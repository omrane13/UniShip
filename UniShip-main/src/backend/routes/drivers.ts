import { Router, Request, Response } from 'express';
import { getCurrentUser } from './helpers';
import { DriverRepository, AuditLogRepository } from '../db/repository';

export const driversRouter = Router();

// ==========================================
// 5. MODULE LIVRAISON & GÉOLOCALISATION
// ==========================================

driversRouter.get('/drivers', async (req: Request, res: Response): Promise<void> => {
  const drivers = await DriverRepository.getAll();

  const list = drivers.map(drv => {
    const simulatedDist = parseFloat((Math.random() * 8 + 0.5).toFixed(1));
    const calculatedFee = parseFloat((drv.baseFee + simulatedDist * drv.perKmFee).toFixed(2));
    const durationMin = Math.round(simulatedDist * 3 + 4);
    return { ...drv, distanceKm: simulatedDist, calculatedFee, estimatedMinutes: durationMin };
  });

  res.json(list);
});

driversRouter.put('/drivers/status', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'driver') {
    res.status(403).json({ error: 'Réservé aux livreurs' });
    return;
  }

  const { status } = req.body;
  const drv = await DriverRepository.getByUserId(u.id);

  if (!drv) {
    res.status(404).json({ error: 'Profil livreur inexistant' });
    return;
  }

  const updated = await DriverRepository.update(drv.id, { status });
  await AuditLogRepository.log(u.id, u.name, 'DRIVER_STATUS', `Status modifié en : ${status}`);
  res.json(updated || drv);
});
