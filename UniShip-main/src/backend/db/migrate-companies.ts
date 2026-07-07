/**
 * migrate-companies.ts
 * Script automatique de migration : déplace les documents role='company'
 * de la collection 'users' vers la collection dédiée 'companies'.
 * S'exécute au démarrage du serveur si MongoDB est disponible.
 */
import { MongoUser } from './models/user';
import { MongoCompany } from './models/company';
import { isMongoEnabled } from './connection';

export async function migrateCompanies(): Promise<void> {
  if (!isMongoEnabled()) return;

  try {
    // 1. Find all users with role 'company' still in users collection
    const companiesToMigrate = await MongoUser.find({ role: 'company' }).lean();

    if (companiesToMigrate.length === 0) {
      console.log('  ⏭️  [Migration] Aucune entreprise à migrer depuis la collection users.');
      return;
    }

    console.log('');
    console.log('  🔄 [Migration] Déplacement de', companiesToMigrate.length, 'entreprise(s) users → companies...');

    let migratedCount = 0;

    for (const doc of companiesToMigrate) {
      const companyData: any = { ...doc };
      delete companyData._id; // Remove MongoDB _id for fresh upsert

      try {
        // 2. Upsert into companies collection
        await MongoCompany.findOneAndUpdate(
          { id: companyData.id },
          companyData,
          { upsert: true, returnDocument: 'after' }
        );

        // 3. Remove from users collection
        await MongoUser.deleteOne({ id: companyData.id });
        console.log('  ✅ [Migration] Migré :', companyData.name, '(' + companyData.email + ')');
        migratedCount++;
      } catch (err: any) {
        console.error('  ❌ [Migration] Erreur pour', companyData.name, ':', err.message);
      }
    }

    console.log('  🎉 [Migration] Terminé —', migratedCount, 'entreprise(s) migrée(s) vers la collection companies.');
    console.log('');
  } catch (error: any) {
    console.error('  ❌ [Migration] Erreur critique :', error.message);
  }
}
