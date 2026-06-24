import { Schema, model, Document } from 'mongoose';
import { User } from '../../store';

export interface MongoUserDoc extends Omit<User, '_id'>, Document {}

const UserSchema = new Schema<MongoUserDoc>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String },
  role: { 
    type: String, 
    enum: ['admin', 'company', 'client', 'driver', 'collaborator'], 
    required: true,
    default: 'client'
  },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'inactive'], 
    required: true,
    default: 'pending'
  },
  companyId: { type: String },
  permissions: { type: String, enum: ['read', 'write', 'admin'] },
  color: { type: String },
  logo: { type: String },
  phone: { type: String },
  address: { type: String },
  baseFee: { type: Number },
  perKmFee: { type: Number },
  zone: { type: String },
  driverStatus: { type: String },
  photo: { type: String },
  rating: { type: Number, default: 5.0 },

  // Subscriptions & Tunisia specific fields
  planId: { type: String, enum: ['starter', 'pro', 'premium'] },
  billingCycle: { type: String, enum: ['monthly', 'yearly'] },
  consecutiveMonthsCount: { type: Number, default: 0 },
  referralCode: { type: String },
  referredByCode: { type: String },
  isVerifiedPartner: { type: Boolean, default: false },
  cancellationRate: { type: Number, default: 0 },
  averageRating: { type: Number, default: 5.0 },
  suspended: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['konnect', 'paymee', 'virement', 'cheque'] },
  entryFeePaid: { type: Boolean, default: false },
  inactivityDays: { type: Number, default: 0 },
  paymentDelayDays: { type: Number, default: 0 },
  nonConformingWarningsCount: { type: Number, default: 0 },
  monthlyOrdersCount: { type: Number, default: 0 },

  // Livreur (Driver) Subscriptions & Tunisia specific fields
  driverPlanId: { type: String, enum: ['freelance', 'partenaire', 'pro'] },
  driverBillingCycle: { type: String, enum: ['monthly', 'yearly'] },
  driverConsecutiveMonthsCount: { type: Number, default: 0 },
  driverCancellationRate: { type: Number, default: 0 },
  driverAverageRating: { type: Number, default: 5.0 },
  driverInactivityDays: { type: Number, default: 0 },
  driverNonConformingWarningsCount: { type: Number, default: 0 },
  driverMonthlyDeliveriesCount: { type: Number, default: 0 },
  driverPaymentMethod: { type: String, enum: ['konnect', 'virement'] },
  driverEntryFeePaid: { type: Boolean, default: false }
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

export const MongoUser = model<MongoUserDoc>('User', UserSchema);
