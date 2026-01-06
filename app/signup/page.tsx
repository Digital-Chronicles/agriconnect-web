// app/signup/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'farmer' | 'buyer' | 'guest';
type Lang = 'en' | 'sw';

export default function SignUpPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    location: '',
    preferred_language: 'en' as Lang,
    role: 'guest' as Role,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Keep these aligned with your DB checks (en/sw) and roles (farmer/buyer/guest)
  const languages: { value: Lang; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'sw', label: 'Swahili' },
  ];

  const roles: { value: Role; label: string }[] = [
    { value: 'farmer', label: 'Farmer' },
    { value: 'buyer', label: 'Buyer' },
    { value: 'guest', label: 'Guest' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    // Handle radio inputs as normal
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'radio' ? value : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: '' }));
    }
    if (successMsg) setSuccessMsg('');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.password2) {
      newErrors.password2 = 'Please confirm your password';
    } else if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }

    if (formData.phone_number && !/^\+?\d{9,15}$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const redirectAfterSignup = (role: Role) => {
    if (role === 'farmer') router.push('/farmer/dashboard');
    else if (role === 'buyer') router.push('/buyer/dashboard');
    else router.push('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, submit: '' }));
    setSuccessMsg('');

    try {
      // ✅ Step 1: Supabase Auth signup
      // ✅ Step 2: DB trigger auto-creates public.accounts_user (NO client upsert)
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            first_name: formData.first_name.trim(),
            last_name: formData.last_name.trim(),
            phone_number: formData.phone_number.trim() || null,
            location: formData.location.trim() || null,
            preferred_language: formData.preferred_language,
            role: formData.role,
          },
        },
      });

      if (error) {
        const msg =
          error.message?.toLowerCase().includes('already') ||
          error.message?.toLowerCase().includes('registered')
            ? 'An account with this email already exists.'
            : error.message || 'Registration failed. Please try again.';
        setErrors({ submit: msg });
        return;
      }

      // If email confirmation is enabled, session will often be null after signup
      const needsEmailVerify = !data.session;

      if (needsEmailVerify) {
        setSuccessMsg('Account created! Please check your email to verify your account.');
        router.push('/check-email');
        return;
      }

      setSuccessMsg('Account created successfully! Redirecting…');
      redirectAfterSignup(formData.role);
    } catch (err: any) {
      setErrors({ submit: err?.message || 'Registration failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex justify-center items-center mb-3 sm:mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
            AgriConnect
          </h1>
          <p className="text-gray-500 text-sm sm:text-base lg:text-lg">
            Join Our Farming Community
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-6 sm:mb-8">
            Create Your Account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                  First Name *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  maxLength={150}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    errors.first_name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="John"
                />
                {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name *
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  maxLength={150}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    errors.last_name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Doe"
                />
                {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>}
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                      errors.email ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="farmer@example.com"
                  />
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    errors.phone_number ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="+256712345678"
                />
                {errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a *</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {roles.map((r) => (
                  <div key={r.value} className="relative">
                    <input
                      type="radio"
                      id={`role-${r.value}`}
                      name="role"
                      value={r.value}
                      checked={formData.role === r.value}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <label
                      htmlFor={`role-${r.value}`}
                      className={`w-full flex items-center justify-center px-4 py-3 border rounded-lg sm:rounded-xl cursor-pointer transition-all duration-200 ${
                        formData.role === r.value
                          ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-500 ring-opacity-20'
                          : 'border-gray-200 text-gray-700 hover:border-green-300 hover:bg-green-50'
                      }`}
                    >
                      <span className="font-medium">{r.label}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location (Optional)
              </label>
              <input
                id="location"
                name="location"
                type="text"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200"
                placeholder="Your farm or business location"
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    errors.password ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Create a password"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  id="password2"
                  name="password2"
                  type="password"
                  value={formData.password2}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    errors.password2 ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Confirm your password"
                />
                {errors.password2 && <p className="mt-1 text-sm text-red-600">{errors.password2}</p>}
              </div>
            </div>

            {/* Language */}
            <div>
              <label
                htmlFor="preferred_language"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Preferred Language
              </label>
              <select
                id="preferred_language"
                name="preferred_language"
                value={formData.preferred_language}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 transition-all duration-200"
              >
                {languages.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Terms */}
            <div className="space-y-4">
              <div className="flex items-start">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-1 flex-shrink-0"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-600">
                  I agree to the{' '}
                  <a href="/terms" className="text-green-600 hover:text-green-500 font-medium">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" className="text-green-600 hover:text-green-500 font-medium">
                    Privacy Policy
                  </a>
                </label>
              </div>

              {/* Success */}
              {successMsg && (
                <div className="rounded-lg sm:rounded-xl bg-green-50 border border-green-200 p-3 sm:p-4">
                  <p className="text-sm text-green-800">{successMsg}</p>
                </div>
              )}

              {/* Submit Error */}
              {errors.submit && (
                <div className="rounded-lg sm:rounded-xl bg-red-50 border border-red-200 p-3 sm:p-4">
                  <span className="text-sm text-red-700">{errors.submit}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 sm:py-3.5 px-4 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base shadow-sm hover:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-green-600 hover:text-green-700 font-medium transition-colors">
                Sign in here
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-xs sm:text-sm text-gray-500">
            © 2026 AgriConnect. Connecting farmers across Uganda.
          </p>
        </div>
      </div>
    </div>
  );
}
