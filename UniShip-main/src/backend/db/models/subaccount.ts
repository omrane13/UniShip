import { Schema, model, Document } from 'mongoose';
import { SubAccount } from '../../store';

export interface MongoSubAccountDoc extends Omit<SubAccount, '_id'>, Document {}

const SubAccountSchema = new Schema<MongoSubAccountDoc>({
  id:          { type: String, required: true, unique: true, index: true },
  companyId:   { type: String, required: true, index: true },
  name:        { type: String, required: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String },
  role:        { type: String, default: 'Employé' },
  permissions: { type: String, enum: ['read', 'write', 'admin'], default: 'read' },
  status:      { type: String, enum: ['active', 'pending', 'inactive'], default: 'pending' },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoSubAccount = model<MongoSubAccountDoc>('SubAccount', SubAccountSchema);
