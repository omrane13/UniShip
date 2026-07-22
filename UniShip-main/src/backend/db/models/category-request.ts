import { Schema, model, Document } from 'mongoose';
import { CategoryRequest } from '../../store';

export interface MongoCategoryRequestDoc extends Omit<CategoryRequest, '_id'>, Document {}

const CategoryRequestSchema = new Schema<MongoCategoryRequestDoc>({
  id:          { type: String, required: true, unique: true, index: true },
  name:        { type: String, required: true },
  companyId:   { type: String, required: true, index: true },
  companyName: { type: String, required: true },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  createdAt:   { type: String }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoCategoryRequest = model<MongoCategoryRequestDoc>('CategoryRequest', CategoryRequestSchema);
