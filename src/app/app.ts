import { ChangeDetectionStrategy, Component, OnInit, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiClient, User, Product, Order, SupportTicket, Offer, StockRequest, Driver, AuditLog, SubAccount, AppStats } from './services/api';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [CommonModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  api = inject(ApiClient);

  // App-wide interactive UI views
  activeAuthMode = signal<'login' | 'register'>('login');
  
  // Registration Form Signals
  regName = signal('');
  regEmail = signal('');
  regRole = signal<'client' | 'company' | 'driver'>('client');
  regPhone = signal('');
  regAddress = signal('');
  regColor = signal('#10b981'); // Emerald
  regFeedback = signal('');

  // Tab selections
  adminCurrentTab = signal<'users' | 'offers' | 'stocks' | 'logs' | 'support' | 'profile'>('users');
  companyCurrentTab = signal<'products' | 'requests' | 'offers' | 'team' | 'support' | 'orders' | 'profile'>('products');
  clientCurrentTab = signal<'browse' | 'orders' | 'support' | 'profile'>('browse');
  driverCurrentTab = signal<'dashboard' | 'profile'>('dashboard');

  // Profile management editing signals
  profileName = signal('');
  profileEmail = signal('');
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
  auditLogs = signal<AuditLog[]>([]);
  tickets = signal<SupportTicket[]>([]);
  subAccounts = signal<SubAccount[]>([]);
  globalStats = signal<AppStats | null>(null);

  // Client search and filters
  searchQuery = signal('');
  categoryFilter = signal('all');
  companyFilter = signal('all');
  selectedProduct = signal<Product | null>(null);

  // Checkout process simulation signals
  deliveryAddress = signal('');
  selectedDriver = signal<Driver | null>(null);
  paymentMethod = signal<'stripe' | 'paypal' | 'cash'>('stripe');

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
        } else if (user.role === 'client') {
          this.loadClientData();
        } else if (user.role === 'driver') {
          this.loadDriverData();
        }
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
      if (role === 'company') email = 'contact@ecoshop.com';
      if (role === 'client') email = 'alice@gmail.com';
      if (role === 'driver') email = 'lucas@delivery.com';

      await this.api.login(email);
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

    try {
      const res = await this.api.register({
        name: this.regName(),
        email: this.regEmail(),
        role: this.regRole(),
        phone: this.regPhone(),
        address: this.regAddress(),
        companyColor: this.regRole() === 'company' ? this.regColor() : undefined
      });

      this.successMessage.set(res.message);
      this.activeAuthMode.set('login');
      // Reset registration form
      this.regName.set('');
      this.regEmail.set('');
      this.regPhone.set('');
      this.regAddress.set('');
    } catch (err) { const error = err as { message: string };
      this.regFeedback.set(error.message || 'Une erreur s’est produite lors de l’inscription.');
    }
  }

  // Standard Login handle
  manualEmail = signal('');
  async handleManualLogin() {
    this.clearMessages();
    if (!this.manualEmail()) {
      this.errorMessage.set('Veuillez renseigner un e-mail valide.');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.login(this.manualEmail());
      this.successMessage.set('Connexion réussie !');
      this.manualEmail.set('');
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  // Logouts
  triggerLogout() {
    this.api.logout();
    this.loadVisitorData();
    this.successMessage.set('Déconnecté avec succès.');
  }

  // Profile Methods
  initProfileForm() {
    const user = this.api.currentUser();
    if (user) {
      this.profileName.set(user.name || '');
      this.profileEmail.set(user.email || '');
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
      const payload: Partial<User> & { baseFee?: number; perKmFee?: number; zone?: string; driverStatus?: string; photo?: string } = {
        name: this.profileName(),
        email: this.profileEmail(),
        phone: this.profilePhone(),
        address: this.profileAddress(),
      };

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
  async loadVisitorData() {
    this.loading.set(true);
    try {
      const prods = await this.api.getProducts();
      this.products.set(prods);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set(error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadAdminData() {
    this.loading.set(true);
    try {
      const [usrList, prodList, offerList, sReqs, audit, tkts, stats] = await Promise.all([
        this.api.getUsers(),
        this.api.getProducts({ all: true }), // see all products
        this.api.getOffers(),
        this.api.getStockRequests(),
        this.api.getAuditLogs(),
        this.api.getTickets(),
        this.api.getStats()
      ]);

      this.users.set(usrList);
      this.products.set(prodList);
      this.offers.set(offerList);
      this.stockRequests.set(sReqs);
      this.auditLogs.set(audit);
      this.tickets.set(tkts);
      this.globalStats.set(stats);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Admin : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadCompanyData() {
    this.loading.set(true);
    try {
      const [prodList, sReqs, offerList, subs, tkts, stats] = await Promise.all([
        this.api.getProducts({ all: false }), // company owns
        this.api.getStockRequests(),
        this.api.getOffers(),
        this.api.getSubAccounts(),
        this.api.getTickets(),
        this.api.getStats()
      ]);

      this.products.set(prodList);
      this.stockRequests.set(sReqs);
      this.offers.set(offerList);
      this.subAccounts.set(subs);
      this.tickets.set(tkts);
      this.globalStats.set(stats);
    } catch (err) { const error = err as { message: string };
      this.errorMessage.set('Erreur d’initialisation Entreprise : ' + error.message);
    } finally {
      this.loading.set(false);
    }
  }

  async loadClientData() {
    this.loading.set(true);
    try {
      const [prodList, ords, drvs, tkts] = await Promise.all([
        this.api.getProducts(),
        this.api.getOrders(),
        this.api.getDrivers(),
        this.api.getTickets()
      ]);

      this.products.set(prodList);
      this.orders.set(ords);
      this.drivers.set(drvs);
      this.tickets.set(tkts);

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

  // Handle order checkout
  async triggerCheckout() {
    this.clearMessages();
    const userObj = this.api.currentUser();
    if (!userObj) {
      // Force instant client setup for easy testing
      this.errorMessage.set('Veuillez vous authentifier en tant que Client pour commander.');
      return;
    }

    if (!this.deliveryAddress()) {
      this.errorMessage.set('Veuillez spécifier l’adresse de livraison.');
      return;
    }

    const drv = this.selectedDriver();
    if (!drv) {
      this.errorMessage.set('Veuillez sélectionner un livreur disponible.');
      return;
    }

    const itemsPayload = this.api.cart().map(i => ({
      productId: i.product.id,
      quantity: i.quantity
    }));

    this.loading.set(true);
    try {
      const res = await this.api.checkout({
        items: itemsPayload,
        deliveryAddress: this.deliveryAddress(),
        driverId: drv.id,
        driverName: drv.name,
        driverFee: drv.calculatedFee || drv.baseFee,
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
      await this.api.createStockRequest(prod.id, {
        quantity: this.stockReqQty(),
        justification: this.stockReqJustif()
      });

      this.successMessage.set('Demande d’augmentation de stock enregistrée avec succès.');
      this.selectedProdForStock.set(null);
      this.stockReqQty.set(50);
      this.stockReqJustif.set('');
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
}
