import { Router } from 'express';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { offersRouter } from './routes/offers';
import { driversRouter } from './routes/drivers';
import { ordersRouter } from './routes/orders';
import { ticketsRouter } from './routes/tickets';
import { statsRouter } from './routes/stats';

export const apiRouter = Router();

// Mount newly separated sub-routers
apiRouter.use(authRouter);
apiRouter.use(productsRouter);
apiRouter.use(offersRouter);
apiRouter.use(driversRouter);
apiRouter.use(ordersRouter);
apiRouter.use(ticketsRouter);
apiRouter.use(statsRouter);
