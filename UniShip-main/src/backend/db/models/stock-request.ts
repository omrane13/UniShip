import { Schema, model, Document } from 'mongoose';
import { StockRequest } from '../../store';

export interface MongoStockRequestDoc extends Omit<StockRequest, '_id'>, Document {}

const StockRequestSchema = new Schema<MongoStockRequestDoc>({
  id:            { type: String, required: true, unique: true, index: true },
  productId:     { type: String, required: true, index: true },
  productName:   { type: String, required: true },
  companyId:     { type: String, required: true, index: true },
  companyName:   { type: String, required: true },
  quantity:      { type: Number, required: true },
  justification: { type: String, required: true },
  status:        { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  createdAt:     { type: String },
  requestedPrice: { type: Number },
  currentPrice:   { type: Number },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoStockRequest = model<MongoStockRequestDoc>('StockRequest', StockRequestSchema);
