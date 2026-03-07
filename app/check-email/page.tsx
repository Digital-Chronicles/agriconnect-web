'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CheckEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setEmail(localStorage.getItem('pending_signup_email') || '');
    }
  }, []);

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
          We sent a 6-digit verification code to your email address.
        </p>

        {email && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <span className="font-semibold">Email:</span> {email}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="font-semibold mb-1">Important</div>
          <ul className="list-disc ml-5 space-y-1">
            <li>Check your inbox and spam/junk folder.</li>
            <li>Use the latest code if you requested more than one.</li>
            <li>Codes can expire, so verify as soon as possible.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              `/verify-email${email ? `?email=${encodeURIComponent(email)}` : ''}`
            )
          }
          className="mt-6 w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition"
        >
          Enter verification code
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="text-emerald-700 hover:text-emerald-800 font-medium">
            Go to Sign In
          </Link>
          <Link href="/signup" className="text-gray-600 hover:text-gray-800">
            Use a different email
          </Link>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';