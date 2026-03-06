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
  icon: any;
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

  const fetchUserProfile = async (authUserId: string) => {
    const { data, error, status } = await supabase
      .from('accounts_user')
      .select('id,email,first_name,last_name,role,phone_number,auth_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
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

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowDropdown(false);
      }

      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        const el = event.target as Element | null;
        const clickedMenuButton = !!el?.closest(
          'button[aria-label="Open menu"],button[aria-label="Close menu"]'
        );
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

  const firstName = useMemo(() => {
    if (!user) return '';
    return user.first_name?.trim() || 'User';
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
      farmer: 'Farmer',
      buyer: 'Buyer',
      admin: 'Admin',
      logistics: 'Logistics',
      finance: 'Finance',
      guest: 'Guest',
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

  const roleTheme = (role: Role) => {
    const map: Record<string, string> = {
      farmer: 'from-emerald-50 to-green-50 border-emerald-100 text-emerald-800',
      buyer: 'from-blue-50 to-cyan-50 border-blue-100 text-blue-800',
      admin: 'from-purple-50 to-violet-50 border-purple-100 text-purple-800',
      logistics: 'from-orange-50 to-amber-50 border-orange-100 text-orange-800',
      finance: 'from-rose-50 to-pink-50 border-rose-100 text-rose-800',
      guest: 'from-gray-50 to-gray-100 border-gray-200 text-gray-700',
    };
    return map[role] ?? 'from-gray-50 to-gray-100 border-gray-200 text-gray-700';
  };

  const roleIcon = (role: Role) => {
    const map: Record<string, any> = {
      farmer: Leaf,
      buyer: Target,
      admin: LayoutDashboard,
      logistics: Truck,
      finance: Wallet,
      guest: UserIcon,
    };
    return map[role] ?? UserIcon;
  };

  const navItems = useMemo<NavItem[]>(() => {
    const common: NavItem[] = [
      { href: '/', label: 'Home', icon: Home },
      { href: '/discover', label: 'Discover', icon: Compass },
      { href: '/products', label: 'Products', icon: Package },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
    ];

    if (!user) return common;

    if (user.role === 'buyer') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/discover', label: 'Discover', icon: Compass },
        { href: '/marketplace', label: 'Marketplace', icon: Store },
        { href: '/buyer/demands', label: 'My Demands', icon: Target },
        { href: '/trending', label: 'Trending', icon: TrendingUp },
      ];
    }

    if (user.role === 'farmer') {
      return [
        { href: '/', label: 'Home', icon: Home },
        { href: '/discover', label: 'Discover', icon: Compass },
        { href: '/marketplace', label: 'Marketplace', icon: Store },
        { href: '/farmer/products', label: 'My Produce', icon: Leaf },
        { href: '/trending', label: 'Trending', icon: TrendingUp },
      ];
    }

    if (user.role === 'admin') {
      return [
        ...common,
        { href: '/admin', label: 'Admin', icon: LayoutDashboard },
        { href: '/trending', label: 'Trending', icon: TrendingUp },
      ];
    }

    return [...common, { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];
  }, [user]);

  const roleQuickLinks = useMemo<NavItem[]>(() => {
    if (!user) return [];

    if (user.role === 'buyer') {
      return [
        { href: '/buyer/demands', label: 'Post Demand', icon: Target },
        { href: '/marketplace', label: 'Find Farmers', icon: Store },
        { href: '/discover', label: 'Browse Produce', icon: Compass },
      ];
    }

    if (user.role === 'farmer') {
      return [
        { href: '/farmer/products', label: 'Add Produce', icon: Leaf },
        { href: '/marketplace', label: 'Find Buyers', icon: Store },
        { href: '/products', label: 'My Listings', icon: Package },
      ];
    }

    if (user.role === 'admin') {
      return [
        { href: '/admin', label: 'Admin Panel', icon: LayoutDashboard },
        { href: '/discover', label: 'Discover', icon: Compass },
        { href: '/marketplace', label: 'Marketplace', icon: Store },
      ];
    }

    return [
      { href: '/discover', label: 'Discover', icon: Compass },
      { href: '/products', label: 'Products', icon: Package },
      { href: '/marketplace', label: 'Marketplace', icon: Store },
    ];
  }, [user]);

  const roleMessage = useMemo(() => {
    if (!user) return 'Connect with the agricultural marketplace';
    if (user.role === 'buyer') return 'Source produce faster and post buyer demands';
    if (user.role === 'farmer') return 'Showcase produce and respond to buyer opportunities';
    if (user.role === 'admin') return 'Monitor and manage the marketplace';
    return 'Manage your marketplace activity';
  }, [user]);

  const iconLinks = [
    { href: '/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/cart', label: 'Cart', icon: ShoppingCart },
  ];

  const RoleIcon = roleIcon(user?.role || 'guest');

  return (
    <>
      <nav
        className={cn(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-gray-100/60 bg-white/95 shadow-lg backdrop-blur-xl'
            : 'border-b border-gray-100/30 bg-white/90 backdrop-blur-lg'
        )}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16">
            <Link
              href="/"
              className="group flex items-center space-x-2 sm:space-x-3"
              onClick={closeAll}
            >
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-md transition-all duration-300 group-hover:scale-105 group-hover:shadow-emerald-200/50 sm:h-10 sm:w-10 sm:rounded-xl sm:shadow-lg">
                  <Leaf className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                  AgriConnect
                </h1>
                <p className="hidden text-xs font-medium text-gray-500 md:block">
                  Farm-to-Table Marketplace
                </p>
              </div>
            </Link>

            <div className="relative hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowDropdown(false)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive(item.href)
                      ? 'border border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-50/80 hover:text-gray-900'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <span className="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-green-500" />
                  )}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="mr-1 hidden items-center gap-1 sm:mr-2 sm:flex sm:gap-2">
                {iconLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowDropdown(false)}
                    className={cn(
                      'relative rounded-lg p-2 transition-all duration-200 hover:scale-105 sm:rounded-xl sm:p-2.5',
                      isActive(link.href)
                        ? 'bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                    aria-label={link.label}
                    title={link.label}
                  >
                    <link.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                ))}
              </div>

              {loading ? (
                <div className="hidden items-center gap-2 md:flex">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gradient-to-r from-gray-200 to-gray-300" />
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                </div>
              ) : user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown((s) => !s)}
                    className={cn(
                      'hidden items-center gap-3 rounded-xl p-2 transition-all duration-300 md:flex',
                      showDropdown
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 ring-1 ring-gray-200'
                        : 'hover:bg-gray-50/80 hover:ring-1 hover:ring-gray-200'
                    )}
                    aria-label="User menu"
                    aria-expanded={showDropdown}
                  >
                    <div
                      className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md',
                        roleGradient(user.role)
                      )}
                    >
                      {initials}
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400" />
                    </div>

                    <div className="hidden max-w-[190px] flex-col items-start lg:flex">
                      <span className="line-clamp-1 text-sm font-semibold text-gray-900">
                        {displayName}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {roleLabel(user.role)}
                      </span>
                    </div>

                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-gray-400 transition-all duration-300',
                        showDropdown && 'rotate-180 text-gray-600'
                      )}
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-2xl border border-gray-100/50 bg-white shadow-xl backdrop-blur-xl">
                      <div className={cn('h-1 bg-gradient-to-r', roleGradient(user.role))} />

                      <div
                        className={cn(
                          'border-b px-4 py-4',
                          user.role === 'buyer'
                            ? 'border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50'
                            : user.role === 'farmer'
                            ? 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50'
                            : 'border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100/50'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-lg',
                              roleGradient(user.role)
                            )}
                          >
                            {initials}
                            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-green-400" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
                            <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
                            <div className="mt-2">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold bg-gradient-to-r',
                                  roleTheme(user.role)
                                )}
                              >
                                <RoleIcon className="mr-1.5 h-3.5 w-3.5" />
                                {roleLabel(user.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="border-b border-gray-100 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                          Quick actions
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2">
                          {roleQuickLinks.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setShowDropdown(false)}
                              className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 transition hover:bg-gray-50"
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                                <item.icon className="h-4 w-4 text-gray-700" />
                              </div>
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-800">{item.label}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>

                      <div className="px-4 py-3">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Role focus
                          </p>
                          <p className="mt-1 text-sm text-gray-700">{roleMessage}</p>
                        </div>
                      </div>

                      <div className="py-2">
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 transition-all duration-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                            <UserIcon className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">My Profile</span>
                            <p className="text-xs text-gray-400">Account information</p>
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
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 transition-all duration-200 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                            <LogOut className="h-4 w-4" />
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
              )}

              {!loading && user && (
                <button
                  onClick={() => setShowDropdown((s) => !s)}
                  className={cn(
                    'rounded-lg p-2 transition-all duration-200 md:hidden',
                    showDropdown ? 'bg-gray-100 ring-1 ring-gray-200' : 'hover:bg-gray-50'
                  )}
                  aria-label="User menu"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-white font-semibold shadow-sm',
                      roleGradient(user.role)
                    )}
                  >
                    {initials}
                  </div>
                </button>
              )}

              <button
                onClick={() => {
                  setIsMobileMenuOpen((s) => !s);
                  setShowDropdown(false);
                }}
                className={cn(
                  'rounded-lg p-2 transition-all duration-200 md:hidden',
                  isMobileMenuOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {user && (
          <div
            className={cn(
              'hidden border-t md:block',
              user.role === 'buyer'
                ? 'border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50'
                : user.role === 'farmer'
                ? 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-green-50'
                : 'border-gray-100 bg-gradient-to-r from-gray-50 to-white'
            )}
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 md:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold bg-gradient-to-r',
                    roleTheme(user.role)
                  )}
                >
                  <RoleIcon className="mr-1.5 h-3.5 w-3.5" />
                  {roleLabel(user.role)} Space
                </span>
                <p className="text-sm text-gray-700">
                  Welcome back, <span className="font-semibold">{firstName}</span>. {roleMessage}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {roleQuickLinks.slice(0, 2).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-white"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {isMobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <div
            ref={mobileMenuRef}
            className={cn(
              'fixed inset-y-0 right-0 z-50 w-full max-w-xs transform bg-white shadow-2xl transition-transform duration-300 ease-in-out',
              mobileClosing ? 'translate-x-full' : 'translate-x-0'
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-md">
                  <Leaf className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AgriConnect</h2>
                  <p className="text-xs text-gray-500">Farm-to-Table Marketplace</p>
                </div>
              </div>
              <button
                onClick={closeMobile}
                className="rounded-lg p-2 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span className="text-sm text-gray-600">Loading account...</span>
                </div>
              ) : user ? (
                <div
                  className={cn(
                    'mb-6 rounded-xl border p-4 bg-gradient-to-r',
                    user.role === 'buyer'
                      ? 'border-blue-100 from-blue-50 to-cyan-50'
                      : user.role === 'farmer'
                      ? 'border-emerald-100 from-emerald-50 to-green-50'
                      : 'border-gray-100 from-gray-50 to-gray-100/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-md',
                        roleGradient(user.role)
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{user.email}</p>
                      <span
                        className={cn(
                          'mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold bg-gradient-to-r',
                          roleTheme(user.role)
                        )}
                      >
                        <RoleIcon className="mr-1.5 h-3.5 w-3.5" />
                        {roleLabel(user.role)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">You’re not signed in</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Login to post demands, list products, and manage your profile.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href="/login"
                      onClick={closeMobile}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-white"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={closeMobile}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Sign Up
                    </Link>
                  </div>
                </div>
              )}

              <nav className="mb-6 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-all duration-200',
                      isActive(item.href)
                        ? 'border border-emerald-100 bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50/50 hover:text-gray-900'
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        isActive(item.href) ? 'bg-emerald-100' : 'bg-gray-100'
                      )}
                    >
                      <item.icon
                        className={cn(
                          'h-5 w-5',
                          isActive(item.href) ? 'text-emerald-600' : 'text-gray-500'
                        )}
                      />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>

              {user && roleQuickLinks.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {roleQuickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMobile}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 transition hover:bg-gray-50"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
                          <link.icon className="h-4 w-4 text-gray-700" />
                        </div>
                        <span className="text-sm font-medium text-gray-800">{link.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Quick Links
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {iconLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobile}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-xl p-3 transition-all duration-200',
                        isActive(link.href)
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      <link.icon className="mb-2 h-5 w-5" />
                      <span className="text-xs font-medium">{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              {user && (
                <div className="space-y-2">
                  <h3 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 transition-all duration-200 hover:bg-red-50"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-sm font-medium">Sign Out</span>
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