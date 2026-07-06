/**
 * seed.ts — UniShip Database Seeder
 * Migre toutes les données initiales du store in-memory vers MongoDB Atlas.
 * S'exécute une seule fois au démarrage si les collections sont vides.
 */
import { isMongoEnabled } from './connection';
import { MongoUser } from './models/user';
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
