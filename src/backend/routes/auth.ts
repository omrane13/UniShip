import { Router, Request, Response } from 'express';
import { dbStore, User, SubAccount } from '../store';
import { getCurrentUser } from './helpers';
import { UserRepository } from '../db/repository';

export const authRouter = Router();


// ==========================================
// 1. MODULE AUTHENTICATION & ACCESS
// ==========================================

// Login simulation
authRouter.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email obligatoire' });
    return;
  }

  // Find user by email or subaccount email
  let user = await UserRepository.getByEmail(email);
  let isCollab = false;

  if (!user) {
    const sub = dbStore.subAccounts.find(s => s.email.toLowerCase() === email.toLowerCase());
    if (sub) {
      isCollab = true;
      const parentCompany = await UserRepository.getById(sub.companyId);
      user = {
        id: sub.id,
        name: sub.name,
        email: sub.email,
        password: sub.password || '',
        role: 'collaborator',
        status: sub.status || 'pending',
        color: parentCompany?.color || '#3b82f6',
        companyId: sub.companyId,
        permissions: sub.permissions,
        phone: parentCompany?.phone,
        address: parentCompany?.address,
      };
    }
  }

  if (!user) {
    res.status(401).json({ error: 'Identifiants incorrects ou compte inexistant' });
    return;
  }


  if (!password) {
    res.status(400).json({ error: 'Mot de passe obligatoire pour se connecter' });
    return;
  }

  if (user.password !== password) {
    res.status(401).json({ error: 'Mot de passe incorrect' });
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

  dbStore.log(user.id, user.name, 'LOGIN', isCollab ? 'Connexion réussie en tant que Collaborateur' : 'Connexion réussie à la plateforme');
  res.json({ token: 'mock-jwt-token-xyz', user });
});

// Register simulation
authRouter.post('/auth/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role, phone, address, companyColor } = req.body;

  if (!name || !email || !role) {
    res.status(400).json({ error: 'Informations obligatoires manquantes' });
    return;
  }

  const creator = getCurrentUser(req);
  const isCreatorAdmin = creator && creator.role === 'admin';

  let finalPassword = password;
  if (!finalPassword) {
    if (isCreatorAdmin) {
      finalPassword = 'UniShip-' + Math.floor(1000 + Math.random() * 9000);
    } else {
      res.status(400).json({ error: "Un mot de passe d'au moins 4 caractères est obligatoire pour s'inscrire." });
      return;
    }
  }

  if (finalPassword.length < 4) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
    return;
  }

  const existing = await UserRepository.getByEmail(email);
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
    password: finalPassword,
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
    const activeCompanies = await UserRepository.getAll('company', 'active');
    const conflict = activeCompanies.find(u => u.color && u.color.toLowerCase() === selectedColor.toLowerCase());
    if (conflict) {
      res.status(409).json({ error: `Cette couleur est déjà utilisée par ${conflict.name}` });
      return;
    }
    newUser.color = selectedColor;
    newUser.logo = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&h=80&fit=crop';
  }

  await UserRepository.create(newUser);


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

  // Send initial simulated registration email so user of simulated system can see it on login page
  if (role === 'client') {
    dbStore.sendEmail(email, 'Bienvenue chez UniShip ! 🚀', `Bonjour ${name},\n\nVotre compte Client sur la plateforme UniShip a été créé avec succès.\n\nVoici vos identifiants pour vous connecter :\n- Adresse E-mail : ${email}\n- Mot de passe secret : ${finalPassword}\n\nBonnes livraisons !\nL'équipe UniShip.`);
  } else {
    dbStore.sendEmail(email, 'Demande d\'inscription reçue - En attente d\'activation ⏳', `Bonjour ${name},\n\nNous avons bien reçu votre demande d'inscription en tant que ${role === 'company' ? 'Entreprise 🏢' : 'Livreur 🚴'} sur la plateforme logistique UniShip.\n\nVotre compte est actuellement en attente d'approbation et d'activation par l'Administrateur.\n\nVoici un rappel de vos identifiants d'inscription :\n- Adresse E-mail : ${email}\n- Mot de passe choisi : ${finalPassword}\n\nVous recevrez un nouvel e-mail de confirmation dès que l'administrateur aura activé votre espace.\n\nCordialement,\nL'équipe Support UniShip.`);
  }

  res.json({
    message: role === 'client' 
      ? 'Compte créé avec succès ! Un email de vérification a été simulé.' 
      : 'Compte enregistré ! En attente de validation préalable par l’Administrateur.',
    user: newUser
  });
});

// Company sub-account support
authRouter.get('/auth/subaccounts', (req: Request, res: Response): void => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'company') {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const list = dbStore.subAccounts.filter(s => s.companyId === user.id);
  res.json(list);
});

authRouter.post('/auth/subaccounts', (req: Request, res: Response): void => {
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
authRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint à l’Administrateur' });
    return;
  }

  const { role, status } = req.query;
  
  // 1. Get standard users from repository
  const list: User[] = await UserRepository.getAll();

  // 2. Fetch and map subaccounts (collaborators) so the Admin can view & activate them!
  const subList: User[] = [];
  for (const s of dbStore.subAccounts) {
    const parentCompany = await UserRepository.getById(s.companyId);
    const compName = parentCompany ? parentCompany.name : 'Inconnu';
    subList.push({
      id: s.id,
      name: `${s.name} (Poste : ${s.role})`,
      email: s.email,
      role: 'collaborator',
      status: s.status || 'pending',
      phone: `Entreprise : ${compName}`,
      address: `Permissions : ${s.permissions}`,
      companyId: s.companyId
    });
  }

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
authRouter.put('/users/:id', async (req: Request, res: Response): Promise<void> => {
  const adminUser = getCurrentUser(req);
  if (!adminUser || adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint' });
    return;
  }

  const targetUser = await UserRepository.getById(req.params['id'] as string);
  if (!targetUser) {
    const targetSub = dbStore.subAccounts.find(s => s.id === req.params['id']);
    if (targetSub) {
      const { status } = req.body;
      if (status) {
        const previousStatus = targetSub.status;
        targetSub.status = status;

        if (status === 'active' && previousStatus === 'pending') {
          const generatedPassword = 'Collab-' + Math.floor(1000 + Math.random() * 9000);
          targetSub.password = generatedPassword;

          const parentCompany = await UserRepository.getById(targetSub.companyId);
          const companyName = parentCompany ? parentCompany.name : 'Inconnue';
          const companyEmail = parentCompany ? parentCompany.email : '';

          const emailBody = `Bonjour ${targetSub.name},\n\nFélicitations ! Votre sous-compte Collaborateur (${targetSub.role}) rattaché à l'entreprise ${companyName} sur la plateforme UniShip a été activé avec succès par l'Administrateur.\n\nVoici vos identifiants pour vous connecter de manière sécurisée :\n- Adresse E-mail : ${targetSub.email}\n- Mot de passe de connexion de manière sécurisée : ${generatedPassword}\n\nVous pouvez désormais vous connecter et utiliser toutes les fonctionnalités d'UniShip pour gérer vos activités.\n\nCordialement,\nL'équipe Support UniShip.`;

          dbStore.sendEmail(targetSub.email, `Activation de votre compte Collaborateur UniShip 🎉`, emailBody);

          if (companyEmail) {
            const companyMailBody = `Bonjour ${companyName},\n\nLe sous-compte de votre collaborateur ${targetSub.name} (${targetSub.role}) a été activé avec succès par l'Administrateur d'UniShip.\n\nVoici ses accès générés automatiquement :\n- Nom : ${targetSub.name}\n- Adresse E-mail : ${targetSub.email}\n- Mot de passe généré automatiquement : ${generatedPassword}\n- Permissions : ${targetSub.permissions}\n\nVotre collaborateur peut dès maintenant se connecter à son espace de travail.\n\nCordialement,\nL'équipe Support UniShip.`;
            dbStore.sendEmail(companyEmail, `Accès Activés - Collaborateur : ${targetSub.name} 🔑`, companyMailBody);
          }

          dbStore.log('system', 'Système Mail', 'SEND_ACTIVATION_EMAIL', `Email d'activation envoyé au collaborateur ${targetSub.email} et à l'entreprise ${companyEmail}`);
        }

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
      const allUsers = await UserRepository.getAll();
      const conflict = allUsers.find(u => 
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
      const allUsers = await UserRepository.getAll();
      const conflict = allUsers.find(u => 
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
    const previousStatus = targetUser.status;
    targetUser.status = status;
    // If driver status gets marked inactive, mark their driver profile offline
    if (targetUser.role === 'driver') {
      const drv = dbStore.drivers.find(d => d.userId === targetUser.id);
      if (drv) drv.status = status === 'active' ? 'available' : 'offline';
    }
    
    // Automatically generate password if missing, otherwise use their chosen password during registration, and send email upon activation of pending account
    if (status === 'active' && previousStatus === 'pending') {
      const activePassword = targetUser.password || 'UniShip-' + Math.floor(1000 + Math.random() * 9000);
      targetUser.password = activePassword;
      const emailBody = `Bonjour ${targetUser.name},\n\nFélicitations ! Votre compte ${targetUser.role === 'company' ? 'Entreprise 🏢' : 'Livreur 🚴'} sur la plateforme logistique UniShip a été activé avec succès par l'Administrateur.\n\nVoici vos identifiants pour vous connecter de manière sécurisée :\n- Adresse E-mail : ${targetUser.email}\n- Mot de passe de connexion : ${activePassword}\n\nVous pouvez désormais vous connecter et utiliser toutes les fonctionnalités d'UniShip pour gérer vos livraisons et activités.\n\nCordialement,\nL'équipe Support UniShip.`;
      dbStore.sendEmail(targetUser.email, `Activation de votre compte UniShip 🎉 (Mot de passe de connexion)`, emailBody);
      dbStore.log('system', 'Système Mail', 'SEND_ACTIVATION_EMAIL', `Email d'activation envoyé à ${targetUser.email} avec mot de passe.`);
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
  }
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
  await UserRepository.create(targetUser);
  res.json(targetUser);
});

// Update logged in user's profile self-care
authRouter.put('/profile', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(401).json({ error: 'Non authentifié. Veuillez vous connecter.' });
    return;
  }

  const { name, email, password, phone, address, logo, baseFee, perKmFee, zone, driverStatus, photo,
          planId, billingCycle, paymentMethod, referralCode, referredByCode, isVerifiedPartner,
          cancellationRate, averageRating, suspended, entryFeePaid, inactivityDays,
          paymentDelayDays, nonConformingWarningsCount, monthlyOrdersCount } = req.body;

  // Validate or enforce email uniqueness if it's being modified
  if (email && email.toLowerCase() !== u.email.toLowerCase()) {
    const allUsers = await UserRepository.getAll();
    const emailConflict = allUsers.find(usr => usr.email.toLowerCase() === email.toLowerCase() && usr.id !== u.id);
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
  if (password !== undefined && password !== '') {
    if (password.length < 4) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 4 caractères.' });
      return;
    }
    u.password = password;
  }

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
  const updatedUser = (await UserRepository.getById(u.id)) || u;
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

  // Persist update
  await UserRepository.create(updatedUser);

  res.json({ message: 'Profil mis à jour avec succès', user: updatedUser });
});
