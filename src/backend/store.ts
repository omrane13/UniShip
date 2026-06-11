export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'company' | 'client' | 'driver' | 'collaborator';
  status: 'active' | 'pending' | 'inactive';
  companyId?: string; // For sub-accounts
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

// In-Memory Database State
class InMemoryStore {
  users: User[] = [
    {
      id: 'usr_admin',
      name: 'Super Admin',
      email: 'admin@market.com',
      role: 'admin',
      status: 'active',
      phone: '+33 6 12 34 56 78',
    },
    {
      id: 'usr_company1',
      name: 'EcoShop Bio',
      email: 'contact@ecoshop.com',
      role: 'company',
      status: 'active',
      color: '#10b981', // Emerald
      logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=80&h=80&fit=crop',
      phone: '+216 71 888 999',
      address: 'Route de la Marsa, Tunis',
      // Subscriptions fields
      planId: 'pro',
      billingCycle: 'monthly',
      consecutiveMonthsCount: 3,
      referralCode: 'ECO100',
      isVerifiedPartner: true,
      cancellationRate: 4.5,
      averageRating: 4.6,
      suspended: false,
      paymentMethod: 'konnect',
      entryFeePaid: true,
      inactivityDays: 2,
      paymentDelayDays: 0,
      nonConformingWarningsCount: 0,
      monthlyOrdersCount: 65,
    },
    {
      id: 'usr_company2',
      name: 'Boulangerie d’Antan',
      email: 'antan@boulange.fr',
      role: 'company',
      status: 'active',
      color: '#f59e0b', // Amber
      logo: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=80&h=80&fit=crop',
      phone: '+216 73 555 111',
      address: 'Avenue Habib Bourguiba, Sousse',
      // Subscriptions fields
      planId: 'starter',
      billingCycle: 'monthly',
      consecutiveMonthsCount: 1,
      referralCode: 'ANTAN30',
      isVerifiedPartner: false,
      cancellationRate: 12.5, // above 10% penalty!
      averageRating: 3.8,
      suspended: false,
      paymentMethod: 'paymee',
      entryFeePaid: true,
      inactivityDays: 14,
      paymentDelayDays: 2,
      nonConformingWarningsCount: 1,
      monthlyOrdersCount: 22,
    },
    {
      id: 'usr_company3',
      name: 'BioAliment',
      email: 'sales@bioaliment.com',
      role: 'company',
      status: 'pending', // Requires admin activation
      color: '#3b82f6', // Blue
      logo: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=80&h=80&fit=crop',
      phone: '+216 74 222 333',
      address: 'Zone Industrielle Poudrière, Sfax',
      // Subscriptions fields
      planId: 'premium',
      billingCycle: 'yearly',
      consecutiveMonthsCount: 5,
      referralCode: 'BIOALL9',
      isVerifiedPartner: true,
      cancellationRate: 1.0,
      averageRating: 4.9,
      suspended: false,
      paymentMethod: 'virement',
      entryFeePaid: true,
      inactivityDays: 1,
      paymentDelayDays: 0,
      nonConformingWarningsCount: 0,
      monthlyOrdersCount: 210, // above 200 orders!
    },
    {
      id: 'usr_client1',
      name: 'Alice Dubois',
      email: 'alice@gmail.com',
      role: 'client',
      status: 'active',
      phone: '+33 6 55 44 33 22',
      address: '10 Rue de la Paix, 75002 Paris',
    },
    {
      id: 'usr_driver1',
      name: 'Lucas Martin',
      email: 'lucas@delivery.com',
      role: 'driver',
      status: 'active',
      phone: '+216 22 333 444',
      // Delivery plan
      driverPlanId: 'partenaire',
      driverBillingCycle: 'monthly',
      driverConsecutiveMonthsCount: 2,
      driverCancellationRate: 2.0,
      driverAverageRating: 4.85,
      driverInactivityDays: 1,
      driverNonConformingWarningsCount: 0,
      driverMonthlyDeliveriesCount: 45,
      driverPaymentMethod: 'konnect',
      driverEntryFeePaid: true
    },
    {
      id: 'usr_driver2',
      name: 'Emma Bernard',
      email: 'emma@delivery.com',
      role: 'driver',
      status: 'active',
      phone: '+216 55 666 777',
      // Delivery plan
      driverPlanId: 'freelance',
      driverBillingCycle: 'monthly',
      driverConsecutiveMonthsCount: 0,
      driverCancellationRate: 6.5,
      driverAverageRating: 4.2,
      driverInactivityDays: 8,
      driverNonConformingWarningsCount: 0,
      driverMonthlyDeliveriesCount: 18,
      driverPaymentMethod: 'virement',
      driverEntryFeePaid: false
    },
  ];

  subAccounts: SubAccount[] = [
    {
      id: 'sub_1',
      companyId: 'usr_company1',
      name: 'Gérant EcoShop Nord',
      email: 'nord@ecoshop.com',
      role: 'Manager',
      permissions: 'write',
      status: 'active',
    },
  ];

  products: Product[] = [
    {
      id: 'prod_1',
      name: 'Pommes Gala Bio',
      description: 'Pommes Gala fraîches et croquantes issues de l’agriculture biologique locale.',
      price: 3.50,
      category: 'Fruits & Légumes',
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop',
      stock: 45,
      threshold: 10,
      companyId: 'usr_company1',
      companyName: 'EcoShop Bio',
      companyColor: '#10b981',
      status: 'active',
    },
    {
      id: 'prod_2',
      name: 'Baguette Tradition',
      description: 'Baguette cuite sur pierre selon une méthode artisanale traditionnelle.',
      price: 1.20,
      category: 'Boulangerie & Pâtisserie',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
      stock: 8, // Triggers warning
      threshold: 10,
      companyId: 'usr_company2',
      companyName: 'Boulangerie d’Antan',
      companyColor: '#f59e0b',
      status: 'active',
    },
    {
      id: 'prod_3',
      name: 'Croissant au Beurre AOP',
      description: 'Pur beurre d’Isigny, feuilletage croustillant et moelleux.',
      price: 1.50,
      category: 'Boulangerie & Pâtisserie',
      image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop',
      stock: 35,
      threshold: 5,
      companyId: 'usr_company2',
      companyName: 'Boulangerie d’Antan',
      companyColor: '#f59e0b',
      status: 'active',
    },
    {
      id: 'prod_4',
      name: 'Jus d’Orange Pressé',
      description: 'Jus d’orange 100% pur fruit, pressé à froid le matin même.',
      price: 4.20,
      category: 'Boissons & Jus',
      image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop',
      stock: 50,
      threshold: 15,
      companyId: 'usr_company1',
      companyName: 'EcoShop Bio',
      companyColor: '#10b981',
      status: 'active',
    },
    {
      id: 'prod_5',
      name: 'Tomates Grappes',
      description: 'Tomates rouges savoureuses cultivées de manière durable.',
      price: 2.90,
      category: 'Fruits & Légumes',
      image: 'https://images.unsplash.com/photo-1595855759920-86582396756a?w=400&h=300&fit=crop',
      stock: 120,
      threshold: 20,
      companyId: 'usr_company1',
      companyName: 'EcoShop Bio',
      companyColor: '#10b981',
      status: 'active',
    },
    {
      id: 'prod_6',
      name: 'Avocats Prêts-à-Manger',
      description: 'Avocats crémeux, parfaits pour vos salades ou guacamole.',
      price: 1.99,
      category: 'Fruits & Légumes',
      image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&h=300&fit=crop',
      stock: 3, // Low stock!
      threshold: 10,
      companyId: 'usr_company1',
      companyName: 'EcoShop Bio',
      companyColor: '#10b981',
      status: 'pending', // Requires admin approval
    }
  ];

  stockRequests: StockRequest[] = [
    {
      id: 'req_1',
      productId: 'prod_2',
      productName: 'Baguette Tradition',
      companyId: 'usr_company2',
      companyName: 'Boulangerie d’Antan',
      quantity: 100,
      justification: 'Forte demande prévue pour l’évènement du weekend.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  ];

  offers: Offer[] = [
    {
      id: 'off_1',
      title: 'Offre Standard Commission',
      description: 'Frais de transaction standard pour les nouvelles entreprises.',
      commissionRate: 10,
      entryFee: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'off_2',
      title: 'Offre Premium Illimitée',
      description: 'Commission réduite pour les partenaires de confiance.',
      commissionRate: 5,
      entryFee: 150,
      targetCompanyId: 'usr_company1',
      createdAt: new Date().toISOString(),
    }
  ];

  drivers: Driver[] = [
    {
      id: 'drv_1',
      userId: 'usr_driver1',
      name: 'Lucas Martin',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      rating: 4.8,
      status: 'available',
      baseFee: 2.50,
      perKmFee: 0.80,
      zone: 'Paris Centre',
    },
    {
      id: 'drv_2',
      userId: 'usr_driver2',
      name: 'Emma Bernard',
      photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      rating: 4.9,
      status: 'available',
      baseFee: 3.00,
      perKmFee: 0.90,
      zone: 'Paris Ouest / Garenne',
    }
  ];

  orders: Order[] = [
    {
      id: 'ord_1',
      clientId: 'usr_client1',
      clientName: 'Alice Dubois',
      clientEmail: 'alice@gmail.com',
      items: [
        {
          productId: 'prod_1',
          productName: 'Pommes Gala Bio',
          price: 3.50,
          quantity: 2,
          companyId: 'usr_company1',
        },
        {
          productId: 'prod_3',
          productName: 'Croissant au Beurre AOP',
          price: 1.50,
          quantity: 4,
          companyId: 'usr_company2',
        }
      ],
      total: 13.00,
      deliveryAddress: '10 Rue de la Paix, 75002 Paris',
      driverId: 'drv_1',
      driverName: 'Lucas Martin',
      driverFee: 4.50,
      paymentMethod: 'stripe',
      paymentStatus: 'paid',
      status: 'pending',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  ];

  auditLogs: AuditLog[] = [
    {
      id: 'log_1',
      userId: 'usr_admin',
      userName: 'Super Admin',
      action: 'APPROVE_COMPANY',
      details: 'Activation du compte EcoShop Bio',
      createdAt: new Date().toISOString(),
    }
  ];

  tickets: SupportTicket[] = [
    {
      id: 'tkt_1',
      userId: 'usr_company1',
      userName: 'EcoShop Bio',
      userRole: 'company',
      subject: 'Problème de mise en ligne d’images',
      message: 'Bonjour, je n’arrive pas à télécharger le logo au bon format. Pouvez-vous m’aider ?',
      status: 'open',
      createdAt: new Date().toISOString(),
      replies: [
        {
          senderName: 'Super Admin',
          senderRole: 'admin',
          message: 'Bonjour, nous recommandons le format PNG ou JPEG en dessous de 2Mo. Est-ce le cas ?',
          createdAt: new Date().toISOString(),
        }
      ],
    }
  ];

  // Helper actions
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
