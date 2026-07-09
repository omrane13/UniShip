import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, SubAccount } from '../store';
import { getCurrentUser, generateAuthToken, sanitizeUser, verifyPassword } from './helpers';
import { UserRepository, SubAccountRepository, AuditLogRepository, SimulatedEmailRepository, ProductRepository, DriverRepository, CompanyRepository } from '../db/repository';

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
  let user: any = await UserRepository.getByEmail(email);
  if (!user) {
    user = await CompanyRepository.getByEmail(email);
  }
  let isCollab = false;

  if (!user) {
    const sub = await SubAccountRepository.getByEmail(email);
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

  const storedHash = user.password || '';
  const { matches: passwordMatches, migratedHash } = await verifyPassword(password, storedHash);

  if (!passwordMatches) {
    res.status(401).json({ error: 'Mot de passe incorrect' });
    return;
  }

  if (migratedHash) {
    // Compte encore en mot de passe clair (créé avant l'introduction de bcrypt) :
    // on persiste discrètement le hash désormais que le mot de passe vient d'être vérifié.
    user.password = migratedHash;
    if (isCollab) {
      await SubAccountRepository.update(user.id, { password: migratedHash });
    } else if (user.role === 'company') {
      await CompanyRepository.update(user.id, { password: migratedHash });
    } else {
      await UserRepository.update(user.id, { password: migratedHash });
    }
  }

  if (user.status === 'pending') {
    res.status(403).json({ error: 'Votre compte est en attente d’activation par un Administrateur.' });
    return;
  }

  if (user.status === 'inactive') {
    res.status(403).json({ error: 'Votre compte a été désactivé par un Administrateur.' });
    return;
  }

  await AuditLogRepository.log(user.id, user.name, 'LOGIN', isCollab ? 'Connexion réussie en tant que Collaborateur' : 'Connexion réussie à la plateforme');
  res.json({ token: generateAuthToken(user.id, user.role), user: sanitizeUser(user) });
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

  // Seuls client / company / driver sont ouverts à l'inscription publique.
  // 'admin' et 'collaborator' ne peuvent être créés que par un Administrateur authentifié
  // (les collaborateurs passent d'ailleurs par /auth/subaccounts, pas par cette route).
  const allowedPublicRoles = ['client', 'company', 'driver'];
  if (!isCreatorAdmin && !allowedPublicRoles.includes(role)) {
    res.status(403).json({ error: 'Rôle non autorisé pour une inscription publique.' });
    return;
  }

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

  const existing = await UserRepository.getByEmail(email) || await CompanyRepository.getByEmail(email);
  if (existing) {
    res.status(400).json({ error: 'Cet email est déjà enregistré' });
    return;
  }

  // Auto-activate client accounts, companies and drivers need validation
  const status = (role === 'client') ? 'active' : 'pending';
  const id = `usr_${role}_${Date.now()}`;
  const passwordHash = await bcrypt.hash(finalPassword, 10);

  const newUser: User = {
    id,
    name,
    email,
    password: passwordHash,
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
    const activeCompanies = await CompanyRepository.getAll({ status: 'active' });
    const conflict = activeCompanies.find(u => u.color && u.color.toLowerCase() === selectedColor.toLowerCase());
    if (conflict) {
      res.status(409).json({ error: `Cette couleur est déjà utilisée par ${conflict.name}` });
      return;
    }
    newUser.color = selectedColor;
    newUser.logo = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&h=80&fit=crop';
  }

  if (role === 'company') {
    await CompanyRepository.create(newUser as any);
  } else {
    await UserRepository.create(newUser);
  }

  // If driver registered, create driver profile in MongoDB too
  if (role === 'driver') {
    const { DriverRepository } = await import('../db/repository');
    await DriverRepository.create({
      id: `drv_${Date.now()}`,
      userId: id,
      name,
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      rating: 5.0,
      status: 'offline',
      baseFee: 2.50,
      perKmFee: 0.80,
      zone: address || 'Tunis Centre',
    });
  }

  await AuditLogRepository.log(id, name, 'REGISTER', `Création de compte (${role}) — statut: ${status}`);

  if (role === 'client') {
    await SimulatedEmailRepository.send(email, 'Bienvenue chez UniShip ! 🚀', `Bonjour ${name},\n\nVotre compte Client sur la plateforme UniShip a été créé avec succès.\n\nVoici vos identifiants pour vous connecter :\n- Adresse E-mail : ${email}\n- Mot de passe secret : ${finalPassword}\n\nBonnes livraisons !\nL'équipe UniShip.`);
  } else {
    await SimulatedEmailRepository.send(email, "Demande d'inscription reçue - En attente d'activation ⏳", `Bonjour ${name},\n\nNous avons bien reçu votre demande d'inscription en tant que ${role === 'company' ? 'Entreprise 🏢' : 'Livreur 🚴'} sur la plateforme logistique UniShip.\n\nVotre compte est actuellement en attente d'approbation et d'activation par l'Administrateur.\n\nVoici un rappel de vos identifiants d'inscription :\n- Adresse E-mail : ${email}\n- Mot de passe choisi : ${finalPassword}\n\nVous recevrez un nouvel e-mail de confirmation dès que l'administrateur aura activé votre espace.\n\nCordialement,\nL'équipe Support UniShip.`);
  }

  res.json({
    message: role === 'client' 
      ? 'Compte créé avec succès ! Un email de vérification a été simulé.' 
      : 'Compte enregistré ! En attente de validation préalable par l’Administrateur.',
    user: sanitizeUser(newUser)
  });
});

// Company sub-account support
authRouter.get('/auth/subaccounts', async (req: Request, res: Response): Promise<void> => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'company') {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }
  const list = await SubAccountRepository.getAll(user.id);
  res.json(list);
});

authRouter.post('/auth/subaccounts', async (req: Request, res: Response): Promise<void> => {
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

  const currentSubs = await SubAccountRepository.getAll(user.id);
  if (currentSubs.length >= 5) {
    res.status(400).json({ error: `La limite de 5 collaborateurs est atteinte (${currentSubs.length}/5).` });
    return;
  }

  const sub: SubAccount = {
    id: `sub_${Date.now()}`,
    companyId: user.id,
    name,
    email,
    role: pRole || 'Employé',
    permissions: permissions || 'read',
    status: 'pending',
  };

  await SubAccountRepository.create(sub);
  await AuditLogRepository.log(user.id, user.name, 'CREATE_SUBACCOUNT', `Création sous-compte: ${name}`);
  res.json(sanitizeUser(sub));
});

// List users for Admin
authRouter.get('/users', async (req: Request, res: Response): Promise<void> => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint à l’Administrateur' });
    return;
  }

  const { role, status } = req.query;
  
  // 1. Get standard users and companies from repository
  const usersList = await UserRepository.getAll();
  const companiesList = await CompanyRepository.getAll();
  const list: User[] = [...usersList, ...(companiesList as any[])];

  // 2. Fetch and map subaccounts (collaborators) so the Admin can view & activate them!
  const subList: User[] = [];
  for (const s of await SubAccountRepository.getAll()) {
    const parentCompany = await CompanyRepository.getById(s.companyId) || await UserRepository.getById(s.companyId);
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

  res.json(fullList.map(sanitizeUser));
});


// Update User (Admin role updates, activation, colors)
authRouter.put('/users/:id', async (req: Request, res: Response): Promise<void> => {
  const adminUser = getCurrentUser(req);
  if (!adminUser || adminUser.role !== 'admin') {
    res.status(403).json({ error: 'Accès restreint' });
    return;
  }

  let targetUser: any = await UserRepository.getById(req.params['id'] as string);
  if (!targetUser) targetUser = await CompanyRepository.getById(req.params['id'] as string);
  
  if (!targetUser) {
    const targetSub = await SubAccountRepository.getById(req.params['id'] as string);
    if (targetSub) {
      const { status } = req.body;
      if (status) {
        const previousStatus = targetSub.status;

        if (status === 'active' && previousStatus === 'pending') {
          const generatedPassword = 'Collab-' + Math.floor(1000 + Math.random() * 9000);
          const generatedPasswordHash = await bcrypt.hash(generatedPassword, 10);
          const parentCompany = await UserRepository.getById(targetSub.companyId);
          const companyName = parentCompany ? parentCompany.name : 'Inconnue';
          const companyEmail = parentCompany ? parentCompany.email : '';

          await SubAccountRepository.update(targetSub.id, { status, password: generatedPasswordHash });

          const emailBody = `Bonjour ${targetSub.name},\n\nFélicitations ! Votre sous-compte Collaborateur (${targetSub.role}) rattaché à l'entreprise ${companyName} a été activé.\n\nIdentifiants :\n- Email : ${targetSub.email}\n- Mot de passe : ${generatedPassword}\n\nCordialement,\nL'équipe UniShip.`;
          await SimulatedEmailRepository.send(targetSub.email, `Activation de votre compte Collaborateur UniShip 🎉`, emailBody);

          if (companyEmail) {
            const companyMailBody = `Bonjour ${companyName},\n\nLe sous-compte de ${targetSub.name} (${targetSub.role}) a été activé.\n\nMot de passe généré : ${generatedPassword}\n\nCordialement,\nL'équipe UniShip.`;
            await SimulatedEmailRepository.send(companyEmail, `Accès Activés - Collaborateur : ${targetSub.name} 🔑`, companyMailBody);
          }
          await AuditLogRepository.log('system', 'Système Mail', 'SEND_ACTIVATION_EMAIL', `Email activation → ${targetSub.email}`);
        } else {
          await SubAccountRepository.update(targetSub.id, { status });
        }

        await AuditLogRepository.log(adminUser.id, adminUser.name, 'UPDATE_SUBACCOUNT_STATUS', `Collaborateur ${targetSub.name} → statut ${status}`);
        res.json({ id: targetSub.id, name: targetSub.name, email: targetSub.email, role: 'collaborator', status, companyId: targetSub.companyId });
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
      const allCompanies = await CompanyRepository.getAll();
      const conflict = allCompanies.find(u => 
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
      const allCompanies = await CompanyRepository.getAll();
      const conflict = allCompanies.find(u => 
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
    // If driver status gets marked inactive, mark their driver profile accordingly
    if (targetUser.role === 'driver') {
      const drv = await DriverRepository.getByUserId(targetUser.id);
      if (drv) await DriverRepository.update(drv.id, { status: status === 'active' ? 'available' : 'offline' });
    }
    
    if (status === 'active' && previousStatus === 'pending') {
      // On génère toujours un nouveau mot de passe en clair ici : targetUser.password
      // contient désormais un hash bcrypt, jamais un mot de passe lisible qu'on pourrait renvoyer.
      const activePassword = 'UniShip-' + Math.floor(1000 + Math.random() * 9000);
      targetUser.password = await bcrypt.hash(activePassword, 10);
      const emailBody = `Bonjour ${targetUser.name},\n\nFélicitations ! Votre compte ${targetUser.role === 'company' ? 'Entreprise 🏢' : 'Livreur 🚴'} a été activé avec succès par l'Administrateur UniShip.\n\nIdentifiants :\n- Email : ${targetUser.email}\n- Mot de passe : ${activePassword}\n\nCordialement,\nL'équipe UniShip.`;
      await SimulatedEmailRepository.send(targetUser.email, `Activation de votre compte UniShip 🎉`, emailBody);
      await AuditLogRepository.log('system', 'Système Mail', 'SEND_ACTIVATION_EMAIL', `Email activation → ${targetUser.email}`);
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

  // Update all company products with new color in MongoDB
  if (color && targetUser.role === 'company') {
    const companyProducts = await ProductRepository.getAll({ companyId: targetUser.id });
    for (const p of companyProducts) {
      await ProductRepository.update(p.id, { companyColor: color });
    }
    console.log(`[MongoDB] Updated companyColor for ${companyProducts.length} products of '${targetUser.name}'`);
  }

  await AuditLogRepository.log(adminUser.id, adminUser.name, 'UPDATE_USER', `Mise à jour utilisateur ${targetUser.name} (${targetUser.id})`);
  if (targetUser.role === 'company') {
    await CompanyRepository.update(targetUser.id, targetUser);
  } else {
    await UserRepository.update(targetUser.id, targetUser);
  }
  res.json(sanitizeUser(targetUser));
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
    const emailConflict = (await UserRepository.getByEmail(email)) || (await CompanyRepository.getByEmail(email));
    if (emailConflict && emailConflict.id !== u.id) {
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
    u.password = await bcrypt.hash(password, 10);
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
    const drv = await DriverRepository.getByUserId(u.id);
    if (drv) {
      const drvUpdates: Record<string, unknown> = {};
      if (name !== undefined) drvUpdates['name'] = name;
      if (baseFee !== undefined) drvUpdates['baseFee'] = Number(baseFee);
      if (perKmFee !== undefined) drvUpdates['perKmFee'] = Number(perKmFee);
      if (zone !== undefined) drvUpdates['zone'] = zone;
      if (driverStatus !== undefined) {
        drvUpdates['status'] = driverStatus;
        u.driverStatus = driverStatus;
      }
      if (photo !== undefined) drvUpdates['photo'] = photo;
      if (Object.keys(drvUpdates).length > 0) {
        await DriverRepository.update(drv.id, drvUpdates as any);
      }
    }
  }

  await AuditLogRepository.log(u.id, u.name, 'UPDATE_PROFILE', `Mise à jour du profil personnel (Rôle: ${u.role})`);

  // Re-fetch decorated user to return updated status/driver attributes
  const updatedUser = (await UserRepository.getById(u.id)) || (await CompanyRepository.getById(u.id)) || u;
  if (updatedUser.role === 'driver') {
    const drv = await DriverRepository.getByUserId(updatedUser.id);
    if (drv) {
      updatedUser.baseFee = drv.baseFee;
      updatedUser.perKmFee = drv.perKmFee;
      updatedUser.zone = drv.zone;
      updatedUser.driverStatus = drv.status;
      updatedUser.photo = drv.photo;
      updatedUser.rating = drv.rating;
    }
  }

  if (updatedUser.role === 'company') {
    await CompanyRepository.update(updatedUser.id, updatedUser as any);
  } else {
    await UserRepository.update(updatedUser.id, updatedUser as any);
  }
  res.json({ message: 'Profil mis à jour avec succès', user: sanitizeUser(updatedUser) });
});