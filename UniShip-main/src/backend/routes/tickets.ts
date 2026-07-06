import { Router, Request, Response } from 'express';
import { SupportTicket } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';
import { TicketRepository, AuditLogRepository } from '../db/repository';

export const ticketsRouter = Router();

// ==========================================
// 7. SUPPORT TICKETS MODULE
// ==========================================

ticketsRouter.get('/tickets', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) { res.status(403).json({ error: 'Accès interdit' }); return; }

  if (u.role === 'admin') {
    res.json(await TicketRepository.getAll());
  } else {
    const ownerId = getCompanyOwnerId(u);
    const all = await TicketRepository.getAll();
    res.json(all.filter(t => t.userId === u.id || (u.role === 'collaborator' && t.userId === ownerId)));
  }
});

ticketsRouter.post('/tickets', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) { res.status(403).json({ error: 'Accès interdit' }); return; }

  const { subject, message } = req.body;
  if (!subject || !message) {
    res.status(400).json({ error: 'Objet et message obligatoires' });
    return;
  }

  const ticket: SupportTicket = {
    id: `tkt_${Date.now()}`,
    userId: u.id,
    userName: u.name,
    userRole: u.role,
    subject,
    message,
    status: 'open',
    createdAt: new Date().toISOString(),
    replies: [],
  };

  await TicketRepository.create(ticket);
  await AuditLogRepository.log(u.id, u.name, 'CREATE_TICKET', `Nouveau ticket: ${subject}`);
  res.json(ticket);
});

ticketsRouter.post('/tickets/:id/replies', async (req: Request, res: Response): Promise<void> => {
  const u = getCurrentUser(req);
  if (!u) { res.status(403).json({ error: 'Accès interdit' }); return; }

  const t = await TicketRepository.getById(req.params['id'] as string);
  if (!t) { res.status(404).json({ error: 'Ticket introuvable' }); return; }

  const { message, markResolved } = req.body;

  const updatedReplies = [...t.replies];
  if (message) {
    updatedReplies.push({
      senderName: u.name,
      senderRole: u.role,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  const updates: Partial<SupportTicket> = { replies: updatedReplies };
  if (markResolved) updates.status = 'resolved';

  const updated = await TicketRepository.update(t.id, updates);
  await AuditLogRepository.log(u.id, u.name, 'REPLY_TICKET', `Réponse ajoutée au ticket ${t.id}`);
  res.json(updated || t);
});
