import { Schema, model, Document } from 'mongoose';
import { Product } from '../../store';

export interface MongoProductDoc extends Omit<Product, '_id'>, Document {}

const ProductSchema = new Schema<MongoProductDoc>({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  category: { type: String, required: true, index: true },
  subCategory: { type: String },
  image: { type: String, required: true },
  stock: { type: Number, required: true, default: 0 },
  threshold: { type: Number, required: true, default: 10 },
  companyId: { type: String, required: true, index: true },
  companyName: { type: String, required: true },
  companyColor: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['active', 'pending', 'rejected'], 
    required: true, 
    default: 'pending' 
  },
  rejectionReason: { type: String }
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

export const MongoProduct = model<MongoProductDoc>('Product', ProductSchema);
