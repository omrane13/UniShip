import bcrypt from 'bcryptjs';

export interface Company {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'company';
  status: 'active' | 'pending' | 'inactive';
  color?: string;
  logo?: string;
  phone?: string;
  address?: string;
  planId?: 'starter' | 'pro' | 'premium';
  billingCycle?: 'monthly' | 'yearly';
  consecutiveMonthsCount?: number;
  referralCode?: string;
  isVerifiedPartner?: boolean;
  cancellationRate?: number;
  averageRating?: number;
  suspended?: boolean;
  paymentMethod?: 'konnect' | 'paymee' | 'virement' | 'cheque';
  entryFeePaid?: boolean;
  inactivityDays?: number;
  paymentDelayDays?: number;
  nonConformingWarningsCount?: number;
  monthlyOrdersCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'company' | 'client' | 'driver' | 'collaborator';
  status: 'active' | 'pending' | 'inactive';
  companyId?: string; // For sub-accounts
  permissions?: 'read' | 'write' | 'admin'; // For collaborators
  color?: string; // For companies, assigned by admin
  logo?: string;
  phone?: string;
  address?: string;
  baseFee?: number;
  perKmFee?: number;
  zone?: string;
  driverStatus?: string;
  photo?: string;
  rating?: number;
  
  // Subscriptions & Tunisia specific fields
  planId?: 'starter' | 'pro' | 'premium';
  billingCycle?: 'monthly' | 'yearly';
  consecutiveMonthsCount?: number;
  referralCode?: string;
  referredByCode?: string;
  isVerifiedPartner?: boolean;
  cancellationRate?: number;
  averageRating?: number;
  suspended?: boolean;
  paymentMethod?: 'konnect' | 'paymee' | 'virement' | 'cheque';
  entryFeePaid?: boolean;
  inactivityDays?: number;
  paymentDelayDays?: number;
  nonConformingWarningsCount?: number;
  monthlyOrdersCount?: number;
  // Livreur (Driver) Subscriptions & Tunisia specific fields
  driverPlanId?: 'freelance' | 'partenaire' | 'pro';
  driverBillingCycle?: 'monthly' | 'yearly';
  driverConsecutiveMonthsCount?: number;
  driverCancellationRate?: number;
  driverAverageRating?: number;
  driverInactivityDays?: number;
  driverNonConformingWarningsCount?: number;
  driverMonthlyDeliveriesCount?: number;
  driverPaymentMethod?: 'konnect' | 'virement';
  driverEntryFeePaid?: boolean;
}

export interface SubAccount {
  id: string;
  companyId: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  permissions: 'read' | 'write' | 'admin';
  status?: 'active' | 'pending' | 'inactive';
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subCategory?: string;
  image: string;
  stock: number;
  threshold: number; // For low-stock alerts
  companyId: string;
  companyName: string;
  companyColor: string;
  status: 'active' | 'pending' | 'rejected';
  rejectionReason?: string;
}

export interface StockRequest {
  id: string;
  productId: string;
  productName: string;
  companyId: string;
  companyName: string;
  quantity: number;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  requestedPrice?: number;  // Optional price change request
  currentPrice?: number;    // Price at time of request (for admin reference)
}

export interface NewProductRequest {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  companyId: string;
  stock: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Offer {
  id: string;
  title: string;
  description: string;
  commissionRate: number; // percentage
  entryFee: number; // euros
  targetCompanyId?: string; // Specific or global if empty
  createdAt: string;
}

export interface Driver {
  id: string;
  userId: string;
  name: string;
  photo: string;
  rating: number;
  status: 'available' | 'busy' | 'offline';
  baseFee: number;
  perKmFee: number;
  zone: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  companyId: string;
}

export interface Order {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  items: OrderItem[];
  total: number;
  deliveryAddress: string;
  driverId: string;
  driverName: string;
  driverFee: number;
  paymentMethod: 'stripe' | 'paypal' | 'cash';
  paymentStatus: 'paid' | 'unpaid' | 'refunded';
  status: 'pending' | 'accepted' | 'preparing' | 'transit' | 'delivered' | 'cancelled';
  updatedAt: string;
  createdAt: string;
  invoiceUrl?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  replies: {
    senderName: string;
    senderRole: string;
    message: string;
    createdAt: string;
  }[];
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
}

export interface CategoryRequest {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
}

// In-Memory Database State
class InMemoryStore {
  users: User[] = [
    {
      id: 'usr_admin',
      name: 'Super Admin',
      email: 'admin@market.com',
      // Hashé au démarrage — ne jamais stocker de mot de passe en clair, même pour les données de seed.
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      status: 'active',
      phone: '+33 6 12 34 56 78',
    }
  ];

  companies: Company[] = [];
  subAccounts: SubAccount[] = [];
  products: Product[] = [];
  stockRequests: StockRequest[] = [];
  offers: Offer[] = [];
  drivers: Driver[] = [];
  orders: Order[] = [];
  auditLogs: AuditLog[] = [];
  tickets: SupportTicket[] = [];
  simulatedEmails: SimulatedEmail[] = [];
  
  categories: Category[] = [
    { id: 'cat_1', name: 'Fruits & Légumes', createdAt: new Date().toISOString() },
    { id: 'cat_2', name: 'Boulangerie & Pâtisserie', createdAt: new Date().toISOString() },
    { id: 'cat_3', name: 'Boissons & Jus', createdAt: new Date().toISOString() }
  ];
  categoryRequests: CategoryRequest[] = [];

  // Helper actions
  sendEmail(to: string, subject: string, body: string) {
    this.simulatedEmails.unshift({
      id: `email_${Date.now()}_` + Math.random().toString(36).substr(2, 4),
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
      read: false
    });
  }

  log(userId: string, userName: string, action: string, details: string) {
    this.auditLogs.unshift({
      id: `log_${Date.now()}_` + Math.random().toString(36).substr(2, 4),
      userId,
      userName,
      action,
      details,
      createdAt: new Date().toISOString(),
    });
  }
}

export const dbStore = new InMemoryStore();