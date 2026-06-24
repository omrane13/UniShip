import { isMongoEnabled } from './connection';
import { MongoUser } from './models/user';
import { MongoProduct } from './models/product';
import { dbStore, User, Product } from '../store';

/**
 * Professional Repository Layer
 * Manages database access for User and Product models.
 * Automatically falls back to the in-memory store (dbStore) when MongoDB is not connected,
 * ensuring high availability and seamless developer experience.
 */
export const UserRepository = {
  /**
   * Fetch all users
   */
  async getAll(role?: string, status?: string): Promise<User[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (role) query['role'] = role;
        if (status) query['status'] = status;
        const users = await MongoUser.find(query);
        return users.map(u => u.toJSON() as User);
      } catch (err) {
        console.error('[Repository] Error fetching users from MongoDB, falling back:', err);
      }
    }

    // Fallback to in-memory store
    let list = [...dbStore.users];
    if (role) list = list.filter(u => u.role === role);
    if (status) list = list.filter(u => u.status === status);
    return list;
  },

  /**
   * Find user by unique ID
   */
  async getById(id: string): Promise<User | undefined> {
    if (isMongoEnabled()) {
      try {
        const user = await MongoUser.findOne({ id });
        if (user) return user.toJSON() as User;
      } catch (err) {
        console.error('[Repository] Error fetching user by ID from MongoDB, falling back:', err);
      }
    }
    return dbStore.users.find(u => u.id === id);
  },

  /**
   * Find user by email
   */
  async getByEmail(email: string): Promise<User | undefined> {
    if (isMongoEnabled()) {
      try {
        const user = await MongoUser.findOne({ email: email.toLowerCase() });
        if (user) return user.toJSON() as User;
      } catch (err) {
        console.error('[Repository] Error fetching user by email from MongoDB, falling back:', err);
      }
    }
    return dbStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  /**
   * Create a new user
   */
  async create(user: User): Promise<User> {
    // 1. Sync to in-memory first to guarantee instant UI response
    const existingIdx = dbStore.users.findIndex(u => u.id === user.id);
    if (existingIdx === -1) {
      dbStore.users.push(user);
    } else {
      dbStore.users[existingIdx] = user;
    }

    // 2. Sync to MongoDB if active
    if (isMongoEnabled()) {
      try {
        await MongoUser.findOneAndUpdate({ id: user.id }, user, { upsert: true, new: true });
        console.log(`[Repository] User '${user.name}' successfully persisted to MongoDB.`);
      } catch (err) {
        console.error('[Repository] Error persisting user to MongoDB:', err);
      }
    }
    return user;
  },

  /**
   * Update an existing user
   */
  async update(id: string, updates: Partial<User>): Promise<User | undefined> {
    // 1. Sync to in-memory
    const user = dbStore.users.find(u => u.id === id);
    if (user) {
      Object.assign(user, updates);
    }

    // 2. Sync to MongoDB
    if (isMongoEnabled()) {
      try {
        const updated = await MongoUser.findOneAndUpdate({ id }, { $set: updates }, { new: true });
        if (updated) return updated.toJSON() as User;
      } catch (err) {
        console.error('[Repository] Error updating user in MongoDB:', err);
      }
    }
    return user;
  },

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<boolean> {
    // 1. Sync to in-memory
    const idx = dbStore.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      dbStore.users.splice(idx, 1);
    }

    // 2. Sync to MongoDB
    if (isMongoEnabled()) {
      try {
        const res = await MongoUser.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[Repository] Error deleting user in MongoDB:', err);
      }
    }
    return idx !== -1;
  }
};

export const ProductRepository = {
  /**
   * Fetch products with optional filters
   */
  async getAll(filters?: { category?: string; search?: string; companyId?: string; status?: string }): Promise<Product[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (filters?.category) {
          query['category'] = { $regex: filters.category, $options: 'i' };
        }
        if (filters?.companyId) {
          query['companyId'] = filters.companyId;
        }
        if (filters?.status) {
          query['status'] = filters.status;
        }
        if (filters?.search) {
          query['$or'] = [
            { name: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } }
          ];
        }
        const products = await MongoProduct.find(query);
        return products.map(p => p.toJSON() as Product);
      } catch (err) {
        console.error('[Repository] Error fetching products from MongoDB, falling back:', err);
      }
    }

    // Fallback to in-memory
    let list = [...dbStore.products];
    if (filters?.status) {
      list = list.filter(p => p.status === filters.status);
    }
    if (filters?.category) {
      const cat = filters.category.toLowerCase();
      list = list.filter(p => p.category.toLowerCase().includes(cat));
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (filters?.companyId) {
      list = list.filter(p => p.companyId === filters.companyId);
    }
    return list;
  },

  /**
   * Find product by ID
   */
  async getById(id: string): Promise<Product | undefined> {
    if (isMongoEnabled()) {
      try {
        const prod = await MongoProduct.findOne({ id });
        if (prod) return prod.toJSON() as Product;
      } catch (err) {
        console.error('[Repository] Error fetching product by ID from MongoDB, falling back:', err);
      }
    }
    return dbStore.products.find(p => p.id === id);
  },

  /**
   * Create a new product
   */
  async create(product: Product): Promise<Product> {
    // 1. Sync to in-memory
    const existingIdx = dbStore.products.findIndex(p => p.id === product.id);
    if (existingIdx === -1) {
      dbStore.products.push(product);
    } else {
      dbStore.products[existingIdx] = product;
    }

    // 2. Sync to MongoDB
    if (isMongoEnabled()) {
      try {
        await MongoProduct.findOneAndUpdate({ id: product.id }, product, { upsert: true, new: true });
        console.log(`[Repository] Product '${product.name}' successfully persisted to MongoDB.`);
      } catch (err) {
        console.error('[Repository] Error persisting product to MongoDB:', err);
      }
    }
    return product;
  },

  /**
   * Update product properties
   */
  async update(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    // 1. Sync to in-memory
    const prod = dbStore.products.find(p => p.id === id);
    if (prod) {
      Object.assign(prod, updates);
    }

    // 2. Sync to MongoDB
    if (isMongoEnabled()) {
      try {
        const updated = await MongoProduct.findOneAndUpdate({ id }, { $set: updates }, { new: true });
        if (updated) return updated.toJSON() as Product;
      } catch (err) {
        console.error('[Repository] Error updating product in MongoDB:', err);
      }
    }
    return prod;
  },

  /**
   * Delete a product by ID
   */
  async delete(id: string): Promise<boolean> {
    // 1. Sync to in-memory
    const idx = dbStore.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      dbStore.products.splice(idx, 1);
    }

    // 2. Sync to MongoDB
    if (isMongoEnabled()) {
      try {
        const res = await MongoProduct.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[Repository] Error deleting product from MongoDB:', err);
      }
    }
    return idx !== -1;
  }
};
