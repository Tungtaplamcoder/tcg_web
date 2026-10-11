import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import StorefrontLayout from './components/StorefrontLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import PermissionRoute from './components/PermissionRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { useAuthStore } from './store/useAuthStore.js';

// Public pages
import Home from './pages/Home.jsx';
import Catalog from './pages/Catalog.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderLookup from './pages/OrderLookup.jsx';
import PaymentSuccess from './pages/PaymentSuccess.jsx';
import PaymentError from './pages/PaymentError.jsx';
import PaymentCancel from './pages/PaymentCancel.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import OrderHistory from './pages/OrderHistory.jsx';
import Vouchers from './pages/Vouchers.jsx';
import NewsList from './pages/NewsList.jsx';
import NewsDetail from './pages/NewsDetail.jsx';
import VirtualBoxesPage from './pages/storefront/VirtualBoxesPage.jsx';
import VirtualBoxDetailPage from './pages/storefront/VirtualBoxDetailPage.jsx';

// Staff pages
import StaffLayout from './pages/staff/StaffLayout.jsx';
import StaffOverview from './pages/staff/StaffOverview.jsx';
import InventoryManager from './pages/staff/InventoryManager.jsx';
import PostEditor from './pages/staff/PostEditor.jsx';
import OrderManagement from './pages/OrderManagement.jsx';
import CategoryManagement from './pages/CategoryManagement.jsx';

// Admin pages
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import PaymentLogAudit from './pages/admin/PaymentLogAudit.jsx';
import SePayConfig from './pages/admin/SePayConfig.jsx';
import ShopSettings from './pages/admin/ShopSettings.jsx';
import ShippingSettings from './pages/admin/ShippingSettings.jsx';
import VirtualBoxes from './pages/admin/VirtualBoxes.jsx';
import AdminVouchers from './pages/admin/Vouchers.jsx';
import CatalogConfig from './pages/admin/CatalogConfig.jsx';

/* Legacy/pluralized product URLs (/products/:id) → canonical /product/:id
 * so old bookmarks and shared links never hit the 404 route. */
const LegacyProductRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/product/${id}`} replace />;
};

function App() {
  // Bootstrap session check: verify the persisted access token against the
  // backend on every full page load. A deleted account returns 401 and the
  // api interceptor purges auth state, so the Topbar never shows a stale
  // profile (e.g. after reloading /login as a deleted user).
  useEffect(() => {
    if (useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().validateSession();
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#FFF0F5] via-[#FDFBF7] to-[#FFF0F5] text-neutral-800 antialiased dark:from-[#120b0e] dark:via-[#170e12] dark:to-[#120b0e] dark:text-neutral-100">
      <Routes>
        {/* Storefront chrome (topbar + footer + chat) — public & customer routes only.
            Admin/Staff routes below are rendered WITHOUT this chrome. */}
        <Route element={<StorefrontLayout />}>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          {/* Legacy/alternative storefront deep link → collection page */}
          <Route path="/collection" element={<Navigate to="/catalog" replace />} />
          <Route
            path="/product/:id"
            element={
              <ErrorBoundary label="Product Detail Page">
                <ProductDetail />
              </ErrorBoundary>
            }
          />
          {/* `/catalog/:id` alias — the product detail view counter increments
              on whichever product-detail path the visitor lands on. */}
          <Route path="/catalog/:id" element={<ProductDetail />} />
          <Route path="/products/:id" element={<LegacyProductRedirect />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order-lookup" element={<OrderLookup />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/error" element={<PaymentError />} />
          <Route path="/payment/cancel" element={<PaymentCancel />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/news" element={<NewsList />} />
          <Route path="/news/:id" element={<NewsDetail />} />
          <Route path="/virtual-boxes" element={<VirtualBoxesPage />} />
          <Route path="/virtual-boxes/:id" element={<VirtualBoxDetailPage />} />

          {/* Customer routes */}
          <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']} />}>
            <Route path="/orders" element={<OrderHistory />} />
            <Route path="/orders/:id" element={<OrderHistory />} />
            <Route path="/user/vouchers" element={<Vouchers />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={
            <div className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4">
              <div className="pointer-events-none absolute -top-24 left-1/3 h-72 w-72 rounded-full bg-primary-400/20 blur-[110px] animate-tcg-float" />
              <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-[100px] animate-tcg-float-slow" />
              <div className="relative text-center animate-tcg-reveal">
                <p className="font-display text-7xl sm:text-8xl font-bold text-gradient-brand">404</p>
                <h1 className="mt-3 text-xl font-semibold text-ink-900 dark:text-white">Page Not Found</h1>
                <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">The page you're looking for doesn't exist or was moved.</p>
                <a href="/" className="btn-primary mt-6">Back to Home</a>
              </div>
            </div>
          } />
        </Route>

        {/* Staff routes — isolated from the storefront topbar/footer */}
        <Route element={<ProtectedRoute allowedRoles={['STAFF', 'ADMIN']} />}>
          <Route path="/staff" element={<StaffLayout />}>
            <Route index element={<StaffOverview />} />
            {/* Explicit alias so the `/staff/dashboard` deep link resolves */}
            <Route path="dashboard" element={<StaffOverview />} />
            <Route element={<PermissionRoute permission="orders" />}>
              <Route path="orders" element={<OrderManagement />} />
            </Route>
            <Route path="inventory" element={<Navigate to="/staff/products" replace />} />
            <Route element={<PermissionRoute permission="inventory" />}>
              <Route path="products" element={<InventoryManager />} />
              <Route path="categories" element={<CategoryManagement />} />
            </Route>
            <Route element={<PermissionRoute permission="virtual_box" />}>
              <Route path="virtual-boxes" element={<VirtualBoxes />} />
            </Route>
            <Route element={<PermissionRoute permission="posts" />}>
              <Route path="posts" element={<PostEditor />} />
            </Route>
            <Route element={<PermissionRoute permission="vouchers" />}>
              <Route path="vouchers" element={<AdminVouchers />} />
            </Route>
          </Route>
        </Route>

        {/* Admin routes — isolated from the storefront topbar/footer */}
        <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AnalyticsDashboard />} />
            {/* Explicit alias so the `/admin/dashboard` deep link resolves */}
            <Route path="dashboard" element={<AnalyticsDashboard />} />
            <Route path="orders" element={<OrderManagement />} />
            <Route path="inventory" element={<InventoryManager />} />
            <Route path="catalog" element={<CatalogConfig />} />
            {/* Alias so the task's `/admin/catalog-settings` path resolves too */}
            <Route path="catalog-settings" element={<CatalogConfig />} />
            <Route path="virtual-boxes" element={<VirtualBoxes />} />
            <Route path="categories" element={<CategoryManagement />} />
            <Route path="posts" element={<PostEditor />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="vouchers" element={<AdminVouchers />} />
            <Route path="payment-logs" element={<PaymentLogAudit />} />
            <Route path="sepay-config" element={<SePayConfig />} />
            <Route path="shop-settings" element={<ShopSettings />} />
            <Route path="shipping-settings" element={<ShippingSettings />} />
          </Route>
        </Route>
      </Routes>
    </div>
  );
}

export default App;