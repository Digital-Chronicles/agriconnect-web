'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function AboutCta() {
  const [loading, setLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setIsSignedIn(!!data.session);
      setLoading(false);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;
  if (isSignedIn) return null;

  return (
    <section className="py-12 sm:py-14 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <h3 className="text-2xl font-extrabold">Ready to use AgriConnect?</h3>
            <p className="text-white/90 mt-2">
              Create an account and start listing produce or browsing the market.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-white text-emerald-700 px-6 py-3 font-semibold hover:bg-white/90 transition"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 font-semibold hover:bg-white/15 transition"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
