import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import ChatWidget from './ChatWidget.jsx';

/* ── StorefrontLayout ────────────────────────────────────────────────────
   Wraps every public / customer-facing route with the storefront chrome
   (floating pill topbar, footer and support chat). Admin/Staff routes are
   rendered OUTSIDE this layout so their panels are fully isolated from the
   storefront Topbar and Footer. */
const StorefrontLayout = () => (
  <>
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <ChatWidget />
  </>
);

export default StorefrontLayout;
