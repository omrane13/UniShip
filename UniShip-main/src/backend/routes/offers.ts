import { Router, Request, Response } from 'express';
import { Offer } from '../store';
import { getCurrentUser } from './helpers';
import { OfferRepository, AuditLogRepository } from '../db/repository';

export const offersRouter = Router();

// ==========================================
// 4. MODULE OFFRES TARIFAIRES
// ==========================================

offersRouter.get('/offers', async (req: Request, res: Response): Promise<void> => {
  const offers = await OfferRepository.getAll();
  res.json(offers);
});

offersRouter.post('/offers', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const { title, description, commissionRate, entryFee, targetCompanyId } = req.body;
  if (!title || commissionRate === undefined) {
    res.status(400).json({ error: "Titre de l'offre et commission nécessaires" });
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

  await OfferRepository.create(offer);
  await AuditLogRepository.log(u.id, u.name, 'CREATE_OFFER', `Publication offre tarifaire '${title}'`);
  res.json(offer);
});

offersRouter.delete('/offers/:id', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u || u.role !== 'admin') {
    res.status(403).json({ error: 'Droits insuffisants' });
    return;
  }

  const deleted = await OfferRepository.delete(req.params['id'] as string);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Offre non trouvée' });
  }
});
