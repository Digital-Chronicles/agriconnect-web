'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';

export default function CheckEmailPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Optional: show your site URL for clarity (can help with support)
  const origin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin;
  }, []);

  useEffect(() => {
    // If user is already logged in (email confirm OFF), redirect to dashboard
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // You can route by role later if you want. For now:
        window.location.href = '/dashboard';
      }
    };
    run();
  }, []);

  const resend = async () => {
    setErr(null);
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErr('Please enter your email address.');
      return;
    }

    setSending(true);
    try {
      // Resend signup verification email
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });

      if (error) {
        // Common helpful mapping
        const e = error.message?.toLowerCase() || '';
        if (e.includes('rate limit') || e.includes('too many')) {
          setErr('Too many requests. Please wait a moment and try again.');
        } else if (e.includes('not found')) {
          setErr('No account found with that email. Please sign up again.');
        } else {
          setErr(error.message || 'Failed to resend verification email.');
        }
        return;
      }

      setMsg('Verification email sent. Please check your inbox (and spam folder).');
    } catch (e: any) {
      setErr(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

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
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-18 8h18V8H3v8z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center">
          Check your email
        </h1>
        <p className="text-sm text-gray-600 text-center mt-2">
          We sent a verification link to your email. Open it to activate your account.
        </p>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-semibold mb-1">Important</div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Check your spam/junk folder if you don’t see it.</li>
            <li>Use the same email you signed up with.</li>
            {origin ? <li>Make sure emails from <span className="font-medium">{origin}</span> are allowed.</li> : null}
          </ul>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Didn’t receive it? Resend verification email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email (e.g. farmer@example.com)"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />

          {err && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {err}
            </div>
          )}

          {msg && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {msg}
            </div>
          )}

          <button
            type="button"
            onClick={resend}
            disabled={sending}
            className="mt-4 w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Resend verification email'}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="text-emerald-700 hover:text-emerald-800 font-medium">
            Go to Sign In
          </Link>
          <Link href="/signup" className="text-gray-600 hover:text-gray-800">
            Use a different email
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          If you verified already, just sign in and continue.
        </p>
      </div>
    </div>
  );
}
