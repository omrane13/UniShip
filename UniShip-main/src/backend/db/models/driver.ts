import { Schema, model, Document } from 'mongoose';
import { Driver } from '../../store';

export interface MongoDriverDoc extends Omit<Driver, '_id'>, Document {}

const DriverSchema = new Schema<MongoDriverDoc>({
  id:        { type: String, required: true, unique: true, index: true },
  userId:    { type: String, required: true, index: true },
  name:      { type: String, required: true },
  photo:     { type: String, default: '' },
  rating:    { type: Number, default: 5.0 },
  status:    { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
  baseFee:   { type: Number, required: true, default: 2.5 },
  perKmFee:  { type: Number, required: true, default: 0.8 },
  zone:      { type: String, default: '' },
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

export const MongoDriver = model<MongoDriverDoc>('Driver', DriverSchema);
