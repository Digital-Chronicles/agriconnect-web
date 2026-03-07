'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        setError(error.message || 'Failed to continue with Google.');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-xl rounded-3xl border border-slate-200 p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V3m0 3a9 9 0 100 18 9 9 0 000-18zm0 0a9 9 0 019 9h-3m-6 6v3m0-3a3 3 0 003-3m-3 3a3 3 0 01-3-3m0 0H6"
                />
              </svg>
            </div>

            <h1 className="mt-5 text-3xl font-bold text-slate-900">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Sign in to AgriConnect with your Google account.
            </p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.7 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 9.2-4.8 9.2-7.3 0-.5 0-.9-.1-1.3H12z"
                />
                <path
                  fill="#34A853"
                  d="M3.6 7.4l3.2 2.3C7.7 7.8 9.7 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.7 2.5 12 2.5c-3.6 0-6.8 2-8.4 4.9z"
                />
                <path
                  fill="#4A90E2"
                  d="M12 21.5c2.6 0 4.7-.8 6.3-2.2l-2.9-2.4c-.8.6-1.9 1.1-3.4 1.1-3.9 0-5.2-2.6-5.5-3.9l-3.2 2.5c1.6 3 4.8 4.9 8.7 4.9z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.5 14.1c-.1-.4-.2-.8-.2-2.1s.1-1.7.2-2.1L3.3 7.4C2.8 8.5 2.5 9.7 2.5 12s.3 3.5.8 4.6l3.2-2.5z"
                />
              </svg>

              {loading ? 'Redirecting...' : 'Continue with Google'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Sign in notes
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
              <li>Use the same Google account you registered with</li>
              <li>Google provider must be enabled in Supabase</li>
              <li>The callback route must be set to <span className="font-medium">/auth/callback</span></li>
            </ul>
          </div>

          <p className="mt-8 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Secure login powered by Google and Supabase.
        </p>
      </div>
    </div>
  );
}