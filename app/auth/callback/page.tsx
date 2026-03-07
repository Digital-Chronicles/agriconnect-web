'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';

type Role = 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.user) {
          router.replace('/login');
          return;
        }

        const user = session.user;
        const meta = user.user_metadata || {};

        const fullName = String(meta.full_name || '').trim();
        const nameParts = fullName.split(' ').filter(Boolean);

        const firstName =
          String(meta.first_name || '').trim() || nameParts[0] || '';
        const lastName =
          String(meta.last_name || '').trim() ||
          (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

        const role = (meta.role || 'guest') as Role;

        const { error: upsertError } = await supabase.rpc(
          'upsert_accounts_user_from_auth',
          {
            p_auth_user_id: user.id,
            p_email: user.email || '',
            p_first_name: firstName,
            p_last_name: lastName,
            p_phone_number: meta.phone_number || null,
            p_location: meta.location || null,
            p_role: role,
            p_preferred_language: meta.preferred_language || 'en',
            p_verified: true,
          }
        );

        if (upsertError) {
          console.error('Profile sync failed:', upsertError.message);
          router.replace('/login');
          return;
        }

        if (role === 'farmer') {
          router.replace('/farmer/dashboard');
          return;
        }

        if (role === 'buyer') {
          router.replace('/buyer/dashboard');
          return;
        }

        router.replace('/dashboard');
      } catch (err) {
        console.error('Auth callback error:', err);
        router.replace('/login');
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
        <h1 className="text-lg font-semibold text-slate-900">Signing you in...</h1>
        <p className="mt-2 text-sm text-slate-600">
          Please wait while we complete your login.
        </p>
      </div>
    </div>
  );
}