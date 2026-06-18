import { Router, Request, Response } from 'express';
import { dbStore } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';

export const statsRouter = Router();

// ==========================================
// 8. GLOBAL STATS / AUDIT Trail API
// ==========================================

statsRouter.get('/stats', (req: Request, res: Response): void => {
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
  
  else if (u.role === 'company' || u.role === 'collaborator') {
    const ownerId = getCompanyOwnerId(u);
    const myProducts = dbStore.products.filter(p => p.companyId === ownerId);
    const myOrders = dbStore.orders.filter(o => o.items.some(it => it.companyId === ownerId));
    const activeSales = myOrders.filter(o => o.status === 'delivered').reduce((sum, o) => {
      const itemsCost = o.items
        .filter(it => it.companyId === ownerId)
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

statsRouter.get('/audit-logs', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Super-Administrateur requis' });
    return;
  }
  res.json(dbStore.auditLogs);
});

// Simulated Emails endpoints
statsRouter.get('/simulated-emails', (req: Request, res: Response): void => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    // Anonymous/Visitor on the login page - let them see ALL simulated emails
    // so they can read and copy their registration & activation credentials!
    res.json(dbStore.simulatedEmails);
    return;
  }

  let emailToCheck = '';
  let isAdminUser = false;

  const standardUser = dbStore.users.find(usr => usr.id === userId);
  if (standardUser) {
    emailToCheck = standardUser.email.toLowerCase();
    if (standardUser.role === 'admin') {
      isAdminUser = true;
    }
  } else {
    const subUser = dbStore.subAccounts.find(s => s.id === userId);
    if (subUser) {
      emailToCheck = subUser.email.toLowerCase();
    }
  }

  if (!emailToCheck) {
    // If we can't find a valid email associated with the token, return all so they aren't blocked on the login page in manual testing
    res.json(dbStore.simulatedEmails);
    return;
  }

  if (isAdminUser) {
    // Admin can see all simulated emails sent on the platform
    res.json(dbStore.simulatedEmails);
  } else {
    // Other users can only see emails sent to them
    const filtered = dbStore.simulatedEmails.filter(email => email.to.toLowerCase() === emailToCheck);
    res.json(filtered);
  }
});

statsRouter.put('/simulated-emails/:id/read', (req: Request, res: Response): void => {
  const emailId = req.params['id'];
  const email = dbStore.simulatedEmails.find(e => e.id === emailId);
  if (email) {
    email.read = true;
    res.json({ success: true, email });
  } else {
    res.status(404).json({ error: 'Email introuvable' });
  }
});
