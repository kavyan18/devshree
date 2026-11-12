# Devshree — Professional Hardware & Home Improvement E-Commerce Platform

Devshree is a modern, responsive, high-performance e-commerce platform built for Indian contractors, builders, and homeowners, focusing on four primary product verticals:
1. **Electrical Products** (Wires, switches, sockets, MCBs, distribution accessories)
2. **Hardware Products** (Brass padlocks, SS hinges, spanners, precision tools, fittings)
3. **Plumbing Products** (CPVC/UPVC pipes, brass valves, angle cocks, bib taps)
4. **Wall Paints** (Interior & exterior emulsions, wall putties, primers)

---

## 📁 Project Structure

```
d:/e-commers website/
├── index.html                  # Homepage (Semantic HTML5, Accessible, SEO-ready)
├── assets/
│   ├── css/
│   │   ├── styles.css          # Design system, CSS tokens, components, modals, toasts
│   │   └── responsive.css      # Responsive media queries (Desktop, Tablet, Mobile)
│   └── js/
│       ├── utils.js            # Currency formatting (INR), XSS escaping, Toast engine
│       ├── mock-data.js        # 4 Core Categories & catalog items with INR pricing & specs
│       ├── cart.js             # Cart engine with stock validation & custom DOM events
│       ├── wishlist.js         # Wishlist engine with persistence & header badge sync
│       └── home.js             # Homepage controller & dynamic renderer
└── README.md                   # Project documentation & stage roadmap
```

---

## 🎨 Brand Design Tokens

- **Deep Navy:** `#142B45`
- **Primary Blue:** `#2463A6`
- **Warm Orange Accent:** `#F28C28`
- **Off-white Background:** `#F7F8FA`
- **Card Surface:** `#FFFFFF`
- **Text Main:** `#202A35`
- **Text Secondary:** `#687385`
- **Borders:** `#E4E8EE`

---

## 🚀 Running the Project Locally

Because Devshree uses standard **ES Modules (`import`/`export`)**, the files should be served via a local web server (instead of double-clicking `file://`) to adhere to browser CORS policies:

### Option 1: Using Python (Recommended)
Open PowerShell in the project directory and run:
```powershell
python -m http.server 5500
```
Then navigate to: `http://localhost:5500`

### Option 2: Using Node.js
```powershell
npx.cmd serve .
```

### Option 3: Using VS Code Live Server
Right-click on `index.html` in VS Code and select **"Open with Live Server"**.

---

## 🧪 Stage Verification Roadmaps

### Stage 1: Core Layout & Catalog (Completed)
- [x] Responsive header with brand logo, search bar, and action badges (Account, Wishlist, Cart)
- [x] Announcement bar with delivery & GST information
- [x] Exactly the 4 main product categories (Electrical, Hardware, Plumbing, Wall Paints)
- [x] Hero section with headline: *"Everything You Need to Build Better."*
- [x] Best-selling products grid with Indian rupee formatting (`₹`)
- [x] Working Wishlist toggle with real-time header badge updates
- [x] Working Add to Cart with inventory stock checking & toast notifications
- [x] Interactive Quick View Modal with specifications table and quantity counter
- [x] Search filtering by product name, brand (e.g. Havells, Polycab), or SKU
- [x] Category card click-to-filter interaction
- [x] Verified contractor reviews section
- [x] Newsletter subscription form with email validation
- [x] Professional footer with authentic business details & Indian GSTIN
- [x] Full mobile drawer navigation & responsive layout

---

### Stage 2: Firebase Authentication & GST Invoicing (Completed)
- [x] **Firebase Configuration (`assets/js/firebase-config.js`)**: Modular v11 SDK with automatic fallback to offline local mode if credentials are not yet pasted.
- [x] **Customer Authentication Service (`assets/js/auth.js`)**:
  - Sign Up with Name, Email, Phone (+91), and Password.
  - Role enforcement: new accounts are strictly tagged with `role: 'customer'` in Firestore (`users/{uid}`).
  - Sign In with Email & Password.
  - Google Sign-In with popup.
  - Password Reset via email link.
  - Sign Out with clean state reset.
- [x] **Mandatory Purchase Guard (`requireAuth()`)**:
  - Unauthenticated users clicking **"Proceed to Checkout"** are automatically prompted to sign up or log in.
  - After successful authentication, their order automatically proceeds.
- [x] **GST Tax Invoice & Cloud Firestore Persistence (`assets/js/orders.js`)**:
  - Automatically calculates 18% GST (CGST 9% + SGST 9%) for Indian hardware & electrical supplies.
  - Generates standard invoice number (`INV-DEV-YYYY-XXXX`).
  - Persists directly under the user's account in Firestore (`orders` collection) or local storage.
  - Automatically displays a formal, printable Indian GST Tax Invoice upon order completion with **"Print / Save PDF"** capability.
- [x] **Customer Invoices List Modal**:
  - Authenticated users can click **"My Account"** to view their profile and browse all past invoices.
  - Users can sign out, sign back in as another user, and see strictly their own invoices.
- [x] **Security Rules (`firestore.rules` & `storage.rules`)**:
  - Role lockdown preventing privilege escalation to admin.
  - Data isolation: customers can only read and write their own orders and profile documents.
- [x] **Deployment Configuration**: `firebase.json` and `firestore.indexes.json` configured.

---

### Stage 3: Cloud Firestore Database Architecture & Real-Time Catalog (Completed)
- [x] **Catalog Sync (`assets/js/products.js`)**: Real-time querying from Cloud Firestore `products` and `categories` collections with automatic local caching.
- [x] **Interactive Catalog Toolbar**: Real-time category filtering tabs (Electrical, Hardware, Plumbing, Wall Paints) and sorting dropdown (Price, Bestsellers, Newest, Rating, In-stock only).
- [x] **Instant "Buy Now" Purchase**: Single-click checkout trigger on product cards and Quick View modal with authentication verification.
- [x] **Secure Administrator Database Seeding**: Sync database button moved exclusively inside the authenticated Admin Console (`admin.html`) to protect store catalog data from public modification.

---

### Stage 4: Multi-Step Checkout, Indian Address & Live Order Tracking (Completed)
- [x] **Multi-Step Checkout Service (`assets/js/checkout.js`)**:
  - **Step 1: Address & Contractor Info**: Full Name, 10-digit mobile (+91), 6-digit Indian PIN code auto-detecting City & State (e.g. 380015 -> Ahmedabad, Gujarat), street address, landmark, optional 15-character Contractor B2B GSTIN with 18% Input Tax Credit validation.
  - **Step 2: Payment Mode Selection**:
    - **Cash on Delivery (COD)** (Verified & Pay on receipt)
    - **Razorpay Simulation Gateway** (Interactive modal supporting UPI apps like Google Pay / PhonePe / Paytm, Cards with test credentials, and NetBanking).
  - **Step 3: Order Confirmation**: Displays generated Invoice ID, total amount, delivery partner (Delhivery Express), estimated arrival date, and direct buttons to print GST tax invoice or track order.
- [x] **Live Order Tracking Modal (`assets/js/orders.js`)**:
  - Search any order or consignment by Invoice Number (`INV-DEV-...`) or Order ID.
  - Horizontal visual progress stepper: Order Confirmed ➔ Warehouse Processing ➔ Handed to Logistics ➔ Out for Delivery ➔ Delivered.
  - Displays AWB tracking number, delivery location, items summary, and contractor contact.

---

### Stage 5: Role-Based Access Control & Secure Admin Console (Completed)
- [x] **Storefront Privacy & Public UI Cleanliness (`index.html`)**:
  - "Admin Console" and "Sync Database" buttons are completely removed from public view in the announcement bar and footer.
  - Normal store visitors and customers only see the clean, professional e-commerce storefront.
- [x] **Role-Based Authentication & Redirection (`assets/js/auth.js`)**:
  - **Normal Customer Sign Up / Sign In**:
    - Users sign up with normal personal emails (e.g. `customer@gmail.com`).
    - Stored with `role: 'customer'`.
    - They remain on `index.html`, browse, add to cart, checkout, view invoices in My Account modal, and sign out normally.
  - **Administrator Sign Up / Sign In**:
    - When signing up or signing in with an administrator email (e.g. `admin@devshree.in` or any email containing `admin`), the system detects administrative privileges.
    - Stored with `role: 'admin'`.
    - Automatically displays an admin notification and redirects directly to the **Admin Console** (`admin.html`).
- [x] **Admin Security Gate & Dashboard Protection (`admin.html` & `assets/js/admin.js`)**:
  - Unauthenticated visitors or normal customer accounts cannot view order or inventory data.
  - Features an **Admin Security Gate** overlay with dedicated Admin Sign In and Admin Sign Up forms.
  - If a logged-in customer attempts to view `admin.html`, an Access Denied alert is shown with options to sign in as admin or return to the storefront.
  - When authenticated as an admin, unlocks live KPI cards (Revenue, Orders, Products, Low Stock), orders fulfillment management, inline price/stock editing, "+ Add Product" modal, and the `↻ Sync Firestore` database tool.

---

### Stage 6: Architectural Hardware Expansion, PDF Lookbooks, and PWA (Completed)
- [x] **Promotional Autoscrolling Offers Carousel**:
  - Live animated hero banner highlighting festive promotions, machine discounts, and contractor packs with smooth continuous autoscrolling.
  - Fully customizable via the Admin Console with instant live synchronization.
- [x] **8 Core Architectural Hardware Categories**:
  - Plywood & Blockboard; MDF, HDHMR & PVC Boards; Laminates & Liners; Panels & Mouldings; Adhesive; Kitchen Hardware; Cabinet Hardware; Nails, Screws & Accessories.
- [x] **Regular Hardware Deals Section**:
  - Prominent homepage shelf for trade discounts with admin badge toggle (`#prod-is-regular-deal`).
- [x] **PDF Catalogs & Digital Lookbooks**:
  - Official shade cards and specification PDFs (Action Tesa, Greenlam, Pidilite, Godrej, CenturyLaminates).
  - Built-in in-browser PDF modal viewer, direct download, and one-click WhatsApp client sharing.
  - Admin PDF catalog management with instant file size and cover preview calculation.
- [x] **Instant 0ms Image Upload & Fallback Engine**:
  - Instant client preview with `URL.createObjectURL`, automatic input clearing, and direct URL paste input (`#prod-image-url`).
- [x] **Progressive Web App (PWA) & Schema.org SEO**:
  - `manifest.json` for home screen installability on Android and iOS.
  - `HardwareStore` Schema.org JSON-LD microdata for Google rich snippet display.
- [x] **Pincode Delivery & Service Estimator**:
  - Interactive 6-digit Indian PIN code checker with next-day Gujarat dispatch and national surface courier estimates.

---

## 🔑 How to Configure Environment Variables & Real Firebase

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
2. In your `.env` (or in Vercel Project Settings > Environment Variables), configure your production keys:
   ```env
   # Admin portal password for /api/auth/login
   ADMIN_PASSWORD=your_secure_admin_password_here

   # Firebase Web Configuration
   FIREBASE_API_KEY=your_firebase_api_key_here
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_APP_ID=your_firebase_app_id
   ```
3. Deploy Firestore and Storage security rules using Firebase CLI:
   ```powershell
   firebase deploy --only firestore:rules,storage:rules
   ```
   *(Note: The repository enforces strict `.gitignore` protection so `.env` and private keys are never committed to Git!)*

