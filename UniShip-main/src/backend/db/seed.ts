/**
 * seed.ts — UniShip Database Seeder
 * Migre toutes les données initiales du store in-memory vers MongoDB Atlas.
 * S'exécute une seule fois au démarrage si les collections sont vides.
 */
import { isMongoEnabled } from './connection';
import { MongoUser } from './models/user';
import { MongoCompany } from './models/company';
import { MongoProduct } from './models/product';
import { MongoOrder } from './models/order';
import { MongoDriver } from './models/driver';
import { MongoSubAccount } from './models/subaccount';
import { MongoOffer } from './models/offer';
import { MongoStockRequest } from './models/stock-request';
import { MongoTicket } from './models/ticket';
import { MongoAuditLog } from './models/audit-log';
import { MongoSimulatedEmail } from './models/simulated-email';
import { dbStore } from '../store';

async function seedCollection<T extends { id: string }>(
  name: string,
  Model: any,
  data: T[]
): Promise<void> {
  const count = await Model.countDocuments();
  if (count > 0) {
    console.log(`  ⏭️  [Seed] '${name}' déjà peuplée (${count} documents) — ignorée.`);
    return;
  }

  if (data.length === 0) {
    console.log(`  ⚠️  [Seed] '${name}' — aucune donnée initiale.`);
    return;
  }

  for (const item of data) {
    try {
      await Model.findOneAndUpdate({ id: item.id }, item, { upsert: true, new: true });
    } catch (err: any) {
      console.error(`  ❌ [Seed] Erreur sur '${name}' (id=${item.id}):`, err.message);
    }
  }

  console.log(`  ✅ [Seed] '${name}' — ${data.length} document(s) insérés.`);
}

export async function seedDatabase(): Promise<void> {
  if (!isMongoEnabled()) {
    console.warn('[Seed] MongoDB non disponible — seed ignoré.');
    return;
  }

  console.log('');
  console.log('🌱 ============================================');
  console.log('   UNISHIP — Migration données → MongoDB');
  console.log('============================================');

  await seedCollection('users',            MongoUser,           dbStore.users);
  await seedCollection('products',         MongoProduct,        dbStore.products);
  await seedCollection('orders',           MongoOrder,          dbStore.orders);
  await seedCollection('drivers',          MongoDriver,         dbStore.drivers);
  await seedCollection('subaccounts',      MongoSubAccount,     dbStore.subAccounts);
  await seedCollection('offers',           MongoOffer,          dbStore.offers);
  await seedCollection('stockrequests',    MongoStockRequest,   dbStore.stockRequests);
  await seedCollection('tickets',          MongoTicket,         dbStore.tickets);
  await seedCollection('auditlogs',        MongoAuditLog,       dbStore.auditLogs);
  await seedCollection('simulatedemails',  MongoSimulatedEmail, dbStore.simulatedEmails);

  console.log('============================================');
  console.log('🌱 Seed terminé — base UniShip prête !');
  console.log('');
}

/**
 * Charge une collection Mongo dans le tableau dbStore correspondant.
 * Si la collection Mongo est encore vide (tout premier démarrage), on conserve
 * les données par défaut déjà présentes en mémoire (ex: l'admin seedé dans store.ts)
 * plutôt que de les écraser par un tableau vide.
 */
async function hydrateCollection<T extends { id: string }>(
  name: string,
  Model: any,
  currentInMemory: T[]
): Promise<T[]> {
  try {
    const docs = await Model.find().lean();
    if (docs.length === 0) {
      return currentInMemory;
    }
    return docs.map((d: any) => {
      const { _id, __v, ...rest } = d;
      return rest as T;
    });
  } catch (err: any) {
    console.error(`  ❌ [Hydrate] Erreur sur '${name}':`, err.message);
    return currentInMemory;
  }
}

/**
 * Recharge l'état actuel de MongoDB dans le cache mémoire (dbStore) au démarrage.
 * Sans cette étape, tout ce qui a été créé (entreprises, utilisateurs, produits...)
 * lors d'un précédent démarrage du serveur redevient invisible pour getCurrentUser
 * et pour toute logique qui lit dbStore directement, alors même que ces données
 * existent bien dans MongoDB — d'où des comptes "authentifiés mais introuvables".
 * À exécuter après migrateCompanies() et avant seedDatabase().
 */
export async function hydrateStoreFromMongo(): Promise<void> {
  if (!isMongoEnabled()) {
    return;
  }

  console.log('');
  console.log('💾 ============================================');
  console.log('   UNISHIP — Chargement MongoDB → mémoire');
  console.log('============================================');

  dbStore.users           = await hydrateCollection('users',           MongoUser,           dbStore.users);
  dbStore.companies       = await hydrateCollection('companies',       MongoCompany,        dbStore.companies);
  dbStore.products        = await hydrateCollection('products',        MongoProduct,        dbStore.products);
  dbStore.orders          = await hydrateCollection('orders',          MongoOrder,          dbStore.orders);
  dbStore.drivers         = await hydrateCollection('drivers',         MongoDriver,         dbStore.drivers);
  dbStore.subAccounts     = await hydrateCollection('subaccounts',     MongoSubAccount,     dbStore.subAccounts);
  dbStore.offers          = await hydrateCollection('offers',          MongoOffer,          dbStore.offers);
  dbStore.stockRequests   = await hydrateCollection('stockrequests',   MongoStockRequest,   dbStore.stockRequests);
  dbStore.tickets         = await hydrateCollection('tickets',         MongoTicket,         dbStore.tickets);
  dbStore.auditLogs       = await hydrateCollection('auditlogs',       MongoAuditLog,       dbStore.auditLogs);
  dbStore.simulatedEmails = await hydrateCollection('simulatedemails', MongoSimulatedEmail, dbStore.simulatedEmails);

  console.log(
    `  ✅ [Hydrate] ${dbStore.users.length} utilisateur(s), ${dbStore.companies.length} entreprise(s), ` +
    `${dbStore.products.length} produit(s), ${dbStore.subAccounts.length} sous-compte(s) chargés en mémoire.`
  );
  console.log('============================================');
  console.log('');
}