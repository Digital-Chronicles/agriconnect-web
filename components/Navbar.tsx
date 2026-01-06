'use client';

import { useEffect, useRef, useState } from 'react';
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
  User,
  Store,
  TrendingUp,
  Home,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone_number?: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  useEffect(() => {
    let alive = true;

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!alive) return;

        if (session?.user?.email) {
          await fetchUserProfile(session.user.email);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;

      if (session?.user?.email) {
        await fetchUserProfile(session.user.email);
      } else {
        setUser(null);
        setShowDropdown(false);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (
        mobileMenuRef.current &&
        isMobileMenuOpen &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as Element)?.closest('button[aria-label*="menu"]')
      ) {
        closeMobileMenu();
      }
    };

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMobileMenuOpen) closeMobileMenu();
        if (showDropdown) setShowDropdown(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      alive = false;
      subscription.unsubscribe();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const fetchUserProfile = async (email: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('accounts_user')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;

      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: profile.role,
          phone_number: profile.phone_number,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setShowDropdown(false);
      setIsMobileMenuOpen(false);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    const first = user.first_name?.charAt(0) || '';
    const last = user.last_name?.charAt(0) || '';
    return (first + last).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      farmer: '🌱 Farmer',
      buyer: '🛒 Buyer',
      admin: '⚡ Administrator',
    };
    return roleNames[role] || role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      farmer: 'from-emerald-500 to-green-600',
      buyer: 'from-blue-500 to-cyan-600',
      admin: 'from-purple-500 to-violet-600',
    };
    return colors[role] || 'from-gray-500 to-gray-600';
  };

  const closeMobileMenu = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMobileMenuOpen(false);
      setIsClosing(false);
    }, 200);
  };

  const closeAll = () => {
    closeMobileMenu();
    setShowDropdown(false);
  };

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/products', label: 'Products', icon: Package },
    { href: '/marketplace', label: 'Marketplace', icon: Store },
    { href: '/trending', label: 'Trending', icon: TrendingUp },
    { href: '/discover', label: 'Discover', icon: Compass },
  ];

  const iconLinks = [
    { href: '/wishlist', label: 'Wishlist', icon: Heart },
    { href: '/cart', label: 'Cart', icon: ShoppingCart },
  ];

  return (
    <>
      <nav 
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/95 backdrop-blur-xl shadow-lg border-b border-gray-100/50' 
            : 'bg-white/90 backdrop-blur-lg border-b border-gray-100/30'
        }`}
      >
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2 sm:space-x-3 group"
              onClick={closeAll}
            >
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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowDropdown(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {isActive(item.href) && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full" />
                  )}
                </Link>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Icon actions */}
              <div className="flex items-center gap-1 sm:gap-2 mr-1 sm:mr-2">
                {iconLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setShowDropdown(false)}
                    className={`relative p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 ${
                      isActive(link.href)
                        ? 'bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    aria-label={link.label}
                    title={link.label}
                  >
                    <link.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    {link.href === '/cart' && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-sm">
                        3
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              {/* User/Auth - Desktop */}
              {loading ? (
                <div className="hidden md:block w-10 h-10 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse" />
              ) : user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown((s) => !s)}
                    className={`hidden md:flex items-center gap-3 p-2 rounded-xl transition-all duration-300 ${
                      showDropdown 
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 ring-1 ring-gray-200' 
                        : 'hover:bg-gray-50/80 hover:ring-1 hover:ring-gray-200'
                    }`}
                    aria-label="User menu"
                    aria-expanded={showDropdown}
                  >
                    <div className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br ${getRoleColor(user.role)} flex items-center justify-center text-white font-medium shadow-md`}>
                      {getUserInitials()}
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-400 border-2 border-white rounded-full" />
                    </div>
                    <div className="hidden lg:flex flex-col items-start">
                      <span className="text-sm font-semibold text-gray-900 line-clamp-1">
                        {user.first_name || 'User'}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{getRoleDisplayName(user.role)}</span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-all duration-300 ${
                        showDropdown ? 'rotate-180 text-gray-600' : ''
                      }`}
                    />
                  </button>

                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100/50 py-2 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200 z-50 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-400" />
                      
                      <div className="px-4 py-4 border-b border-gray-100/50">
                        <div className="flex items-center gap-3">
                          <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${getRoleColor(user.role)} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                            {getUserInitials()}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-400 border-2 border-white rounded-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                            <div className="mt-2">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800">
                                {getRoleDisplayName(user.role)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="py-2">
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200 group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">My Profile</span>
                            <p className="text-xs text-gray-400">Account settings</p>
                          </div>
                        </Link>

                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 transition-all duration-200 group"
                          onClick={() => setShowDropdown(false)}
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                            <Settings className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Dashboard</span>
                            <p className="text-xs text-gray-400">Manage your account</p>
                          </div>
                        </Link>

                        <div className="border-t border-gray-100 my-2" />

                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 transition-all duration-200 group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                            <LogOut className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">Sign Out</span>
                            <p className="text-xs text-red-400">Logout from your account</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/login"
                    className="px-4 py-2 sm:px-5 sm:py-2.5 text-gray-600 hover:text-gray-900 font-medium text-sm transition-all duration-300 hover:bg-gray-50 rounded-lg sm:rounded-xl border border-gray-200 hover:border-gray-300"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="relative px-4 py-2 sm:px-6 sm:py-2.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white rounded-lg sm:rounded-xl font-semibold text-sm shadow-md sm:shadow-lg hover:shadow-xl hover:shadow-emerald-200 transition-all duration-300 hover:scale-[1.02] active:scale-95 group overflow-hidden"
                  >
                    <span className="relative z-10">Get Started</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                </div>
              )}

              {/* Mobile User/Auth Button */}
              {user && (
                <button
                  onClick={() => setShowDropdown((s) => !s)}
                  className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
                    showDropdown 
                      ? 'bg-gradient-to-r from-gray-50 to-gray-100 ring-1 ring-gray-200' 
                      : 'hover:bg-gray-50/80'
                  }`}
                  aria-label="User menu"
                  aria-expanded={showDropdown}
                >
                  <div className={`relative w-7 h-7 rounded-full bg-gradient-to-br ${getRoleColor(user.role)} flex items-center justify-center text-white font-medium shadow-sm`}>
                    {getUserInitials()}
                  </div>
                </button>
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => {
                  setIsMobileMenuOpen((s) => !s);
                  setShowDropdown(false);
                }}
                className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
                  isMobileMenuOpen 
                    ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          <div 
            ref={mobileMenuRef}
            className={`fixed inset-y-0 right-0 z-50 w-full max-w-xs bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${
              isClosing ? 'translate-x-full' : 'translate-x-0'
            }`}
          >
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                  <Leaf className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AgriConnect</h2>
                  <p className="text-xs text-gray-500">Farm-to-Table Marketplace</p>
                </div>
              </div>
              <button
                onClick={closeMobileMenu}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Mobile Menu Content */}
            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
              {/* User Info */}
              {user && (
                <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br ${getRoleColor(user.role)} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                      {getUserInitials()}
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800">
                          {getRoleDisplayName(user.role)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="space-y-1 mb-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-emerald-700 font-semibold border border-emerald-100'
                        : 'text-gray-600 hover:bg-gray-50/50 hover:text-gray-900'
                    }`}
                    onClick={closeMobileMenu}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive(item.href) ? 'bg-emerald-100' : 'bg-gray-100'
                    }`}>
                      <item.icon className={`w-5 h-5 ${isActive(item.href) ? 'text-emerald-600' : 'text-gray-500'}`} />
                    </div>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>

              {/* Quick Actions */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {iconLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 ${
                        isActive(link.href)
                          ? 'bg-gradient-to-br from-emerald-50 to-green-50 text-emerald-600'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <link.icon className="w-5 h-5 mb-2" />
                      <span className="text-xs font-medium">{link.label}</span>
                      {link.href === '/cart' && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-sm">
                          3
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              {/* User Actions */}
              {user ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Account</h3>
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 px-3 py-3 text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl transition-all duration-200"
                    onClick={closeMobileMenu}
                  >
                    <User className="w-5 h-5" />
                    <span className="text-sm font-medium">Profile</span>
                  </Link>
                  
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-3 py-3 text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl transition-all duration-200"
                    onClick={closeMobileMenu}
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-sm font-medium">Dashboard</span>
                  </Link>
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-3 py-3 text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 rounded-xl transition-all duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-medium">Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-6">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-1">Join Us</h3>
                  <Link
                    href="/login"
                    className="block w-full text-center px-4 py-3.5 text-gray-600 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 rounded-xl font-semibold border border-gray-200 hover:border-gray-300 transition-all duration-200"
                    onClick={closeMobileMenu}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="block w-full text-center px-4 py-3.5 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:shadow-emerald-200 transition-all duration-200"
                    onClick={closeMobileMenu}
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dropdown overlay */}
      {showDropdown && !isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm animate-in fade-in duration-200 md:hidden" 
          onClick={() => setShowDropdown(false)} 
          aria-hidden="true" 
        />
      )}
    </>
  );
}