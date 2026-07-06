import { Schema, model, Document } from 'mongoose';
import { Offer } from '../../store';

export interface MongoOfferDoc extends Omit<Offer, '_id'>, Document {}

const OfferSchema = new Schema<MongoOfferDoc>({
  id:              { type: String, required: true, unique: true, index: true },
  title:           { type: String, required: true },
  description:     { type: String, default: '' },
  commissionRate:  { type: Number, required: true },
  entryFee:        { type: Number, default: 0 },
  targetCompanyId: { type: String },
  createdAt:       { type: String },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoOffer = model<MongoOfferDoc>('Offer', OfferSchema);
