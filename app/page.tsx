// app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import supabase from '@/lib/supabaseClient';
import {
  Search,
  MapPin,
  Loader2,
  X,
  SlidersHorizontal,
  Star,
  Calendar,
  User,
  Filter,
  Tag,
} from 'lucide-react';

type Quality = 'top' | 'standard' | 'fair';
type Unit = 'kg' | 'bag' | 'bunch' | 'piece';

type Category = {
  id: number; // bigint in DB, normalize to number
  name: string;
  description: string | null;
  is_active: boolean;
};

type Product = {
  id: string; // uuid
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  variety: string | null;
  quality: Quality;
  quantity: number;
  unit: Unit;
  price_per_unit: number;
  distance_km: number | null;
  location_lat: number | null;
  location_lng: number | null;
  google_maps_link: string | null;
  available_from: string; // date (NOT NULL)
  is_available: boolean;
  listed_at: string; // timestamptz (NOT NULL)
  farmer_phone: string | null;
  photo: string | null;
  description: string | null;
  crop_category: string | null;
  farmer_profile_id: string | null;
  updated_at: string; // timestamptz (NOT NULL)
  total_price: number | null; // generated stored, can appear null in some clients
  category_id: number | null;
  category: Category | null;
};

function safeNumber(v: any, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeInt(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function formatUGX(value: number) {
  return `UGX ${Number(value || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
}

function qualityLabel(q: Quality) {
  if (q === 'top') return 'Premium';
  if (q === 'standard') return 'Standard';
  return 'Fair';
}

function qualityPillClass(q: Quality) {
  if (q === 'top') return 'bg-gradient-to-r from-emerald-500 to-green-500 text-white';
  if (q === 'standard') return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white';
  return 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
}

function unitLabel(unit: Unit) {
  const labels: Record<Unit, string> = { kg: 'kg', bag: 'bag', bunch: 'bunch', piece: 'piece' };
  return labels[unit];
}

function formatRelative(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
}

function normalizeProductRow(r: any): Product {
  const categoryRow = r.category ?? null;

  const normalizedCategory: Category | null = categoryRow
    ? {
        id: safeInt(categoryRow.id) ?? 0,
        name: String(categoryRow.name ?? ''),
        description: categoryRow.description ?? null,
        is_active: Boolean(categoryRow.is_active),
      }
    : null;

  return {
    id: String(r.id),
    farmer_id: r.farmer_id ?? null,
    farmer_name: String(r.farmer_name ?? 'Unknown Farmer'),
    farmer_location: String(r.farmer_location ?? 'Uganda'),
    crop_name: String(r.crop_name ?? 'Produce'),
    variety: r.variety ?? null,
    quality: (r.quality ?? 'standard') as Quality,
    quantity: safeNumber(r.quantity, 0),
    unit: ((r.unit ?? 'kg') as Unit) || 'kg',
    price_per_unit: safeNumber(r.price_per_unit, 0),
    distance_km: r.distance_km === null ? null : safeNumber(r.distance_km, 0),
    location_lat: r.location_lat ?? null,
    location_lng: r.location_lng ?? null,
    google_maps_link: r.google_maps_link ?? null,
    available_from: String(r.available_from), // NOT NULL in DB
    is_available: Boolean(r.is_available),
    listed_at: String(r.listed_at ?? new Date().toISOString()),
    farmer_phone: r.farmer_phone ?? null,
    photo: r.photo ?? null,
    description: r.description ?? null,
    crop_category: r.crop_category ?? null,
    farmer_profile_id: r.farmer_profile_id ?? null,
    updated_at: String(r.updated_at ?? new Date().toISOString()),
    total_price: r.total_price === null ? null : safeNumber(r.total_price, 0),
    category_id: safeInt(r.category_id),
    category: normalizedCategory,
  };
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // filters
  const [query, setQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'uncategorized' | string>('all'); // category id as string
  const [quality, setQuality] = useState<'all' | Quality>('all');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sort, setSort] = useState<'distance' | 'price_low' | 'price_high' | 'newest'>('newest');

  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // load categories
  useEffect(() => {
    const loadCategories = async () => {
      const { data, error } = await supabase
        .from('produce_categories')
        .select('id, name, description, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Failed to load categories:', error);
        return;
      }

      const mapped = (data || []).map((c: any) => ({
        id: safeInt(c.id) ?? 0,
        name: String(c.name ?? ''),
        description: c.description ?? null,
        is_active: Boolean(c.is_active),
      })) as Category[];

      setCategories(mapped);
    };

    loadCategories();
  }, []);

  // load products
  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        const { data, error } = await supabase
          .from('farm_produce')
          .select(
            `
            id, farmer_id, farmer_name, farmer_location, crop_name, variety, quality,
            quantity, unit, price_per_unit, distance_km, location_lat, location_lng,
            google_maps_link, available_from, is_available, listed_at, farmer_phone,
            photo, description, crop_category, farmer_profile_id, updated_at, total_price, category_id,
            category:produce_categories (
              id, name, description, is_active
            )
          `
          )
          .eq('is_available', true)
          .order('listed_at', { ascending: false })
          .limit(300);

        if (error) throw error;
        if (!alive) return;

        setProducts((data || []).map(normalizeProductRow));
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

  // realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('farm_produce_home_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_produce' }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as any)?.id;
          if (!oldId) return;
          setProducts((prev) => prev.filter((p) => p.id !== String(oldId)));
          return;
        }

        const row = payload.new as any;
        if (!row?.id) return;

        // pull category for this row (because realtime payload won't include join)
        let cat: Category | null = null;
        if (row.category_id) {
          const { data: c } = await supabase
            .from('produce_categories')
            .select('id, name, description, is_active')
            .eq('id', row.category_id)
            .single();
          if (c) {
            cat = {
              id: safeInt(c.id) ?? 0,
              name: String(c.name ?? ''),
              description: c.description ?? null,
              is_active: Boolean(c.is_active),
            };
          }
        }

        const normalized = normalizeProductRow({ ...row, category: cat });

        setProducts((prev) => {
          // if product made unavailable, remove from home list
          if (!normalized.is_available) return prev.filter((p) => p.id !== normalized.id);

          const exists = prev.some((p) => p.id === normalized.id);
          if (!exists) return [normalized, ...prev];

          return prev.map((p) => (p.id === normalized.id ? normalized : p));
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
        const hay = `${p.crop_name} ${p.variety || ''} ${p.farmer_name} ${p.crop_category || ''} ${
          p.category?.name || ''
        }`.toLowerCase();
        return hay.includes(q);
      });
    }

    const lq = locationQuery.trim().toLowerCase();
    if (lq) {
      rows = rows.filter((p) => (p.farmer_location || '').toLowerCase().includes(lq));
    }

    if (category !== 'all') {
      rows = rows.filter((p) => {
        if (category === 'uncategorized') return p.category_id === null && !p.category;
        // stored as number, filter value is string
        return String(p.category_id ?? '') === category || String(p.category?.id ?? '') === category;
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
      if (sort === 'newest') return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();

      // distance
      const da = a.distance_km === null ? Number.POSITIVE_INFINITY : safeNumber(a.distance_km);
      const db = b.distance_km === null ? Number.POSITIVE_INFINITY : safeNumber(b.distance_km);
      return da - db;
    });

    return rows;
  }, [products, query, locationQuery, category, quality, maxPrice, sort]);

  const availableCategories = useMemo(() => {
    const map = new Map<number, Category>();
    for (const p of products) {
      if (p.category) map.set(p.category.id, p.category);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-8 py-2 sm:py-4 md:py-6 lg:py-8 space-y-3 sm:space-y-4 md:space-y-6">
        {/* Hero */}
        <section className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg sm:rounded-xl md:rounded-2xl shadow-lg overflow-hidden">
          <div className="relative p-3 sm:p-4 md:p-6 lg:p-8">
            <div className="relative z-10">
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2">
                Fresh Farm Produce Marketplace
              </h1>
              <p className="text-emerald-100 text-xs sm:text-sm mb-3 sm:mb-4">
                Order directly from farmers across Uganda.
              </p>

              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1">
                  <Star className="w-3 h-3 text-yellow-300" />
                  <span className="text-white text-xs font-medium">Fresh</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1">
                  <MapPin className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">Local</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1">
                  <Calendar className="w-3 h-3 text-white" />
                  <span className="text-white text-xs font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile filter toggle */}
        <div className="md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between gap-2 bg-white rounded-lg border border-gray-200 p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm active:bg-gray-100"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              <span>{showFilters ? 'Hide filters' : 'Show filters'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-semibold min-w-[24px] text-center">
                {filtered.length}
              </span>
              <Filter className="w-4 h-4 text-gray-500" />
            </div>
          </button>
        </div>

        {/* Filters */}
        <section
          className={`${
            showFilters ? 'block' : 'hidden md:block'
          } md:sticky md:top-[64px] z-30 bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4`}
        >
          {isMobile && showFilters && (
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Filters</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3">
            {/* Search */}
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="Search crops, farmers, category..."
                  autoComplete="off"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                ) : null}
              </div>
            </div>

            {/* Location */}
            <div className="md:col-span-2">
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="Location (e.g. Kasese)"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Category */}
            <div className="md:col-span-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="all">All Categories</option>
                <option value="uncategorized">Uncategorized</option>
                {availableCategories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quality */}
            <div className="md:col-span-2">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="all">All Qualities</option>
                <option value="top">Premium</option>
                <option value="standard">Standard</option>
                <option value="fair">Fair</option>
              </select>
            </div>

            {/* Max price */}
            <div className="md:col-span-2">
              <div className="relative">
                <input
                  value={maxPrice}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') return setMaxPrice('');
                    const n = Number(v);
                    if (!Number.isNaN(n)) setMaxPrice(n);
                  }}
                  inputMode="numeric"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="Max price"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">UGX</span>
              </div>
            </div>

            {/* Sort */}
            <div className="md:col-span-1">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              >
                <option value="newest">Newest</option>
                <option value="distance">Nearest</option>
                <option value="price_low">Lowest</option>
                <option value="price_high">Highest</option>
              </select>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
              <span className="font-medium">{filtered.length} products</span>

              {category !== 'all' && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {category === 'uncategorized'
                    ? 'Uncategorized'
                    : availableCategories.find((c) => String(c.id) === category)?.name || 'Category'}
                </span>
              )}

              {quality !== 'all' && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                  {qualityLabel(quality)}
                </span>
              )}

              {maxPrice !== '' && (
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">
                  Max: {formatUGX(Number(maxPrice))}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setLocationQuery('');
                  setCategory('all');
                  setQuality('all');
                  setMaxPrice('');
                  setSort('newest');
                }}
                className="px-3 py-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
              >
                Clear all
              </button>

              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  Apply
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Error */}
        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              {err}
            </div>
          </div>
        )}

        {/* Product grid */}
        <section className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="mt-3 text-gray-600 text-sm">Loading produce...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                <Search className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 text-sm mb-4">Try adjusting your filters or keywords.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setLocationQuery('');
                  setCategory('all');
                  setQuality('all');
                  setMaxPrice('');
                  setSort('newest');
                  if (isMobile) setShowFilters(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
              >
                Clear all filters
              </button>
            </div>
          )}

          {!loading &&
            filtered.map((p) => {
              const available = safeNumber(p.quantity, 0);
              const price = safeNumber(p.price_per_unit, 0);
              const distance = p.distance_km !== null ? safeNumber(p.distance_km, 0) : null;
              const totalPrice = p.total_price !== null ? safeNumber(p.total_price, 0) : null;

              return (
                <div
                  key={p.id}
                  className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  {/* Image */}
                  <div className="relative h-36 sm:h-40 md:h-44 overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photo}
                        alt={p.crop_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-4xl">🌾</div>
                      </div>
                    )}

                    {/* Quality */}
                    <div
                      className={`absolute top-2 left-2 ${qualityPillClass(
                        p.quality
                      )} px-2.5 py-1 rounded-full text-[11px] font-bold shadow-sm`}
                    >
                      {qualityLabel(p.quality)}
                    </div>

                    {/* Category */}
                    {p.category && (
                      <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-gray-800 px-2 py-1 rounded text-[10px] font-medium shadow-sm">
                        {p.category.name}
                      </div>
                    )}

                    {/* Listed */}
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-[10px] font-medium">
                      {formatRelative(p.listed_at)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <h3 className="font-bold text-gray-900 text-sm truncate mb-0.5">{p.crop_name}</h3>
                    {p.variety && <p className="text-gray-600 text-xs truncate mb-2">{p.variety}</p>}

                    {/* Location */}
                    <div className="flex items-start gap-1.5 text-gray-600 mb-3">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs truncate block">{p.farmer_location}</span>
                        {distance !== null && (
                          <span className="text-[11px] font-medium text-emerald-600 whitespace-nowrap">
                            {distance.toFixed(1)} km away
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price / Qty */}
                    <div className="mb-3 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-bold text-gray-900">{formatUGX(price)}</span>
                        <span className="text-xs text-gray-500">per {unitLabel(p.unit)}</span>
                      </div>

                      {totalPrice !== null && (
                        <div className="flex items-center justify-between bg-emerald-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-xs text-emerald-700 font-medium">Total:</span>
                          <span className="text-xs font-bold text-emerald-900">{formatUGX(totalPrice)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-gray-600">Available:</span>
                        <span className="text-xs font-bold text-emerald-700">
                          {available.toLocaleString('en-UG')} {unitLabel(p.unit)}
                        </span>
                      </div>
                    </div>

                    {/* Farmer */}
                    <div className="flex items-center gap-2 mb-3 pt-3 border-t border-gray-100">
                      <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <p className="text-xs text-gray-900 truncate font-medium">{p.farmer_name}</p>
                    </div>

                    <Link
                      href={`/products/${p.id}`}
                      className="block w-full text-center px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
        </section>

        <footer className="pt-4 pb-6 text-center border-t border-gray-200 mt-6">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} AgriConnect Marketplace • Connecting farmers with buyers across Uganda
          </p>
        </footer>
      </main>
    </div>
  );
}
