import { Router, Request, Response } from 'express';
import { getCurrentUser, getCompanyOwnerId } from './helpers';
import {
  UserRepository, ProductRepository, OrderRepository,
  DriverRepository, AuditLogRepository, SimulatedEmailRepository, SubAccountRepository
} from '../db/repository';

export const statsRouter = Router();

// ==========================================
// 8. GLOBAL STATS / AUDIT Trail API
// ==========================================

statsRouter.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) { res.status(403).json({ error: 'Non authentifié' }); return; }

  if (u.role === 'admin') {
    const [products, users, orders] = await Promise.all([
      ProductRepository.getAll(),
      UserRepository.getAll(),
      OrderRepository.getAll(),
    ]);

    const lowStocks = products.filter(p => p.stock <= p.threshold);
    const activeContractsCount = users.filter(u => u.role === 'company' && u.status === 'active').length;
    const pendingContractsCount = users.filter(u => u.role === 'company' && u.status === 'pending').length;
    const totalEarnings = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);

    res.json({
      metrics: {
        totalUsers: users.length,
        activeContracts: activeContractsCount,
        pendingContracts: pendingContractsCount,
        lowStocksCount: lowStocks.length,
        totalEarnings,
        ordersCount: orders.length,
      },
      lowStocks,
      ordersByStatus: {
        pending:   orders.filter(o => o.status === 'pending').length,
        accepted:  orders.filter(o => o.status === 'accepted').length,
        completed: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      }
    });
  }

  else if (u.role === 'company' || u.role === 'collaborator') {
    const ownerId = getCompanyOwnerId(u);
    const [myProducts, allOrders] = await Promise.all([
      ProductRepository.getAll({ companyId: ownerId }),
      OrderRepository.getAll({ companyId: ownerId }),
    ]);

    const activeSales = allOrders.filter(o => o.status === 'delivered').reduce((sum, o) => {
      const itemsCost = o.items
        .filter(it => it.companyId === ownerId)
        .reduce((s, it) => s + it.price * it.quantity, 0);
      return sum + itemsCost;
    }, 0);

    const lowMyStocks = myProducts.filter(p => p.stock <= p.threshold);

    res.json({
      metrics: {
        totalProducts: myProducts.length,
        salesSum: activeSales,
        totalOrders: allOrders.length,
        pendingOrders: allOrders.filter(o => o.status === 'pending' || o.status === 'accepted').length,
        lowStocksWarning: lowMyStocks.length,
      },
      lowMyStocks
    });
  }

  else if (u.role === 'driver') {
    const drv = await DriverRepository.getByUserId(u.id);
    const allOrders = await OrderRepository.getAll();
    const myOrders = allOrders.filter(o => o.driverId === drv?.id);
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

statsRouter.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Super-Administrateur requis' });
    return;
  }
  const logs = await AuditLogRepository.getAll();
  res.json(logs);
});

// Simulated Emails endpoints
statsRouter.get('/simulated-emails', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string;

  if (!userId) {
    res.json(await SimulatedEmailRepository.getAll());
    return;
  }

  const standardUser = await UserRepository.getById(userId);
  if (standardUser) {
    if (standardUser.role === 'admin') {
      res.json(await SimulatedEmailRepository.getAll());
    } else {
      res.json(await SimulatedEmailRepository.getAll(standardUser.email));
    }
    return;
  }

  const subUser = await SubAccountRepository.getById(userId);
  if (subUser) {
    res.json(await SimulatedEmailRepository.getAll(subUser.email));
    return;
  }

  res.json(await SimulatedEmailRepository.getAll());
});

statsRouter.put('/simulated-emails/:id/read', async (req: Request, res: Response): Promise<void> => {
  const email = await SimulatedEmailRepository.markAsRead(req.params['id'] as string);
  if (email) {
    res.json({ success: true, email });
  } else {
    res.status(404).json({ error: 'Email introuvable' });
  }
});
