import { Router, Request, Response } from 'express';
import { Product, StockRequest, Category, CategoryRequest } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';
import { ProductRepository, UserRepository, CompanyRepository, StockRequestRepository, AuditLogRepository, CategoryRepository, CategoryRequestRepository } from '../db/repository';

export const productsRouter = Router();

// ==========================================
// 2. MODULE CATALOGUE & CONTRATS & PRODUITS
// ==========================================

productsRouter.get('/products', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  const { category, search, companyId, all } = req.query;

  let list = await ProductRepository.getAll({
    category: category as string,
    search: search as string,
    companyId: companyId as string
  });

  // Clients can only see ACTIVE products. Admin/Company can see all unless specified
  if (!u || u.role === 'client') {
    list = list.filter(p => p.status === 'active');
  } else if (u && (u.role === 'company' || u.role === 'collaborator') && !all) {
    // By default, companies see only their own products
    list = list.filter(p => p.companyId === getCompanyOwnerId(u));
  }

  res.json(list);
});

// Propose OR Direct Addition of products
productsRouter.post('/products', async (req: Request, res: Response): Promise<void> => {
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
  const ownerUser = await CompanyRepository.getById(ownerId) || await UserRepository.getById(ownerId);
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

  await ProductRepository.create(newProd);
  await AuditLogRepository.log(u.id, u.name, 'PROPOSE_PRODUCT', `Ajout produit '${name}' avec statut: ${finalStatus}`);
  res.json(newProd);
});

// Update products
productsRouter.put('/products/:id', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Non authentifié' });
    return;
  }

  const prod = await ProductRepository.getById(req.params['id'] as string);
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

  await ProductRepository.update(prod.id, prod);
  await AuditLogRepository.log(u.id, u.name, 'UPDATE_PRODUCT', `Produit '${prod.name}' mis à jour`);
  res.json(prod);
});

// Delete Product
productsRouter.delete('/products/:id', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Non authentifié' });
    return;
  }

  const prod = await ProductRepository.getById(req.params['id'] as string);
  if (!prod) {
    res.status(404).json({ error: 'Produit non trouvé' });
    return;
  }

  const ownerId = getCompanyOwnerId(u);
  if (u.role !== 'admin' && prod.companyId !== ownerId) {
    res.status(403).json({ error: 'Permissions non acquises' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas de supprimer des produits.' });
    return;
  }

  await ProductRepository.delete(req.params['id'] as string);
  await AuditLogRepository.log(u.id, u.name, 'DELETE_PRODUCT', `Produit '${prod.name}' supprimé`);
  res.json({ success: true, message: 'Produit supprimé avec succès' });
});


// ==========================================
// 3. STORAGE / STOCK REQUESTS
// ==========================================

productsRouter.get('/stock-requests', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification obligatoire' });
    return;
  }

  let list = await StockRequestRepository.getAll();
  if (u.role === 'company' || u.role === 'collaborator') {
    list = list.filter(r => r.companyId === getCompanyOwnerId(u));
  }

  res.json(list);
});

productsRouter.post('/products/:id/stock-request', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator')) {
    res.status(403).json({ error: 'Réservé aux partenaires' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Vos permissions de collaborateur (Lecture seule) ne vous permettent pas d\'initier des demandes de stock.' });
    return;
  }

  const prod = await ProductRepository.getById(req.params['id'] as string);
  if (!prod) {
    res.status(404).json({ error: 'Produit introuvable' });
    return;
  }

  const { quantity, justification, requestedPrice } = req.body;
  if (!quantity || !justification) {
    res.status(400).json({ error: 'Veuillez saisir la quantité et la justification' });
    return;
  }

  // Validate requestedPrice if provided
  if (requestedPrice !== undefined && (isNaN(Number(requestedPrice)) || Number(requestedPrice) <= 0)) {
    res.status(400).json({ error: 'Le prix demandé doit être un nombre positif.' });
    return;
  }

  const ownerId = getCompanyOwnerId(u);
  const ownerUser = await CompanyRepository.getById(ownerId) || await UserRepository.getById(ownerId);
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
    currentPrice: prod.price,
    ...(requestedPrice !== undefined && { requestedPrice: Number(requestedPrice) }),
  };

  await StockRequestRepository.create(reqObj);
  const priceNote = requestedPrice ? ` + demande de prix à ${Number(requestedPrice).toFixed(2)} DTN` : '';
  await AuditLogRepository.log(u.id, u.name, 'STOCK_REQUEST', `Demande de +${quantity} pour ${prod.name}${priceNote}`);
  res.json(reqObj);
});

productsRouter.put('/stock-requests/:id', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Administrateur requis' });
    return;
  }

  const reqObj = await StockRequestRepository.getById(req.params['id'] as string);
  if (!reqObj) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const { status } = req.body; // 'approved' or 'rejected'
  const updatedReq = await StockRequestRepository.update(reqObj.id, { status }) || reqObj;

  if (status === 'approved') {
    const prod = await ProductRepository.getById(reqObj.productId);
    if (prod) {
      const updates: Partial<{ stock: number; price: number }> = { stock: prod.stock + reqObj.quantity };
      // Also apply price change if requested
      if (reqObj.requestedPrice && reqObj.requestedPrice > 0) {
        updates.price = reqObj.requestedPrice;
      }
      await ProductRepository.update(prod.id, updates);
    }
  }

  const priceNote = reqObj.requestedPrice ? ` (prix mis à jour : ${reqObj.requestedPrice} DTN)` : '';
  await AuditLogRepository.log(u.id, u.name, `STOCK_REQUEST_${status.toUpperCase()}`, `La demande ${reqObj.id} a été ${status}${priceNote}`);
  res.json(updatedReq);
});

// ==========================================
// CATEGORY ENDPOINTS
// ==========================================

// Get all approved categories
productsRouter.get('/categories', async (req: Request, res: Response): Promise<void> => {
  const list = await CategoryRepository.getAll();
  res.json(list);
});

// Get all category requests
productsRouter.get('/categories/requests', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification obligatoire' });
    return;
  }
  let list = await CategoryRequestRepository.getAll();
  if (u.role === 'company' || u.role === 'collaborator') {
    list = list.filter(r => r.companyId === getCompanyOwnerId(u));
  }
  res.json(list);
});

// Submit a new category request
productsRouter.post('/categories/request', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'collaborator')) {
    res.status(403).json({ error: 'Seules les entreprises partenaires peuvent proposer une catégorie' });
    return;
  }

  if (u.role === 'collaborator' && u.permissions === 'read') {
    res.status(403).json({ error: 'Permissions de collaborateur insuffisantes (Lecture seule)' });
    return;
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Le nom de la catégorie est requis' });
    return;
  }

  const cleanName = name.trim();

  // Check if it already exists in approved categories
  const approved = await CategoryRepository.getAll();
  if (approved.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
    res.status(400).json({ error: 'Cette catégorie existe déjà dans le catalogue.' });
    return;
  }

  // Check if it's already pending in requests
  const requests = await CategoryRequestRepository.getAll();
  if (requests.some(r => r.name.toLowerCase() === cleanName.toLowerCase() && r.status === 'pending')) {
    res.status(400).json({ error: 'Une demande pour cette catégorie est déjà en attente de validation.' });
    return;
  }

  const ownerId = getCompanyOwnerId(u);
  const ownerUser = await CompanyRepository.getById(ownerId) || await UserRepository.getById(ownerId);
  const ownerName = ownerUser ? ownerUser.name : u.name;

  const reqObj: CategoryRequest = {
    id: `catreq_${Date.now()}`,
    name: cleanName,
    companyId: ownerId,
    companyName: ownerName,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  await CategoryRequestRepository.create(reqObj);
  await AuditLogRepository.log(u.id, u.name, 'CATEGORY_REQUEST', `Propose la catégorie : '${cleanName}'`);
  res.json(reqObj);
});

// Admin decides on category requests
productsRouter.put('/categories/requests/:id', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Administrateur requis' });
    return;
  }

  const reqObj = await CategoryRequestRepository.getById(req.params['id'] as string);
  if (!reqObj) {
    res.status(404).json({ error: 'Demande introuvable' });
    return;
  }

  const { status } = req.body; // 'approved' or 'rejected'
  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ error: 'Statut invalide' });
    return;
  }

  const updatedReq = await CategoryRequestRepository.update(reqObj.id, { status }) || reqObj;

  if (status === 'approved') {
    const categories = await CategoryRepository.getAll();
    if (!categories.some(c => c.name.toLowerCase() === reqObj.name.toLowerCase())) {
      await CategoryRepository.create({
        id: `cat_${Date.now()}`,
        name: reqObj.name,
        createdAt: new Date().toISOString()
      });
    }
  }

  await AuditLogRepository.log(u.id, u.name, `CATEGORY_REQUEST_${status.toUpperCase()}`, `La demande de catégorie '${reqObj.name}' a été ${status}`);
  res.json(updatedReq);
});
