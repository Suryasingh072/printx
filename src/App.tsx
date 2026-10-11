import React, { useState, useEffect } from 'react';
import { api } from './lib/api.js';
import { User, Shop } from './types.js';
import { LandingPage } from './components/LandingPage.js';
import { CustomerPortal } from './components/CustomerPortal.js';
import { ShopDashboard } from './components/ShopDashboard.js';
import { AdminDashboard } from './components/AdminDashboard.js';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Path routing
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Initial Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const data = await api.getMe();
        setCurrentUser(data.user);
        if (data.shop) {
          setCurrentShop(data.shop);
        }
      } catch (e) {
        api.clearToken();
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setCurrentShop(null);
    navigateTo('/');
  };

  const handleLoginSuccess = (user: User, shop?: Shop) => {
    setCurrentUser(user);
    if (shop) setCurrentShop(shop);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold tracking-wide">Starting PrintQR...</p>
        </div>
      </div>
    );
  }

  // 1. Customer QR Route: /s/:slug or /shop/:slug
  const shopMatch = currentPath.match(/^\/(?:s|shop)\/([a-zA-Z0-9_\.-]+)/);
  if (shopMatch) {
    const slug = shopMatch[1];
    return (
      <CustomerPortal
        shopSlug={slug}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  // 2. Admin Dashboard Route
  if (currentUser && currentUser.role === 'admin') {
    return (
      <AdminDashboard
        user={currentUser}
        onLogout={handleLogout}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  // 3. Authenticated Shop Owner Dashboard
  if (currentUser && currentShop) {
    return (
      <ShopDashboard
        user={currentUser}
        shop={currentShop}
        onLogout={handleLogout}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  // 4. Public Landing Page
  return (
    <LandingPage
      onOpenCustomerPortal={(slug) => navigateTo(`/shop/${slug}`)}
      onLoginSuccess={handleLoginSuccess}
    />
  );
}
