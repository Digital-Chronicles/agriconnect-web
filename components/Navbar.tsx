'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import {
  Menu,
  X,
  ChevronDown,
  Settings,
  LogOut,
  ShoppingCart,
  Heart,
  Compass,
  Package,
  Leaf,
  User as UserIcon,
  Store,
  TrendingUp,
  Home,
  LayoutDashboard,
  MapPin,
  Loader2,
  Target,
  Truck,
  Wallet,
} from 'lucide-react';

type Role = 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest' | string;

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone_number?: string;
  auth_user_id?: string;
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const closeMobile = () => {
    setMobileClosing(true);
    window.setTimeout(() => {
      setIsMobileMenuOpen(false);
      setMobileClosing(false);
    }, 200);
  };

  const closeAll = () => {
    setShowDropdown(false);
    if (isMobileMenuOpen) closeMobile();
  };

  const fetchUserProfile = async (authUserId: string, authUser?: User) => {
    try {
      const { data, error, status } = await supabase
        .from('accounts_user')
        .select('id,email,first_name,last_name,role,phone_number,auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', {
          status,
          message: error.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
          code: (error as any)?.code,
        });

        if (authUser) {
          const meta = authUser.user_metadata || {};
          setUser({
            id: authUserId,
            email: authUser.email || '',
            first_name: meta.first_name || '',
            last_name: meta.last_name || '',
            role: meta.role || 'guest',
            phone_number: meta.phone_number || undefined,
            auth_user_id: authUserId,
          });
        } else {
          setUser(null);
        }
        return;
      }

      if (!data) {
        if (authUser) {
          const meta = authUser.user_metadata || {};
          setUser({
            id: authUserId,
            email: authUser.email || '',
            first_name: meta.first_name || '',
            last_name: meta.last_name || '',
            role: meta.role || 'guest',
            phone_number: meta.phone_number || undefined,
            auth_user_id: authUserId,
          });
        } else {
          setUser(null);
        }
        return;
      }

      setUser({
        id: String(data.id),
        email: data.email ?? authUser?.email ?? '',
        first_name: data.first_name ?? '',
        last_name: data.last_name ?? '',
        role: data.role ?? 'guest',
        phone_number: data.phone_number ?? undefined,
        auth_user_id: data.auth_user_id ?? authUserId,
      });
    } catch (error) {
      console.error('Unexpected profile fetch error:', error);

      if (authUser) {
        const meta = authUser.user_metadata || {};
        setUser({
          id: authUserId,
          email: authUser.email || '',
          first_name: meta.first_name || '',
          last_name: meta.last_name || '',
          role: meta.role || 'guest',
          phone_number: meta.phone_number || undefined,
          auth_user_id: authUserId,
        });
      } else {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error.message);
          if (mounted) setUser(null);
          return;
        }

        if (!session?.user) {
          if (mounted) setUser(null);
          return;
        }

        if (mounted) {
          await fetchUserProfile(session.user.id, session.user);
        }
      } catch (error) {
        console.error('Unexpected auth load error:', error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      await fetchUserProfile(session.user.id, session.user);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const node = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(node)) {
        setShowDropdown(false);
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(node) &&
        isMobileMenuOpen
      ) {
        closeMobile();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    closeAll();
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Error signing out:', error.message);
        return;
      }

      setUser(null);
      setShowDropdown(false);
      setIsMobileMenuOpen(false);
      setMobileClosing(false);

      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error('Unexpected sign out error:', error);
    } finally {
      setSigningOut(false);
    }
  };

  const navItems = useMemo<NavItem[]>(() => {
    const role = user?.role;

    if (!user) {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/marketplace', label: 'Marketplace', icon: Store },
        { href: '/demands', label: 'Buyer Demands', icon: Target },
        { href: '/logistics', label: 'Logistics', icon: Truck },
      ];
    }

    if (role === 'farmer') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/farmer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/marketplace', label: 'My Produce', icon: Leaf },
        { href: '/demands', label: 'Buyer Demands', icon: Target },
        { href: '/locations', label: 'Locations', icon: MapPin },
      ];
    }

    if (role === 'buyer') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/buyer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
        { href: '/favorites', label: 'Saved', icon: Heart },
        { href: '/demands', label: 'My Demands', icon: Target },
      ];
    }

    if (role === 'logistics') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/logistics', label: 'Routes', icon: Truck },
        { href: '/deliveries', label: 'Deliveries', icon: Package },
        { href: '/marketplace', label: 'Loads', icon: Compass },
      ];
    }

    if (role === 'finance') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/finance', label: 'Finance', icon: Wallet },
        { href: '/transactions', label: 'Transactions', icon: TrendingUp },
        { href: '/marketplace', label: 'Marketplace', icon: Store },
      ];
    }

    return [
      { href: '/', label: 'Home', icon: Home },
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/demands', label: 'Demands', icon: Target },
      { href: '/logistics', label: 'Logistics', icon: Truck },
    ];
  }, [user]);

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || 'U';
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'My Account';

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 w-full border-b transition-all duration-300',
          scrolled
            ? 'border-slate-200 bg-white/90 shadow-sm backdrop-blur-xl'
            : 'border-transparent bg-white/75 backdrop-blur-lg'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <Leaf className="h-5 w-5" />
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-bold tracking-tight text-slate-900">
                    AgriConnect
                  </p>
                  <p className="text-xs text-slate-500">
                    Smarter agriculture marketplace
                  </p>
                </div>
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {!loading && !user ? (
                <div className="hidden items-center gap-2 md:flex">
                  <Link
                    href="/login"
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:shadow-lg"
                  >
                    Get Started
                  </Link>
                </div>
              ) : null}

              {loading ? (
                <div className="hidden items-center gap-2 md:flex">
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                </div>
              ) : null}

              {!loading && user ? (
                <div className="relative hidden md:block" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown((s) => !s)}
                    className={cn(
                      'inline-flex items-center gap-3 rounded-2xl border px-2.5 py-2 transition-all duration-200',
                      showDropdown
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-sm font-bold text-white shadow-sm">
                      {initials}
                    </div>

                    <div className="hidden text-left lg:block">
                      <p className="max-w-[170px] truncate text-sm font-semibold text-slate-900">
                        {displayName}
                      </p>
                      <p className="max-w-[170px] truncate text-xs capitalize text-slate-500">
                        {String(user.role || 'guest')}
                      </p>
                    </div>

                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-slate-500 transition-transform duration-200',
                        showDropdown && 'rotate-180'
                      )}
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
                      <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-lg font-bold text-white shadow-md">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-bold text-slate-900">
                              {displayName}
                            </h3>
                            <p className="truncate text-sm text-slate-600">
                              {user.email}
                            </p>
                            <p className="mt-1 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700">
                              {String(user.role || 'guest')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-2">
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-all duration-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <UserIcon className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Profile</span>
                            <p className="text-xs text-gray-400">Manage your account</p>
                          </div>
                        </Link>

                        <Link
                          href="/settings"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-all duration-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <Settings className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Settings</span>
                            <p className="text-xs text-gray-400">Preferences</p>
                          </div>
                        </Link>

                        <div className="my-2 border-t border-gray-100" />

                        <button
                          onClick={handleSignOut}
                          disabled={signingOut}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                            {signingOut ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <LogOut className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <span className="font-medium">
                              {signingOut ? 'Signing out...' : 'Sign Out'}
                            </span>
                            <p className="text-xs text-red-400">Logout</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <button
                onClick={() => {
                  if (isMobileMenuOpen) {
                    closeMobile();
                  } else {
                    setIsMobileMenuOpen(true);
                  }
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 md:hidden"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" />

          <div
            ref={mobileMenuRef}
            className={cn(
              'fixed inset-x-0 top-16 z-50 mx-4 rounded-3xl border border-slate-200 bg-white shadow-2xl md:hidden',
              mobileClosing ? 'animate-out fade-out slide-out-to-top-4' : 'animate-in fade-in slide-in-from-top-4'
            )}
          >
            <div className="max-h-[calc(100vh-5rem)] overflow-y-auto p-4">
              {!loading && user && (
                <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 font-bold text-white">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-900">{displayName}</h3>
                      <p className="truncate text-sm text-slate-600">{user.email}</p>
                      <p className="mt-1 text-xs capitalize text-emerald-700">
                        {String(user.role || 'guest')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobile}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200',
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {!loading && !user && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <Link
                    href="/login"
                    onClick={closeMobile}
                    className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    onClick={closeMobile}
                    className="block rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-md"
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {!loading && user && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h3 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Account
                  </h3>

                  <Link
                    href="/profile"
                    onClick={closeMobile}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-gray-600 transition-all duration-200 hover:bg-gray-50"
                  >
                    <UserIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={closeMobile}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-gray-600 transition-all duration-200 hover:bg-gray-50"
                  >
                    <Settings className="h-5 w-5" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>

                  <button
                    onClick={() => {
                      closeMobile();
                      handleSignOut();
                    }}
                    disabled={signingOut}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 transition-all duration-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {signingOut ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <LogOut className="h-5 w-5" />
                    )}
                    <span className="text-sm font-medium">
                      {signingOut ? 'Signing out...' : 'Sign Out'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showDropdown && !isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm md:hidden"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </>
  );
}