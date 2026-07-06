import { Schema, model, Document } from 'mongoose';
import { AuditLog } from '../../store';

export interface MongoAuditLogDoc extends Omit<AuditLog, '_id'>, Document {}

const AuditLogSchema = new Schema<MongoAuditLogDoc>({
  id:        { type: String, required: true, unique: true, index: true },
  userId:    { type: String, required: true, index: true },
  userName:  { type: String, required: true },
  action:    { type: String, required: true, index: true },
  details:   { type: String, default: '' },
  createdAt: { type: String },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoAuditLog = model<MongoAuditLogDoc>('AuditLog', AuditLogSchema);
