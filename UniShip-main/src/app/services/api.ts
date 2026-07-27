import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'company' | 'client' | 'driver' | 'collaborator';
  status: 'active' | 'pending' | 'inactive';
  companyId?: string;
  color?: string;
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
  monthlyOrdersCount?: number;
  inactivityDays?: number;
  paymentDelayDays?: number;
  nonConformingWarningsCount?: number;
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
  permissions?: 'read' | 'write' | 'admin';
}

export interface SubAccount {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: string;
  permissions: 'read' | 'write' | 'admin';
  status?: 'active' | 'pending' | 'inactive';
}

export interface AppStats {
  metrics: {
    lowStocksCount: number;
    totalEarnings: number;
    activeContracts: number;
    ordersCount: number;
    salesSum: number;
    totalProducts: number;
    totalOrders: number;
    lowStocksWarning: number;
    earningsTotal: number;
    deliveredCount: number;
  };
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  stock: number;
  threshold: number;
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

export interface Offer {
  id: string;
  title: string;
  description: string;
  commissionRate: number;
  entryFee: number;
  targetCompanyId?: string;
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
  distanceKm?: number;
  calculatedFee?: number;
  estimatedMinutes?: number;
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

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
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

@Injectable({
  providedIn: 'root'
})
export class ApiClient {
  private platformId = inject(PLATFORM_ID);
  
  // App-wide state signals
  currentUser = signal<User | null>(null);
  authToken = signal<string | null>(null);
  cart = signal<{ product: Product; quantity: number }[]>([]);
  
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const persisted = localStorage.getItem('ecom_current_user');
      if (persisted) {
        try {
          this.currentUser.set(JSON.parse(persisted));
        } catch {
          // ignore
        }
      }

      const persistedToken = localStorage.getItem('ecom_auth_token');
      if (persistedToken) {
        this.authToken.set(persistedToken);
      }

      // Persist user changes
      effect(() => {
        const user = this.currentUser();
        if (user) {
          localStorage.setItem('ecom_current_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('ecom_current_user');
        }
      });

      // Persist token changes
      effect(() => {
        const token = this.authToken();
        if (token) {
          localStorage.setItem('ecom_auth_token', token);
        } else {
          localStorage.removeItem('ecom_auth_token');
        }
      });
    }
  }

  // Helper fetch wrapper to inject the JWT bearer token
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.authToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur serveur: N/A (Status: ${response.status})`);
    }

    return response.json() as Promise<T>;
  }

  // ==========================================
  // Auth API
  // ==========================================
  async login(email: string, password?: string): Promise<User> {
    const data = await this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.authToken.set(data.token);
    this.currentUser.set(data.user);
    return data.user;
  }

  async register(payload: { name: string; email: string; role: string; phone?: string; address?: string; companyColor?: string; password?: string }): Promise<{ message: string; user: User }> {
    return this.request<{ message: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  logout() {
    this.currentUser.set(null);
    this.authToken.set(null);
    this.cart.set([]);
  }

  async getSubAccounts(): Promise<SubAccount[]> {
    return this.request<SubAccount[]>('/api/auth/subaccounts');
  }

  /** Retourne les entreprises actives pour le filtre "Partenaire" du catalogue client.
   *  N'exige pas d'authentification — ne renvoie que les champs publics. */
  async getPublicCompanies(): Promise<Pick<User, 'id' | 'name' | 'color' | 'logo' | 'role' | 'status'>[]> {
    return this.request('/api/companies/public');
  }

  async createSubAccount(payload: { name: string; email: string; pRole?: string; permissions?: string }): Promise<SubAccount> {
    return this.request<SubAccount>('/api/auth/subaccounts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // ==========================================
  // Users Admin API
  // ==========================================
  async getUsers(filters?: { role?: string; status?: string }): Promise<User[]> {
    let q = '';
    if (filters) {
      const params = new URLSearchParams();
      if (filters.role) params.append('role', filters.role);
      if (filters.status) params.append('status', filters.status);
      q = '?' + params.toString();
    }
    return this.request<User[]>(`/api/users${q}`);
  }

  async updateUser(userId: string, payload: Partial<User>): Promise<User> {
    return this.request<User>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async updateProfile(payload: Partial<User> & { baseFee?: number; perKmFee?: number; zone?: string; driverStatus?: string; photo?: string }): Promise<User> {
    const res = await this.request<{ message: string; user: User }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    this.currentUser.set(res.user);
    return res.user;
  }

  // ==========================================
  // Products / Catalog API
  // ==========================================
  async getProducts(filters?: { category?: string; search?: string; companyId?: string; all?: boolean; limit?: number; skip?: number }): Promise<Product[]> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.companyId) params.append('companyId', filters.companyId);
      if (filters.all) params.append('all', 'true');
      if (filters.limit !== undefined) params.append('limit', String(filters.limit));
      if (filters.skip !== undefined) params.append('skip', String(filters.skip));
    }
    return this.request<Product[]>(`/api/products?${params.toString()}`);
  }

  async createProduct(payload: Partial<Product>): Promise<Product> {
    return this.request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateProduct(id: string, payload: Partial<Product>): Promise<Product> {
    return this.request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/products/${id}`, {
      method: 'DELETE'
    });
  }

  // ==========================================
  // Stock / Requests API
  // ==========================================
  async getStockRequests(): Promise<StockRequest[]> {
    return this.request<StockRequest[]>('/api/stock-requests');
  }

  async createStockRequest(productId: string, payload: { quantity: number; justification: string; requestedPrice?: number }): Promise<StockRequest> {
    return this.request<StockRequest>(`/api/products/${productId}/stock-request`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async actionStockRequest(id: string, status: 'approved' | 'rejected'): Promise<StockRequest> {
    return this.request<StockRequest>(`/api/stock-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // ==========================================
  // Category / Requests API
  // ==========================================
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/api/categories');
  }

  async getCategoryRequests(): Promise<CategoryRequest[]> {
    return this.request<CategoryRequest[]>('/api/categories/requests');
  }

  async createCategoryRequest(name: string): Promise<CategoryRequest> {
    return this.request<CategoryRequest>('/api/categories/request', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  }

  async actionCategoryRequest(id: string, status: 'approved' | 'rejected'): Promise<CategoryRequest> {
    return this.request<CategoryRequest>(`/api/categories/requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // ==========================================
  // Offers API
  // ==========================================
  async getOffers(): Promise<Offer[]> {
    return this.request<Offer[]>('/api/offers');
  }

  async createOffer(payload: Partial<Offer>): Promise<Offer> {
    return this.request<Offer>('/api/offers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async deleteOffer(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/offers/${id}`, {
      method: 'DELETE'
    });
  }

  // ==========================================
  // Drivers API
  // ==========================================
  async getDrivers(): Promise<Driver[]> {
    return this.request<Driver[]>('/api/drivers');
  }

  async updateDriverStatus(status: 'available' | 'busy' | 'offline'): Promise<Driver> {
    return this.request<Driver>('/api/drivers/status', {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // ==========================================
  // Orders API
  // ==========================================
  async getOrders(): Promise<Order[]> {
    return this.request<Order[]>('/api/orders');
  }

  async checkout(payload: {
    items: { productId: string; quantity: number }[];
    deliveryAddress: string;
    driverId: string;
    driverName: string;
    driverFee: number;
    paymentMethod: string;
  }): Promise<{ message: string; order: Order }> {
    const res = await this.request<{ message: string; order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    this.cart.set([]); // clear cart
    return res;
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    return this.request<Order>(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  async selectDriverForOrder(orderId: string, driverId: string, driverName: string, driverFee: number): Promise<Order> {
    return this.request<Order>(`/api/orders/${orderId}/select-driver`, {
      method: 'PUT',
      body: JSON.stringify({ driverId, driverName, driverFee })
    });
  }

  // ==========================================
  // Support Tickets API
  // ==========================================
  async getTickets(): Promise<SupportTicket[]> {
    return this.request<SupportTicket[]>('/api/tickets');
  }

  async createTicket(subject: string, message: string): Promise<SupportTicket> {
    return this.request<SupportTicket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, message })
    });
  }

  async replyTicket(ticketId: string, message: string, markResolved = false): Promise<SupportTicket> {
    return this.request<SupportTicket>(`/api/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message, markResolved })
    });
  }

  // ==========================================
  // Stats & Audit Log API
  // ==========================================
  async getStats(): Promise<AppStats> {
    return this.request<AppStats>('/api/stats');
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request<AuditLog[]>('/api/audit-logs');
  }

  // ==========================================
  // Simulated Emails API
  // ==========================================
  async getSimulatedEmails(): Promise<SimulatedEmail[]> {
    return this.request<SimulatedEmail[]>('/api/simulated-emails');
  }

  async markSimulatedEmailAsRead(id: string): Promise<{ success: boolean; email: SimulatedEmail }> {
    return this.request<{ success: boolean; email: SimulatedEmail }>(`/api/simulated-emails/${id}/read`, {
      method: 'PUT'
    });
  }
}