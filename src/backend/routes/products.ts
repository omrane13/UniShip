import { Router, Request, Response } from 'express';
import { dbStore, Product, StockRequest } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';

export const productsRouter = Router();

// ==========================================
// 2. MODULE CATALOGUE & CONTRATS & PRODUITS
// ==========================================

productsRouter.get('/products', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  const { category, search, companyId, all } = req.query;

  let list = dbStore.products;

  // Clients can only see ACTIVE products. Admin/Company can see all unless specified
  if (!u || u.role === 'client') {
    list = list.filter(p => p.status === 'active');
  } else if (u && (u.role === 'company' || u.role === 'collaborator') && !all) {
    // By default, companies see only their own products
    list = list.filter(p => p.companyId === getCompanyOwnerId(u));
  }

  // Filter conditions
  if (category) {
    list = list.filter(p => p.category.toLowerCase().includes((category as string).toLowerCase()));
  }
  if (search) {
    const q = (search as string).toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }
  if (companyId) {
    list = list.filter(p => p.companyId === companyId);
  }

  res.json(list);
});

// Propose OR Direct Addition of products
productsRouter.post('/products', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator' && u.role !== 'admin')) {
    res.status(403).json({ error: 'Permissions de création de produits insuffisantes' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas d\'ajouter des produits.' });
    return;
  }

  const { name, description, price, category, image, stock, threshold } = req.body;
  if (!name || !price || !category) {
    res.status(400).json({ error: 'Nom, prix et catégorie requis' });
    return;
  }

  const id = `prod_${Date.now()}`;
  const finalStatus = (u.role === 'admin') ? 'active' : 'pending'; // admin addition auto-active

  const isCompOrCollab = u.role === 'company' || u.role === 'collaborator';
  const ownerId = isCompOrCollab ? getCompanyOwnerId(u) : 'usr_company1';
  const ownerUser = dbStore.users.find(usr => usr.id === ownerId);
  const ownerName = ownerUser ? ownerUser.name : 'EcoShop Bio';
  const ownerColor = ownerUser ? (ownerUser.color || '#10b981') : '#10b981';

  const newProd: Product = {
    id,
    name,
    description: description || '',
    price: Number(price),
    category,
    image: image || 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop',
    stock: Number(stock) || 0,
    threshold: Number(threshold) || 10,
    companyId: ownerId,
    companyName: ownerName,
    companyColor: ownerColor,
    status: finalStatus,
  };

  dbStore.products.push(newProd);
  dbStore.log(u.id, u.name, 'PROPOSE_PRODUCT', `Ajout produit '${name}' avec statut: ${finalStatus}`);
  res.json(newProd);
});

// Update products
productsRouter.put('/products/:id', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Non authentifié' });
    return;
  }

  const prod = dbStore.products.find(p => p.id === req.params['id']);
  if (!prod) {
    res.status(404).json({ error: 'Produit non trouvé' });
    return;
  }

  // Authorize check
  const ownerId = getCompanyOwnerId(u);
  if (u.role !== 'admin' && prod.companyId !== ownerId) {
    res.status(403).json({ error: 'Vous ne possédez pas les droits sur ce produit' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas de modifier des produits.' });
    return;
  }

  const { name, description, price, category, stock, threshold, status, rejectionReason } = req.body;

  if (name) prod.name = name;
  if (description !== undefined) prod.description = description;
  if (price !== undefined) prod.price = Number(price);
  if (category) prod.category = category;
  if (stock !== undefined) prod.stock = Number(stock);
  if (threshold !== undefined) prod.threshold = Number(threshold);
  if (status) prod.status = status;
  if (rejectionReason !== undefined) prod.rejectionReason = rejectionReason;

  dbStore.log(u.id, u.name, 'UPDATE_PRODUCT', `Produit '${prod.name}' mis à jour`);
  res.json(prod);
});

// Delete Product
productsRouter.delete('/products/:id', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Non authentifié' });
    return;
  }

  const idx = dbStore.products.findIndex(p => p.id === req.params['id']);
  if (idx === -1) {
    res.status(404).json({ error: 'Produit non trouvé' });
    return;
  }

  const prod = dbStore.products[idx];
  const ownerId = getCompanyOwnerId(u);
  if (u.role !== 'admin' && prod.companyId !== ownerId) {
    res.status(403).json({ error: 'Permissions non acquises' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas de supprimer des produits.' });
    return;
  }

  dbStore.products.splice(idx, 1);
  dbStore.log(u.id, u.name, 'DELETE_PRODUCT', `Produit '${prod.name}' supprimé`);
  res.json({ success: true, message: 'Produit supprimé avec succès' });
});


// ==========================================
// 3. STORAGE / STOCK REQUESTS
// ==========================================

productsRouter.get('/stock-requests', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification obligatoire' });
    return;
  }

  let list = dbStore.stockRequests;
  if (u.role === 'company' || u.role === 'collaborator') {
    list = list.filter(r => r.companyId === getCompanyOwnerId(u));
  }

  res.json(list);
});

productsRouter.post('/products/:id/stock-request', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator')) {
    res.status(403).json({ error: 'Réservé aux partenaires' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas d\'initier des demandes de stock.' });
    return;
  }

  const prod = dbStore.products.find(p => p.id === req.params['id']);
  if (!prod) {
    res.status(404).json({ error: 'Produit introuvable' });
    return;
  }

  const { quantity, justification } = req.body;
  if (!quantity || !justification) {
    res.status(400).json({ error: 'Veuillez saisir la quantité et la justification' });
    return;
  }

  const ownerId = getCompanyOwnerId(u);
  const ownerUser = dbStore.users.find(usr => usr.id === ownerId);
  const ownerName = ownerUser ? ownerUser.name : u.name;

  const reqObj: StockRequest = {
    id: `req_${Date.now()}`,
    productId: prod.id,
    productName: prod.name,
    companyId: ownerId,
    companyName: ownerName,
    quantity: Number(quantity),
    justification,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  dbStore.stockRequests.push(reqObj);
  dbStore.log(u.id, u.name, 'STOCK_REQUEST', `Demande de +${quantity} pour ${prod.name}`);
  res.json(reqObj);
});

productsRouter.put('/stock-requests/:id', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Administrateur requis' });
    return;
  }

  const reqObj = dbStore.stockRequests.find(r => r.id === req.params['id']);
  if (!reqObj) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const { status } = req.body; // 'approved' or 'rejected'
  reqObj.status = status;

  if (status === 'approved') {
    const prod = dbStore.products.find(p => p.id === reqObj.productId);
    if (prod) {
      prod.stock += reqObj.quantity;
    }
  }

  dbStore.log(u.id, u.name, `STOCK_REQUEST_${status.toUpperCase()}`, `La demande ${reqObj.id} a été ${status}`);
  res.json(reqObj);
});
