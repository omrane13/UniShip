import { isMongoEnabled } from './connection';
import { MongoUser } from './models/user';
import { MongoCompany } from './models/company';
import { MongoProduct } from './models/product';
import { MongoOrder } from './models/order';
import { MongoDriver } from './models/driver';
import { MongoSubAccount } from './models/subaccount';
import { MongoOffer } from './models/offer';
import { MongoStockRequest } from './models/stock-request';
import { MongoTicket } from './models/ticket';
import { MongoAuditLog } from './models/audit-log';
import { MongoSimulatedEmail } from './models/simulated-email';
import { MongoCategory } from './models/category';
import { MongoCategoryRequest } from './models/category-request';
import { dbStore, User, Company, Product, Order, Driver, SubAccount, Offer, StockRequest, SupportTicket, AuditLog, SimulatedEmail, Category, CategoryRequest } from '../store';

/**
 * Professional Repository Layer — UniShip
 * Toutes les entités sont persistées dans MongoDB Atlas.
 * Fallback automatique vers le store in-memory si MongoDB est indisponible.
 */

// ==========================================
// USER REPOSITORY
// ==========================================
export const UserRepository = {
  async getAll(role?: string, status?: string): Promise<User[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (role) query['role'] = role;
        if (status) query['status'] = status;
        const users = await MongoUser.find(query).sort({ createdAt: -1 });
        return users.map(u => u.toJSON() as User);
      } catch (err) {
        console.error('[UserRepository] getAll fallback:', err);
      }
    }
    let list = [...dbStore.users];
    if (role) list = list.filter(u => u.role === role);
    if (status) list = list.filter(u => u.status === status);
    return list;
  },

  async getById(id: string): Promise<User | undefined> {
    if (isMongoEnabled()) {
      try {
        const user = await MongoUser.findOne({ id });
        if (user) return user.toJSON() as User;
      } catch (err) {
        console.error('[UserRepository] getById fallback:', err);
      }
    }
    return dbStore.users.find(u => u.id === id);
  },

  async getByEmail(email: string): Promise<User | undefined> {
    if (isMongoEnabled()) {
      try {
        const user = await MongoUser.findOne({ email: email.toLowerCase() });
        if (user) return user.toJSON() as User;
      } catch (err) {
        console.error('[UserRepository] getByEmail fallback:', err);
      }
    }
    return dbStore.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async create(user: User): Promise<User> {
    const idx = dbStore.users.findIndex(u => u.id === user.id);
    if (idx === -1) dbStore.users.push(user);
    else dbStore.users[idx] = user;

    if (isMongoEnabled()) {
      try {
        await MongoUser.findOneAndUpdate({ id: user.id }, user, { upsert: true, returnDocument: 'after' });
        console.log(`[UserRepository] User '${user.name}' (${user.role}) persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[UserRepository] create error:', err);
      }
    }
    return user;
  },

  async update(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = dbStore.users.find(u => u.id === id);
    if (user) Object.assign(user, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoUser.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as User;
      } catch (err) {
        console.error('[UserRepository] update error:', err);
      }
    }
    return user;
  },

  async delete(id: string): Promise<boolean> {
    const idx = dbStore.users.findIndex(u => u.id === id);
    if (idx !== -1) dbStore.users.splice(idx, 1);

    if (isMongoEnabled()) {
      try {
        const res = await MongoUser.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[UserRepository] delete error:', err);
      }
    }
    return idx !== -1;
  }
};

// ==========================================
// COMPANY REPOSITORY
// ==========================================
export const CompanyRepository = {
  async getAll(filters?: { status?: string }): Promise<Company[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = { role: 'company' };
        if (filters?.status) query['status'] = filters.status;
        const companies = await MongoCompany.find(query).sort({ createdAt: -1 });
        return companies.map(c => c.toJSON() as Company);
      } catch (err) {
        console.error('[CompanyRepository] getAll fallback:', err);
      }
    }
    // Fallback to memory
    let list = [...dbStore.companies];
    if (filters?.status) list = list.filter(c => c.status === filters.status);
    return list;
  },

  async getById(id: string): Promise<Company | undefined> {
    if (isMongoEnabled()) {
      try {
        const company = await MongoCompany.findOne({ id });
        if (company) return company.toJSON() as Company;
      } catch (err) {
        console.error('[CompanyRepository] getById fallback:', err);
      }
    }
    return dbStore.companies.find(c => c.id === id);
  },

  async getByEmail(email: string): Promise<Company | undefined> {
    if (isMongoEnabled()) {
      try {
        const company = await MongoCompany.findOne({ email: email.toLowerCase() });
        if (company) return company.toJSON() as Company;
      } catch (err) {
        console.error('[CompanyRepository] getByEmail fallback:', err);
      }
    }
    return dbStore.companies.find(c => c.email.toLowerCase() === email.toLowerCase());
  },

  async create(company: Company): Promise<Company> {
    dbStore.companies.push(company);
    if (isMongoEnabled()) {
      try {
        const c = new MongoCompany(company);
        await c.save();
        return c.toJSON() as Company;
      } catch (err) {
        console.error('[CompanyRepository] create error:', err);
      }
    }
    return company;
  },

  async update(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const company = dbStore.companies.find(c => c.id === id);
    if (company) Object.assign(company, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoCompany.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as Company;
      } catch (err) {
        console.error('[CompanyRepository] update error:', err);
      }
    }
    return company;
  },

  async delete(id: string): Promise<boolean> {
    const idx = dbStore.companies.findIndex(c => c.id === id);
    if (idx !== -1) dbStore.companies.splice(idx, 1);

    if (isMongoEnabled()) {
      try {
        const res = await MongoCompany.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[CompanyRepository] delete error:', err);
      }
    }
    return idx !== -1;
  }
};


// ==========================================
// PRODUCT REPOSITORY
// ==========================================
export const ProductRepository = {
  async getAll(filters?: { category?: string; search?: string; companyId?: string; status?: string }): Promise<Product[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (filters?.category) query['category'] = { $regex: filters.category, $options: 'i' };
        if (filters?.companyId) query['companyId'] = filters.companyId;
        if (filters?.status) query['status'] = filters.status;
        if (filters?.search) {
          query['$or'] = [
            { name: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } }
          ];
        }
        const products = await MongoProduct.find(query).sort({ createdAt: -1 });
        return products.map(p => p.toJSON() as Product);
      } catch (err) {
        console.error('[ProductRepository] getAll fallback:', err);
      }
    }
    let list = [...dbStore.products];
    if (filters?.status) list = list.filter(p => p.status === filters.status);
    if (filters?.category) list = list.filter(p => p.category.toLowerCase().includes(filters.category!.toLowerCase()));
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (filters?.companyId) list = list.filter(p => p.companyId === filters.companyId);
    return list;
  },

  async getById(id: string): Promise<Product | undefined> {
    if (isMongoEnabled()) {
      try {
        const prod = await MongoProduct.findOne({ id });
        if (prod) return prod.toJSON() as Product;
      } catch (err) {
        console.error('[ProductRepository] getById fallback:', err);
      }
    }
    return dbStore.products.find(p => p.id === id);
  },

  async create(product: Product): Promise<Product> {
    const idx = dbStore.products.findIndex(p => p.id === product.id);
    if (idx === -1) dbStore.products.push(product);
    else dbStore.products[idx] = product;

    if (isMongoEnabled()) {
      try {
        await MongoProduct.findOneAndUpdate({ id: product.id }, product, { upsert: true, returnDocument: 'after' });
        console.log(`[ProductRepository] Product '${product.name}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[ProductRepository] create error:', err);
      }
    }
    return product;
  },

  async update(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const prod = dbStore.products.find(p => p.id === id);
    if (prod) Object.assign(prod, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoProduct.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as Product;
      } catch (err) {
        console.error('[ProductRepository] update error:', err);
      }
    }
    return prod;
  },

  async delete(id: string): Promise<boolean> {
    const idx = dbStore.products.findIndex(p => p.id === id);
    if (idx !== -1) dbStore.products.splice(idx, 1);

    if (isMongoEnabled()) {
      try {
        const res = await MongoProduct.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[ProductRepository] delete error:', err);
      }
    }
    return idx !== -1;
  }
};

// ==========================================
// ORDER REPOSITORY
// ==========================================
export const OrderRepository = {
  async getAll(filters?: { clientId?: string; driverId?: string; companyId?: string }): Promise<Order[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (filters?.clientId) query['clientId'] = filters.clientId;
        if (filters?.driverId) query['driverId'] = filters.driverId;
        if (filters?.companyId) query['items.companyId'] = filters.companyId;
        const orders = await MongoOrder.find(query).sort({ createdAt: -1 });
        return orders.map(o => o.toJSON() as Order);
      } catch (err) {
        console.error('[OrderRepository] getAll fallback:', err);
      }
    }
    return [...dbStore.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(id: string): Promise<Order | undefined> {
    if (isMongoEnabled()) {
      try {
        const order = await MongoOrder.findOne({ id });
        if (order) return order.toJSON() as Order;
      } catch (err) {
        console.error('[OrderRepository] getById fallback:', err);
      }
    }
    return dbStore.orders.find(o => o.id === id);
  },

  async create(order: Order): Promise<Order> {
    const idx = dbStore.orders.findIndex(o => o.id === order.id);
    if (idx === -1) dbStore.orders.push(order);
    else dbStore.orders[idx] = order;

    if (isMongoEnabled()) {
      try {
        await MongoOrder.findOneAndUpdate({ id: order.id }, order, { upsert: true, returnDocument: 'after' });
        console.log(`[OrderRepository] Order '${order.id}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[OrderRepository] create error:', err);
      }
    }
    return order;
  },

  async update(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const order = dbStore.orders.find(o => o.id === id);
    if (order) Object.assign(order, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoOrder.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as Order;
      } catch (err) {
        console.error('[OrderRepository] update error:', err);
      }
    }
    return order;
  }
};

// ==========================================
// DRIVER REPOSITORY
// ==========================================
export const DriverRepository = {
  async getAll(): Promise<Driver[]> {
    if (isMongoEnabled()) {
      try {
        const drivers = await MongoDriver.find({});
        return drivers.map(d => d.toJSON() as Driver);
      } catch (err) {
        console.error('[DriverRepository] getAll fallback:', err);
      }
    }
    return [...dbStore.drivers];
  },

  async getByUserId(userId: string): Promise<Driver | undefined> {
    if (isMongoEnabled()) {
      try {
        const drv = await MongoDriver.findOne({ userId });
        if (drv) return drv.toJSON() as Driver;
      } catch (err) {
        console.error('[DriverRepository] getByUserId fallback:', err);
      }
    }
    return dbStore.drivers.find(d => d.userId === userId);
  },

  async getById(id: string): Promise<Driver | undefined> {
    if (isMongoEnabled()) {
      try {
        const drv = await MongoDriver.findOne({ id });
        if (drv) return drv.toJSON() as Driver;
      } catch (err) {
        console.error('[DriverRepository] getById fallback:', err);
      }
    }
    return dbStore.drivers.find(d => d.id === id);
  },

  async create(driver: Driver): Promise<Driver> {
    const idx = dbStore.drivers.findIndex(d => d.id === driver.id);
    if (idx === -1) dbStore.drivers.push(driver);
    else dbStore.drivers[idx] = driver;

    if (isMongoEnabled()) {
      try {
        await MongoDriver.findOneAndUpdate({ id: driver.id }, driver, { upsert: true, returnDocument: 'after' });
        console.log(`[DriverRepository] Driver '${driver.name}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[DriverRepository] create error:', err);
      }
    }
    return driver;
  },

  async update(id: string, updates: Partial<Driver>): Promise<Driver | undefined> {
    const drv = dbStore.drivers.find(d => d.id === id);
    if (drv) Object.assign(drv, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoDriver.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as Driver;
      } catch (err) {
        console.error('[DriverRepository] update error:', err);
      }
    }
    return drv;
  }
};

// ==========================================
// SUBACCOUNT REPOSITORY
// ==========================================
export const SubAccountRepository = {
  async getAll(companyId?: string): Promise<SubAccount[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (companyId) query['companyId'] = companyId;
        const subs = await MongoSubAccount.find(query);
        return subs.map(s => s.toJSON() as SubAccount);
      } catch (err) {
        console.error('[SubAccountRepository] getAll fallback:', err);
      }
    }
    let list = [...dbStore.subAccounts];
    if (companyId) list = list.filter(s => s.companyId === companyId);
    return list;
  },

  async getById(id: string): Promise<SubAccount | undefined> {
    if (isMongoEnabled()) {
      try {
        const sub = await MongoSubAccount.findOne({ id });
        if (sub) return sub.toJSON() as SubAccount;
      } catch (err) {
        console.error('[SubAccountRepository] getById fallback:', err);
      }
    }
    return dbStore.subAccounts.find(s => s.id === id);
  },

  async getByEmail(email: string): Promise<SubAccount | undefined> {
    if (isMongoEnabled()) {
      try {
        const sub = await MongoSubAccount.findOne({ email: email.toLowerCase() });
        if (sub) return sub.toJSON() as SubAccount;
      } catch (err) {
        console.error('[SubAccountRepository] getByEmail fallback:', err);
      }
    }
    return dbStore.subAccounts.find(s => s.email.toLowerCase() === email.toLowerCase());
  },

  async create(sub: SubAccount): Promise<SubAccount> {
    const idx = dbStore.subAccounts.findIndex(s => s.id === sub.id);
    if (idx === -1) dbStore.subAccounts.push(sub);
    else dbStore.subAccounts[idx] = sub;

    if (isMongoEnabled()) {
      try {
        await MongoSubAccount.findOneAndUpdate({ id: sub.id }, sub, { upsert: true, returnDocument: 'after' });
        console.log(`[SubAccountRepository] SubAccount '${sub.name}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[SubAccountRepository] create error:', err);
      }
    }
    return sub;
  },

  async update(id: string, updates: Partial<SubAccount>): Promise<SubAccount | undefined> {
    const sub = dbStore.subAccounts.find(s => s.id === id);
    if (sub) Object.assign(sub, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoSubAccount.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as SubAccount;
      } catch (err) {
        console.error('[SubAccountRepository] update error:', err);
      }
    }
    return sub;
  }
};

// ==========================================
// OFFER REPOSITORY
// ==========================================
export const OfferRepository = {
  async getAll(): Promise<Offer[]> {
    if (isMongoEnabled()) {
      try {
        const offers = await MongoOffer.find({}).sort({ createdAt: -1 });
        return offers.map(o => o.toJSON() as Offer);
      } catch (err) {
        console.error('[OfferRepository] getAll fallback:', err);
      }
    }
    return [...dbStore.offers];
  },

  async create(offer: Offer): Promise<Offer> {
    const idx = dbStore.offers.findIndex(o => o.id === offer.id);
    if (idx === -1) dbStore.offers.push(offer);
    else dbStore.offers[idx] = offer;

    if (isMongoEnabled()) {
      try {
        await MongoOffer.findOneAndUpdate({ id: offer.id }, offer, { upsert: true, returnDocument: 'after' });
        console.log(`[OfferRepository] Offer '${offer.title}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[OfferRepository] create error:', err);
      }
    }
    return offer;
  },

  async delete(id: string): Promise<boolean> {
    const idx = dbStore.offers.findIndex(o => o.id === id);
    if (idx !== -1) dbStore.offers.splice(idx, 1);

    if (isMongoEnabled()) {
      try {
        const res = await MongoOffer.deleteOne({ id });
        return res.deletedCount > 0;
      } catch (err) {
        console.error('[OfferRepository] delete error:', err);
      }
    }
    return idx !== -1;
  }
};

// ==========================================
// STOCK REQUEST REPOSITORY
// ==========================================
export const StockRequestRepository = {
  async getAll(): Promise<StockRequest[]> {
    if (isMongoEnabled()) {
      try {
        const reqs = await MongoStockRequest.find({}).sort({ createdAt: -1 });
        return reqs.map(r => r.toJSON() as StockRequest);
      } catch (err) {
        console.error('[StockRequestRepository] getAll fallback:', err);
      }
    }
    return [...dbStore.stockRequests];
  },

  async getById(id: string): Promise<StockRequest | undefined> {
    if (isMongoEnabled()) {
      try {
        const req = await MongoStockRequest.findOne({ id });
        if (req) return req.toJSON() as StockRequest;
      } catch (err) {
        console.error('[StockRequestRepository] getById fallback:', err);
      }
    }
    return dbStore.stockRequests.find(r => r.id === id);
  },

  async create(req: StockRequest): Promise<StockRequest> {
    const idx = dbStore.stockRequests.findIndex(r => r.id === req.id);
    if (idx === -1) dbStore.stockRequests.push(req);
    else dbStore.stockRequests[idx] = req;

    if (isMongoEnabled()) {
      try {
        await MongoStockRequest.findOneAndUpdate({ id: req.id }, req, { upsert: true, returnDocument: 'after' });
        console.log(`[StockRequestRepository] StockRequest '${req.id}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[StockRequestRepository] create error:', err);
      }
    }
    return req;
  },

  async update(id: string, updates: Partial<StockRequest>): Promise<StockRequest | undefined> {
    const req = dbStore.stockRequests.find(r => r.id === id);
    if (req) Object.assign(req, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoStockRequest.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as StockRequest;
      } catch (err) {
        console.error('[StockRequestRepository] update error:', err);
      }
    }
    return req;
  }
};

// ==========================================
// TICKET REPOSITORY
// ==========================================
export const TicketRepository = {
  async getAll(userId?: string): Promise<SupportTicket[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (userId) query['userId'] = userId;
        const tickets = await MongoTicket.find(query).sort({ createdAt: -1 });
        return tickets.map(t => t.toJSON() as SupportTicket);
      } catch (err) {
        console.error('[TicketRepository] getAll fallback:', err);
      }
    }
    let list = [...dbStore.tickets];
    if (userId) list = list.filter(t => t.userId === userId);
    return list;
  },

  async getById(id: string): Promise<SupportTicket | undefined> {
    if (isMongoEnabled()) {
      try {
        const t = await MongoTicket.findOne({ id });
        if (t) return t.toJSON() as SupportTicket;
      } catch (err) {
        console.error('[TicketRepository] getById fallback:', err);
      }
    }
    return dbStore.tickets.find(t => t.id === id);
  },

  async create(ticket: SupportTicket): Promise<SupportTicket> {
    const idx = dbStore.tickets.findIndex(t => t.id === ticket.id);
    if (idx === -1) dbStore.tickets.push(ticket);
    else dbStore.tickets[idx] = ticket;

    if (isMongoEnabled()) {
      try {
        await MongoTicket.findOneAndUpdate({ id: ticket.id }, ticket, { upsert: true, returnDocument: 'after' });
        console.log(`[TicketRepository] Ticket '${ticket.id}' persisté → MongoDB ✅`);
      } catch (err) {
        console.error('[TicketRepository] create error:', err);
      }
    }
    return ticket;
  },

  async update(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const ticket = dbStore.tickets.find(t => t.id === id);
    if (ticket) Object.assign(ticket, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoTicket.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as SupportTicket;
      } catch (err) {
        console.error('[TicketRepository] update error:', err);
      }
    }
    return ticket;
  }
};

// ==========================================
// AUDIT LOG REPOSITORY
// ==========================================
export const AuditLogRepository = {
  async getAll(): Promise<AuditLog[]> {
    if (isMongoEnabled()) {
      try {
        const logs = await MongoAuditLog.find({}).sort({ createdAt: -1 }).limit(500);
        return logs.map(l => l.toJSON() as AuditLog);
      } catch (err) {
        console.error('[AuditLogRepository] getAll fallback:', err);
      }
    }
    return [...dbStore.auditLogs];
  },

  async create(log: AuditLog): Promise<void> {
    dbStore.auditLogs.unshift(log);

    if (isMongoEnabled()) {
      try {
        await MongoAuditLog.create(log);
      } catch (err) {
        console.error('[AuditLogRepository] create error:', err);
      }
    }
  },

  /** Shortcut helper — remplace dbStore.log() partout */
  async log(userId: string, userName: string, action: string, details: string): Promise<void> {
    const entry: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      userName,
      action,
      details,
      createdAt: new Date().toISOString(),
    };
    await AuditLogRepository.create(entry);
  }
};

// ==========================================
// SIMULATED EMAIL REPOSITORY
// ==========================================
export const SimulatedEmailRepository = {
  async getAll(to?: string): Promise<SimulatedEmail[]> {
    if (isMongoEnabled()) {
      try {
        const query: Record<string, unknown> = {};
        if (to) query['to'] = to.toLowerCase();
        const emails = await MongoSimulatedEmail.find(query).sort({ createdAt: -1 });
        return emails.map(e => e.toJSON() as SimulatedEmail);
      } catch (err) {
        console.error('[SimulatedEmailRepository] getAll fallback:', err);
      }
    }
    let list = [...dbStore.simulatedEmails];
    if (to) list = list.filter(e => e.to.toLowerCase() === to.toLowerCase());
    return list;
  },

  async getById(id: string): Promise<SimulatedEmail | undefined> {
    if (isMongoEnabled()) {
      try {
        const email = await MongoSimulatedEmail.findOne({ id });
        if (email) return email.toJSON() as SimulatedEmail;
      } catch (err) {
        console.error('[SimulatedEmailRepository] getById fallback:', err);
      }
    }
    return dbStore.simulatedEmails.find(e => e.id === id);
  },

  async markAsRead(id: string): Promise<SimulatedEmail | undefined> {
    const email = dbStore.simulatedEmails.find(e => e.id === id);
    if (email) email.read = true;

    if (isMongoEnabled()) {
      try {
        const updated = await MongoSimulatedEmail.findOneAndUpdate({ id }, { $set: { read: true } }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as SimulatedEmail;
      } catch (err) {
        console.error('[SimulatedEmailRepository] markAsRead error:', err);
      }
    }
    return email;
  },

  /** Shortcut helper — remplace dbStore.sendEmail() partout */
  async send(to: string, subject: string, body: string): Promise<void> {
    const email: SimulatedEmail = {
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
      read: false,
    };
    dbStore.simulatedEmails.unshift(email);

    if (isMongoEnabled()) {
      try {
        await MongoSimulatedEmail.create(email);
      } catch (err) {
        console.error('[SimulatedEmailRepository] send error:', err);
      }
    }
  }
};

// ==========================================
// CATEGORY REPOSITORY
// ==========================================
export const CategoryRepository = {
  async getAll(): Promise<Category[]> {
    if (isMongoEnabled()) {
      try {
        const categories = await MongoCategory.find({});
        // Si la collection MongoDB est vide, on initialise avec les catégories de base du store mémoire
        if (categories.length === 0) {
          for (const cat of dbStore.categories) {
            await MongoCategory.create(cat);
          }
          return dbStore.categories;
        }
        return categories.map(c => c.toJSON() as Category);
      } catch (err) {
        console.error('[CategoryRepository] getAll fallback:', err);
      }
    }
    return dbStore.categories;
  },

  async create(category: Category): Promise<Category> {
    dbStore.categories.push(category);
    if (isMongoEnabled()) {
      try {
        await MongoCategory.create(category);
      } catch (err) {
        console.error('[CategoryRepository] create error:', err);
      }
    }
    return category;
  }
};

// ==========================================
// CATEGORY REQUEST REPOSITORY
// ==========================================
export const CategoryRequestRepository = {
  async getAll(): Promise<CategoryRequest[]> {
    if (isMongoEnabled()) {
      try {
        const reqs = await MongoCategoryRequest.find({}).sort({ createdAt: -1 });
        return reqs.map(r => r.toJSON() as CategoryRequest);
      } catch (err) {
        console.error('[CategoryRequestRepository] getAll fallback:', err);
      }
    }
    return dbStore.categoryRequests;
  },

  async getById(id: string): Promise<CategoryRequest | undefined> {
    if (isMongoEnabled()) {
      try {
        const r = await MongoCategoryRequest.findOne({ id });
        if (r) return r.toJSON() as CategoryRequest;
      } catch (err) {
        console.error('[CategoryRequestRepository] getById fallback:', err);
      }
    }
    return dbStore.categoryRequests.find(r => r.id === id);
  },

  async create(req: CategoryRequest): Promise<CategoryRequest> {
    dbStore.categoryRequests.push(req);
    if (isMongoEnabled()) {
      try {
        await MongoCategoryRequest.create(req);
      } catch (err) {
        console.error('[CategoryRequestRepository] create error:', err);
      }
    }
    return req;
  },

  async update(id: string, updates: Partial<CategoryRequest>): Promise<CategoryRequest | undefined> {
    const req = dbStore.categoryRequests.find(r => r.id === id);
    if (req) Object.assign(req, updates);

    if (isMongoEnabled()) {
      try {
        const updated = await MongoCategoryRequest.findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after' });
        if (updated) return updated.toJSON() as CategoryRequest;
      } catch (err) {
        console.error('[CategoryRequestRepository] update error:', err);
      }
    }
    return req;
  }
};