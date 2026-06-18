import { Router, Request, Response } from 'express';
import { dbStore } from '../store';
import { getCurrentUser } from './helpers';

export const driversRouter = Router();

// ==========================================
// 5. MODULE LIVRISON & GÉOLOCALISATION
// ==========================================

driversRouter.get('/drivers', (req: Request, res: Response): void => {
  // Simulating rating / calculation with optional client geolocation query params
  const list = dbStore.drivers.map(drv => {
    // Generate simulated distance (e.g., between 0.5km and 8.5km)
    const simulatedDist = parseFloat((Math.random() * 8 + 0.5).toFixed(1));
    const calculatedFee = parseFloat((drv.baseFee + simulatedDist * drv.perKmFee).toFixed(2));
    const durationMin = Math.round(simulatedDist * 3 + 4);

    return {
      ...drv,
      distanceKm: simulatedDist,
      calculatedFee,
      estimatedMinutes: durationMin
    };
  });

  res.json(list);
});

driversRouter.put('/drivers/status', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'driver') {
    res.status(403).json({ error: 'Réservé aux livreurs' });
    return;
  }

  const { status } = req.body; // 'available', 'busy', 'offline'
  const drv = dbStore.drivers.find(d => d.userId === u.id);
  if (drv) {
    drv.status = status;
    dbStore.log(u.id, u.name, 'DRIVER_STATUS', `Status modifié en : ${status}`);
    res.json(drv);
  } else {
    res.status(404).json({ error: 'Profil livreur inexistant' });
  }
});
