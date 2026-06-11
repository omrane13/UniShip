import { Router, Request, Response } from 'express';
import { dbStore, User, Product, Order, OrderItem, SupportTicket, Offer, StockRequest, SubAccount } from './store';

export const apiRouter = Router();

// Helper to check standard tokens or custom header for simulating session roles
function getCurrentUser(req: Request): User | undefined {
  const userId = req.headers['x-user-id'] || 'usr_client1'; // default backup
  const u = dbStore.users.find(u => u.id === userId);
  if (u && u.role === 'driver') {
    const drv = dbStore.drivers.find(d => d.userId === u.id);
    if (drv) {
      u.baseFee = drv.baseFee;
      u.perKmFee = drv.perKmFee;
      u.zone = drv.zone;
      u.driverStatus = drv.status;
      u.photo = drv.photo;
      u.rating = drv.rating;
    }
  }
  return u;
}

// ==========================================
// 1. MODULE AUTHENTICATION & ACCESS
// ==========================================

// Login simulation
apiRouter.post('/auth/login', (req: Request, res: Response): void => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email obligatoire' });
    return;
  }

  // Find user by email
  const user = dbStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    res.status(401).json({ error: 'Identifiants incorrects ou compte inexistant' });
    return;
  }

  if (user.status === 'pending') {
    res.status(403).json({ error: 'Votre compte est en attente d’activation par un Administrateur.' });
    return;
  }

  if (user.status === 'inactive') {
    res.status(403).json({ error: 'Votre compte a été désactivé par un Administrateur.' });
    return;
  }

  dbStore.log(user.id, user.name, 'LOGIN', 'Connexion réussie à la plateforme');
  res.json({ token: 'mock-jwt-token-xyz', user });
});

// Register simulation
apiRouter.post('/auth/register', (req: Request, res: Response): void => {
  const { name, email, role, phone, address, companyColor } = req.body;

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Informations obligatoires manquantes' });
    return;
  }

  const existing = dbStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    res.status(400).json({ error: 'Cet email est déjà enregistré' });
    return;
  }

  // Auto-activate client accounts, companies and drivers need validation
  const status = (role === 'client') ? 'active' : 'pending';
  const id = `usr_${role}_${Date.now()}`;

  const newUser: User = {
    id,
    name,
    email,
    role,
    status,
    phone,
    address,
  };

  // Companies get assigned color
  if (role === 'company') {
    const selectedColor = companyColor || '#10b981';
    if (!/^#[0-9A-Fa-f]{6}$/.test(selectedColor)) {
      res.status(400).json({ error: 'Format de couleur invalide. Utilisez le format hexadécimal #RRGGBB.' });
      return;
    }
    // Check if color is already used by an active company
    const conflict = dbStore.users.find(u => 
      u.role === 'company' && 
      u.status === 'active' && 
      u.color && u.color.toLowerCase() === selectedColor.toLowerCase()
    );
    if (conflict) {
      res.status(409).json({ error: `Cette couleur est déjà utilisée par ${conflict.name}` });
      return;
    }
    newUser.color = selectedColor;
    newUser.logo = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&h=80&fit=crop';
  }

  dbStore.users.push(newUser);

  // If driver registered, add metadata too
  if (role === 'driver') {
    dbStore.drivers.push({
      id: `drv_${Date.now()}`,
      userId: id,
      name,
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      rating: 5.0,
      status: 'offline', // default
      baseFee: 2.50,
      perKmFee: 0.80,
      zone: address || 'Paris Centre',
    });
  }

  dbStore.log(id, name, 'REGISTER', `Création de compte avec statut: ${status}`);

  res.json({
    message: role === 'client' 
      ? 'Compte créé avec succès ! Un email de vérification a été simulé.' 
      : 'Compte enregistré ! En attente de validation préalable par l’Administrateur.',
    user: newUser
  });
});

// Company sub-account support
apiRouter.get('/auth/subaccounts', (req: Request, res: Response): void => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'company') {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const list = dbStore.subAccounts.filter(s => s.companyId === user.id);
  res.json(list);
});

apiRouter.post('/auth/subaccounts', (req: Request, res: Response): void => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'company') {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const { name, email, pRole, permissions } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'Nom et email obligatoires' });
    return;
  }

  // LIMIT 5 COLLABORATORS CHECK
  const currentSubs = dbStore.subAccounts.filter(s => s.companyId === user.id);
  if (currentSubs.length >= 5) {
    res.status(400).json({ error: `La limite de 5 collaborateurs est atteinte pour cette entreprise. Vous avez déjà ${currentSubs.length} collaborateurs.` });
    return;
  }

  const sub: SubAccount = {
    id: `sub_${Date.now()}`,
    companyId: user.id,
    name,
    email,
    role: pRole || 'Employé',
    permissions: permissions || 'read',
    status: 'pending', // Starts pending activation by Admin
  };

  dbStore.subAccounts.push(sub);
  dbStore.log(user.id, user.name, 'CREATE_SUBACCOUNT', `Création sous-compte (collaborateur): ${name}`);
  res.json(sub);
});

// List users for Admin
apiRouter.get('/users', (req: Request, res: Response): void => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint à l’Administrateur' });
    return;
  }

  const { role, status } = req.query;
  
  // 1. Get standard users
  const list: User[] = dbStore.users.map(u => ({ ...u }));

  // 2. Fetch and map subaccounts (collaborators) so the Admin can view & activate them!
  const subList: User[] = dbStore.subAccounts.map(s => {
    const parentCompany = dbStore.users.find(u => u.id === s.companyId);
    const compName = parentCompany ? parentCompany.name : 'Inconnu';
    return {
      id: s.id,
      name: `${s.name} (Poste : ${s.role})`,
      email: s.email,
      role: 'collaborator',
      status: s.status || 'pending',
      phone: `Entreprise : ${compName}`,
      address: `Permissions : ${s.permissions}`,
      companyId: s.companyId
    };
  });

  let fullList = [...list, ...subList];

  if (role) {
    fullList = fullList.filter(u => u.role === role);
  }
  if (status) {
    fullList = fullList.filter(u => u.status === status);
  }

  res.json(fullList);
});

// Update User (Admin role updates, activation, colors)
apiRouter.put('/users/:id', (req: Request, res: Response): void => {
  const adminUser = getCurrentUser(req);
  if (!adminUser || adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint' });
    return;
  }

  const targetUser = dbStore.users.find(u => u.id === req.params['id']);
  if (!targetUser) {
    const targetSub = dbStore.subAccounts.find(s => s.id === req.params['id']);
    if (targetSub) {
      const { status } = req.body;
      if (status) {
        targetSub.status = status;
        dbStore.log(adminUser.id, adminUser.name, 'UPDATE_SUBACCOUNT_STATUS', `Mise à jour du collaborateur ${targetSub.name} vers le statut ${status}`);
        res.json({
          id: targetSub.id,
          name: targetSub.name,
          email: targetSub.email,
          role: 'collaborator',
          status: targetSub.status,
          companyId: targetSub.companyId
        });
        return;
      }
    }
    res.status(404).json({ error: 'Utilisateur non trouvé' });
    return;
  }

  const { role, status, color, name, phone, address,
          planId, billingCycle, paymentMethod, referralCode, referredByCode, isVerifiedPartner,
          cancellationRate, averageRating, suspended, entryFeePaid, inactivityDays,
          paymentDelayDays, nonConformingWarningsCount, monthlyOrdersCount } = req.body;

  if (color && targetUser.role === 'company') {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      res.status(400).json({ error: 'Format de couleur invalide (ex: #FFAA00).' });
      return;
    }
    const targetStatus = status || targetUser.status;
    if (targetStatus === 'active') {
      const conflict = dbStore.users.find(u => 
        u.role === 'company' && 
        u.status === 'active' && 
        u.id !== targetUser.id && 
        u.color && u.color.toLowerCase() === color.toLowerCase()
      );
      if (conflict) {
        res.status(409).json({ error: `Cette couleur est déjà utilisée par ${conflict.name}` });
        return;
      }
    }
  }

  if (status === 'active' && targetUser.role === 'company') {
    const colorToCheck = color || targetUser.color;
    if (colorToCheck) {
      const conflict = dbStore.users.find(u => 
        u.role === 'company' && 
        u.status === 'active' && 
        u.id !== targetUser.id && 
        u.color && u.color.toLowerCase() === colorToCheck.toLowerCase()
      );
      if (conflict) {
        res.status(409).json({ error: `Cette couleur est déjà utilisée par ${conflict.name}` });
        return;
      }
    }
  }

  if (role) targetUser.role = role;
  if (status) {
    targetUser.status = status;
    // If driver status gets marked inactive, mark their driver profile offline
    if (targetUser.role === 'driver') {
      const drv = dbStore.drivers.find(d => d.userId === targetUser.id);
      if (drv) drv.status = status === 'active' ? 'available' : 'offline';
    }
  }
  if (color && targetUser.role === 'company') targetUser.color = color;
  if (name) targetUser.name = name;
  if (phone) targetUser.phone = phone;
  if (address) targetUser.address = address;

  if (targetUser.role === 'company') {
    if (planId !== undefined) targetUser.planId = planId;
    if (billingCycle !== undefined) targetUser.billingCycle = billingCycle;
    if (paymentMethod !== undefined) targetUser.paymentMethod = paymentMethod;
    if (referralCode !== undefined) targetUser.referralCode = referralCode;
    if (referredByCode !== undefined) targetUser.referredByCode = referredByCode;
    if (isVerifiedPartner !== undefined) targetUser.isVerifiedPartner = !!isVerifiedPartner;
    if (cancellationRate !== undefined) targetUser.cancellationRate = Number(cancellationRate);
    if (averageRating !== undefined) targetUser.averageRating = Number(averageRating);
    if (suspended !== undefined) targetUser.suspended = !!suspended;
    if (entryFeePaid !== undefined) targetUser.entryFeePaid = !!entryFeePaid;
    if (inactivityDays !== undefined) targetUser.inactivityDays = Number(inactivityDays);
    if (paymentDelayDays !== undefined) targetUser.paymentDelayDays = Number(paymentDelayDays);
    if (nonConformingWarningsCount !== undefined) targetUser.nonConformingWarningsCount = Number(nonConformingWarningsCount);
    if (monthlyOrdersCount !== undefined) targetUser.monthlyOrdersCount = Number(monthlyOrdersCount);
  };
  if (address) targetUser.address = address;

  // Track product updates with changed company color
  if (color && targetUser.role === 'company') {
    dbStore.products.forEach(p => {
      if (p.companyId === targetUser.id) p.companyColor = color;
    });
    // Invalidate simulated Redis cache for company products
    console.log(`[Redis Cache] Invalidated cache for products of company '${targetUser.name}' (${targetUser.id}) after color change to ${color}`);
  }

  dbStore.log(adminUser.id, adminUser.name, 'UPDATE_USER', `Mise à jour de l'utilisateur ${targetUser.name} (${targetUser.id})`);
  res.json(targetUser);
});

// Update logged in user's profile self-care
apiRouter.put('/profile', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    return;
  }

  const { name, email, phone, address, logo, baseFee, perKmFee, zone, driverStatus, photo,
          planId, billingCycle, paymentMethod, referralCode, referredByCode, isVerifiedPartner,
          cancellationRate, averageRating, suspended, entryFeePaid, inactivityDays,
          paymentDelayDays, nonConformingWarningsCount, monthlyOrdersCount } = req.body;

  // Validate or enforce email uniqueness if it's being modified
  if (email && email.toLowerCase() !== u.email.toLowerCase()) {
    const emailConflict = dbStore.users.find(usr => usr.email.toLowerCase() === email.toLowerCase() && usr.id !== u.id);
    if (emailConflict) {
      res.status(400).json({ error: 'Cette adresse email est déjà utilisée.' });
      return;
    }
    u.email = email;
  }

  // Modify generic User fields
  if (name !== undefined) u.name = name;
  if (phone !== undefined) u.phone = phone;
  if (address !== undefined) u.address = address;
  if (logo !== undefined && u.role === 'company') u.logo = logo;

  // Subscriptions & Tunisia specific fields (if company)
  if (u.role === 'company') {
    if (planId !== undefined) u.planId = planId;
    if (billingCycle !== undefined) u.billingCycle = billingCycle;
    if (paymentMethod !== undefined) u.paymentMethod = paymentMethod;
    if (referralCode !== undefined) u.referralCode = referralCode;
    if (referredByCode !== undefined) u.referredByCode = referredByCode;
    if (isVerifiedPartner !== undefined) u.isVerifiedPartner = !!isVerifiedPartner;
    if (cancellationRate !== undefined) u.cancellationRate = Number(cancellationRate);
    if (averageRating !== undefined) u.averageRating = Number(averageRating);
    if (suspended !== undefined) u.suspended = !!suspended;
    if (entryFeePaid !== undefined) u.entryFeePaid = !!entryFeePaid;
    if (inactivityDays !== undefined) u.inactivityDays = Number(inactivityDays);
    if (paymentDelayDays !== undefined) u.paymentDelayDays = Number(paymentDelayDays);
    if (nonConformingWarningsCount !== undefined) u.nonConformingWarningsCount = Number(nonConformingWarningsCount);
    if (monthlyOrdersCount !== undefined) u.monthlyOrdersCount = Number(monthlyOrdersCount);
  }

  // Special Driver profile sync
  if (u.role === 'driver') {
    const drv = dbStore.drivers.find(d => d.userId === u.id);
    if (drv) {
      if (name !== undefined) drv.name = name;
      if (baseFee !== undefined) drv.baseFee = Number(baseFee);
      if (perKmFee !== undefined) drv.perKmFee = Number(perKmFee);
      if (zone !== undefined) drv.zone = zone;
      if (driverStatus !== undefined) {
        drv.status = driverStatus;
        u.driverStatus = driverStatus;
      }
      if (photo !== undefined) drv.photo = photo;
    }
  }

  dbStore.log(u.id, u.name, 'UPDATE_PROFILE', `Mise à jour du profil personnel (Rôle: ${u.role})`);
  
  // Re-fetch decorated user to return updated status/driver attributes
  const updatedUser = dbStore.users.find(usr => usr.id === u.id) || u;
  if (updatedUser.role === 'driver') {
    const drv = dbStore.drivers.find(d => d.userId === updatedUser.id);
    if (drv) {
      updatedUser.baseFee = drv.baseFee;
      updatedUser.perKmFee = drv.perKmFee;
      updatedUser.zone = drv.zone;
      updatedUser.driverStatus = drv.status;
      updatedUser.photo = drv.photo;
      updatedUser.rating = drv.rating;
    }
  }

  res.json({ message: 'Profil mis à jour avec succès', user: updatedUser });
});


// ==========================================
// 2. MODULE CATALOGUE & CONTRATS & PRODUITS
// ==========================================

apiRouter.get('/products', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  const { category, search, companyId, all } = req.query;

  let list = dbStore.products;

  // Clients can only see ACTIVE products. Admin/Company can see all unless specified
  if (!u || u.role === 'client') {
    list = list.filter(p => p.status === 'active');
  } else if (u && u.role === 'company' && !all) {
    // By default, companies see only their own products
    list = list.filter(p => p.companyId === u.id);
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
apiRouter.post('/products', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || (u.role !== 'company' && u.role !== 'admin')) {
    res.status(403).json({ error: 'Permissions de création de produits insuffisantes' });
    return;
  }

  const { name, description, price, category, image, stock, threshold } = req.body;
  if (!name || !price || !category) {
    res.status(400).json({ error: 'Nom, prix et catégorie requis' });
    return;
  }

  const id = `prod_${Date.now()}`;
  const finalStatus = (u.role === 'admin') ? 'active' : 'pending'; // admin addition auto-active

  const newProd: Product = {
    id,
    name,
    description: description || '',
    price: Number(price),
    category,
    image: image || 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop',
    stock: Number(stock) || 0,
    threshold: Number(threshold) || 10,
    companyId: u.role === 'company' ? u.id : 'usr_company1', // fallback to default test company in admin mode
    companyName: u.role === 'company' ? u.name : 'EcoShop Bio',
    companyColor: u.role === 'company' ? (u.color || '#10b981') : '#10b981',
    status: finalStatus,
  };

  dbStore.products.push(newProd);
  dbStore.log(u.id, u.name, 'PROPOSE_PRODUCT', `Ajout produit '${name}' avec statut: ${finalStatus}`);
  res.json(newProd);
});

// Update products
apiRouter.put('/products/:id', (req: Request, res: Response): void => {
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
  if (u.role !== 'admin' && prod.companyId !== u.id) {
    res.status(403).json({ error: 'Vous ne possédez pas les droits sur ce produit' });
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
apiRouter.delete('/products/:id', (req: Request, res: Response): void => {
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
  if (u.role !== 'admin' && prod.companyId !== u.id) {
    res.status(403).json({ error: 'Permissions non acquises' });
    return;
  }

  dbStore.products.splice(idx, 1);
  dbStore.log(u.id, u.name, 'DELETE_PRODUCT', `Produit '${prod.name}' supprimé`);
  res.json({ success: true, message: 'Produit supprimé avec succès' });
});


// ==========================================
// 3. STORAGE / STOCK REQUESTS
// ==========================================

apiRouter.get('/stock-requests', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Authentification obligatoire' });
    return;
  }

  let list = dbStore.stockRequests;
  if (u.role === 'company') {
    list = list.filter(r => r.companyId === u.id);
  }

  res.json(list);
});

apiRouter.post('/products/:id/stock-request', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'company') {
    res.status(403).json({ error: 'Réservé aux partenaires' });
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

  const reqObj: StockRequest = {
    id: `req_${Date.now()}`,
    productId: prod.id,
    productName: prod.name,
    companyId: u.id,
    companyName: u.name,
    quantity: Number(quantity),
    justification,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  dbStore.stockRequests.push(reqObj);
  dbStore.log(u.id, u.name, 'STOCK_REQUEST', `Demande de +${quantity} pour ${prod.name}`);
  res.json(reqObj);
});

apiRouter.put('/stock-requests/:id', (req: Request, res: Response): void => {
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


// ==========================================
// 4. MODULE OFFRES TARIFFAIRE
// ==========================================

apiRouter.get('/offers', (req: Request, res: Response): void => {
  res.json(dbStore.offers);
});

apiRouter.post('/offers', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const { title, description, commissionRate, entryFee, targetCompanyId } = req.body;
  if (!title || commissionRate === undefined) {
    res.status(400).json({ error: 'Titre de l’offre et commission nécessaires' });
    return;
  }

  const offer: Offer = {
    id: `off_${Date.now()}`,
    title,
    description: description || '',
    commissionRate: Number(commissionRate),
    entryFee: Number(entryFee) || 0,
    targetCompanyId,
    createdAt: new Date().toISOString(),
  };

  dbStore.offers.push(offer);
  dbStore.log(u.id, u.name, 'CREATE_OFFER', `Publication de l’offretarifaire '${title}'`);
  res.json(offer);
});

apiRouter.delete('/offers/:id', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const idx = dbStore.offers.findIndex(o => o.id === req.params['id']);
  if (idx !== -1) {
    dbStore.offers.splice(idx, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Offre non trouvée' });
  }
});


// ==========================================
// 5. MODULE LIVRISON & GÉOLOCALISATION
// ==========================================

apiRouter.get('/drivers', (req: Request, res: Response): void => {
  // Simulating rating / calculation with optional client geolocation query params
  const list = dbStore.drivers.map(drv => {
    // Generate simulated distance (e.g., between 0.5km and 8.5km)
    const simulatedDist = parseFloat((Math.random() * 8 + 0.5).toFixed(1));
    const calculatedFee = parseFloat((drv.baseFee + simulatedDist * drv.perKmFee).toFixed(2));
    const durationMin = Math.round(simulatedDist * 3 + 4);

    return {
      ...drv,
      distanceKm: simulatedDist,
      calculatedFee,
      estimatedMinutes: durationMin
    };
  });

  res.json(list);
});

apiRouter.put('/drivers/status', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'driver') {
    res.status(403).json({ error: 'Réservé aux livreurs' });
    return;
  }

  const { status } = req.body; // 'available', 'busy', 'offline'
  const drv = dbStore.drivers.find(d => d.userId === u.id);
  if (drv) {
    drv.status = status;
    dbStore.log(u.id, u.name, 'DRIVER_STATUS', `Status modifié en : ${status}`);
    res.json(drv);
  } else {
    res.status(404).json({ error: 'Profil livreur inexistant' });
  }
});


// ==========================================
// 6. MODULE COMMANDES & PAIEMENT
// ==========================================

apiRouter.get('/orders', (req: Request, res: Response): void => {
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
  } else if (u.role === 'company') {
    // Companies only see orders containing at least one product of their own
    list = list.filter(o => o.items.some(item => item.companyId === u.id));
  }

  // Sort by newest
  list.sort((a,b) => b.createdAt.localeCompare(a.createdAt));

  res.json(list);
});

apiRouter.post('/orders', (req: Request, res: Response): void => {
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
apiRouter.put('/orders/:id/select-driver', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'company') {
    res.status(403).json({ error: 'Seule l’entreprise peut assigner un livreur' });
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
apiRouter.put('/orders/:id/status', (req: Request, res: Response): void => {
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
  else if (u.role === 'company') {
    if (status === 'preparing') {
      o.status = 'preparing';
    } else if (status === 'cancelled') {
      // Allow company to cancel order if it is pending and no driver was accepted yet
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
      res.status(400).json({ error: 'Action non autorisée pour l’entreprise' });
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
apiRouter.get('/orders/:id/invoice', (req: Request, res: Response): void => {
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


// ==========================================
// 7. SUPPORT TICKETS MODULE
// ==========================================

apiRouter.get('/tickets', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  if (u.role === 'admin') {
    res.json(dbStore.tickets);
  } else {
    res.json(dbStore.tickets.filter(t => t.userId === u.id));
  }
});

apiRouter.post('/tickets', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const { subject, message } = req.body;
  if (!subject || !message) {
    res.status(400).json({ error: 'Objet et message obligatoires' });
    return;
  }

  const ticket: SupportTicket = {
    id: `tkt_${Date.now()}`,
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    subject,
    message,
    status: 'open',
    createdAt: new Date().toISOString(),
    replies: [],
  };

  dbStore.tickets.push(ticket);
  dbStore.log(u.id, u.name, 'CREATE_TICKET', `Nouveau ticket de support créé: ${subject}`);
  res.json(ticket);
});

apiRouter.post('/tickets/:id/replies', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const t = dbStore.tickets.find(tick => tick.id === req.params['id']);
  if (!t) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }

  const { message, markResolved } = req.body;
  if (message) {
    t.replies.push({
      senderName: u.name,
      senderRole: u.role,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  if (markResolved) {
    t.status = 'resolved';
  }

  dbStore.log(u.id, u.name, 'REPLY_TICKET', `Réponse ajoutée au ticket ${t.id}`);
  res.json(t);
});


// ==========================================
// 8. GLOBAL STATS / AUDIT Trail API
// ==========================================

apiRouter.get('/stats', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Non authentifié' });
    return;
  }

  if (u.role === 'admin') {
    // Collect active stock warnings
    const lowStocks = dbStore.products.filter(p => p.stock <= p.threshold);
    const activeContractsCount = dbStore.users.filter(u => u.role === 'company' && u.status === 'active').length;
    const pendingContractsCount = dbStore.users.filter(u => u.role === 'company' && u.status === 'pending').length;
    const totalEarnings = dbStore.orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

    res.json({
      metrics: {
        totalUsers: dbStore.users.length,
        activeContracts: activeContractsCount,
        pendingContracts: pendingContractsCount,
        lowStocksCount: lowStocks.length,
        totalEarnings,
        ordersCount: dbStore.orders.length,
      },
      lowStocks,
      ordersByStatus: {
        pending: dbStore.orders.filter(o => o.status === 'pending').length,
        accepted: dbStore.orders.filter(o => o.status === 'accepted').length,
        completed: dbStore.orders.filter(o => o.status === 'delivered').length,
        cancelled: dbStore.orders.filter(o => o.status === 'cancelled').length,
      }
    });
  } 
  
  else if (u.role === 'company') {
    const myProducts = dbStore.products.filter(p => p.companyId === u.id);
    const myOrders = dbStore.orders.filter(o => o.items.some(it => it.companyId === u.id));
    const activeSales = myOrders.filter(o => o.status === 'delivered').reduce((sum, o) => {
      const itemsCost = o.items
        .filter(it => it.companyId === u.id)
        .reduce((s, it) => s + (it.price * it.quantity), 0);
      return sum + itemsCost;
    }, 0);

    const lowMyStocks = myProducts.filter(p => p.stock <= p.threshold);

    res.json({
      metrics: {
        totalProducts: myProducts.length,
        salesSum: activeSales,
        totalOrders: myOrders.length,
        pendingOrders: myOrders.filter(o => o.status === 'pending' || o.status === 'accepted').length,
        lowStocksWarning: lowMyStocks.length,
      },
      lowMyStocks
    });
  } 
  
  else if (u.role === 'driver') {
    const drv = dbStore.drivers.find(d => d.userId === u.id);
    const myOrders = dbStore.orders.filter(o => o.driverId === drv?.id);
    const earnings = myOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.driverFee, 0);

    res.json({
      metrics: {
        totalDeliveries: myOrders.length,
        deliveredCount: myOrders.filter(o => o.status === 'delivered').length,
        earningsTotal: earnings,
        currentOrders: myOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length,
      }
    });
  } 
  
  else {
    res.status(403).json({ error: 'Rôle inconnu pour statistiques' });
  }
});

apiRouter.get('/audit-logs', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Super-Administrateur requis' });
    return;
  }
  res.json(dbStore.auditLogs);
});
