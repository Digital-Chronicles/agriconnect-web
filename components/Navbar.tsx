'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
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
} from 'lucide-react';

type Role = 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest' | string;

interface UserProfile {
  id: string; // accounts_user.id (bigserial -> string is fine)
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone_number?: string;
  auth_user_id?: string;
}

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

  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
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

  // --- Profile fetch: use auth_user_id (best) ---
  const fetchUserProfile = async (authUserId: string) => {
    const { data, error, status } = await supabase
      .from('accounts_user')
      .select('id,email,first_name,last_name,role,phone_number,auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      // log useful fields (avoid {} logs)
      console.error('Error fetching user profile:', {
        status,
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code,
      });
      setUser(null);
      return;
    }

    if (!data) {
      // user exists in auth but no row in accounts_user
      setUser(null);
      return;
    }

    setUser({
      id: String(data.id),
      email: data.email,
      first_name: data.first_name ?? '',
      last_name: data.last_name ?? '',
      role: data.role ?? 'guest',
      phone_number: data.phone_number ?? undefined,
      auth_user_id: data.auth_user_id ?? undefined,
    });
  };

  // --- Auth bootstrap ---
  useEffect(() => {
    let alive = true;

    const boot = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        const session = data.session;
        if (session?.user?.id) {
          await fetchUserProfile(session.user.id);
        } else {
          setUser(null);
        }
      } catch (e: any) {
        console.error('Error checking auth:', e?.message ?? e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    boot();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;
      if (session?.user?.id) {
        await fetchUserProfile(session.user.id);
      } else {
        setUser(null);
        setShowDropdown(false);
      }
    });

    const onScroll = () => setScrolled(window.scrollY > 10);

    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      // dropdown close
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowDropdown(false);
      }

      // mobile menu close (click outside)
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        const el = event.target as Element | null;
        const clickedMenuButton = !!el?.closest('button[aria-label="Open menu"],button[aria-label="Close menu"]');
        if (!clickedMenuButton) closeMobile();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowDropdown(false);
      if (isMobileMenuOpen) closeMobile();
    };

    window.addEventListener('scroll', onScroll);
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onEscape);

    return () => {
      alive = false;
      authListener?.subscription?.unsubscribe();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onEscape);
    };
    // IMPORTANT: no dependency on isMobileMenuOpen to avoid re-registering listeners endlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setShowDropdown(false);
      setIsMobileMenuOpen(false);
      router.push('/');
      router.refresh();
    } catch (e: any) {
      console.error('Error signing out:', e?.message ?? e);
    }
  };

  const displayName = useMemo(() => {
    if (!user) return '';
    const name = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return name || user.email || 'User';
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return 'U';
    const f = user.first_name?.trim()?.[0] ?? '';
    const l = user.last_name?.trim()?.[0] ?? '';
    const i = (f + l).toUpperCase();
    return i || user.email?.trim()?.[0]?.toUpperCase() || 'U';
  }, [user]);

  const roleLabel = (role: Role) => {
    const map: Record<string, string> = {
      farmer: '🌱 Farmer',
      buyer: '🛒 Buyer',
      admin: '⚡ Admin',
      logistics: '🚚 Logistics',
      finance: '💰 Finance',
      guest: '👤 Guest',
    };
    return map[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
  };

  const roleGradient = (role: Role) => {
    const map: Record<string, string> = {
      farmer: 'from-emerald-500 to-green-600',
      buyer: 'from-blue-500 to-cyan-600',
      admin: 'from-purple-500 to-violet-600',
      logistics: 'from-orange-500 to-amber-600',
      finance: 'from-rose-500 to-pink-600',
      guest: 'from-gray-500 to-gray-600',
    };
    return map[role] ?? 'from-gray-500 to-gray-600';
  };

  // --- Nav items (role-aware) ---
  const navItems = useMemo(() => {
    const base = [
      { href: '/', label: 'Home', icon: Home },
      { href: '/products', label: 'Products', icon: Package },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
      { href: '/trending', label: 'Trending', icon: TrendingUp },
      { href: '/discover', label: 'Discover', icon: Compass },
    ];

    if (!user) return base;

    if (user.role === 'buyer') {
      return [
        ...base,
        { href: '/buyer/demands', label: 'My Demands', icon: MapPin },
      ];
    }

    if (user.role === 'farmer') {
      return [
        ...base,
        { href: '/farmer/products', label: 'My Produce', icon: Leaf },
      ];
    }

    if (user.role === 'admin') {
      return [
        ...base,
        { href: '/admin', label: 'Admin', icon: LayoutDashboard },
      ];
    }

    return [...base, { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];
  }, [user]);

  const iconLinks = [
    { href: '/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/cart', label: 'Cart', icon: ShoppingCart },
  ];

  return (
    <>
      <nav
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/95 backdrop-blur-xl shadow-lg border-b border-gray-100/50'
            : 'bg-white/90 backdrop-blur-lg border-b border-gray-100/30'
        )}
      >
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group" onClick={closeAll}>
              <div className="relative">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md sm:shadow-lg group-hover:shadow-emerald-200/50 group-hover:scale-105 transition-all duration-300">
                  <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-green-500 rounded-lg sm:rounded-xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-transparent">
                  AgriConnect
                </h1>
                <p className="text-xs text-gray-500 font-medium hidden md:block">Farm-to-Table Marketplace</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1 relative">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowDropdown(false)}
                  className={cn(
                    'relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Icon links */}
              <div className="hidden sm:flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                {iconLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowDropdown(false)}
                    className={cn(
                      'relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105',
                      isActive(link.href)
                        ? 'bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    aria-label={link.label}
                    title={link.label}
                  >
                    <link.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Link>
                ))}
              </div>

              {/* Auth area */}
              {loading ? (
                <div className="hidden md:flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
                  <div className="w-28 h-4 rounded bg-gray-200 animate-pulse" />
                </div>
              ) : user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown((s) => !s)}
                    className={cn(
                      'hidden md:flex items-center gap-3 p-2 rounded-xl transition-all duration-300',
                      showDropdown
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 ring-1 ring-gray-200'
                        : 'hover:bg-gray-50/80 hover:ring-1 hover:ring-gray-200'
                    )}
                    aria-label="User menu"
                    aria-expanded={showDropdown}
                  >
                    <div
                      className={cn(
                        'relative w-9 h-9 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold shadow-md',
                        roleGradient(user.role)
                      )}
                    >
                      {initials}
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                    </div>

                    <div className="hidden lg:flex flex-col items-start max-w-[180px]">
                      <span className="text-sm font-semibold text-gray-900 line-clamp-1">{displayName}</span>
                      <span className="text-xs text-gray-500 font-medium">{roleLabel(user.role)}</span>
                    </div>

                    <ChevronDown
                      className={cn('w-4 h-4 text-gray-400 transition-all duration-300', showDropdown && 'rotate-180 text-gray-600')}
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100/50 py-2 backdrop-blur-xl z-50 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400" />

                      <div className="px-4 py-4 border-b border-gray-100/50">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'relative w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-lg',
                              roleGradient(user.role)
                            )}
                          >
                            {initials}
                            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                            <div className="mt-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800">
                                {roleLabel(user.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="py-2">
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <UserIcon className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">My Profile</span>
                            <p className="text-xs text-gray-400">Account settings</p>
                          </div>
                        </Link>

                        <Link
                          href="/settings"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Settings className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Settings</span>
                            <p className="text-xs text-gray-400">Preferences</p>
                          </div>
                        </Link>

                        <div className="border-t border-gray-100 my-2" />

                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all duration-200"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-left">
                            <span className="font-medium">Sign Out</span>
                            <p className="text-xs text-red-400">Logout</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2">
                  <Link
                    href="/login"
                    className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm transition-all duration-200 hover:bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Get Started
                  </Link>
                </div>
              )}

              {/* Mobile avatar shortcut */}
              {!loading && user && (
                <button
                  onClick={() => setShowDropdown((s) => !s)}
                  className={cn(
                    'md:hidden p-2 rounded-lg transition-all duration-200',
                    showDropdown ? 'bg-gray-100 ring-1 ring-gray-200' : 'hover:bg-gray-50'
                  )}
                  aria-label="User menu"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold shadow-sm',
                      roleGradient(user.role)
                    )}
                  >
                    {initials}
                  </div>
                </button>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen((s) => !s);
                  setShowDropdown(false);
                }}
                className={cn(
                  'md:hidden p-2 rounded-lg transition-all duration-200',
                  isMobileMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeMobile} aria-hidden="true" />
          <div
            ref={mobileMenuRef}
            className={cn(
              'fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-white shadow-2xl transform transition-transform duration-300 ease-in-out',
              mobileClosing ? 'translate-x-full' : 'translate-x-0'
            )}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AgriConnect</h2>
                  <p className="text-xs text-gray-500">Farm-to-Table Marketplace</p>
                </div>
              </div>
              <button onClick={closeMobile} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close menu">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
              {loading ? (
                <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-600">Loading account...</span>
                </div>
              ) : user ? (
                <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg shadow-md',
                        roleGradient(user.role)
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                      <span className="inline-flex mt-2 items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800">
                        {roleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm font-semibold text-gray-900">You’re not signed in</p>
                  <p className="text-xs text-gray-500 mt-1">Login to post demands & manage your profile.</p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href="/login"
                      onClick={closeMobile}
                      className="flex-1 text-center px-4 py-2.5 rounded-xl border border-gray-200 font-semibold text-sm text-gray-700 hover:bg-white"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={closeMobile}
                      className="flex-1 text-center px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              )}

              <nav className="space-y-1 mb-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-emerald-700 border border-emerald-100'
                        : 'text-gray-600 hover:bg-gray-50/50 hover:text-gray-900'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isActive(item.href) ? 'bg-emerald-100' : 'bg-gray-100')}>
                      <item.icon className={cn('w-5 h-5', isActive(item.href) ? 'text-emerald-600' : 'text-gray-500')} />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {iconLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobile}
                      className={cn(
                        'flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200',
                        isActive(link.href) ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <link.icon className="w-5 h-5 mb-2" />
                      <span className="text-xs font-medium">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {user && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Account</h3>
                  <Link
                    href="/profile"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={closeMobile}
                    className="flex items-center gap-3 px-3 py-3 text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">Settings</span>
                  </Link>

                  <button
                    onClick={() => {
                      closeMobile();
                      handleSignOut();
                    }}
                    className="flex items-center gap-3 w-full px-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile dropdown overlay */}
      {showDropdown && !isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm md:hidden" onClick={() => setShowDropdown(false)} />
      )}
    </>
  );
}
