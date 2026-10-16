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
        } else if (data.user && data.user.role === 'shop_owner') {
          // Fallback: restore shop directly
          try {
            const directShop = await api.getCurrentShop();
            if (directShop) setCurrentShop(directShop);
          } catch (shopErr) {
            console.warn('Could not restore shop profile:', shopErr);
          }
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
          <p className="text-sm font-semibold tracking-wide">Starting printx...</p>
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
        onShopUpdate={(updated) => setCurrentShop(updated)}
      />
    );
  }

  // 3b. Authenticated user without linked shop
  if (currentUser && !currentShop) {
    return (
      <div className="min-h-screen bg-[#080b14] text-[#f1f5f9] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0f172a] border border-white/15 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl mx-auto">
            🏪
          </div>
          <div>
            <h2 className="text-xl font-bold font-['Sora'] text-white">Welcome, {currentUser.fullName}!</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Your account (<span className="text-pink-300 font-mono">{currentUser.email}</span>) is active and permanently saved.
              Your shop profile is being configured by the system administrator.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary py-2.5 text-xs font-bold cursor-pointer"
            >
              Refresh & Check Shop Link
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
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
