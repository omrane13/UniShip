import { Router, Request, Response } from 'express';
import { dbStore, Order, OrderItem } from '../store';
import { getCurrentUser, getCompanyOwnerId, notifyOrderStatusChange } from './helpers';
import { OrderRepository, AuditLogRepository, ProductRepository, DriverRepository } from '../db/repository';

export const ordersRouter = Router();

// ==========================================
// 6. MODULE COMMANDES & PAIEMENT
// ==========================================

ordersRouter.get('/orders', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification requise pour les commandes' });
    return;
  }

  let list = await OrderRepository.getAll();

  if (u.role === 'client') {
    list = list.filter(o => o.clientId === u.id);
  } else if (u.role === 'driver') {
    const drvProfile = await DriverRepository.getByUserId(u.id);
    if (drvProfile) {
      list = list.filter(o => o.driverId === drvProfile.id);
    }
  } else if (u.role === 'company' || u.role === 'collaborator') {
    const ownerId = getCompanyOwnerId(u);
    list = list.filter(o => o.items.some(item => item.companyId === ownerId));
  }

  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

ordersRouter.post('/orders', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'client') {
    res.status(403).json({ error: 'Seul un client peut passer commande' });
    return;
  }

  const { items, deliveryAddress, driverId, driverName, driverFee, paymentMethod } = req.body;

  if (!items || !items.length || !deliveryAddress) {
    res.status(400).json({ error: 'Panier et adresse de livraison requis' });
    return;
  }

  const validatedItems: OrderItem[] = [];
  let subtotal = 0;

  for (const it of items) {
    const fetched = await ProductRepository.getById(it.productId);
    if (!fetched) {
      res.status(404).json({ error: `Produit ${it.productId} n'existe plus` });
      return;
    }
    if (fetched.stock < it.quantity) {
      res.status(400).json({ error: `Rupture de stock pour ${fetched.name}` });
      return;
    }
    // Decrease stock
    await ProductRepository.update(fetched.id, { stock: fetched.stock - it.quantity });
    subtotal += fetched.price * it.quantity;

    validatedItems.push({
      productId: fetched.id,
      productName: fetched.name,
      price: fetched.price,
      quantity: it.quantity,
      companyId: fetched.companyId,
    });
  }

  const total = parseFloat(subtotal.toFixed(2));
  const orderId = `ord_${Date.now()}`;

  const newOrder: Order = {
    id: orderId,
    clientId: u.id,
    clientName: u.name,
    clientEmail: u.email,
    items: validatedItems,
    total,
    deliveryAddress,
    driverId: driverId || '',
    driverName: driverName || "En attente d'attribution",
    driverFee: Number(driverFee) || 0,
    paymentMethod,
    paymentStatus: 'unpaid',
    status: 'pending',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    invoiceUrl: `/api/orders/${orderId}/invoice`,
  };

  await OrderRepository.create(newOrder);
  await AuditLogRepository.log(u.id, u.name, 'PLACE_ORDER', `Création commande ${orderId} — ${total} DTN`);

  res.json({
    message: "Commande confirmée ! En attente d'affectation d'un livreur.",
    order: newOrder
  });
});

// Select Driver for Order (Company action)
ordersRouter.put('/orders/:id/select-driver', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator')) {
    res.status(403).json({ error: "Seule l'entreprise peut assigner un livreur" });
    return;
  }
  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: "Permissions insuffisantes (lecture seule)" });
    return;
  }

  const o = await OrderRepository.getById(req.params['id'] as string);
  if (!o) { res.status(404).json({ error: 'Commande introuvable' }); return; }
  if (o.status !== 'pending') {
    res.status(400).json({ error: "Impossible d'assigner un livreur à une commande non en attente" });
    return;
  }

  const { driverId, driverName, driverFee } = req.body;
  if (!driverId || !driverName) {
    res.status(400).json({ error: 'Livreur requis' });
    return;
  }

  const updated = await OrderRepository.update(o.id, {
    driverId,
    driverName,
    driverFee: Number(driverFee) || 0,
    updatedAt: new Date().toISOString(),
  });

  await AuditLogRepository.log(u.id, u.name, 'SELECT_DRIVER', `Livreur ${driverName} assigné à la commande ${o.id}`);
  res.json(updated || o);
});

// Update order status
ordersRouter.put('/orders/:id/status', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) { res.status(403).json({ error: 'Authentification obligatoire' }); return; }

  const o = await OrderRepository.getById(req.params['id'] as string);
  if (!o) { res.status(404).json({ error: 'Commande introuvable' }); return; }

  const oldStatus = o.status;
  const { status } = req.body;
  const updates: Partial<Order> = { updatedAt: new Date().toISOString() };

  if (u.role === 'client') {
    if (status !== 'cancelled') {
      res.status(403).json({ error: 'Droits insuffisants' }); return;
    }
    if (o.status !== 'pending') {
      res.status(400).json({ error: 'La commande a déjà été acceptée' }); return;
    }
    // Restore stock
    for (const it of o.items) {
      const prod = await ProductRepository.getById(it.productId);
      if (prod) await ProductRepository.update(prod.id, { stock: prod.stock + it.quantity });
    }
    updates.status = 'cancelled';
    updates.paymentStatus = 'refunded';
  }

  else if (u.role === 'driver') {
    const drvProfile = await DriverRepository.getByUserId(u.id);
    if (!drvProfile) { res.status(403).json({ error: 'Profil livreur invalide' }); return; }

    if (['accepted', 'preparing', 'transit', 'delivered'].includes(status)) {
      if (o.driverId !== drvProfile.id) {
        res.status(403).json({ error: "Vous n'êtes pas le livreur désigné" }); return;
      }
      updates.status = status;
      if (status === 'accepted' && o.paymentMethod !== 'cash') updates.paymentStatus = 'paid';
      if (status === 'delivered') {
        updates.paymentStatus = 'paid';
        await DriverRepository.update(drvProfile.id, { status: 'available' });
      } else if (status === 'accepted') {
        await DriverRepository.update(drvProfile.id, { status: 'busy' });
      }
    } else {
      res.status(400).json({ error: 'Action non autorisée pour le livreur' }); return;
    }
  }

  else if (u.role === 'company' || u.role === 'collaborator') {
    if (u.role === 'collaborator' && u.permissions === 'read') {
      res.status(403).json({ error: 'Permissions insuffisantes' }); return;
    }
    const ownerId = getCompanyOwnerId(u);
    if (!o.items.some(it => it.companyId === ownerId)) {
      res.status(403).json({ error: 'Droits insuffisants sur cette commande' }); return;
    }
    if (status === 'preparing') {
      updates.status = 'preparing';
    } else if (status === 'cancelled') {
      if (o.status !== 'pending' && o.status !== 'accepted') {
        res.status(400).json({ error: 'Annulation impossible' }); return;
      }
      for (const it of o.items) {
        const prod = await ProductRepository.getById(it.productId);
        if (prod) await ProductRepository.update(prod.id, { stock: prod.stock + it.quantity });
      }
      updates.status = 'cancelled';
      updates.paymentStatus = 'refunded';
    } else {
      res.status(400).json({ error: 'Action non autorisée' }); return;
    }
  }

  else if (u.role === 'admin') {
    if (status === 'cancelled') {
      for (const it of o.items) {
        const prod = await ProductRepository.getById(it.productId);
        if (prod) await ProductRepository.update(prod.id, { stock: prod.stock + it.quantity });
      }
    }
    updates.status = status;
  }

  const finalOrder = await OrderRepository.update(o.id, updates) || { ...o, ...updates };
  await AuditLogRepository.log(u.id, u.name, `ORDER_${status.toUpperCase()}`, `Statut commande ${o.id} → ${status}`);

  if (oldStatus !== finalOrder.status) {
    await notifyOrderStatusChange(finalOrder as Order, oldStatus, finalOrder.status!);
  }

  res.json(finalOrder);
});

// Invoice download
ordersRouter.get('/orders/:id/invoice', async (req: Request, res: Response): Promise<void> => {
  const o = await OrderRepository.getById(req.params['id'] as string);
  if (!o) { res.status(404).send('Commande introuvable'); return; }

  let invoiceText = `
=========================================
      FACTURE DE LA COMMANDE ${o.id}
=========================================
Date de commande: ${o.createdAt}
Client: ${o.clientName} (${o.clientEmail})
Adresse de livraison: ${o.deliveryAddress}

PRODUITS ACHETÉS :
`;
  o.items.forEach((it, i) => {
    invoiceText += `${i+1}. ${it.productName} - Quantité: ${it.quantity} x ${it.price.toFixed(2)} DTN = ${(it.price * it.quantity).toFixed(2)} DTN\n`;
  });
  invoiceText += `
Frais de Livraison: ${o.driverFee.toFixed(2)} DTN (Livreur: ${o.driverName})
Mode de Paiement: ${o.paymentMethod.toUpperCase()}
Statut de Paiement: ${o.paymentStatus.toUpperCase()}

-----------------------------------------
TOTAL GÉNÉRAL : ${(o.total + o.driverFee).toFixed(2)} DTN
-----------------------------------------
Merci pour votre commande UniShip !
=========================================
`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(invoiceText);
});
