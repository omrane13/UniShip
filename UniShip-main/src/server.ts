import dotenv from 'dotenv';
dotenv.config();
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { apiRouter } from './backend/routes';
import { connectMongoDB } from './backend/db/connection';
import { seedDatabase } from './backend/db/seed';
import { migrateCompanies } from './backend/db/migrate-companies';


const browserDistFolder = join(import.meta.dirname, '../browser');


const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Connect to MongoDB on module load — active in BOTH dev (ng serve) and production.
 * Then run the database seeder to migrate initial data on first startup.
 */
connectMongoDB()
  .then(async status => {
    if (status.isConnected) {
      console.log('💚 [MongoDB] Connexion active — les données seront persistées dans MongoDB Atlas.');
      await migrateCompanies();
      await seedDatabase();
    } else if (!status.uriConfigured) {
      console.warn('🟡 [MongoDB] MONGODB_URI manquant — fonctionnement en mémoire uniquement.');
    } else {
      console.error('❌ [MongoDB] Échec de connexion — fonctionnement en mémoire uniquement.');
    }
  })
  .catch(err => console.error('❌ [MongoDB] Erreur fatale:', err));

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
