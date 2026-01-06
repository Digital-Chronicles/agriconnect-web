// app/login/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';

type Errors = {
  email?: string;
  password?: string;
  submit?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountUserRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

function getRedirectForRole(role?: string | null) {
  const r = (role || '').toLowerCase();

  // ✅ Match your new nav flow
  if (r === 'buyer') return '/products';
  if (r === 'farmer') return '/products';
  if (r === 'admin') return '/products';

  return '/products';
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !isLoading;
  }, [email, password, isLoading]);

  const validate = (): boolean => {
    const next: Errors = {};
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) next.email = 'Email is required';
    else if (!emailRegex.test(normalizedEmail)) next.email = 'Please enter a valid email address';

    if (!password) next.password = 'Password is required';
    else if (password.length < 6) next.password = 'Password must be at least 6 characters';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const friendlyAuthError = (msg: string): string => {
    const m = msg.toLowerCase();

    if (m.includes('invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (m.includes('email not confirmed')) {
      return 'Please confirm your email address before logging in. Check your inbox for the confirmation email.';
    }
    if (m.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (m.includes('rate limit') || m.includes('too many')) {
      return 'Too many attempts. Please wait a few minutes before trying again.';
    }
    return 'Login failed. Please try again.';
  };

  const fetchUserRoleByEmail = async (normalizedEmail: string) => {
    // If accounts_user row doesn't exist, we still allow login,
    // but we redirect to /products by default.
    const { data, error } = await supabase
      .from('accounts_user')
      .select('id,email,first_name,last_name,role')
      .eq('email', normalizedEmail)
      .maybeSingle<AccountUserRow>();

    if (error) throw error;
    return data?.role ?? null;
  };

  // ✅ If already logged in, redirect based on role (not /dashboard)
  useEffect(() => {
    let alive = true;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error) return;

        const session = data?.session;
        const sessionEmail = session?.user?.email?.trim().toLowerCase();
        if (!session || !sessionEmail) return;

        let role: string | null = null;
        try {
          role = await fetchUserRoleByEmail(sessionEmail);
        } catch {
          // ignore and fall back
        }

        router.replace(getRedirectForRole(role));
        router.refresh();
      } catch {
        // ignore
      }
    };

    checkSession();

    return () => {
      alive = false;
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors((prev) => ({ ...prev, submit: undefined }));

    if (!validate()) return;

    setIsLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const message = friendlyAuthError(error.message);

        if (error.message.toLowerCase().includes('invalid login credentials')) {
          setErrors({
            email: 'Check your email',
            password: 'Check your password',
            submit: message,
          });
        } else {
          setErrors({ submit: message });
        }
        return;
      }

      // Confirm session exists
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.user?.email) {
        setErrors({ submit: 'Signed in, but session was not created. Please retry.' });
        return;
      }

      const sessionEmail = data.session.user.email.trim().toLowerCase();

      // Fetch role and redirect
      let role: string | null = null;
      try {
        role = await fetchUserRoleByEmail(sessionEmail);
      } catch {
        role = null;
      }

      setEmail('');
      setPassword('');

      router.replace(getRedirectForRole(role));
      router.refresh();
    } catch {
      setErrors({
        submit: 'Something went wrong. Please try again or contact support if the problem continues.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onChangeEmail = (v: string) => {
    setEmail(v);
    if (errors.email || errors.submit) setErrors((prev) => ({ ...prev, email: undefined, submit: undefined }));
  };

  const onChangePassword = (v: string) => {
    setPassword(v);
    if (errors.password || errors.submit) setErrors((prev) => ({ ...prev, password: undefined, submit: undefined }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-6">
            <div className="text-white text-3xl" aria-hidden>
              🌾
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">AgriConnect</h1>
          <p className="text-gray-600 text-lg">Sign in to your account</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => onChangeEmail(e.target.value)}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-4 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                    errors.email ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
              </div>
              {errors.email && (
                <div id="email-error" className="mt-2 flex items-center text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                  {errors.email}
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                {/* Keep this link only if you actually have the route */}
                <Link
                  href="/forgot-password"
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => onChangePassword(e.target.value)}
                  disabled={isLoading}
                  className={`w-full pl-12 pr-12 py-3 text-base border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                    errors.password ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {errors.password && (
                <div id="password-error" className="mt-2 flex items-center text-sm text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                  {errors.password}
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4" role="alert">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <strong className="font-semibold">Login failed</strong>
                    <p className="mt-1">{errors.submit}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3.5 px-4 rounded-xl font-semibold text-base shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-500">Don&apos;t have an account?</span>
              </div>
            </div>
          </div>

          {/* Signup Link */}
          <div className="text-center">
            <Link
              href="/signup"
              className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-medium text-base transition-colors group"
            >
              Create a new account
              <svg
                className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-start">
            <CheckCircle className="w-5 h-5 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-800">
              <strong className="font-semibold">Having trouble?</strong>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Ensure your email is confirmed</li>
                <li>Check your internet connection</li>
                <li>Try resetting your password if needed</li>
                <li>Contact support if issues persist</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">© 2024 AgriConnect. Empowering farmers across Uganda.</p>
        </div>
      </div>
    </div>
  );
}
