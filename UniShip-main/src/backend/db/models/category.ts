import { Schema, model, Document } from 'mongoose';
import { Category } from '../../store';

export interface MongoCategoryDoc extends Omit<Category, '_id'>, Document {}

const CategorySchema = new Schema<MongoCategoryDoc>({
  id:        { type: String, required: true, unique: true, index: true },
  name:      { type: String, required: true },
  createdAt: { type: String }
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoCategory = model<MongoCategoryDoc>('Category', CategorySchema);
