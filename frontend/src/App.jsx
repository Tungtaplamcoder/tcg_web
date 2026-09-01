import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

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
import NewsList from './pages/NewsList.jsx';
import NewsDetail from './pages/NewsDetail.jsx';
import VirtualBoxesPage from './pages/storefront/VirtualBoxesPage.jsx';

// Staff pages
import StaffLayout from './pages/staff/StaffLayout.jsx';
import StaffOverview from './pages/staff/StaffOverview.jsx';
import InventoryManager from './pages/staff/InventoryManager.jsx';
import PostEditor from './pages/staff/PostEditor.jsx';
import StaffChatInbox from './pages/staff/StaffChatInbox.jsx';
import OrderManagement from './pages/OrderManagement.jsx';
import CategoryManagement from './pages/CategoryManagement.jsx';

// Admin pages
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard.jsx';
import UserManagement from './pages/admin/UserManagement.jsx';
import PaymentLogAudit from './pages/admin/PaymentLogAudit.jsx';
import SePayConfig from './pages/admin/SePayConfig.jsx';
import VirtualBoxes from './pages/admin/VirtualBoxes.jsx';
import AdminChat from './pages/admin/Chat.jsx';

function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route
            path="/product/:id"
            element={
              <ErrorBoundary label="Product Detail Page">
                <ProductDetail />
              </ErrorBoundary>
            }
          />
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

          {/* Customer routes */}
          <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']} />}>
            <Route path="/orders" element={<OrderHistory />} />
            <Route path="/orders/:id" element={<OrderHistory />} />
          </Route>

          {/* Staff routes */}
          <Route element={<ProtectedRoute allowedRoles={['STAFF', 'ADMIN']} />}>
            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffOverview />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="inventory" element={<InventoryManager />} />
              <Route path="categories" element={<CategoryManagement />} />
              <Route path="virtual-boxes" element={<VirtualBoxes />} />
              <Route path="posts" element={<PostEditor />} />
              <Route path="chat" element={<StaffChatInbox />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AnalyticsDashboard />} />
              <Route path="orders" element={<OrderManagement />} />
              <Route path="inventory" element={<InventoryManager />} />
              <Route path="virtual-boxes" element={<VirtualBoxes />} />
              <Route path="categories" element={<CategoryManagement />} />
              <Route path="posts" element={<PostEditor />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="payment-logs" element={<PaymentLogAudit />} />
              <Route path="sepay-config" element={<SePayConfig />} />
              <Route path="chat" element={<AdminChat />} />
            </Route>
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
        </Routes>
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}

export default App;