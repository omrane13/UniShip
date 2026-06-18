import { Router, Request, Response } from 'express';
import { dbStore, Offer } from '../store';
import { getCurrentUser } from './helpers';

export const offersRouter = Router();

// ==========================================
// 4. MODULE OFFRES TARIFFAIRE
// ==========================================

offersRouter.get('/offers', (req: Request, res: Response): void => {
  res.json(dbStore.offers);
});

offersRouter.post('/offers', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const { title, description, commissionRate, entryFee, targetCompanyId } = req.body;
  if (!title || commissionRate === undefined) {
    res.status(400).json({ error: 'Titre de l’offre et commission nécessaires' });
    return;
  }

  const offer: Offer = {
    id: `off_${Date.now()}`,
    title,
    description: description || '',
    commissionRate: Number(commissionRate),
    entryFee: Number(entryFee) || 0,
    targetCompanyId,
    createdAt: new Date().toISOString(),
  };

  dbStore.offers.push(offer);
  dbStore.log(u.id, u.name, 'CREATE_OFFER', `Publication de l’offretarifaire '${title}'`);
  res.json(offer);
});

offersRouter.delete('/offers/:id', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const idx = dbStore.offers.findIndex(o => o.id === req.params['id']);
  if (idx !== -1) {
    dbStore.offers.splice(idx, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Offre non trouvée' });
  }
});
