'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import supabase from '@/lib/supabaseClient';
import {
  Search,
  Filter,
  Grid,
  List,
  Loader2,
  Phone,
  MessageCircle,
  Eye,
  Package,
  Tag,
  DollarSign,
  MapPin,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';

// Type definitions
type Category = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

type FarmProduce = {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  distance_km: number | null;
  is_available: boolean;
  listed_at: string;
  photo: string | null;
  farmer_phone: string | null;
  description: string | null;
  available_from: string | null;
  total_price: number | null;
  category_id: number | null;
  category: Category | null;
};

// Raw database row type
type FarmProduceRow = {
  id: string;
  farmer_id: string | null;
  farmer_name: string | null;
  farmer_location: string | null;
  crop_name: string | null;
  variety: string | null;
  quality: string | null;
  quantity: number | string | null;
  unit: string | null;
  price_per_unit: number | string | null;
  distance_km: number | string | null;
  is_available: boolean | null;
  listed_at: string | null;
  photo: string | null;
  farmer_phone: string | null;
  description: string | null;
  available_from: string | null;
  total_price: number | string | null;
  category_id: number | null;
  category: Category[] | Category | null;
};

type CategoryCount = {
  id: string;
  name: string;
  count: number;
};

const PAGE_SIZE = 60;

// Utility functions
const categoryImageFallback = (category?: string | null): string => {
  const key = (category || '').toLowerCase();
  const images: Record<string, string> = {
    coffee:
      'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&h=600&fit=crop',
    fruits:
      'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&h=600&fit=crop',
    vegetable:
      'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=800&h=600&fit=crop',
    grain:
      'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&h=600&fit=crop',
    'cash crops':
      'https://images.unsplash.com/photo-1592921870789-04563d55041c?w=800&h=600&fit=crop',
  };

  return (
    images[key] ||
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop'
  );
};

const formatPrice = (price: number): string =>
  `UGX ${Number(price || 0).toLocaleString('en-UG')}`;

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

const safePhone = (phone?: string | null): string | null => {
  const p = (phone || '').trim();
  return p.length ? p : null;
};

const normalizeWhatsapp = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `256${digits.slice(1)}`;
  return digits;
};

const safeNumber = (v: unknown, fallback = 0): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeCategory = (input?: Category[] | Category | null): Category | null => {
  if (!input) return null;
  
  // If it's already a Category object (has id and name)
  if (typeof input === 'object' && 'id' in input && 'name' in input) {
    return input as Category;
  }
  
  // If it's an array, take the first item if it exists
  if (Array.isArray(input) && input.length > 0) {
    const first = input[0];
    if (first && typeof first === 'object' && 'id' in first && 'name' in first) {
      return first as Category;
    }
  }
  
  return null;
};

const normalizeProduct = (row: FarmProduceRow): FarmProduce => ({
  id: row.id,
  farmer_id: row.farmer_id ?? null,
  farmer_name: row.farmer_name ?? '',
  farmer_location: row.farmer_location ?? '',
  crop_name: row.crop_name ?? '',
  variety: row.variety ?? null,
  quality: row.quality ?? '',
  quantity: safeNumber(row.quantity),
  unit: row.unit ?? '',
  price_per_unit: safeNumber(row.price_per_unit),
  distance_km:
    row.distance_km === null || row.distance_km === undefined
      ? null
      : safeNumber(row.distance_km),
  is_available: Boolean(row.is_available),
  listed_at: row.listed_at ?? new Date().toISOString(),
  photo: row.photo ?? null,
  farmer_phone: row.farmer_phone ?? null,
  description: row.description ?? null,
  available_from: row.available_from ?? null,
  total_price:
    row.total_price === null || row.total_price === undefined
      ? null
      : safeNumber(row.total_price),
  category_id: row.category_id ?? null,
  category: normalizeCategory(row.category),
});

// Custom hook for debounced value
function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function ProductsPage() {
  const router = useRouter();

  // State
  const [products, setProducts] = useState<FarmProduce[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const categoryMapRef = useRef<Map<number, Category>>(new Map());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quality, setQuality] = useState<'all' | string>('all');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<
    'newest' | 'price-low' | 'price-high' | 'distance' | 'name'
  >('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Data fetching
  const fetchCategories = useCallback(async (): Promise<void> => {
    const { data, error } = await supabase
      .from('produce_categories')
      .select('id, name, description, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    const rows = (data || []) as Category[];
    setCategories(rows);
    categoryMapRef.current = new Map(rows.map((c) => [c.id, c]));
  }, []);

  const fetchProducts = useCallback(async (silent = false): Promise<void> => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const { data, error } = await supabase
        .from('farm_produce')
        .select(
          `
          id,
          farmer_id,
          farmer_name,
          farmer_location,
          crop_name,
          variety,
          quality,
          quantity,
          unit,
          price_per_unit,
          distance_km,
          is_available,
          listed_at,
          photo,
          farmer_phone,
          description,
          available_from,
          total_price,
          category_id,
          category:category_id (
            id,
            name,
            description,
            is_active
          )
        `
        )
        .eq('is_available', true)
        .order('listed_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) throw error;

      // Normalize each row to match FarmProduce type
      const normalizedProducts = ((data || []) as FarmProduceRow[]).map(normalizeProduct);
      setProducts(normalizedProducts);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products');
      console.error('Error loading products:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load and real-time subscription
  useEffect(() => {
    let isMounted = true;

    const initializeData = async (): Promise<void> => {
      try {
        await Promise.all([fetchCategories(), fetchProducts()]);
      } catch (e) {
        if (!isMounted) return;
        console.error('Failed to initialize data:', e);
      }
    };

    initializeData();

    // Set up real-time subscription
    const channel = supabase
      .channel('products-page-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'farm_produce' },
        async (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (!oldRow?.id) return;
            setProducts((prev) => prev.filter((p) => p.id !== oldRow.id));
            return;
          }

          const newProduct = payload.new as Partial<FarmProduceRow>;
          if (!newProduct?.id) return;

          if (!newProduct.is_available) {
            setProducts((prev) => prev.filter((p) => p.id !== newProduct.id));
            return;
          }

          const categoryData = newProduct.category_id
            ? categoryMapRef.current.get(newProduct.category_id) || null
            : null;

          const updatedProduct: FarmProduce = {
            id: newProduct.id!,
            farmer_id: newProduct.farmer_id ?? null,
            farmer_name: newProduct.farmer_name ?? '',
            farmer_location: newProduct.farmer_location ?? '',
            crop_name: newProduct.crop_name ?? '',
            variety: newProduct.variety ?? null,
            quality: newProduct.quality ?? '',
            quantity: safeNumber(newProduct.quantity),
            unit: newProduct.unit ?? '',
            price_per_unit: safeNumber(newProduct.price_per_unit),
            distance_km:
              newProduct.distance_km === null || newProduct.distance_km === undefined
                ? null
                : safeNumber(newProduct.distance_km),
            is_available: Boolean(newProduct.is_available),
            listed_at: newProduct.listed_at ?? new Date().toISOString(),
            photo: newProduct.photo ?? null,
            farmer_phone: newProduct.farmer_phone ?? null,
            description: newProduct.description ?? null,
            available_from: newProduct.available_from ?? null,
            total_price:
              newProduct.total_price === null || newProduct.total_price === undefined
                ? null
                : safeNumber(newProduct.total_price),
            category_id: newProduct.category_id ?? null,
            category: categoryData,
          };

          setProducts((prev) => {
            const index = prev.findIndex((p) => p.id === updatedProduct.id);

            if (index === -1) {
              // Add new product and sort
              const next = [updatedProduct, ...prev];
              return next
                .sort(
                  (a, b) =>
                    new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
                )
                .slice(0, PAGE_SIZE);
            }

            // Update existing product
            const next = [...prev];
            next[index] = { ...next[index], ...updatedProduct };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchCategories, fetchProducts]);

  // Memoized values
  const availableQualities = useMemo((): string[] => {
    const qualities = new Set<string>();
    products.forEach((p) => {
      if (p.quality) qualities.add(p.quality);
    });
    return Array.from(qualities).sort();
  }, [products]);

  const categoriesWithCounts = useMemo((): CategoryCount[] => {
    const counts = new Map<string, number>();

    for (const product of products) {
      const key = product.category_id ? String(product.category_id) : 'uncategorized';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [
      { id: 'all', name: 'All Categories', count: products.length },
      ...categories.map((cat) => ({
        id: String(cat.id),
        name: cat.name,
        count: counts.get(String(cat.id)) || 0,
      })),
      {
        id: 'uncategorized',
        name: 'Uncategorized',
        count: counts.get('uncategorized') || 0,
      },
    ];
  }, [products, categories]);

  const filteredProducts = useMemo((): FarmProduce[] => {
    const searchTerm = debouncedSearch.trim().toLowerCase();

    const filtered = products.filter((p) => {
      const crop = (p.crop_name || '').toLowerCase();
      const farmer = (p.farmer_name || '').toLowerCase();
      const location = (p.farmer_location || '').toLowerCase();
      const variety = (p.variety || '').toLowerCase();
      const description = (p.description || '').toLowerCase();
      const categoryName = (p.category?.name || '').toLowerCase();

      const matchesSearch =
        !searchTerm ||
        crop.includes(searchTerm) ||
        farmer.includes(searchTerm) ||
        location.includes(searchTerm) ||
        categoryName.includes(searchTerm) ||
        variety.includes(searchTerm) ||
        description.includes(searchTerm);

      const matchesCategory =
        selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized' && !p.category_id) ||
        String(p.category_id) === selectedCategory;

      const matchesQuality = quality === 'all' || p.quality === quality;
      const matchesPrice =
        maxPrice === '' || safeNumber(p.price_per_unit) <= safeNumber(maxPrice);

      return matchesSearch && matchesCategory && matchesQuality && matchesPrice;
    });

    // Sort products
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return safeNumber(a.price_per_unit) - safeNumber(b.price_per_unit);
        case 'price-high':
          return safeNumber(b.price_per_unit) - safeNumber(a.price_per_unit);
        case 'distance': {
          const da = a.distance_km === null ? Infinity : safeNumber(a.distance_km);
          const db = b.distance_km === null ? Infinity : safeNumber(b.distance_km);
          return da - db;
        }
        case 'name':
          return (a.crop_name || '').localeCompare(b.crop_name || '');
        default:
          return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
      }
    });
  }, [products, debouncedSearch, selectedCategory, quality, maxPrice, sortBy]);

  const selectedCategoryInfo = useMemo((): { name: string; color: string } => {
    if (selectedCategory === 'all') {
      return { name: 'All Categories', color: 'bg-emerald-500' };
    }
    if (selectedCategory === 'uncategorized') {
      return { name: 'Uncategorized', color: 'bg-gray-500' };
    }
    const cat = categories.find((c) => String(c.id) === selectedCategory);
    return { name: cat?.name || 'Unknown', color: 'bg-emerald-500' };
  }, [selectedCategory, categories]);

  // Event handlers
  const clearFilters = (): void => {
    setSearch('');
    setSelectedCategory('all');
    setQuality('all');
    setMaxPrice('');
    setSortBy('newest');
  };

  const handleViewProduct = (id: string): void => {
    router.push(`/products/${id}`);
  };

  const handleCall = (e: React.MouseEvent, phone?: string | null): void => {
    e.stopPropagation();
    const validPhone = safePhone(phone);
    if (!validPhone) return;
    window.open(`tel:${validPhone}`, '_self');
  };

  const handleMessage = (e: React.MouseEvent, phone?: string | null): void => {
    e.stopPropagation();
    const validPhone = safePhone(phone);
    if (!validPhone) return;
    window.open(`https://wa.me/${normalizeWhatsapp(validPhone)}`, '_blank', 'noopener,noreferrer');
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-gray-600">Loading products...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Available Products</h1>
            <p className="mt-1 text-sm text-gray-600">
              Browse current farm produce listings by category, quality, price, and
              location.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
                viewMode === 'grid'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="Grid view"
            >
              <Grid className="h-4 w-4" />
              Grid
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
                viewMode === 'list'
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
              List
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search crop, farmer, variety, location..."
                className="w-full rounded-2xl border border-gray-300 py-3 pl-10 pr-4 outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                aria-label="Search products"
              />
            </div>

            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              aria-expanded={showFilters}
            >
              <Filter className="h-4 w-4" />
              Filters
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                aria-label="Filter by category"
              >
                {categoriesWithCounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>

              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                aria-label="Filter by quality"
              >
                <option value="all">All qualities</option>
                {availableQualities.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) =>
                  setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Max price"
                className="rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-emerald-500"
                aria-label="Maximum price"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-emerald-500"
                aria-label="Sort by"
              >
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="distance">Distance</option>
                <option value="name">Name</option>
              </select>

              <button
                onClick={clearFilters}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${selectedCategoryInfo.color}`} />
            <span>{selectedCategoryInfo.name}</span>
            <span>•</span>
            <span>{filteredProducts.length} product(s)</span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!error && filteredProducts.length === 0 && (
          <div className="mt-6 rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <Package className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-4 text-lg font-bold text-gray-900">No products found</h3>
            <p className="mt-1 text-sm text-gray-600">
              Try changing your search or filters.
            </p>
          </div>
        )}

        {/* Products grid view */}
        {!error && filteredProducts.length > 0 && viewMode === 'grid' && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  onClick={() => handleViewProduct(product.id)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleViewProduct(product.id);
                    }
                  }}
                >
                  <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                    <img
                      src={product.photo || categoryImageFallback(product.category?.name)}
                      alt={product.crop_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-gray-900">
                          {product.crop_name}
                        </h3>
                        <p className="mt-1 truncate text-sm text-gray-600">
                          {product.farmer_name}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {product.quality || 'Standard'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-gray-500">
                          <DollarSign className="h-4 w-4" />
                          Price
                        </div>
                        <div className="mt-1 font-bold text-emerald-700">
                          {formatPrice(product.price_per_unit)}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-gray-50 p-3">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Package className="h-4 w-4" />
                          Quantity
                        </div>
                        <div className="mt-1 font-bold text-gray-900">
                          {safeNumber(product.quantity).toLocaleString()} {product.unit}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      {product.category?.name && (
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          <span>{product.category.name}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{product.farmer_location}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>{formatDate(product.listed_at)}</span>
                        {product.distance_km !== null && (
                          <span>{safeNumber(product.distance_km).toFixed(1)} km away</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCall(e, product.farmer_phone)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      aria-label={`Call ${product.farmer_name}`}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </button>

                    <button
                      onClick={(e) => handleMessage(e, product.farmer_phone)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      aria-label={`Message ${product.farmer_name} on WhatsApp`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>

                    <button
                      onClick={() => handleViewProduct(product.id)}
                      className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-3 py-2.5 text-white hover:bg-black"
                      aria-label={`View ${product.crop_name} details`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Products list view */}
        {!error && filteredProducts.length > 0 && viewMode === 'list' && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex w-full flex-col gap-4 p-4 text-left transition hover:bg-gray-50 md:flex-row"
                >
                  <div
                    onClick={() => handleViewProduct(product.id)}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-4 md:flex-row"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleViewProduct(product.id);
                      }
                    }}
                  >
                    <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 md:w-40">
                      <img
                        src={product.photo || categoryImageFallback(product.category?.name)}
                        alt={product.crop_name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold text-gray-900">
                            {product.crop_name}
                          </h3>
                          <p className="truncate text-sm text-gray-600">
                            {product.farmer_name}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {product.quality || 'Standard'}
                          </span>
                          {product.category?.name && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                              {product.category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                        <span>{formatPrice(product.price_per_unit)}</span>
                        <span>
                          {safeNumber(product.quantity).toLocaleString()} {product.unit}
                        </span>
                        <span className="truncate">{product.farmer_location}</span>
                        <span>{formatDate(product.listed_at)}</span>
                        {product.distance_km !== null && (
                          <span>{safeNumber(product.distance_km).toFixed(1)} km away</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 md:items-start">
                    <button
                      onClick={(e) => handleCall(e, product.farmer_phone)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      aria-label={`Call ${product.farmer_name}`}
                    >
                      <Phone className="h-4 w-4" />
                      Call
                    </button>
                    <button
                      onClick={(e) => handleMessage(e, product.farmer_phone)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      aria-label={`Message ${product.farmer_name} on WhatsApp`}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleViewProduct(product.id)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                      aria-label={`View ${product.crop_name} details`}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}