'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type FarmerProfile = {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string | null;
  location?: string | null;
  role?: string;
  verified?: boolean;
};

type QuickStat = {
  label: string;
  value: string;
  note: string;
};

export default function FarmerDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [userName, setUserName] = useState('Farmer');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          router.replace('/login');
          return;
        }

        const user = session.user;
        const meta = user.user_metadata || {};
        const role = String(meta.role || '').toLowerCase();

        if (role && role !== 'farmer') {
          router.replace('/dashboard');
          return;
        }

        const fallbackName =
          String(meta.full_name || '').trim() ||
          `${String(meta.first_name || '').trim()} ${String(meta.last_name || '').trim()}`.trim() ||
          'Farmer';

        setUserName(fallbackName);

        const { data: profileData, error: profileError } = await supabase
          .from('accounts_user')
          .select('id, email, first_name, last_name, phone_number, location, role, verified')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (profileError) {
          setError(profileError.message || 'Failed to load your profile.');
        }

        if (profileData) {
          setProfile(profileData);

          const dbName =
            `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim() ||
            fallbackName;

          setUserName(dbName);
        } else {
          setProfile({
            email: user.email || '',
            first_name: String(meta.first_name || ''),
            last_name: String(meta.last_name || ''),
            phone_number: meta.phone_number || null,
            location: meta.location || null,
            role: meta.role || 'farmer',
            verified: true,
          });
        }
      } catch (err: any) {
        setError(err?.message || 'Something went wrong while loading the dashboard.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [router]);

  const quickStats: QuickStat[] = useMemo(
    () => [
      {
        label: 'Produce Listings',
        value: '0',
        note: 'Add your first produce listing',
      },
      {
        label: 'Buyer Requests',
        value: '0',
        note: 'No buyer requests yet',
      },
      {
        label: 'Orders',
        value: '0',
        note: 'Your confirmed orders will appear here',
      },
      {
        label: 'Messages',
        value: '0',
        note: 'Stay connected with buyers',
      },
    ],
    []
  );

  const initials = useMemo(() => {
    const parts = userName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'F';
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || 'F';
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }, [userName]);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch {
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900">Loading dashboard...</h1>
          <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium text-emerald-700">AgriConnect</p>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Farmer Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Home
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-green-700 p-6 text-white shadow-sm lg:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-100">Welcome back</p>
                <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{userName}</h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-50 sm:text-base">
                  Manage your produce listings, connect with buyers, and track your
                  farming activity from one place.
                </p>
              </div>

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold backdrop-blur-sm">
                {initials}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                View Produce Market
              </Link>
              <Link
                href="/farmer/products"
                className="inline-flex rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
              >
                My Produce
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">My Profile</h3>

            <div className="mt-5 space-y-4 text-sm">
              <div>
                <p className="text-slate-500">Email</p>
                <p className="mt-1 font-medium text-slate-900">
                  {profile?.email || 'Not available'}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Phone Number</p>
                <p className="mt-1 font-medium text-slate-900">
                  {profile?.phone_number || 'Not added'}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Location</p>
                <p className="mt-1 font-medium text-slate-900">
                  {profile?.location || 'Not added'}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Role</p>
                <p className="mt-1 font-medium capitalize text-slate-900">
                  {profile?.role || 'farmer'}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Verification</p>
                <div className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      profile?.verified
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {profile?.verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </section>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <h3 className="mt-3 text-3xl font-bold text-slate-900">{stat.value}</h3>
              <p className="mt-2 text-sm text-slate-600">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
            <div className="mt-5 grid gap-3">
              <Link
                href="/farmer/products"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Manage my produce
              </Link>
              <Link
                href="/buyer/demands"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View buyer demands
              </Link>
              <Link
                href="/messages"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open messages
              </Link>
              <Link
                href="/profile"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Update my profile
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Getting Started</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">1. Complete profile</p>
                <p className="mt-2 text-sm text-slate-600">
                  Add your phone number, farm location, and produce details so buyers
                  can trust your listings.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">2. Add produce</p>
                <p className="mt-2 text-sm text-slate-600">
                  Start by posting your available crops, quantity, price, and quality.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">3. Review demands</p>
                <p className="mt-2 text-sm text-slate-600">
                  Check what buyers are looking for and match your produce to demand.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">4. Respond quickly</p>
                <p className="mt-2 text-sm text-slate-600">
                  Reply to buyer interest quickly to improve your chances of closing deals.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}