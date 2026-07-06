import { Schema, model, Document } from 'mongoose';
import { SimulatedEmail } from '../../store';

export interface MongoSimulatedEmailDoc extends Omit<SimulatedEmail, '_id'>, Document {}

const SimulatedEmailSchema = new Schema<MongoSimulatedEmailDoc>({
  id:        { type: String, required: true, unique: true, index: true },
  to:        { type: String, required: true, index: true },
  subject:   { type: String, required: true },
  body:      { type: String, required: true },
  createdAt: { type: String },
  read:      { type: Boolean, default: false },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoSimulatedEmail = model<MongoSimulatedEmailDoc>('SimulatedEmail', SimulatedEmailSchema);
