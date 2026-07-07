import { Schema, model, Document } from 'mongoose';
import { Company } from '../../store';

export interface MongoCompanyDoc extends Omit<Company, '_id'>, Document {}

const CompanySchema = new Schema<MongoCompanyDoc>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String },
  role: {
    type: String,
    enum: ['company'],
    required: true,
    default: 'company'
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'inactive'],
    required: true,
    default: 'pending'
  },
  color: { type: String },
  logo: { type: String },
  phone: { type: String },
  address: { type: String },

  planId: { type: String, enum: ['starter', 'pro', 'premium'] },
  billingCycle: { type: String, enum: ['monthly', 'yearly'] },
  consecutiveMonthsCount: { type: Number, default: 0 },
  referralCode: { type: String },
  isVerifiedPartner: { type: Boolean, default: false },
  cancellationRate: { type: Number, default: 0 },
  averageRating: { type: Number, default: 5.0 },
  suspended: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['konnect', 'paymee', 'virement', 'cheque'] },
  entryFeePaid: { type: Boolean, default: false },
  inactivityDays: { type: Number, default: 0 },
  paymentDelayDays: { type: Number, default: 0 },
  nonConformingWarningsCount: { type: Number, default: 0 },
  monthlyOrdersCount: { type: Number, default: 0 }
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

export const MongoCompany = model<MongoCompanyDoc>('Company', CompanySchema);
