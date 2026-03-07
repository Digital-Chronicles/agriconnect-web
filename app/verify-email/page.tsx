'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type Role = 'farmer' | 'buyer' | 'guest';

export default function VerifyEmailPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pendingMeta = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const raw = localStorage.getItem('pending_signup_meta');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as {
        first_name?: string;
        last_name?: string;
        phone_number?: string | null;
        location?: string | null;
        preferred_language?: 'en' | 'sw';
        role?: Role;
      };
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('email') || '';
    const fromStorage = localStorage.getItem('pending_signup_email') || '';

    setEmail((fromUrl || fromStorage || '').toLowerCase());
  }, []);

  const redirectByRole = (role: Role) => {
    if (role === 'farmer') return '/farmer/dashboard';
    if (role === 'buyer') return '/buyer/dashboard';
    return '/dashboard';
  };

  const verifyCode = async () => {
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanEmail) {
      setErr('Email is required.');
      return;
    }

    if (!/^\d{6}$/.test(cleanCode)) {
      setErr('Enter the 6-digit verification code.');
      return;
    }

    setVerifying(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        setErr(error.message || 'Invalid or expired verification code.');
        return;
      }

      const sessionUser = data.user ?? data.session?.user;

      if (!sessionUser) {
        setErr('Verification succeeded, but no user session was returned.');
        return;
      }

      const metadata = pendingMeta ?? {};
      const role = (metadata.role || 'guest') as Role;

      const { error: profileError } = await supabase.rpc(
        'upsert_accounts_user_from_auth',
        {
          p_auth_user_id: sessionUser.id,
          p_email: sessionUser.email ?? cleanEmail,
          p_first_name: metadata.first_name ?? '',
          p_last_name: metadata.last_name ?? '',
          p_phone_number: metadata.phone_number ?? null,
          p_location: metadata.location ?? null,
          p_role: role,
          p_preferred_language: metadata.preferred_language ?? 'en',
          p_verified: true,
        }
      );

      if (profileError) {
        setErr(profileError.message || 'Email verified, but profile sync failed.');
        return;
      }

      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_signup_email');
        localStorage.removeItem('pending_signup_meta');
      }

      router.replace(redirectByRole(role));
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong while verifying your code.');
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErr('Enter your email first.');
      return;
    }

    setResending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          data: {
            first_name: pendingMeta?.first_name ?? '',
            last_name: pendingMeta?.last_name ?? '',
            phone_number: pendingMeta?.phone_number ?? null,
            location: pendingMeta?.location ?? null,
            preferred_language: pendingMeta?.preferred_language ?? 'en',
            role: pendingMeta?.role ?? 'guest',
          },
        },
      });

      if (error) {
        setErr(error.message || 'Failed to resend code.');
        return;
      }

      setMsg('A new verification code has been sent to your email.');
    } catch (e: any) {
      setErr(e?.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/30 shadow-md rounded-2xl p-6 sm:p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <h1 className="text-lg font-semibold text-slate-900">Loading verification...</h1>
          <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/30 shadow-md rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 11c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm9 0c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 19l1.125-3.375A7.958 7.958 0 013 11c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
          Verify your email
        </h1>
        <p className="text-sm text-gray-600 text-center mt-2">
          Enter the 6-digit code sent to your email address.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-center tracking-[0.35em] text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {msg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {msg}
            </div>
          )}

          <button
            type="button"
            onClick={verifyCode}
            disabled={verifying}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify code'}
          </button>

          <button
            type="button"
            onClick={resendCode}
            disabled={resending}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="text-emerald-700 hover:text-emerald-800 font-medium">
            Go to Sign In
          </Link>
          <Link href="/signup" className="text-gray-600 hover:text-gray-800">
            Back to Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';