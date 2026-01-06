// app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import supabase from '@/lib/supabaseClient';
import { Search, MapPin, Loader2, X, Filter, SlidersHorizontal } from 'lucide-react';

type Quality = 'top' | 'standard' | 'fair';

type Product = {
  id: string;
  crop_name: string;
  variety: string | null;
  quality: Quality;
  price_per_unit: number;
  quantity: number;
  unit: string;
  farmer_name: string;
  farmer_location: string;
  distance_km: number | null;
  listed_at: string | null;
  is_available: boolean;
  photo: string | null;
};

function formatUGX(value: number) {
  return `UGX ${Number(value || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

function qualityLabel(q: Quality) {
  if (q === 'top') return 'Premium';
  if (q === 'standard') return 'Standard';
  return 'Fair';
}

function qualityPillClass(q: Quality) {
  if (q === 'top') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (q === 'standard') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function safeNumber(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [quality, setQuality] = useState<'all' | Quality>('all');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sort, setSort] = useState<'distance' | 'price_low' | 'price_high' | 'newest'>('distance');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch products
  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from('farm_produce')
          .select(
            'id, crop_name, variety, quality, price_per_unit, quantity, unit, farmer_name, farmer_location, distance_km, listed_at, is_available, photo'
          )
          .eq('is_available', true)
          .order('listed_at', { ascending: false })
          .limit(300);

        if (error) throw error;
        if (!alive) return;

        const mapped = (data || []).map((r: any) => ({
          ...r,
          price_per_unit: safeNumber(r.price_per_unit, 0),
          quantity: safeNumber(r.quantity, 0),
          distance_km: r.distance_km === null ? null : safeNumber(r.distance_km, null as any),
        })) as Product[];

        setProducts(mapped);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'Failed to load products.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('farm_produce_home_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_produce' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          if (!oldId) return;
          setProducts((prev) => prev.filter((p) => p.id !== oldId));
          return;
        }

        const row = payload.new as any;
        if (!row?.id) return;

        const normalized: Product = {
          id: String(row.id),
          crop_name: row.crop_name ?? 'Produce',
          variety: row.variety ?? null,
          quality: (row.quality ?? 'standard') as Quality,
          price_per_unit: safeNumber(row.price_per_unit, 0),
          quantity: safeNumber(row.quantity, 0),
          unit: row.unit ?? 'kg',
          farmer_name: row.farmer_name ?? 'Unknown Farmer',
          farmer_location: row.farmer_location ?? 'Uganda',
          distance_km: row.distance_km === null ? null : safeNumber(row.distance_km, null as any),
          listed_at: row.listed_at ?? null,
          is_available: Boolean(row.is_available),
          photo: row.photo ?? null,
        };

        setProducts((prev) => {
          if (!normalized.is_available) return prev.filter((p) => p.id !== normalized.id);

          const exists = prev.find((p) => p.id === normalized.id);
          if (!exists) return [normalized, ...prev];

          return prev.map((p) => (p.id === normalized.id ? { ...p, ...normalized } : p));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    let rows = [...products];

    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) => {
        const hay = `${p.crop_name} ${p.variety || ''} ${p.farmer_location} ${p.farmer_name}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (quality !== 'all') rows = rows.filter((p) => p.quality === quality);

    if (maxPrice !== '') {
      const mp = safeNumber(maxPrice, 0);
      rows = rows.filter((p) => safeNumber(p.price_per_unit, 0) <= mp);
    }

    rows.sort((a, b) => {
      if (sort === 'price_low') return safeNumber(a.price_per_unit) - safeNumber(b.price_per_unit);
      if (sort === 'price_high') return safeNumber(b.price_per_unit) - safeNumber(a.price_per_unit);
      if (sort === 'newest') {
        const da = a.listed_at ? new Date(a.listed_at).getTime() : 0;
        const db = b.listed_at ? new Date(b.listed_at).getTime() : 0;
        return db - da;
      }

      const da = a.distance_km === null ? Number.POSITIVE_INFINITY : safeNumber(a.distance_km);
      const db = b.distance_km === null ? Number.POSITIVE_INFINITY : safeNumber(b.distance_km);
      return da - db;
    });

    return rows;
  }, [products, query, quality, maxPrice, sort]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
        {/* Hero */}
        <section className="bg-white/80 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/40 shadow-sm sm:shadow-md p-4 sm:p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                Marketplace — Order directly from farmers
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
                Browse live listings, compare price and distance, and contact sellers.
              </p>

              <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-2 rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold border border-gray-200 text-gray-800 bg-white hover:bg-gray-50 transition"
                >
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Discover on map
                </Link>

                <Link
                  href="/trending"
                  className="inline-flex items-center gap-2 rounded-lg sm:rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold border border-gray-200 text-gray-800 bg-white hover:bg-gray-50 transition"
                >
                  🔥 Trending
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* Mobile filter toggle */}
        <div className="md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-center gap-2 bg-white rounded-xl border border-gray-200 p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {showFilters ? 'Hide filters' : 'Show filters'}
            <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </button>
        </div>

        {/* Filters */}
        <section className={`${showFilters ? 'block' : 'hidden md:block'} md:sticky md:top-[64px] z-30 bg-white/80 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/40 shadow-sm sm:shadow-md p-3 sm:p-4 md:p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3">
            {/* Search - full width on mobile, spans 5 on desktop */}
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Coffee, maize, farmer name, location…"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Quality - full width on mobile, spans 3 on desktop */}
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">All</option>
                <option value="top">Top</option>
                <option value="standard">Standard</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            {/* Max price - full width on mobile, spans 2 on desktop */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Max price (UGX/kg)</label>
              <input
                value={maxPrice}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') return setMaxPrice('');
                  const n = Number(v);
                  if (!Number.isNaN(n)) setMaxPrice(n);
                }}
                inputMode="numeric"
                className="w-full px-3 py-2 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="e.g. 5000"
              />
            </div>

            {/* Sort - full width on mobile, spans 2 on desktop */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Sort</label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg sm:rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="distance">Nearest</option>
                <option value="price_low">Cheapest</option>
                <option value="price_high">Most expensive</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          <div className="mt-2 sm:mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>{filtered.length.toLocaleString('en-UG')} listings</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setQuality('all');
                  setMaxPrice('');
                  setSort('distance');
                }}
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                Reset filters
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="md:hidden font-medium text-gray-600 hover:text-gray-800"
              >
                Hide
              </button>
            </div>
          </div>
        </section>

        {/* Errors */}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 shadow-sm">
            {err}
          </div>
        )}

        {/* Product grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {loading && (
            <div className="col-span-full flex items-center justify-center py-8 sm:py-10 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm sm:text-base">Loading products…</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full bg-white/80 border border-white/40 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center text-gray-600">
              <p className="text-sm sm:text-base">No products found. Try changing filters.</p>
            </div>
          )}

          {!loading &&
            filtered.map((p) => {
              const available = safeNumber(p.quantity, 0);
              const price = safeNumber(p.price_per_unit, 0);

              return (
                <div
                  key={String(p.id)}
                  className="bg-white/80 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/40 shadow-sm sm:shadow-md overflow-hidden hover:shadow-md sm:hover:shadow-lg transition"
                >
                  <div className="h-32 sm:h-40 bg-gradient-to-br from-emerald-50 to-green-50 border-b border-white/40">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={p.photo} 
                        alt={p.crop_name} 
                        className="h-32 sm:h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-32 sm:h-40 w-full flex items-center justify-center text-3xl sm:text-4xl">🌾</div>
                    )}
                  </div>

                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {p.crop_name}
                          {p.variety ? <span className="text-gray-500"> • {p.variety}</span> : null}
                        </h3>

                        <div className="mt-1 flex items-center gap-1.5 sm:gap-2 text-xs text-gray-600">
                          <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                          <span className="truncate text-xs">{p.farmer_location}</span>
                          {p.distance_km !== null ? (
                            <span className="text-gray-400 whitespace-nowrap">• {safeNumber(p.distance_km)} km</span>
                          ) : null}
                        </div>
                      </div>

                      <span
                        className={`shrink-0 inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-medium ${qualityPillClass(
                          p.quality
                        )}`}
                      >
                        {qualityLabel(p.quality)}
                      </span>
                    </div>

                    <div className="mt-2 sm:mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Price</p>
                        <p className="text-base sm:text-lg font-semibold text-gray-900">{formatUGX(price)} / kg</p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">Available</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {available.toLocaleString('en-UG')} {p.unit || 'kg'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-4 flex items-center justify-between gap-2">
                      <Link
                        href={`/products/${p.id}`}
                        className="flex-1 inline-flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold border border-gray-200 text-gray-800 hover:bg-gray-50 transition"
                      >
                        View details
                      </Link>
                    </div>

                    <p className="mt-2 sm:mt-3 text-[10px] sm:text-[11px] text-gray-500">
                      Seller: <span className="font-medium text-gray-700">{p.farmer_name}</span>
                    </p>
                  </div>
                </div>
              );
            })}
        </section>

        <footer className="py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
          © {new Date().getFullYear()} AgriConnect. Connecting farmers across Uganda.
        </footer>
      </main>
    </div>
  );
}