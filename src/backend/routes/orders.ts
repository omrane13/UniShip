import { Router, Request, Response } from 'express';
import { dbStore, Order, OrderItem } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';

export const ordersRouter = Router();

// ==========================================
// 6. MODULE COMMANDES & PAIEMENT
// ==========================================

ordersRouter.get('/orders', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification requise pour les commandes' });
    return;
  }

  let list = dbStore.orders;

  if (u.role === 'client') {
    list = list.filter(o => o.clientId === u.id);
  } else if (u.role === 'driver') {
    // Return all orders where they are assigned, so they can accept or fulfill it
    const drvProfile = dbStore.drivers.find(d => d.userId === u.id);
    if (drvProfile) {
      list = list.filter(o => o.driverId === drvProfile.id);
    }
  } else if (u.role === 'company' || u.role === 'collaborator') {
    // Companies and collaborators only see orders containing at least one product of their own
    const ownerId = getCompanyOwnerId(u);
    list = list.filter(o => o.items.some(item => item.companyId === ownerId));
  }

  // Sort by newest
  list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  res.json(list);
});

ordersRouter.post('/orders', (req: Request, res: Response): void => {
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

  // Validate and subtract stock
  const validatedItems: OrderItem[] = [];
  let subtotal = 0;

  for (const it of items) {
    const fetched = dbStore.products.find(p => p.id === it.productId);
    if (!fetched) {
      res.status(404).json({ error: `Produit ${it.productId} n’existe plus` });
      return;
    }
    if (fetched.stock < it.quantity) {
      res.status(400).json({ error: `Rupture de stock pour ${fetched.name}` });
      return;
    }
    fetched.stock -= it.quantity; // reserve stock
    subtotal += fetched.price * it.quantity;

    validatedItems.push({
      productId: fetched.id,
      productName: fetched.name,
      price: fetched.price,
      quantity: it.quantity,
      companyId: fetched.companyId,
    });
  }

  const total = parseFloat((subtotal).toFixed(2));
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
    driverName: driverName || 'En attente d\'attribution',
    driverFee: Number(driverFee) || 0,
    paymentMethod,
    paymentStatus: 'unpaid', // Step 03/10: captures later after driver acceptance
    status: 'pending',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    invoiceUrl: `/api/orders/${orderId}/invoice`,
  };

  dbStore.orders.push(newOrder);
  dbStore.log(u.id, u.name, 'PLACE_ORDER', `Création commande ${orderId} d’un montant de ${total} DTN`);

  res.json({
    message: 'Commande confirmée avec succès ! En attente d\'affectation d\'un livreur par l’entreprise.',
    order: newOrder
  });
});

// Select Driver for Order (Step 06 - Company action)
ordersRouter.put('/orders/:id/select-driver', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator')) {
    res.status(403).json({ error: 'Seule l’entreprise ou un collaborateur autorisé peut assigner un livreur' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas d\'assigner de livreur.' });
    return;
  }

  const o = dbStore.orders.find(ord => ord.id === req.params['id']);
  if (!o) {
    res.status(404).json({ error: 'Commande introuvable' });
    return;
  }

  if (o.status !== 'pending') {
    res.status(400).json({ error: 'Impossible d’assigner un livreur à une commande non en attente' });
    return;
  }

  const { driverId, driverName, driverFee } = req.body;
  if (!driverId || !driverName) {
    res.status(400).json({ error: 'Livreur requis pour l’assignation' });
    return;
  }

  // Update order with driver info
  o.driverId = driverId;
  o.driverName = driverName;
  o.driverFee = Number(driverFee) || 0;
  o.updatedAt = new Date().toISOString();

  dbStore.log(u.id, u.name, 'SELECT_DRIVER', `L'entreprise a sélectionné le livreur ${driverName} pour la commande ${o.id}`);
  res.json(o);
});

// Update order status
ordersRouter.put('/orders/:id/status', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification obligatoire' });
    return;
  }

  const o = dbStore.orders.find(ord => ord.id === req.params['id']);
  if (!o) {
    res.status(404).json({ error: 'Commande introuvable' });
    return;
  }

  const { status } = req.body; // pending, accepted, preparing, transit, delivered, cancelled

  // Rights validation
  // Clients can cancel if status is still pending
  if (u.role === 'client') {
    if (status === 'cancelled') {
      if (o.status !== 'pending') {
        res.status(400).json({ error: 'La commande a déjà été acceptée et ne peut plus être annulée' });
        return;
      }
      // Return stocks
      o.items.forEach(it => {
        const prod = dbStore.products.find(p => p.id === it.productId);
        if (prod) prod.stock += it.quantity;
      });
      o.status = 'cancelled';
      o.paymentStatus = 'refunded';
    } else {
      res.status(403).json({ error: 'Vous ne possédez pas les droits requis pour ce changement de statut' });
      return;
    }
  } 
  
  // Deliverer accepts, picks up or delivers
  else if (u.role === 'driver') {
    const drvProfile = dbStore.drivers.find(d => d.userId === u.id);
    if (!drvProfile) {
      res.status(403).json({ error: 'Profil de livreur invalide' });
      return;
    }

    if (status === 'accepted') {
      if (o.driverId !== drvProfile.id) {
        res.status(403).json({ error: 'Vous n’êtes pas le livreur sélectionné par l’entreprise pour cette commande' });
        return;
      }
      o.status = 'accepted';
      // Step 10: Capture payment if not cash
      if (o.paymentMethod !== 'cash') {
        o.paymentStatus = 'paid';
      }
      drvProfile.status = 'busy';
    } else if (status === 'preparing') {
      // Step 11: Driver retrieves products from company
      if (o.driverId !== drvProfile.id) {
        res.status(403).json({ error: 'Vous n’êtes pas le livreur désigné' });
        return;
      }
      o.status = 'preparing';
    } else if (status === 'transit') {
      if (o.driverId !== drvProfile.id) {
        res.status(403).json({ error: 'Vous n’êtes pas le livreur désigné' });
        return;
      }
      o.status = 'transit';
    } else if (status === 'delivered') {
      if (o.driverId !== drvProfile.id) {
        res.status(403).json({ error: 'Vous n’êtes pas le livreur' });
        return;
      }
      o.status = 'delivered';
      o.paymentStatus = 'paid'; // Cash on delivery is now paid
      drvProfile.status = 'available';
    } else {
      res.status(400).json({ error: 'Action non autorisée pour le livreur' });
      return;
    }
  } 
  
  // Company prepares
  else if (u.role === 'company' || u.role === 'collaborator') {
    if (u.role === 'collaborator' && u.permissions === 'read') {
      res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas de modifier le statut de la commande.' });
      return;
    }

    const ownerId = getCompanyOwnerId(u);
    const hasCompanyItem = o.items.some(item => item.companyId === ownerId);
    if (!hasCompanyItem) {
      res.status(403).json({ error: 'Vous ne possédez pas les droits requis pour modifier le statut de cette commande' });
      return;
    }

    if (status === 'preparing') {
      o.status = 'preparing';
    } else if (status === 'cancelled') {
      // Allow company/collaborator to cancel order if it is pending and no driver was accepted yet
      if (o.status !== 'pending' && o.status !== 'accepted') {
        res.status(400).json({ error: 'Vous ne pouvez plus annuler cette commande' });
        return;
      }
      o.items.forEach(it => {
        const prod = dbStore.products.find(p => p.id === it.productId);
        if (prod) prod.stock += it.quantity;
      });
      o.status = 'cancelled';
      o.paymentStatus = 'refunded';
    } else {
      res.status(400).json({ error: 'Action non autorisée' });
      return;
    }
  } 

  // Admin has total rights
  else if (u.role === 'admin') {
    if (status === 'cancelled') {
      o.items.forEach(it => {
        const prod = dbStore.products.find(p => p.id === it.productId);
        if (prod) prod.stock += it.quantity;
      });
    }
    o.status = status;
  }

  o.updatedAt = new Date().toISOString();
  dbStore.log(u.id, u.name, `ORDER_${status.toUpperCase()}`, `Mise à jour statut commande ${o.id} -> ${status}`);
  res.json(o);
});

// Mock Invoice download
ordersRouter.get('/orders/:id/invoice', (req: Request, res: Response): void => {
  const o = dbStore.orders.find(ord => ord.id === req.params['id']);
  if (!o) {
    res.status(404).send('Commande introuvable');
    return;
  }

  // Generate plain text simulation of an invoice
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
Merci pour votre commande sur notre plateforme !
=========================================
`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(invoiceText);
});
