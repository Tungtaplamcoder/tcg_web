# Architecture & Technical Context

High-density technical reference for the TCG E-Commerce platform.

---

## 1. Stack & Tools

| Layer | Technologies & Libraries | Key Directives |
| :--- | :--- | :--- |
| **Frontend** | React 18 (`react`, `react-dom` 18.2), Vite 8 (`@vitejs/plugin-react`), React Router Dom 7 (`react-router-dom` 7.18) | Single-page application, client-side routing, code-splitting |
| **Backend** | Node.js (>=20.0), Express 4.18 | RESTful JSON API (`/api/v1`), layered controller/service pattern |
| **Database & ORM** | MariaDB / MySQL, Prisma 5.22 (`@prisma/client`) | Pre-generated client committed at `src/generated/prisma` (bypasses server-side CLI Wasm OOM on cPanel LVE) |
| **UI Framework** | Vanilla CSS + Tailwind CSS 3.4 (`darkMode: 'class'`), PostCSS, Autoprefixer | Custom design tokens; no arbitrary third-party component kits |
| **Icons** | `lucide-react` (0.344+) strictly | **Zero raw emojis allowed** across storefront, admin, and staff interfaces |
| **State Management**| Zustand 4.5 (`useAuthStore`, `useCartStore`, `useAddressStore`) | Lightweight client stores with localStorage persistence |
| **HTTP Client** | Axios 1.6 (`api.js`) | JWT bearer injection, 401 automatic refresh token queue, seamless logout |
| **Data Viz** | Recharts 3.10 (`AreaChart`, `BarChart`, `RadialBarChart`) | Mobile optimization (`isAnimationActive=false` on narrow viewports) |
| **Testing** | Playwright 1.62 (`@playwright/test`), Vitest (frontend unit), Jest (backend unit) | E2E headless/headed test suite covering UI contracts & regressions |

---

## 2. Design System & Constraints

### 2.1 Palette & Color Restrictions
* **Primary Accent:** Soft Pastel Pink (`#ec4899` / `pink-500`, `#e11d48` / `rose-600`, `#f472b6` / `pink-400`, `#be123c` / `rose-700`).
* **Canvases:**
  * *Light:* Blush `#FFF0F5` to Cream `#FDFBF7`, pure white containers (`bg-white`), hairline borders (`border-pink-100/60` or `border-neutral-200`).
  * *Dark:* Deep obsidian `#120b0e` / `#170e12` / `neutral-950`, dark containers (`bg-neutral-900/90`), subtle hairline borders (`border-neutral-800` or `border-white/10`).
* **Strict Color Ban:** Warm tones (**yellow**, **orange**, **amber**, **gold**) are strictly banned from UI elements, tags, chips, buttons, and badges.
  * Verified in Playwright tests via selector check: `/(amber|orange|yellow)-/` count must strictly equal 0.

### 2.2 Component & Layout Architecture
* **Neuro-Bento Layout:**
  * Fixed, structured modular widgets (e.g. 4-widget Bento grid on `/admin/dashboard`).
  * Uniform corner radiuses (`rounded-2xl` / `rounded-3xl`), soft elevation shadows (`shadow-soft`), high visual contrast.
  * Consistent status pills: single-line `whitespace-nowrap`, fixed horizontal padding, pastel rose/neutral backgrounds.
* **GPU-Accelerated Transitions:**
  * Route changes wrapped in `dash-route-transition` (`index.css`):
    * Keyframe `dash-slide-fade`: `translate3d(20px, 0, 0)` -> `translate3d(0, 0, 0)`, opacity `0` -> `1`.
    * Duration: `0.25s cubic-bezier(0.25, 0.1, 0.25, 1)`.
    * `animation-fill-mode: backwards` leaves no lingering CSS transform after completion, preventing fixed overlays/modals from becoming viewport-misaligned.
    * Uses `will-change: opacity` and `backface-visibility: hidden`.
* **Mobile-Responsive Drawers:**
  * Storefront header hamburger menu opens full-height side drawer (`animate-drawer-in` using GPU `translate3d(100%, 0, 0)` -> `translate3d(0, 0, 0)` over 0.28s).
  * Touch discipline: interactive tap targets guaranteed `>= 44px`.
  * Background scroll-locking on body while drawer/modals are active; dismissal via backdrop click or `Escape` key.
  * Admin user profile viewer uses dedicated slide-out drawer (`UserDetailModal.jsx`).

---

## 3. Directory Map & Key Files

### 3.1 Repository Layout
```
tcg_web/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma             # Authoritative Prisma schema & DB indexes
│   │   └── seed.js                   # Initial seed data
│   └── src/
│       ├── controllers/              # Request handlers (admin, product, gacha, auth, order)
│       ├── middlewares/              # JWT auth, role validation, rate limiters, validation
│       ├── routes/                   # Express router endpoints
│       ├── schemas/                  # Zod validation schemas
│       ├── services/                 # Business logic & Prisma queries
│       └── server.js                 # HTTP server bootstrap
├── frontend/
│   ├── src/
│   │   ├── components/               # Reusable UI widgets, drawers, modals, layouts
│   │   ├── config/                   # Environment & base URL resolutions
│   │   ├── pages/                    # Route-level page components
│   │   ├── services/api.js           # Axios client instance & interceptors
│   │   ├── store/                    # Zustand state management
│   │   ├── App.jsx                   # Master routing table & route protections
│   │   └── index.css                 # Global CSS tokens, keyframes, transitions
│   └── tailwind.config.js            # Tailwind color & font token extensions
├── tests/                            # Playwright E2E spec files
├── playwright.config.js              # Playwright configuration
└── successful_test/                  # Required test execution screenshot artifact output
```

### 3.2 Routes & Pages Breakdown

#### Storefront Routes (`components/StorefrontLayout.jsx` chrome)
* **Public Pages:**
  * `/` (`pages/Home.jsx`): Hero banner, editorial carousel, featured products, virtual boxes.
  * `/catalog` (`pages/Catalog.jsx`): Faceted search, rarity/set/category/price filtering.
  * `/product/:id` & `/catalog/:id` (`pages/ProductDetail.jsx`): Product gallery, variant selector, condition badge, dynamic stock.
  * `/cart` (`pages/Cart.jsx`): Persistent cart summary, quantity increment/decrement, shipping calculation.
  * `/checkout` (`pages/Checkout.jsx`): Vietnamese administrative address selection, SePay QR payment flow.
  * `/order-lookup` (`pages/OrderLookup.jsx`): Public order tracking by code & phone number.
  * `/news` & `/news/:id` (`pages/NewsList.jsx`, `pages/NewsDetail.jsx`): CMS blog articles.
  * `/virtual-boxes` & `/virtual-boxes/:id` (`pages/storefront/VirtualBoxesPage.jsx`, `VirtualBoxDetailPage.jsx`): Gacha boxes, drop rates, live reveal animation.
  * `/login` & `/register` (`pages/Login.jsx`, `pages/Register.jsx`): Customer/staff authentication.
  * `/payment/success`, `/payment/error`, `/payment/cancel`: Checkout callback status views.
* **Customer Protected Pages (`ProtectedRoute` roles: `CUSTOMER`, `STAFF`, `ADMIN`):**
  * `/orders` & `/orders/:id` (`pages/OrderHistory.jsx`): User order tracking and history.
  * `/user/vouchers` (`pages/Vouchers.jsx`): Claimed coupon wallet.

#### Staff Routes (`pages/staff/StaffLayout.jsx`, isolated portal)
* Access restricted via `ProtectedRoute` (`allowedRoles: ['STAFF', 'ADMIN']`) + granular `PermissionRoute`:
  * `/staff` & `/staff/dashboard` (`StaffOverview.jsx`): High-level operational overview.
  * `/staff/orders` (`OrderManagement.jsx`): Permission `orders` — status updates, fulfillment.
  * `/staff/products` (`InventoryManager.jsx`): Permission `inventory` — stock & variant manager with `CreatableSelect`.
  * `/staff/categories` (`CategoryManagement.jsx`): Permission `inventory` — catalog tree CRUD.
  * `/staff/virtual-boxes` (`VirtualBoxes.jsx`): Permission `virtual_box` — gacha card pools & rates.
  * `/staff/posts` (`PostEditor.jsx`): Permission `posts` — article editor.
  * `/staff/vouchers` (`AdminVouchers.jsx`): Permission `vouchers` — discount codes.

#### Admin Routes (`pages/admin/AdminLayout.jsx`, full management portal)
* Access restricted via `ProtectedRoute` (`allowedRoles: ['ADMIN']`):
  * `/admin` & `/admin/dashboard` (`AnalyticsDashboard.jsx`): Neuro-Bento analytics, revenue, top viewed cards.
  * `/admin/orders` (`OrderManagement.jsx`): Global order lifecycle and status audit.
  * `/admin/inventory` (`InventoryManager.jsx`): Full product inventory, multi-variant pricing, image uploads.
  * `/admin/catalog` & `/admin/catalog-settings` (`CatalogConfig.jsx`): Simplified tables for Card Conditions, Rarities, and Sealed Categories.
  * `/admin/virtual-boxes` (`VirtualBoxes.jsx`): Full gacha box configuration, drop rates, card pool associations.
  * `/admin/categories` (`CategoryManagement.jsx`): Category hierarchy management.
  * `/admin/posts` (`PostEditor.jsx`): Post creation, deletion, rich editing.
  * `/admin/users` (`UserManagement.jsx`): User list, granular staff permission toggles, read-only detail drawer.
  * `/admin/vouchers` (`AdminVouchers.jsx`): Voucher creation with percentage/fixed discount rules.
  * `/admin/payment-logs` (`PaymentLogAudit.jsx`): SePay webhook raw logs, idempotency & payload debugging.
  * `/admin/sepay-config` (`SePayConfig.jsx`): SePay API credentials & banking configuration.
  * `/admin/shop-settings` (`ShopSettings.jsx`): Store identity, support hotline, banner copy.
  * `/admin/shipping-settings` (`ShippingSettings.jsx`): Flat-rate or dynamic shipping fees.

### 3.3 Core Components & Architecture Layers
* `components/CreatableSelect.jsx`: Unified searchable dropdown with inline `+ Thêm ...` creation trigger for card conditions, rarities, and sealed categories.
* `components/BentoPieces.jsx`: Neuro-Bento chart components, standard tile classes, fixed typography, strict pink token mappings.
* `components/Navbar.jsx`: Storefront header with search, cart indicator, authentication actions, and mobile drawer.
* `components/UserDetailModal.jsx`: Admin slide-out drawer presenting user orders, balance, and permissions.
* `components/CatalogEditModal.jsx`: Modal for editing catalog lookup tables (`name` field only).
* `store/useAuthStore.js`: Handles JWT tokens, role inspection, user attributes, and `validateSession` bootstrap check on reload.
* `store/useCartStore.js`: Shopping cart state with persistent localStorage caching.
* `services/api.js`: Central Axios instance handling automatic Bearer token injection, synchronized 401 refresh token queueing, and immediate `forceLogout()` on credential revocation.

---

## 4. Data Models & API Conventions

### 4.1 Simplified Catalog Schemas (Name-Only Convention)
To eliminate administrative overhead and schema fragility, dynamic catalog models maintain strictly `name` as their identifier and descriptor (**no `code` or `description` columns**):

| Model | Table Name | Key Fields | Purpose |
| :--- | :--- | :--- | :--- |
| `CardConditionOption` | `card_conditions` | `id` (UUID), `name` (unique string), `isActive` (boolean), timestamps | Dynamic condition options (e.g., "Near Mint", "PSA 10") bound to `ProductVariant.condition` |
| `Rarity` | `Rarity` | `id` (UUID), `name` (unique string), `isActive` (boolean), timestamps | Card rarities (e.g., "SAR", "Secret Rare") bound to `Product.rarity` |
| `SealedCategory` | `SealedCategory` | `id` (UUID), `name` (unique string), `isActive` (boolean), timestamps | Sealed box types (e.g., "Booster Box", "ETB") bound to sealed product types |

* **Zod Schemas (`backend/src/schemas/admin.schema.js`):**
  * Validation expects: `{ name: z.string().trim().min(1).max(100), isActive: z.boolean().optional() }`.
  * Partial updates allow modifying `name` or toggling `isActive`.
* **API Endpoints:**
  * Public (active only): `GET /api/v1/rarities`, `GET /api/v1/sealed-categories`.
  * Management: `GET|POST|PUT|PATCH|DELETE` on `/api/v1/admin/card-conditions`, `/api/v1/admin/rarities`, `/api/v1/admin/sealed-categories`.
* **Variant & Product Decoupling:**
  * `ProductVariant.condition` and `Product.rarity` store free string values matching catalog `name`s, allowing new conditions/rarities without database enum migrations.

### 4.2 Real-Time `view_count` Tracking Mechanism
* **Schema Columns:**
  * `Product.viewCount` mapped to DB column `view_count` (`Int @default(0) @map("view_count")`).
  * `VirtualBox.viewCount` mapped to DB column `view_count` (`Int @default(0) @map("view_count")`).
  * Both fields indexed with `@@index([viewCount])` for fast descending sort on analytics queries.
* **Execution Architecture:**
  * Triggered automatically upon detail page queries:
    * `GET /api/v1/products/:id` (`product.controller.js`)
    * `GET /api/v1/virtual-boxes/:id` (`gacha.controller.js`)
  * **Fire-and-forget asynchronous increment:**
    ```javascript
    prisma.product
      .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
    ```
  * Never blocks or delays the HTTP response; failures are silently discarded to protect user latency.

---

## 5. Verification Workflow

### 5.1 Playwright Test Runner Commands
* **Run entire test suite:**
  ```bash
  npx playwright test
  ```
* **Run specific spec:**
  ```bash
  npx playwright test tests/<spec_name>.spec.js
  ```
* **Run in headed visual mode (with Xvfb virtual frame buffer):**
  ```bash
  xvfb-run npx playwright test --headed
  ```
* **Run specific test file in headed mode:**
  ```bash
  xvfb-run npx playwright test tests/<spec_name>.spec.js --headed
  ```

### 5.2 Strict Screenshot Output Convention
* All verification screenshots must be saved directly to the project's root screenshot directory:
  ```
  successful_test/
  ```
* **Naming standard:** `<issue_or_step_number>_<descriptive_test_name>.png` (e.g., `successful_test/56_admin_catalog_simplified_tables.png`).
* Specs mirror artifacts to `successful_test/` to ensure visual verification and prevent regressions across frontend changes.
