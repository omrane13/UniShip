import { Schema, model, Document } from 'mongoose';
import { Order, OrderItem } from '../../store';

export interface MongoOrderDoc extends Omit<Order, '_id'>, Document {}

const OrderItemSchema = new Schema<OrderItem>({
  productId:   { type: String, required: true },
  productName: { type: String, required: true },
  price:       { type: Number, required: true },
  quantity:    { type: Number, required: true },
  companyId:   { type: String, required: true },
}, { _id: false });

const OrderSchema = new Schema<MongoOrderDoc>({
  id:              { type: String, required: true, unique: true, index: true },
  clientId:        { type: String, required: true, index: true },
  clientName:      { type: String, required: true },
  clientEmail:     { type: String, required: true },
  items:           { type: [OrderItemSchema], required: true },
  total:           { type: Number, required: true },
  deliveryAddress: { type: String, required: true },
  driverId:        { type: String, default: '' },
  driverName:      { type: String, default: '' },
  driverFee:       { type: Number, default: 0 },
  paymentMethod:   { type: String, enum: ['stripe', 'paypal', 'cash'], required: true },
  paymentStatus:   { type: String, enum: ['paid', 'unpaid', 'refunded'], default: 'unpaid' },
  status:          { type: String, enum: ['pending', 'accepted', 'preparing', 'transit', 'delivered', 'cancelled'], default: 'pending', index: true },
  updatedAt:       { type: String },
  createdAt:       { type: String },
  invoiceUrl:      { type: String },
}, {
  toJSON: {
    transform: (doc, ret) => {
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

export const MongoOrder = model<MongoOrderDoc>('Order', OrderSchema);
