import { Router, Request, Response } from 'express';
import { dbStore, SupportTicket } from '../store';
import { getCurrentUser, getCompanyOwnerId } from './helpers';

export const ticketsRouter = Router();

// ==========================================
// 7. SUPPORT TICKETS MODULE
// ==========================================

ticketsRouter.get('/tickets', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  if (u.role === 'admin') {
    res.json(dbStore.tickets);
  } else {
    const ownerId = getCompanyOwnerId(u);
    res.json(dbStore.tickets.filter(t => t.userId === u.id || (u.role === 'collaborator' && t.userId === ownerId)));
  }
});

ticketsRouter.post('/tickets', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

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

  dbStore.tickets.push(ticket);
  dbStore.log(u.id, u.name, 'CREATE_TICKET', `Nouveau ticket de support créé: ${subject}`);
  res.json(ticket);
});

ticketsRouter.post('/tickets/:id/replies', (req: Request, res: Response): void => {
  const u = getCurrentUser(req);
  if (!u) {
    res.status(403).json({ error: 'Accès interdit' });
    return;
  }

  const t = dbStore.tickets.find(tick => tick.id === req.params['id']);
  if (!t) {
    res.status(404).json({ error: 'Ticket introuvable' });
    return;
  }

  const { message, markResolved } = req.body;
  if (message) {
    t.replies.push({
      senderName: u.name,
      senderRole: u.role,
      message,
      createdAt: new Date().toISOString(),
    });
  }

  if (markResolved) {
    t.status = 'resolved';
  }

  dbStore.log(u.id, u.name, 'REPLY_TICKET', `Réponse ajoutée au ticket ${t.id}`);
  res.json(t);
});
