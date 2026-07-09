import { Request } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbStore, User, Order } from '../store';
import { UserRepository, CompanyRepository } from '../db/repository';

// ==========================================
// JWT CONFIGURATION
// ==========================================
const JWT_SECRET = process.env['JWT_SECRET'] || (() => {
  console.warn(
    "⚠️  [Auth] JWT_SECRET manquant dans les variables d'environnement (.env). " +
    "Utilisation d'un secret de développement non sécurisé — à NE JAMAIS utiliser en production."
  );
  return 'dev-insecure-secret-change-me-in-.env';
})();

const TOKEN_EXPIRY = '24h';

interface AuthTokenPayload {
  sub: string;  // user id
  role: string;
}

/** Génère un JWT signé pour un utilisateur venant de s'authentifier avec succès. */
export function generateAuthToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/** Retire le champ password de tout objet utilisateur avant de le renvoyer au client. */
export function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _password, ...safe } = user;
  return safe;
}

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

export interface PasswordVerification {
  matches: boolean;
  /** Présent uniquement quand un ancien mot de passe en clair vient d'être validé — il doit être persisté à la place de l'ancien. */
  migratedHash?: string;
}

/**
 * Vérifie un mot de passe contre la valeur stockée.
 * Gère la transition en douceur : les comptes créés avant l'introduction de bcrypt
 * ont encore un mot de passe en clair en base (Mongo ou mémoire). Si la valeur stockée
 * ne ressemble pas à un hash bcrypt, on compare en clair par compatibilité, et si ça
 * correspond, on renvoie un nouveau hash à sauvegarder — migrant ainsi le compte
 * silencieusement, sans script ni intervention manuelle sur la base.
 */
export async function verifyPassword(plainPassword: string, storedPassword: string | undefined): Promise<PasswordVerification> {
  if (!storedPassword) return { matches: false };

  if (BCRYPT_HASH_PATTERN.test(storedPassword)) {
    try {
      const matches = await bcrypt.compare(plainPassword, storedPassword);
      return { matches };
    } catch {
      return { matches: false };
    }
  }

  // Ancien compte : mot de passe encore en clair en base.
  const matches = storedPassword === plainPassword;
  if (!matches) return { matches: false };

  const migratedHash = await bcrypt.hash(plainPassword, 10);
  return { matches: true, migratedHash };
}

// Helper to get the actual company owner ID (since collaborators act on behalf of their parent company)
export function getCompanyOwnerId(u: User): string {
  return u.role === 'collaborator' && u.companyId ? u.companyId : u.id;
}


// Résout l'utilisateur courant STRICTEMENT à partir d'un JWT valide
// envoyé via le header `Authorization: Bearer <token>`.
// Ne retourne jamais d'utilisateur par défaut : une requête sans jeton
// valide donne undefined (→ 401 côté route), jamais un compte de secours.
export function getCurrentUser(req: Request): User | undefined {
  const authHeader = req.headers['authorization'];
  if (!authHeader || Array.isArray(authHeader) || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return undefined;

  let payload: AuthTokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    // Signature invalide, jeton expiré, ou malformé → non authentifié.
    return undefined;
  }

  const userId = payload.sub;

  let u: any = dbStore.users.find(usr => usr.id === userId);

  if (!u) {
    // BUGFIX: les entreprises vivent dans dbStore.companies depuis la migration,
    // pas dans dbStore.users — sans cette recherche, aucune entreprise connectée
    // n'était jamais reconnue comme utilisateur courant.
    u = dbStore.companies.find(c => c.id === userId);
  }

  if (!u) {
    // Check if the user is a collaborator (subaccount)
    const sub = dbStore.subAccounts.find(s => s.id === userId);
    if (sub) {
      const parentCompany = dbStore.companies.find(c => c.id === sub.companyId) || dbStore.users.find(usr => usr.id === sub.companyId);
      u = {
        id: sub.id,
        name: sub.name,
        email: sub.email,
        password: sub.password || '',
        role: 'collaborator',
        status: sub.status || 'active',
        color: parentCompany?.color || '#3b82f6',
        companyId: sub.companyId,
        permissions: sub.permissions,
        phone: parentCompany?.phone,
        address: parentCompany?.address,
      };
    }
  }

  if (!u) return undefined;

  if (u.role === 'driver') {
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
  return u as User;
}

// Automated notification engine for order status changes
export async function notifyOrderStatusChange(o: Order, oldStatus: string, newStatus: string): Promise<void> {
  // 1. Client notification
  let clientSubject = '';
  let clientBody = '';

  const formattedItems = o.items.map(item => `- ${item.productName} (x${item.quantity}) : ${(item.price * item.quantity).toFixed(2)} DTN`).join('\n');

  switch (newStatus) {
    case 'accepted':
      clientSubject = `Votre commande #${o.id} a été acceptée par un livreur ! 🚴`;
      clientBody = `Bonjour ${o.clientName},\n\nBonne nouvelle ! Le livreur ${o.driverName} a accepté votre commande.\n\nRécapitulatif de la commande :\n${formattedItems}\n\nFrais de livraison : ${o.driverFee.toFixed(2)} DTN\nTotal général : ${(o.total + o.driverFee).toFixed(2)} DTN\nMode de paiement : ${o.paymentMethod.toUpperCase()}\n\nNous vous tiendrons informé des prochaines étapes !\n\nCordialement,\nL'équipe UniShip.`;
      break;

    case 'preparing':
      clientSubject = `Votre commande #${o.id} est en préparation ! 📦`;
      clientBody = `Bonjour ${o.clientName},\n\nVotre commande #${o.id} est actuellement en cours de préparation par nos marchands partenaires.\n\nElle sera remise très prochainement au livreur ${o.driverName}.\n\nMerci de votre confiance,\nL'équipe UniShip.`;
      break;

    case 'transit':
      clientSubject = `Votre commande #${o.id} est en route ! 🚚`;
      clientBody = `Bonjour ${o.clientName},\n\nVotre livreur ${o.driverName} a récupéré votre colis auprès de nos partenaires. Il est en chemin vers votre adresse de livraison :\n👉 ${o.deliveryAddress}\n\nSoyez prêt(e) pour la livraison !\n\nCordialement,\nL'équipe UniShip.`;
      break;

    case 'delivered':
      clientSubject = `Commande #${o.id} livrée ! 🎉 Merci de votre confiance`;
      clientBody = `Bonjour ${o.clientName},\n\nVotre commande #${o.id} a été confirmée comme livrée avec succès par votre livreur ${o.driverName} !\n\nVoici le montant réglé :\n- Total articles : ${o.total.toFixed(2)} DTN\n- Frais de livraison : ${o.driverFee.toFixed(2)} DTN\n- Total payé : ${(o.total + o.driverFee).toFixed(2)} DTN (${o.paymentMethod.toUpperCase()})\n\nVous pouvez télécharger ou imprimer votre facture officielle ici : ${o.invoiceUrl || ''}\n\nÀ très bientôt sur UniShip !\nL'équipe UniShip.`;
      break;

    case 'cancelled':
      clientSubject = `Votre commande #${o.id} a été annulée ❌`;
      clientBody = `Bonjour ${o.clientName},\n\nNous sommes au regret de vous informer que votre commande #${o.id} a été annulée.\n\nSi vous avez déjà été débité(e) en ligne, le remboursement total de ${(o.total + o.driverFee).toFixed(2)} DTN sera traité sous les plus brefs délais.\n\nPour toute question, n'hésitez pas à ouvrir un ticket de support dans votre espace client.\n\nCordialement,\nL'équipe UniShip.`;
      break;
    
    default:
      break;
  }

  if (clientSubject && clientBody && o.clientEmail) {
    dbStore.sendEmail(o.clientEmail, clientSubject, clientBody);
  }

  // 2. Partner Companies notification
  const distinctCompanyIds = Array.from(new Set(o.items.map(item => item.companyId)));
  
  for (const compId of distinctCompanyIds) {
    const companyUser = await CompanyRepository.getById(compId) || await UserRepository.getById(compId);
    if (companyUser && companyUser.email) {
      const companyItems = o.items.filter(item => item.companyId === compId);
      const companyItemsText = companyItems.map(item => `- ${item.productName} (x${item.quantity})`).join('\n');
      const companyAmount = companyItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      let pSubject = '';
      let pBody = '';

      if (newStatus === 'delivered') {
        pSubject = `🎉 Succès : Les produits de la commande #${o.id} ont été livrés !`;
        pBody = `Bonjour ${companyUser.name},\n\nNous vous informons que les articles de la commande #${o.id} ont été livrés avec succès au client ${o.clientName}.\n\nVos articles vendus :\n${companyItemsText}\n\nMontant à créditer (hors commissions) : ${companyAmount.toFixed(2)} DTN\n\nMerci de votre précieuse collaboration !\nL'équipe UniShip.`;
      } else if (newStatus === 'preparing') {
        pSubject = `📦 Préparation requise : Commande #${o.id}`;
        pBody = `Bonjour ${companyUser.name},\n\nLe client ${o.clientName} a passé commande de vos produits. Le statut de l'ordre est passé en PRÉPARATION.\n\nVeuillez préparer ces articles pour le livreur ${o.driverName} :\n${companyItemsText}\n\nMerci,\nL'équipe UniShip.`;
      } else if (newStatus === 'cancelled') {
        pSubject = `❌ Annulation : Commande #${o.id}`;
        pBody = `Bonjour ${companyUser.name},\n\nLa commande #${o.id} a été annulée. Les produits suivants ont été réintégrés dans votre stock actif :\n${companyItemsText}\n\nCordialement,\nL'équipe UniShip.`;
      }

      if (pSubject && pBody) {
        dbStore.sendEmail(companyUser.email, pSubject, pBody);
      }
    }
  }

  // 3. Admin Notification
  if (newStatus === 'delivered') {
    const adminEmail = 'admin@market.com';
    const adminSubject = `📢 Notification Admin : Commande #${o.id} Livrée`;
    const adminBody = `Bonjour l'administrateur UniShip,\n\nLa commande #${o.id} a été marquée comme livrée par le livreur ${o.driverName}.\n\n- Client : ${o.clientName} (${o.clientEmail})\n- Total Articles : ${o.total.toFixed(2)} DTN\n- Frais Livreur : ${o.driverFee.toFixed(2)} DTN\n- Mode de Paiement : ${o.paymentMethod.toUpperCase()}\n\nLes tableaux de bord et rapports financiers ont été actualisés.\n\nSystème UniShip Automatisation.`;
    
    dbStore.sendEmail(adminEmail, adminSubject, adminBody);
  }
}