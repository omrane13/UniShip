<h1 align="center">
  <br>
  🚢 UniShip
  <br>
</h1>

<h4 align="center">Plateforme e-commerce de livraison intelligente — connectant Clients, Entreprises Partenaires, Livreurs et Administrateurs.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-21-red?style=for-the-badge&logo=angular" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?style=for-the-badge&logo=mongodb" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/SSR-Angular_SSR-purple?style=for-the-badge" />
</p>

---

## 📖 Présentation

**UniShip** est une plateforme e-commerce full-stack dédiée à la gestion de la livraison. Elle offre une expérience unifiée pour quatre types d'utilisateurs :

| Rôle | Description |
|---|---|
| 👤 **Visiteur** | Parcourt le catalogue, filtre les produits par catégorie/partenaire, et peut commander après authentification automatique |
| 🛍️ **Client** | Gère son panier, passe des commandes et suit ses livraisons |
| 🏢 **Entreprise Partenaire** | Gère ses produits, ses offres et consulte le tableau de bord des commandes |
| 🚗 **Livreur** | Consulte et gère les livraisons qui lui sont assignées |
| 🛡️ **Administrateur** | Supervise l'ensemble de la plateforme (utilisateurs, statistiques, tickets) |

---

## 🛠️ Stack Technique

- **Frontend** : Angular 21 (Standalone Components, Signals, Angular Material)
- **Backend** : Express.js 5 (API REST intégrée via Angular SSR)
- **Base de données** : MongoDB avec Mongoose
- **Authentification** : JWT (JSON Web Tokens) + bcryptjs
- **Rendu** : Angular SSR (Server-Side Rendering) avec prérendu statique
- **Styling** : TailwindCSS 4 + CSS personnalisé
- **IA** : Google Gemini AI (`@google/genai`)

---

## ✅ Prérequis

Assurez-vous d'avoir installé les outils suivants avant de démarrer :

- [Node.js](https://nodejs.org/) **v20 ou supérieur**
- [npm](https://www.npmjs.com/) **v9 ou supérieur** (inclus avec Node.js)
- [Git](https://git-scm.com/)
- Un cluster **MongoDB** (local ou [MongoDB Atlas](https://www.mongodb.com/atlas))

---

## 🚀 Installation et Démarrage

### 1. Cloner le dépôt

```bash
git clone https://github.com/omrane13/UniShip.git
cd UniShip
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Copiez le fichier `.env.example` en `.env` :

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Puis ouvrez le fichier `.env` et renseignez vos valeurs :

```env
# Clé API Google Gemini (pour les fonctionnalités IA)
GEMINI_API_KEY="votre_clé_gemini_ici"

# URL de l'application (ex: http://localhost:4000 en local)
APP_URL="http://localhost:4000"

# Chaîne de connexion MongoDB
# Exemple local :
MONGODB_URI="mongodb://localhost:27017/uniship"
# Exemple MongoDB Atlas :
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.mongodb.net/uniship"

# Clé secrète pour les tokens JWT (changez en production !)
JWT_SECRET="votre_secret_jwt_tres_long_et_securise"
```

---

## ▶️ Démarrage en mode Développement

```bash
npm start
```

L'application sera disponible à l'adresse : **http://localhost:4200**

> **Note** : Le serveur Express (API backend) et le frontend Angular tournent ensemble grâce à Angular SSR.

---

## 🏗️ Build de Production

### 1. Compiler l'application

```bash
npm run build
```

Les fichiers compilés seront générés dans le dossier `dist/app/`.

### 2. Démarrer le serveur SSR en production

```bash
npm run serve:ssr:app
```

Le serveur démarrera sur le port défini (par défaut **4000**).

---

## 📁 Structure du Projet

```
UniShip/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── admin-dashboard.ts       # Dashboard Administrateur
│   │   │   ├── client-hub.ts            # Catalogue & Panier Client
│   │   │   ├── company-dashboard.ts     # Dashboard Entreprise Partenaire
│   │   │   └── driver-console.ts        # Console Livreur
│   │   ├── services/
│   │   │   └── api.ts                   # Service API client (HTTP)
│   │   ├── app.ts                       # Composant racine (logique principale)
│   │   └── app.html                     # Template principal
│   ├── backend/
│   │   ├── db/
│   │   │   └── connection.ts            # Connexion MongoDB
│   │   ├── routes/
│   │   │   ├── auth.ts                  # Routes d'authentification
│   │   │   ├── products.ts              # Routes produits
│   │   │   ├── orders.ts                # Routes commandes
│   │   │   ├── drivers.ts               # Routes livreurs
│   │   │   ├── offers.ts                # Routes offres
│   │   │   ├── tickets.ts               # Routes tickets support
│   │   │   └── stats.ts                 # Routes statistiques
│   │   └── store.ts                     # Modèles Mongoose (schémas DB)
│   └── server.ts                        # Serveur Express SSR
├── .env.example                         # Modèle de configuration
├── angular.json                         # Configuration Angular CLI
├── package.json                         # Dépendances npm
└── tsconfig.json                        # Configuration TypeScript
```

---

## 🔌 API Endpoints principaux

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Inscription d'un utilisateur |
| `POST` | `/api/auth/login` | Connexion et obtention du token JWT |
| `GET` | `/api/products` | Liste des produits (public) |
| `GET` | `/api/categories` | Liste des catégories (public) |
| `GET` | `/api/companies/public` | Liste des entreprises partenaires (public) |
| `POST` | `/api/orders` | Passer une commande (authentifié) |
| `GET` | `/api/orders` | Historique des commandes (authentifié) |
| `GET` | `/api/stats` | Statistiques globales (admin) |

---

## 🧩 Fonctionnalités clés

- **Authentification automatique en mode visiteur** : lorsqu'un visiteur clique sur « Commander », le modal de connexion/inscription s'ouvre automatiquement, le panier est conservé et se réouvre après connexion.
- **Filtres dynamiques depuis l'API** : les filtres par catégorie et par partenaire sont chargés via des appels API séparés et parallèles.
- **Multi-rôles** : un seul frontend gère les 5 types d'utilisateurs avec des interfaces dédiées.
- **SSR & Prérendu** : optimisé pour le SEO avec Angular Server-Side Rendering.

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez votre branche : `git checkout -b feature/ma-fonctionnalite`
3. Committez vos changements : `git commit -m 'feat: ajout de ma fonctionnalité'`
4. Poussez la branche : `git push origin feature/ma-fonctionnalite`
5. Ouvrez une **Pull Request**

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

<p align="center">
  Développé avec ❤️ — <strong>UniShip Team</strong>
</p>
