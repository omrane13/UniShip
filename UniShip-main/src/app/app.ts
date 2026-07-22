import { ChangeDetectionStrategy, Component, OnInit, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiClient, User, Product, Order, SupportTicket, Offer, StockRequest, Driver, AuditLog, SubAccount, AppStats, SimulatedEmail, Category, CategoryRequest } from './services/api';
import { AdminDashboard } from './components/admin-dashboard';
import { CompanyDashboard } from './components/company-dashboard';
import { DriverConsole } from './components/driver-console';
import { ClientHub } from './components/client-hub';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, MatIconModule, AdminDashboard, CompanyDashboard, DriverConsole, ClientHub],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  api = inject(ApiClient);

  // App-wide interactive UI views
  activeAuthMode = signal<'login' | 'register'>('login');
  showAuthModal = signal(false);
  showCartDrawer = signal(false);
  
  // Registration Form Signals
  regName = signal('');
  regEmail = signal('');
  regPassword = signal('');
  regRole = signal<'client' | 'company' | 'driver'>('client');
  regPhone = signal('');
  regAddress = signal('');
  regColor = signal('#10b981'); // Emerald
  regFeedback = signal('');

  // Tab selections
  adminCurrentTab = signal<'users' | 'offers' | 'stocks' | 'logs' | 'support' | 'profile'>('users');
  companyCurrentTab = signal<'products' | 'requests' | 'offers' | 'team' | 'support' | 'orders' | 'profile'>('products');
  clientCurrentTab = signal<'browse' | 'orders' | 'support' | 'profile'>('browse');
  driverCurrentTab = signal<'dashboard' | 'profile' | 'subscription'>('dashboard');

  // Profile management editing signals
  profileName = signal('');
  profileEmail = signal('');
  profilePassword = signal('');
  profilePhone = signal('');
  profileAddress = signal('');
  profileLogo = signal('');
  profileBaseFee = signal<number>(3.00);
  profilePerKmFee = signal<number>(0.80);
  profileZone = signal('');
  profilePhoto = signal('');

  // Loaders and errors
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Data Cache Signals
  products = signal<Product[]>([]);
  users = signal<User[]>([]);
  drivers = signal<Driver[]>([]);
  orders = signal<Order[]>([]);
  offers = signal<Offer[]>([]);
  stockRequests = signal<StockRequest[]>([]);
  categories = signal<Category[]>([]);
  categoryRequests = signal<CategoryRequest[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  tickets = signal<SupportTicket[]>([]);
  subAccounts = signal<SubAccount[]>([]);
  globalStats = signal<AppStats | null>(null);
  
  // Simulated Email Signals
  simulatedEmails = signal<SimulatedEmail[]>([]);
  showEmailsInbox = signal(false);
  activeEmailDetails = signal<SimulatedEmail | null>(null);

  // Form Signals: Category Requests
  newCategoryName = signal('');

  // Client search and filters
  searchQuery = signal('');
  categoryFilter = signal('all');
  companyFilter = signal('all');
  selectedProduct = signal<Product | null>(null);

  // Checkout process simulation signals
  deliveryAddress = signal('');
  selectedDriver = signal<Driver | null>(null);
  paymentMethod = signal<'stripe' | 'paypal' | 'cash'>('stripe');
  feeEstimateVisible = signal(false);

  // Form Signals: Add Product
  newProdName = signal('');
  newProdDesc = signal('');
  newProdPrice = signal<number>(5);
  newProdCategory = signal('Fruits & Légumes');
  newProdStock = signal<number>(20);
  newProdThreshold = signal<number>(5);

  // Form Signals: Create Offer (Admin)
  newOfferTitle = signal('');
  newOfferDesc = signal('');
  newOfferCommission = signal<number>(10);
  newOfferFee = signal<number>(0);

  // Form Signals: Create Sub-Account (Company)
  newSubName = signal('');
  newSubEmail = signal('');
  newSubRole = signal('Commercial');
  newSubPerm = signal<'read' | 'write' | 'admin'>('write');

  // Support Ticket Form Signals
  ticketSubject = signal('');
  ticketMessage = signal('');
  selectedTicket = signal<SupportTicket | null>(null);
  ticketReplyText = signal('');

  // Stock Request inputs
  selectedProdForStock = signal<Product | null>(null);
  stockReqQty = signal<number>(50);
  stockReqJustif = signal('');
  stockReqNewPrice = signal<number | null>(null); // Optional price change

  // Price change quick-inputs in products table (productId → new price)
  prodPriceEdits = signal<Record<string, number>>({});

  constructor() {
    // Re-fetch data whenever current user changes
    effect(() => {
      const user = this.api.currentUser();
      this.clearMessages();
      this.selectedTicket.set(null);
      this.selectedProduct.set(null);

      if (user) {
        this.initProfileForm();
        if (user.role === 'admin') {
          this.loadAdminData();
        } else if (user.role === 'company') {
          this.loadCompanyData();
          this.initSimulatorFromUser(user);
        } else if (user.role === 'client') {
          this.loadClientData();
        } else if (user.role === 'driver') {
          this.loadDriverData();
          this.initDriverSimulatorFromUser(user);
        }
        this.loadSimulatedEmails();
      } else {
        // Visitor default load
        this.loadVisitorData();
      }
    });
  }

  ngOnInit() {
    // Trigger initial default query
    if (!this.api.currentUser()) {
      this.loadVisitorData();
    }
  }

  // Clear feedback messages
  clearMessages() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.regFeedback.set('');
  }

  async loadSimulatedEmails() {
    try {
      const emails = await this.api.getSimulatedEmails();
      this.simulatedEmails.set(emails || []);
    } catch (e) {
      console.warn('Erreur lors du chargement des e-mails :', e);
    }
  }

  async markEmailAsRead(id: string) {
    try {
      const res = await this.api.markSimulatedEmailAsRead(id);
      if (res.success) {
        await this.loadSimulatedEmails();
        // Update active email view if open
        const active = this.activeEmailDetails();
        if (active && active.id === id) {
          this.activeEmailDetails.set({ ...active, read: true });
        }
      }
    } catch (e) {
      console.warn('Erreur marquage lu e-mail :', e);
    }
  }

  // ==========================================
  // Quick Switch Simulated Playground logins
  // ==========================================
  async selectPlaygroundUser(role: 'admin' | 'company' | 'client' | 'driver' | 'visitor') {
    this.clearMessages();
    this.selectedTicket.set(null);
    this.selectedProduct.set(null);
    this.selectedProdForStock.set(null);

    if (role === 'visitor') {
      this.api.logout();
      return;
    }

    this.loading.set(true);
    try {
      let email = 'admin@market.com';
      let password = 'admin123';
      if (role === 'company') { email = 'contact@ecoshop.com'; password = 'ecoshop123'; }
      if (role === 'client') { email = 'alice@gmail.com'; password = 'alice123'; }
      if (role === 'driver') { email = 'lucas@delivery.com'; password = 'lucas123'; }

      await this.api.login(email, password);
      this.successMessage.set(`Connecté en tant que ${role === 'admin' ? '👑 Administrateur' : role === 'company' ? '🏢 EcoShop Bio' : role === 'client' ? '🛒 Alice Dubois' : '🚚 Lucas Martin (Livreur)'}`);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Échec de la connexion simulée.');
    } finally {
      this.loading.set(false);
    }
  }

  // Register form handle
  async handleRegistration() {
    this.clearMessages();
    if (!this.regName() || !this.regEmail()) {
      this.regFeedback.set('Veuillez remplir les informations obligatoires.');
      return;
    }

    const isCreatorAdmin = this.api.currentUser()?.role === 'admin';
    if (!isCreatorAdmin && (!this.regPassword() || this.regPassword().length < 4)) {
      this.regFeedback.set('Un mot de passe d\'au moins 4 caractères est obligatoire.');
      return;
    }

    try {
      const res = await this.api.register({
        name: this.regName(),
        email: this.regEmail(),
        password: this.regPassword() || undefined,
        role: this.regRole(),
        phone: this.regPhone(),
        address: this.regAddress(),
        companyColor: this.regRole() === 'company' ? this.regColor() : undefined
      });

      this.successMessage.set(res.message);
      this.activeAuthMode.set('login');
      this.loadSimulatedEmails();
      // Reset registration form
      this.regName.set('');
      this.regEmail.set('');
      this.regPassword.set('');
      this.regPhone.set('');
      this.regAddress.set('');
    } catch (err) { const error = err as { message: string };
      this.regFeedback.set(error.message || 'Une erreur s’est produite lors de l’inscription.');
    }
  }

  // Standard Login handle
  manualEmail = signal('');
  manualPassword = signal('');
  async handleManualLogin() {
    this.clearMessages();
    if (!this.manualEmail()) {
      this.errorMessage.set('Veuillez renseigner un e-mail valide.');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.login(this.manualEmail(), this.manualPassword());
      this.showAuthModal.set(false);
      this.successMessage.set('Connexion réussie !');
      this.manualEmail.set('');
      this.manualPassword.set('');
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Logouts
  triggerLogout() {
    this.api.logout();
    this.showAuthModal.set(false);
    this.loadVisitorData();
    this.simulatedEmails.set([]);
    this.showEmailsInbox.set(false);
    this.activeEmailDetails.set(null);
    this.successMessage.set('Déconnecté avec succès.');
  }

  // Profile Methods
  initProfileForm() {
    const user = this.api.currentUser();
    if (user) {
      this.profileName.set(user.name || '');
      this.profileEmail.set(user.email || '');
      this.profilePassword.set('');
      this.profilePhone.set(user.phone || '');
      this.profileAddress.set(user.address || '');
      this.profileLogo.set(user.logo || '');
      this.profileBaseFee.set(user.baseFee || 3.00);
      this.profilePerKmFee.set(user.perKmFee || 0.80);
      this.profileZone.set(user.zone || '');
      this.profilePhoto.set(user.photo || '');
    }
  }

  async updateUserProfile() {
    this.clearMessages();
    this.loading.set(true);
    try {
      const user = this.api.currentUser();
      const payload: Partial<User> & { password?: string; baseFee?: number; perKmFee?: number; zone?: string; driverStatus?: string; photo?: string } = {
        name: this.profileName(),
        email: this.profileEmail(),
        phone: this.profilePhone(),
        address: this.profileAddress(),
      };

      if (this.profilePassword() !== '') {
        payload.password = this.profilePassword();
      }

      if (user?.role === 'company') {
        payload.logo = this.profileLogo();
      } else if (user?.role === 'driver') {
        payload.baseFee = Number(this.profileBaseFee());
        payload.perKmFee = Number(this.profilePerKmFee());
        payload.zone = this.profileZone();
        payload.photo = this.profilePhoto();
      }

      await this.api.updateProfile(payload);
      this.successMessage.set('Votre compte a été mis à jour avec succès.');
      
      // Refresh current simulated user's data caches if needed
      if (user?.role === 'admin') await this.loadAdminData();
      else if (user?.role === 'company') await this.loadCompanyData();
      else if (user?.role === 'client') await this.loadClientData();
      else if (user?.role === 'driver') await this.loadDriverData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la mise à jour du profil');
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Dynamic Load Functions
  // ==========================================
  // ==========================================
  async loadVisitorData() {
    this.loading.set(true);
    try {
      const [prods, cats] = await Promise.all([
        this.api.getProducts(),
        this.api.getCategories()
      ]);
      this.products.set(prods);
      this.categories.set(cats);
      this.loadSimulatedEmails();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadAdminData() {
    this.loading.set(true);
    try {
      const [usrList, prodList, offerList, sReqs, audit, tkts, stats, cats, catReqs] = await Promise.all([
        this.api.getUsers(),
        this.api.getProducts({ all: true }), // see all products
        this.api.getOffers(),
        this.api.getStockRequests(),
        this.api.getAuditLogs(),
        this.api.getTickets(),
        this.api.getStats(),
        this.api.getCategories(),
        this.api.getCategoryRequests()
      ]);

      this.users.set(usrList);
      this.products.set(prodList);
      this.offers.set(offerList);
      this.stockRequests.set(sReqs);
      this.auditLogs.set(audit);
      this.tickets.set(tkts);
      this.globalStats.set(stats);
      this.categories.set(cats);
      this.categoryRequests.set(catReqs);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Admin : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCompanyData() {
    this.loading.set(true);
    try {
      const [prodList, sReqs, offerList, subs, tkts, stats, ords, drvs, cats, catReqs] = await Promise.all([
        this.api.getProducts({ all: false }), // company owns
        this.api.getStockRequests(),
        this.api.getOffers(),
        this.api.getSubAccounts(),
        this.api.getTickets(),
        this.api.getStats(),
        this.api.getOrders(),
        this.api.getDrivers(),
        this.api.getCategories(),
        this.api.getCategoryRequests()
      ]);

      this.products.set(prodList);
      this.stockRequests.set(sReqs);
      this.offers.set(offerList);
      this.subAccounts.set(subs);
      this.tickets.set(tkts);
      this.globalStats.set(stats);
      this.orders.set(ords);
      this.drivers.set(drvs);
      this.categories.set(cats);
      this.categoryRequests.set(catReqs);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Entreprise : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadClientData() {
    this.loading.set(true);
    try {
      // Charger les livreurs disponibles pour l'estimation des frais (bulle info)
      const [prodList, ords, drvs, tkts, companiesList, cats] = await Promise.all([
        this.api.getProducts(),
        this.api.getOrders(),
        this.api.getDrivers(), // utilisé uniquement pour les estimations de frais
        this.api.getTickets(),
        this.api.getPublicCompanies(),
        this.api.getCategories()
      ]);

      this.products.set(prodList);
      this.orders.set(ords);
      this.drivers.set(drvs); // stocké pour l'estimation, pas pour la sélection
      this.tickets.set(tkts);
      this.categories.set(cats);
      // Peuple app.users() avec les entreprises actives pour le filtre "Partenaire" du catalogue client.
      this.users.set(companiesList as any);

      // set default address for convenience
      const u = this.api.currentUser();
      if (u?.address && !this.deliveryAddress()) {
        this.deliveryAddress.set(u.address);
      }
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Client : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Calcule des estimations de frais de livraison par tranches de distance
  getDeliveryFeeEstimates(): { label: string; minFee: number; maxFee: number; icon: string }[] {
    const drvs = this.drivers();
    if (!drvs.length) {
      // Estimations par défaut si aucun livreur chargé
      return [
        { label: '< 2 km (Zone proche)', minFee: 2.5, maxFee: 5.0, icon: 'near_me' },
        { label: '2 – 5 km (Zone standard)', minFee: 5.0, maxFee: 9.0, icon: 'directions_bike' },
        { label: '5 – 10 km (Zone élargie)', minFee: 9.0, maxFee: 15.0, icon: 'local_shipping' },
        { label: '> 10 km (Zone distante)', minFee: 15.0, maxFee: 25.0, icon: 'route' },
      ];
    }
    // Calculer min/max basés sur les tarifaires réels des livreurs
    const avgBase = drvs.reduce((s, d) => s + d.baseFee, 0) / drvs.length;
    const avgKm   = drvs.reduce((s, d) => s + d.perKmFee, 0) / drvs.length;
    const calc = (km: number) => parseFloat((avgBase + km * avgKm).toFixed(2));
    return [
      { label: '< 2 km — Zone de proximité', minFee: calc(0.5), maxFee: calc(2), icon: 'near_me' },
      { label: '2 – 5 km — Zone standard',     minFee: calc(2),   maxFee: calc(5), icon: 'directions_bike' },
      { label: '5 – 10 km — Zone élargie',     minFee: calc(5),   maxFee: calc(10), icon: 'local_shipping' },
      { label: '> 10 km — Zone distante',       minFee: calc(10),  maxFee: calc(18), icon: 'route' },
    ];
  }

  async loadDriverData() {
    this.loading.set(true);
    try {
      const [ords, tkts, stats] = await Promise.all([
        this.api.getOrders(),
        this.api.getTickets(),
        this.api.getStats()
      ]);

      this.orders.set(ords);
      this.tickets.set(tkts);
      this.globalStats.set(stats);

      // Get current driver profile location status
      const u = this.api.currentUser();
      const driversObj = await this.api.getDrivers();
      const currDrv = driversObj.find(d => d.userId === u?.id);
      if (currDrv) {
        this.selectedDriver.set(currDrv);
      }
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Livreur : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Fetch updated drivers with actual computed geolocation mock fees
  async refreshDriversLocation() {
    this.loading.set(true);
    try {
      const drvs = await this.api.getDrivers();
      this.drivers.set(drvs);
      if (drvs.length && !this.selectedDriver()) {
        this.selectedDriver.set(drvs[0]);
      }
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Client Panier Actions
  // ==========================================
  addToCart(prod: Product) {
    if (prod.stock <= 0) {
      this.errorMessage.set(`Le produit '${prod.name}' est épuisé.`);
      return;
    }
    const current = [...this.api.cart()];
    const idx = current.findIndex(item => item.product.id === prod.id);

    if (idx !== -1) {
      if (current[idx].quantity >= prod.stock) {
        this.errorMessage.set(`Pas assez de stock disponible pour '${prod.name}'.`);
        return;
      }
      current[idx].quantity += 1;
    } else {
      current.push({ product: prod, quantity: 1 });
    }
    this.api.cart.set(current);
    this.successMessage.set(`'${prod.name}' ajouté au panier.`);
  }

  removeFromCart(prodId: string) {
    const current = this.api.cart().filter(item => item.product.id !== prodId);
    this.api.cart.set(current);
  }

  incrementCartItem(prodId: string, limit: number) {
    const current = [...this.api.cart()];
    const item = current.find(i => i.product.id === prodId);
    if (item) {
      if (item.quantity >= limit) {
        this.errorMessage.set(`Limite de stock atteinte (${limit}).`);
        return;
      }
      item.quantity += 1;
      this.api.cart.set(current);
    }
  }

  decrementCartItem(prodId: string) {
    const current = [...this.api.cart()];
    const item = current.find(i => i.product.id === prodId);
    if (item) {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        const idx = current.indexOf(item);
        current.splice(idx, 1);
      }
      this.api.cart.set(current);
    }
  }

  getCartTotal(): number {
    return Number(
      this.api.cart().reduce((sum, item) => sum + item.product.price * item.quantity, 0).toFixed(2)
    );
  }

  // Handle order checkout — le livreur est assigné par l'entreprise après commande
  async triggerCheckout() {
    this.clearMessages();
    this.feeEstimateVisible.set(false);
    const userObj = this.api.currentUser();
    if (!userObj) {
      this.errorMessage.set('Veuillez vous authentifier en tant que Client pour commander.');
      return;
    }

    if (!this.deliveryAddress()) {
      this.errorMessage.set('Veuillez spécifier l’adresse de livraison.');
      return;
    }

    const itemsPayload = this.api.cart().map(i => ({
      productId: i.product.id,
      quantity: i.quantity
    }));

    this.loading.set(true);
    try {
      // Le livreur sera assigné par l'entreprise (driverId vide = "En attente d'attribution")
      const res = await this.api.checkout({
        items: itemsPayload,
        deliveryAddress: this.deliveryAddress(),
        driverId: '',
        driverName: '',
        driverFee: 0,
        paymentMethod: this.paymentMethod()
      });

      this.successMessage.set(res.message);
      this.clientCurrentTab.set('orders');
      await this.loadClientData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la validation du panier');
    } finally {
      this.loading.set(false);
    }
  }

  // Client cancels order
  async cancelOrder(orderId: string) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateOrderStatus(orderId, 'cancelled');
      this.successMessage.set('Commande annulée avec succès. Remboursement initié.');
      const user = this.api.currentUser();
      if (user?.role === 'client') await this.loadClientData();
      else await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Admin Operations
  // ==========================================
  async toggleUserActivation(u: User) {
    this.clearMessages();
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    this.loading.set(true);
    try {
      await this.api.updateUser(u.id, { status: newStatus });
      this.successMessage.set(`L'utilisateur ${u.name} est maintenant ${newStatus === 'active' ? 'activé' : 'désactivé'}.`);
      await this.loadAdminData();
      await this.loadSimulatedEmails();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async editUserRole(userId: string, targetRole: 'admin' | 'company' | 'client' | 'driver') {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateUser(userId, { role: targetRole });
      this.successMessage.set(`Rôle mis à jour.`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async assignCompanyColor(userId: string, hexColor: string) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateUser(userId, { color: hexColor });
      this.successMessage.set(`Code couleur entreprise mis à jour avec succès : ${hexColor}`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Handle Admin product approval
  async decideOnProductApproval(prod: Product, status: 'active' | 'rejected', reason = '') {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateProduct(prod.id, { status, rejectionReason: reason });
      this.successMessage.set(`Produit '${prod.name}' ${status === 'active' ? 'approuvé et publié' : 'refusé'}.`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Handle Admin stock request approval
  async decideOnStockRequest(req: StockRequest, status: 'approved' | 'rejected') {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.actionStockRequest(req.id, status);
      this.successMessage.set(`Demande d'augmentation de stock ${status === 'approved' ? 'acceptée' : 'rejetée'}.`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Manual fast stock adjustments by Admin
  async manualAdjustProductStock(prod: Product, newQty: number) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateProduct(prod.id, { stock: newQty });
      this.successMessage.set(`Stock pour '${prod.name}' ajusté manuellement à ${newQty}.`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Define tariff offer
  async submitNewOffer() {
    this.clearMessages();
    if (!this.newOfferTitle() || this.newOfferCommission() === undefined) {
      this.errorMessage.set('Nom et % de commission requis');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.createOffer({
        title: this.newOfferTitle(),
        description: this.newOfferDesc(),
        commissionRate: this.newOfferCommission(),
        entryFee: this.newOfferFee()
      });

      this.successMessage.set('Nouvelle offre publiée avec succès.');
      this.newOfferTitle.set('');
      this.newOfferDesc.set('');
      this.newOfferCommission.set(10);
      this.newOfferFee.set(0);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteOffer(id: string) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.deleteOffer(id);
      this.successMessage.set('Offre supprimée.');
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Company Operations
  // ==========================================
  async submitNewProduct() {
    this.clearMessages();
    if (!this.newProdName() || !this.newProdPrice() || !this.newProdCategory()) {
      this.errorMessage.set('Veuillez remplir le nom, prix et catégorie.');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.createProduct({
        name: this.newProdName(),
        description: this.newProdDesc(),
        price: Number(this.newProdPrice()),
        category: this.newProdCategory(),
        stock: Number(this.newProdStock()),
        threshold: Number(this.newProdThreshold()),
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop'
      });

      const u = this.api.currentUser();
      this.successMessage.set(u?.role === 'admin' 
        ? `Produit ajouté et publié avec succès.` 
        : `Demande de création de produit soumise avec succès à la validation Admin.`);

      // Reset form variables
      this.newProdName.set('');
      this.newProdDesc.set('');
      this.newProdPrice.set(5);
      this.newProdStock.set(20);

      if (u?.role === 'admin') await this.loadAdminData();
      else await this.loadCompanyData();

    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Assign driver to an order (Step 06 - Company action)
  async assignDriverToOrder(orderId: string, driver: Driver) {
    this.clearMessages();
    this.loading.set(true);
    try {
      const fee = driver.calculatedFee || driver.baseFee || 4.50;
      await this.api.selectDriverForOrder(orderId, driver.id, driver.name, fee);
      this.successMessage.set(`Livreur ${driver.name} assigné à la commande ${orderId} avec succès.`);
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de l’attribution du livreur');
    } finally {
      this.loading.set(false);
    }
  }

  // Propose stock increase
  async raiseStockIncreaseRequest() {
    this.clearMessages();
    const prod = this.selectedProdForStock();
    if (!prod) return;

    if (!this.stockReqQty() || !this.stockReqJustif()) {
      this.errorMessage.set('Saisissez une quantité et un motif.');
      return;
    }

    this.loading.set(true);
    try {
      const newPrice = this.stockReqNewPrice();
      const payload: { quantity: number; justification: string; requestedPrice?: number } = {
        quantity: this.stockReqQty(),
        justification: this.stockReqJustif()
      };
      if (newPrice && newPrice > 0 && newPrice !== prod.price) {
        payload.requestedPrice = newPrice;
      }

      await this.api.createStockRequest(prod.id, payload);

      const priceMsg = payload.requestedPrice ? ` + demande de changement de prix à ${payload.requestedPrice.toFixed(2)} DTN soumise.` : '';
      this.successMessage.set(`Demande d’augmentation de stock enregistrée avec succès.${priceMsg}`);
      this.selectedProdForStock.set(null);
      this.stockReqQty.set(50);
      this.stockReqJustif.set('');
      this.stockReqNewPrice.set(null);
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async triggerDeleteProduct(id: string) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.deleteProduct(id);
      this.successMessage.set('Produit supprimé.');
      const u = this.api.currentUser();
      if (u?.role === 'admin') await this.loadAdminData();
      else await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Create Sub-Account for colleagues
  async submitSubAccount() {
    this.clearMessages();
    if (!this.newSubName() || !this.newSubEmail()) {
      this.errorMessage.set('Nom et email requis');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.createSubAccount({
        name: this.newSubName(),
        email: this.newSubEmail(),
        pRole: this.newSubRole(),
        permissions: this.newSubPerm()
      });

      this.successMessage.set(`Collaborateur ${this.newSubName()} ajouté !`);
      this.newSubName.set('');
      this.newSubEmail.set('');
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Driver Operations
  // ==========================================
  async toggleDriverShift(stat: 'available' | 'busy' | 'offline') {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateDriverStatus(stat);
      this.successMessage.set(`Disponibilité mise à jour : ${stat === 'available' ? 'Disponible 🟢' : stat === 'busy' ? 'Occupé 🟡' : 'Hors ligne 🔴'}`);
      await this.loadDriverData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Order state update (Deliverer or Companys prepping)
  async updateOrderProgress(orderId: string, targetStatus: string) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateOrderStatus(orderId, targetStatus);
      this.successMessage.set(`Statut de commande modifié en : ${targetStatus}`);
      
      const userObj = this.api.currentUser();
      if (userObj?.role === 'driver') await this.loadDriverData();
      else if (userObj?.role === 'company') await this.loadCompanyData();
      else if (userObj?.role === 'client') await this.loadClientData();
      else await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // Support Tickets
  // ==========================================
  async createSupportTicket() {
    this.clearMessages();
    if (!this.ticketSubject() || !this.ticketMessage()) {
      this.errorMessage.set('Objet et message requis.');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.createTicket(this.ticketSubject(), this.ticketMessage());
      this.successMessage.set('Votre ticket a été envoyé avec succès à l’assistance.');
      this.ticketSubject.set('');
      this.ticketMessage.set('');
      
      const user = this.api.currentUser();
      if (user?.role === 'admin') await this.loadAdminData();
      else if (user?.role === 'company') await this.loadCompanyData();
      else if (user?.role === 'client') await this.loadClientData();
      else if (user?.role === 'driver') await this.loadDriverData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async postTicketReply(tkt: SupportTicket, resolve = false) {
    this.clearMessages();
    if (!this.ticketReplyText() && !resolve) {
      this.errorMessage.set('Entrez un message de réponse.');
      return;
    }

    this.loading.set(true);
    try {
      const resp = await this.api.replyTicket(tkt.id, this.ticketReplyText(), resolve);
      this.successMessage.set(resolve ? 'Ticket clos avec succès.' : 'Réponse ajoutée.');
      this.ticketReplyText.set('');
      this.selectedTicket.set(resp);
      
      const user = this.api.currentUser();
      if (user?.role === 'admin') await this.loadAdminData();
      else if (user?.role === 'company') await this.loadCompanyData();
      else if (user?.role === 'client') await this.loadClientData();
      else if (user?.role === 'driver') await this.loadDriverData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Helper getters
  getFilteredProducts(): Product[] {
    let prods = this.products();
    const query = this.searchQuery().trim().toLowerCase();
    const cat = this.categoryFilter();
    const company = this.companyFilter();

    if (query) {
      prods = prods.filter(p => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query));
    }
    if (cat !== 'all') {
      prods = prods.filter(p => p.category === cat);
    }
    if (company !== 'all') {
      prods = prods.filter(p => p.companyId === company);
    }

    return prods;
  }

  // Auto-contrast calculation (WCAG)
  getTextColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith('#') || hexColor.length !== 7) {
      return '#FFFFFF';
    }
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (r * 299 + g * 587 + b * 114) / 1000;
    return luminance > 128 ? '#1A1A1A' : '#FFFFFF';
  }

  // Unique suggested random color generator
  generateRandomColor(): string {
    const existingColors = this.users()
      .filter(u => u.role === 'company' && u.status === 'active')
      .map(u => (u.color || '').toLowerCase());
    
    const palette = [
      '#e8710a', '#1b3a6b', '#1f7a4d', '#3b82f6', '#10b981', 
      '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', 
      '#14b8a6', '#6366f1', '#a855f7', '#64748b'
    ];
    
    // Suggest first unused from nice palette first
    for (const color of palette) {
      if (!existingColors.includes(color)) {
        return color;
      }
    }
    
    // Fallback to random hex
    for (let i = 0; i < 50; i++) {
      const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
      if (!existingColors.includes(randomColor.toLowerCase())) {
        return randomColor;
      }
    }
    return '#E8710A';
  }

  // Set selected registration role with automatic color suggestion
  setRegRole(role: 'client' | 'company' | 'driver') {
    this.regRole.set(role);
    if (role === 'company') {
      this.regColor.set(this.generateRandomColor());
    }
  }

  // Company properties and statistics helper actions
  getCompanyColor(companyId: string): string {
    const company = this.users().find(u => u.id === companyId);
    return company?.color || '#E8710A';
  }

  isCompanyUser(userId: string): boolean {
    const user = this.users().find(u => u.id === userId);
    return user?.role === 'company';
  }

  getCompanyProductCount(companyId: string): number {
    return this.products().filter(p => p.companyId === companyId).length;
  }

  getCompanyRevenue(companyId: string): number {
    return this.orders()
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => {
        const itemsCost = o.items
          .filter(it => it.companyId === companyId)
          .reduce((s, it) => s + (it.price * it.quantity), 0);
        return sum + itemsCost;
      }, 0);
  }

  getCompanyMaxProductCount(): number {
    const activeCompanies = this.users().filter(u => u.role === 'company' && u.status === 'active');
    if (activeCompanies.length === 0) return 1;
    const counts = activeCompanies.map(u => this.getCompanyProductCount(u.id));
    return Math.max(...counts, 1);
  }

  getCompanyMaxRevenue(): number {
    const activeCompanies = this.users().filter(u => u.role === 'company' && u.status === 'active');
    if (activeCompanies.length === 0) return 1;
    const revs = activeCompanies.map(u => this.getCompanyRevenue(u.id));
    return Math.max(...revs, 1);
  }

  // ==========================================
  // TUNISIAN SUBSCRIPTION & BUSINESS MODEL SIMULATOR HELPERS
  // ==========================================
  selectedSimulatorPlan = signal<'starter' | 'pro' | 'premium' | null>(null);
  selectedSimulatorCycle = signal<'monthly' | 'yearly'>('monthly');
  showCheckoutModal = signal(false);
  simulatedPaidMethod = signal<'konnect' | 'paymee' | 'virement' | 'cheque'>('konnect');
  simulatedReferralInput = signal('');
  
  // Local sliding simulation overrides for local real-time sliders
  simulatedOrdersVolumeCount = signal<number>(25);
  simulatedCancellationRate = signal<number>(3.5);
  simulatedClientRating = signal<number>(4.2);
  simulatedInactivityDays = signal<number>(2);
  simulatedPaymentDelayDays = signal<number>(0);
  simulatedWarningsCount = signal<number>(0);


  // 📸 QR CODE SCANNER SIMULATOR FOR DRIVERS
  scanningOrderId = signal<string | null>(null);
  isAnalyzingQR = signal<boolean>(false);
  qrScanStep = signal<'idle' | 'scanning' | 'success'>('idle');

  playBeep() {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.value = 1000; // 1000Hz frequency
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 150);
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  }

  startQRScanner(orderId: string) {
    this.clearMessages();
    this.scanningOrderId.set(orderId);
    this.qrScanStep.set('scanning');
    this.isAnalyzingQR.set(true);

    // After 1.8s, simulate scan, beep and validation
    setTimeout(() => {
      // Check if we are still scanning that same order
      if (this.scanningOrderId() === orderId && this.qrScanStep() === 'scanning') {
        this.confirmQRScanSuccess();
      }
    }, 1800);
  }

  cancelQRScanner() {
    this.scanningOrderId.set(null);
    this.qrScanStep.set('idle');
    this.isAnalyzingQR.set(false);
  }

  async confirmQRScanSuccess() {
    const orderId = this.scanningOrderId();
    if (!orderId) return;

    this.qrScanStep.set('success');
    this.isAnalyzingQR.set(false);
    this.playBeep();

    try {
      await this.api.updateOrderStatus(orderId, 'delivered');
      this.successMessage.set(`Commande ${orderId} scannée et livrée avec succès ! 🏁`);
      
      const userObj = this.api.currentUser();
      if (userObj?.role === 'driver') await this.loadDriverData();
      else if (userObj?.role === 'company') await this.loadCompanyData();
      else if (userObj?.role === 'client') await this.loadClientData();
      else await this.loadAdminData();

      setTimeout(() => {
        if (this.scanningOrderId() === orderId) {
          this.cancelQRScanner();
        }
      }, 1500);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur de simulation de scan.');
      this.cancelQRScanner();
    }
  }

  // 🚴 DELIVERER (LIVREUR) SUBSCRIPTIONS & EARNINGS MODEL
  selectedDriverPlan = signal<'freelance' | 'partenaire' | 'pro' | null>(null);
  selectedDriverCycle = signal<'monthly' | 'yearly'>('monthly');
  showDriverCheckoutModal = signal(false);
  simulatedDriverPaidMethod = signal<'konnect' | 'virement'>('konnect');

  // Slider inputs for Livreurs
  simulatedDriverMonthlyDeliveries = signal<number>(40);
  simulatedDriverCancellationRate = signal<number>(2.0);
  simulatedDriverRating = signal<number>(4.8);
  simulatedDriverInactivityDays = signal<number>(1);
  simulatedDriverWarningsCount = signal<number>(0);
  simulatedDriverConsecutiveMonthsCount = signal<number>(2);
  simulatedDriverReferralsCount = signal<number>(2);
  simulatedDriverTopDriver = signal<boolean>(false);

  // Distribution percents for different delivery types in Tunisia
  simulatedDriverLocalPercent = signal<number>(60);
  simulatedDriverRegionalPercent = signal<number>(30);
  simulatedDriverNationalPercent = signal<number>(10);
  simulatedDriverExpressPercent = signal<number>(20);

  // Initialize interactive overrides when driver logs in
  initDriverSimulatorFromUser(user: User) {
    if (!user) return;
    this.selectedDriverPlan.set(user.driverPlanId || 'freelance');
    this.selectedDriverCycle.set(user.driverBillingCycle || 'monthly');
    this.simulatedDriverMonthlyDeliveries.set(user.driverMonthlyDeliveriesCount ?? 40);
    this.simulatedDriverCancellationRate.set(user.driverCancellationRate ?? 2.0);
    this.simulatedDriverRating.set(user.driverAverageRating ?? 4.8);
    this.simulatedDriverInactivityDays.set(user.driverInactivityDays ?? 1);
    this.simulatedDriverWarningsCount.set(user.driverNonConformingWarningsCount ?? 0);
    this.simulatedDriverConsecutiveMonthsCount.set(user.driverConsecutiveMonthsCount ?? 2);
  }

  // Open driver subscription checkout
  openDriverSubscriptionCheckout(plan: 'freelance' | 'partenaire' | 'pro', cycle: 'monthly' | 'yearly') {
    this.selectedDriverPlan.set(plan);
    this.selectedDriverCycle.set(cycle);
    this.showDriverCheckoutModal.set(true);
  }

  // Confirm driver subscription payment
  async confirmDriverPlanSubscription() {
    this.clearMessages();
    this.loading.set(true);
    try {
      const plan = this.selectedDriverPlan();
      const cycle = this.selectedDriverCycle();
      const gateway = this.simulatedDriverPaidMethod();

      if (!plan) return;

      const payload: Partial<User> = {
        driverPlanId: plan,
        driverBillingCycle: cycle,
        driverPaymentMethod: gateway,
        driverEntryFeePaid: true
      };

      await this.api.updateProfile(payload);
      this.showDriverCheckoutModal.set(false);
      
      const updatedUser = this.api.currentUser();
      if (updatedUser) {
        this.api.currentUser.set({ ...updatedUser, ...payload });
      }
      this.successMessage.set(`Succès ! Votre forfait Coursier "${plan.toUpperCase()}" (${cycle === 'monthly' ? 'mensuel' : 'annuel'}) a été validé avec succès via ${gateway.toUpperCase()}.`);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur de souscription Livreur : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Live synchronizer for driver's real metrics (to simulated database backend)
  async syncDriverSimulationMetrics() {
    this.clearMessages();
    this.loading.set(true);
    try {
      const payload: Partial<User> = {
        driverMonthlyDeliveriesCount: Number(this.simulatedDriverMonthlyDeliveries()),
        driverCancellationRate: Number(this.simulatedDriverCancellationRate()),
        driverAverageRating: Number(this.simulatedDriverRating()),
        driverInactivityDays: Number(this.simulatedDriverInactivityDays()),
        driverNonConformingWarningsCount: Number(this.simulatedDriverWarningsCount()),
        driverConsecutiveMonthsCount: Number(this.simulatedDriverConsecutiveMonthsCount()),
      };

      await this.api.updateProfile(payload);
      this.successMessage.set('⚙️ Indicateurs d’activité Livreur synchronisés avec succès. Vos calculs de performance et commissions s’adaptent en temps réel !');
      
      const updatedUser = this.api.currentUser();
      if (updatedUser) {
        this.api.currentUser.set({ ...updatedUser, ...payload });
      }
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la synchronisation.');
    } finally {
      this.loading.set(false);
    }
  }

  // Dynamic Multi-tier Tunisia Earning calculation engine
  calculateDriverRealTimePayout(user: Partial<User> | null) {
    if (!user) return { base: 0, express: 0, gross: 0, commission: 0, netBeforeBonus: 0, volumeBonus: 0, qualityBonus: 0, reliabilityBonus: 0, penalty: 0, net: 0, upgradeEligible: false };
    
    // Fallback if looking at active simulation values of current user
    const isSimCurrent = user.id === this.api.currentUser()?.id;
    
    const plan = user.driverPlanId || 'freelance';
    
    let deliveries = user.driverMonthlyDeliveriesCount ?? 0;
    let rating = user.driverAverageRating ?? 5.0;
    let cancelRate = user.driverCancellationRate ?? 0;
    let cMonths = user.driverConsecutiveMonthsCount ?? 0;
    let referrals = 0;
    let isTopDriver = false;
    
    let localPct = 60;
    let regionalPct = 30;
    let nationalPct = 10;
    let expressPct = 20;

    if (isSimCurrent) {
      deliveries = Number(this.simulatedDriverMonthlyDeliveries());
      rating = Number(this.simulatedDriverRating());
      cancelRate = Number(this.simulatedDriverCancellationRate());
      cMonths = Number(this.simulatedDriverConsecutiveMonthsCount());
      referrals = Number(this.simulatedDriverReferralsCount());
      isTopDriver = this.simulatedDriverTopDriver();
      
      localPct = Number(this.simulatedDriverLocalPercent());
      regionalPct = Number(this.simulatedDriverRegionalPercent());
      nationalPct = Number(this.simulatedDriverNationalPercent());
      expressPct = Number(this.simulatedDriverExpressPercent());
    }

    // Distribute deliveries
    const localCount = deliveries * (localPct / 100);
    const regionalCount = deliveries * (regionalPct / 100);
    const nationalCount = deliveries * (nationalPct / 100);
    const expressCount = deliveries * (expressPct / 100);
    
    const baseEarnings = (localCount * 7) + (regionalCount * 11) + (nationalCount * 16);
    const expressEarnings = expressCount * 3;
    const grossEarnings = baseEarnings + expressEarnings;
    
    // Platform commission based on plan
    let commPercent = 0.15; // freelance
    if (plan === 'partenaire') {
      commPercent = 0.10;
    } else if (plan === 'pro') {
      commPercent = 0.06;
    }
    
    const commission = grossEarnings * commPercent;
    const netBeforeBonus = grossEarnings - commission;
    
    // Volume bonus (only for Partenaire or Pro)
    let volBonus = 0;
    if (plan !== 'freelance') {
      if (deliveries >= 100) {
        volBonus = (deliveries * 3) + 50; // +3 TND per delivery + 50 TND fixed bonus
      } else if (deliveries >= 60) {
        volBonus = deliveries * 2; // +2 TND per delivery
      } else if (deliveries >= 30) {
        volBonus = deliveries * 1; // +1 TND per delivery
      }
    }
    
    // Special rewards
    const qualityBonus = (rating >= 4.8 && plan !== 'freelance') ? 30 : 0;
    const reliabilityBonus = (cancelRate === 0 && plan !== 'freelance') ? 20 : 0;
    const topDriverBonus = isTopDriver ? 75 : 0;
    const referralBonus = referrals * 20;
    
    // Penalty
    let penalty = 0;
    if (cancelRate > 15 && plan !== 'freelance') {
      penalty = baseEarnings * 0.10; // -10% on gross earnings
    }
    
    const net = netBeforeBonus + volBonus + qualityBonus + reliabilityBonus + topDriverBonus + referralBonus - penalty;
    const upgradeEligible = cMonths >= 3 && deliveries >= 60;
    
    return {
      base: baseEarnings,
      express: expressEarnings,
      gross: grossEarnings,
      commission,
      netBeforeBonus,
      volumeBonus: volBonus,
      qualityBonus: qualityBonus + topDriverBonus,
      reliabilityBonus: reliabilityBonus + referralBonus,
      penalty,
      net,
      upgradeEligible
    };
  }

  // Initialize interactive overrides when company logs in
  initSimulatorFromUser(user: User) {
    if (!user) return;
    this.simulatedOrdersVolumeCount.set(user.monthlyOrdersCount ?? 25);
    this.simulatedCancellationRate.set(user.cancellationRate ?? 3.5);
    this.simulatedClientRating.set(user.averageRating ?? 4.2);
    this.simulatedInactivityDays.set(user.inactivityDays ?? 3);
    this.simulatedPaymentDelayDays.set(user.paymentDelayDays ?? 0);
    this.simulatedWarningsCount.set(user.nonConformingWarningsCount ?? 0);
  }

  // Triggered checkout
  openSubscriptionCheckout(plan: 'starter' | 'pro' | 'premium', cycle: 'monthly' | 'yearly') {
    this.selectedSimulatorPlan.set(plan);
    this.selectedSimulatorCycle.set(cycle);
    this.showCheckoutModal.set(true);
  }

  // Confirm simulated subscription payment via Tunisian gateways (Konnect / Paymee) or standard Transfer/Check
  async confirmPlanSubscription() {
    this.clearMessages();
    this.loading.set(true);
    try {
      const plan = this.selectedSimulatorPlan();
      const cycle = this.selectedSimulatorCycle();
      const gateway = this.simulatedPaidMethod();

      if (!plan) return;

      const payload: Partial<User> = {
        planId: plan,
        billingCycle: cycle,
        paymentMethod: gateway,
        entryFeePaid: true,
        // Pro / Premium gets verified automatically
        isVerifiedPartner: plan === 'pro' || plan === 'premium'
      };

      await this.api.updateProfile(payload);
      this.showCheckoutModal.set(false);
      this.successMessage.set(`Félicitations ! Abonnement au plan ${plan.toUpperCase()} (${cycle === 'monthly' ? 'mensuel' : 'annuel'}) activé avec succès via ${gateway.toUpperCase()}.`);
      
      const updatedUser = this.api.currentUser();
      if (updatedUser) {
        this.api.currentUser.set({ ...updatedUser, ...payload });
      }
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la facturation.');
    } finally {
      this.loading.set(false);
    }
  }

  // Change interactive metrics to synchronize with simulated backend
  async syncSimulationMetrics() {
    this.clearMessages();
    this.loading.set(true);
    try {
      const payload: Partial<User> = {
        monthlyOrdersCount: Number(this.simulatedOrdersVolumeCount()),
        cancellationRate: Number(this.simulatedCancellationRate()),
        averageRating: Number(this.simulatedClientRating()),
        inactivityDays: Number(this.simulatedInactivityDays()),
        paymentDelayDays: Number(this.simulatedPaymentDelayDays()),
        nonConformingWarningsCount: Number(this.simulatedWarningsCount())
      };

      await this.api.updateProfile(payload);
      this.successMessage.set('Indicateurs de simulation de santé de compte et volume de commandes synchronisés avec succès. Les calculs adaptent automatiquement vos paliers.');
      
      const updatedUser = this.api.currentUser();
      if (updatedUser) {
        this.api.currentUser.set({ ...updatedUser, ...payload });
      }
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la synchronisation.');
    } finally {
      this.loading.set(false);
    }
  }

  // Confirm parrainage / Referral input
  async submitSponsorship() {
    this.clearMessages();
    const code = this.simulatedReferralInput().trim();
    if (!code) {
      this.errorMessage.set('Veuillez entrer un code de parrainage de parrain.');
      return;
    }

    this.loading.set(true);
    try {
      // Send code using profile update
      await this.api.updateProfile({ referredByCode: code });
      this.successMessage.set(`Code parrainage "${code}" appliqué avec succès ! Vous bénéficiez d'un mois offert pour votre parrain.`);
      this.simulatedReferralInput.set('');
      
      const updatedUser = this.api.currentUser();
      if (updatedUser) {
        this.api.currentUser.set({ ...updatedUser, referredByCode: code });
      }
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Code parrainage invalide.');
    } finally {
      this.loading.set(false);
    }
  }

  // Let Admin update any user's subscription metrics directly from admin panel
  async adminUpdateUserPlanDetails(userId: string, updates: Partial<User>) {
    this.clearMessages();
    this.loading.set(true);
    try {
      await this.api.updateUser(userId, updates);
      this.successMessage.set(`Configuration du partenaire mise à jour avec succès.`);
      await this.loadAdminData();
      await this.loadSimulatedEmails();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la mise à jour.');
    } finally {
      this.loading.set(false);
    }
  }

  // Execute End of Month Billing and Sla calculation simulation for all users
  async simulateEndOfMonthBilling() {
    this.clearMessages();
    this.loading.set(true);
    try {
      // 1. Process Partner Companies (Enterprise SLA Contracts)
      const companyUsers = this.users().filter(u => u.role === 'company');
      for (const comp of companyUsers) {
        const orderVol = comp.monthlyOrdersCount ?? 0;
        let cMonths = comp.consecutiveMonthsCount ?? 0;
        let newPlan = comp.planId;

        if (orderVol >= 50) {
          cMonths += 1;
          if (cMonths >= 3) {
            if (comp.planId === 'starter') {
              newPlan = 'pro';
            } else if (comp.planId === 'pro') {
              newPlan = 'premium';
            }
            cMonths = 0;
          }
        } else {
          cMonths = 0;
        }

        const updates: Partial<User> = {
          consecutiveMonthsCount: cMonths,
          planId: newPlan,
        };
        await this.api.updateUser(comp.id, updates);
      }

      // 2. Process Delivery Drivers (Livreurs SLA Performance Rewards)
      const driverUsers = this.users().filter(u => u.role === 'driver');
      for (const drv of driverUsers) {
        const delivVol = drv.driverMonthlyDeliveriesCount ?? 0;
        let cMonths = drv.driverConsecutiveMonthsCount ?? 0;
        let newPlan = drv.driverPlanId;

        if (delivVol >= 60) {
          cMonths += 1;
          if (cMonths >= 3) {
            if (drv.driverPlanId === 'freelance' || !drv.driverPlanId) {
              newPlan = 'partenaire';
            } else if (drv.driverPlanId === 'partenaire') {
              newPlan = 'pro';
            }
            cMonths = 0;
          }
        } else {
          cMonths = 0;
        }

        const updates: Partial<User> = {
          driverConsecutiveMonthsCount: cMonths,
          driverPlanId: newPlan,
        };
        await this.api.updateUser(drv.id, updates);
      }

      this.successMessage.set('⚙️ Simulation de fin de mois exécutée ! Les indicateurs consécutifs ont été calculés et les méritants (Entreprises et Livreurs) ont été surclassés gratuitement.');
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur de simulation.');
    } finally {
      this.loading.set(false);
    }
  }

  // ==========================================
  // CATEGORY REQUESTS (Company → Admin)
  // ==========================================

  async submitCategoryRequest() {
    const name = this.newCategoryName().trim();
    if (!name) {
      this.errorMessage.set('Veuillez saisir un nom de catégorie.');
      return;
    }
    this.loading.set(true);
    try {
      await this.api.createCategoryRequest(name);
      this.newCategoryName.set('');
      this.successMessage.set(`✅ Demande pour la catégorie "${name}" envoyée à l'administrateur pour validation.`);
      await this.loadCompanyData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de l\'envoi de la demande.');
    } finally {
      this.loading.set(false);
    }
  }

  async decideOnCategoryRequest(id: string, status: 'approved' | 'rejected') {
    this.loading.set(true);
    try {
      await this.api.actionCategoryRequest(id, status);
      const label = status === 'approved' ? 'approuvée et ajoutée au catalogue' : 'rejetée';
      this.successMessage.set(`✅ Demande de catégorie ${label}.`);
      await this.loadAdminData();
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message || 'Erreur lors de la décision.');
    } finally {
      this.loading.set(false);
    }
  }
}