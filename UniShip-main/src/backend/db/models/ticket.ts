import { Schema, model, Document } from 'mongoose';
import { SupportTicket } from '../../store';

export interface MongoTicketDoc extends Omit<SupportTicket, '_id'>, Document {}

const ReplySchema = new Schema({
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  message:    { type: String, required: true },
  createdAt:  { type: String },
}, { _id: false });

const TicketSchema = new Schema<MongoTicketDoc>({
  id:        { type: String, required: true, unique: true, index: true },
  userId:    { type: String, required: true, index: true },
  userName:  { type: String, required: true },
  userRole:  { type: String, required: true },
  subject:   { type: String, required: true },
  message:   { type: String, required: true },
  status:    { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
  createdAt: { type: String },
  replies:   { type: [ReplySchema], default: [] },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoTicket = model<MongoTicketDoc>('Ticket', TicketSchema);
