'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import {
  Search,
  Filter,
  X,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Package,
  TrendingUp,
  DollarSign,
  SortAsc,
  Check,
  Grid,
  List,
  Clock,
  ShoppingBag,
  User,
  Loader2,
  ChevronDown,
  Tag,
} from 'lucide-react';

interface FarmProduce {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  category_id: string | null;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  distance_km: number | null;
  is_available: boolean;
  listed_at: string;
  photo?: string | null;
  farmer_phone?: string | null;
  description?: string | null;
  available_from?: string;
  total_price?: number | null;
  category?: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  } | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

const sortOptions = [
  { id: 'newest', label: 'Newest', icon: TrendingUp, description: 'Recently listed' },
  { id: 'price-low', label: 'Price: Low', icon: DollarSign, description: 'Lowest price first' },
  { id: 'price-high', label: 'Price: High', icon: DollarSign, description: 'Highest price first' },
  { id: 'distance', label: 'Nearest', icon: MapPin, description: 'Closest to you' },
  { id: 'name', label: 'Name A-Z', icon: SortAsc, description: 'Alphabetical order' },
];

const qualityColors: Record<string, string> = {
  top: 'bg-gradient-to-r from-emerald-500 to-green-500',
  standard: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  fair: 'bg-gradient-to-r from-amber-500 to-orange-500',
};

const qualityLabels: Record<string, string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

const unitLabels: Record<string, string> = {
  kg: 'kg',
  bag: 'bag',
  bunch: 'bunch',
  piece: 'piece'
};

const getPlaceholderImage = (categoryName?: string): string => {
  const category = (categoryName || '').toLowerCase();
  const images: Record<string, string> = {
    poultry: 'https://images.unsplash.com/photo-1562962236-2c224b5ef5f5?w=400&h=300&fit=crop',
    fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=300&fit=crop',
    legume: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop',
    'cash crops': 'https://images.unsplash.com/photo-1592921870789-04563d55041c?w=400&h=300&fit=crop',
    vegetable: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400&h=300&fit=crop',
    grain: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=300&fit=crop',
  };
  return images[category] || 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop';
};

const formatPrice = (price: number) => `UGX ${Number(price || 0).toLocaleString('en-UG')}`;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

function safePhone(phone?: string | null) {
  const p = (phone || '').trim();
  return p.length ? p : null;
}

function normalizeWhatsapp(phone: string) {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return `256${digits.slice(1)}`;
  return digits;
}

function safeNumber(v: any, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<FarmProduce[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [quality, setQuality] = useState<'all' | string>('all');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch categories from database
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('produce_categories')
          .select('id, name, description, is_active')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        setCategories(data || []);
      } catch (e: any) {
        console.error('Failed to load categories:', e);
      }
    };

    loadCategories();
  }, []);

  // Fetch products with categories
  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('farm_produce')
          .select(`
            *,
            category:category_id (
              id,
              name,
              description,
              is_active
            )
          `)
          .eq('is_available', true)
          .order('listed_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        if (!active) return;
        setProducts((data || []) as FarmProduce[]);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Failed to load products');
        console.error('Error loading products:', e);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    };

    fetchProducts();

    // Realtime subscription
    const channel = supabase
      .channel('products-page-live')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'farm_produce' }, 
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setProducts(prev => prev.filter(p => p.id !== payload.old.id));
            return;
          }

          const newProduct = payload.new as FarmProduce;
          if (!newProduct.is_available) {
            setProducts(prev => prev.filter(p => p.id !== newProduct.id));
            return;
          }

          // Fetch category for updated product
          let categoryData = null;
          if (newProduct.category_id) {
            const { data } = await supabase
              .from('produce_categories')
              .select('id, name, description, is_active')
              .eq('id', newProduct.category_id)
              .single();
            categoryData = data;
          }

          const updatedProduct = {
            ...newProduct,
            category: categoryData
          };

          setProducts(prev => {
            const exists = prev.find(p => p.id === updatedProduct.id);
            if (!exists) return [updatedProduct, ...prev];
            return prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Get unique qualities from products
  const availableQualities = useMemo(() => {
    const qualities = new Set<string>();
    products.forEach(p => {
      if (p.quality) qualities.add(p.quality);
    });
    return Array.from(qualities).sort();
  }, [products]);

  // Get categories with product counts
  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    // Count products per category
    products.forEach(product => {
      const categoryId = product.category_id || 'uncategorized';
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    });
    
    // Create array with counts
    return [
      { id: 'all', name: 'All Categories', count: products.length },
      ...categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        count: counts.get(cat.id) || 0
      })),
      { id: 'uncategorized', name: 'Uncategorized', count: counts.get('uncategorized') || 0 }
    ];
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered = products.filter((p) => {
      const crop = (p.crop_name || '').toLowerCase();
      const farmer = (p.farmer_name || '').toLowerCase();
      const location = (p.farmer_location || '').toLowerCase();
      const variety = (p.variety || '').toLowerCase();
      const description = (p.description || '').toLowerCase();
      const categoryName = (p.category?.name || '').toLowerCase();

      const matchesSearch =
        !q || 
        crop.includes(q) || 
        farmer.includes(q) || 
        location.includes(q) || 
        categoryName.includes(q) ||
        variety.includes(q) ||
        description.includes(q);

      const matchesCategory = selectedCategory === 'all' || 
        (selectedCategory === 'uncategorized' && !p.category_id) ||
        p.category_id === selectedCategory;

      const matchesQuality = quality === 'all' || p.quality === quality;

      const matchesPrice = maxPrice === '' || safeNumber(p.price_per_unit) <= safeNumber(maxPrice);

      return matchesSearch && matchesCategory && matchesQuality && matchesPrice;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'price-low') return safeNumber(a.price_per_unit) - safeNumber(b.price_per_unit);
      if (sortBy === 'price-high') return safeNumber(b.price_per_unit) - safeNumber(a.price_per_unit);
      if (sortBy === 'distance') {
        const da = a.distance_km === null ? Infinity : safeNumber(a.distance_km);
        const db = b.distance_km === null ? Infinity : safeNumber(b.distance_km);
        return da - db;
      }
      if (sortBy === 'name') return (a.crop_name || '').localeCompare(b.crop_name || '');
      return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
    });

    return filtered;
  }, [products, search, selectedCategory, quality, maxPrice, sortBy]);

  const handleViewProduct = (id: string) => router.push(`/products/${id}`);

  const handleCall = (e: React.MouseEvent, phone?: string | null) => {
    e.stopPropagation();
    const p = safePhone(phone);
    if (!p) return;
    window.open(`tel:${p}`, '_self');
  };

  const handleMessage = (e: React.MouseEvent, phone?: string | null) => {
    e.stopPropagation();
    const p = safePhone(phone);
    if (!p) return;
    window.open(`https://wa.me/${normalizeWhatsapp(p)}`, '_blank', 'noopener,noreferrer');
  };

  const selectedCategoryInfo = useMemo(() => {
    if (selectedCategory === 'all') return { name: 'All Categories', color: 'bg-emerald-500' };
    if (selectedCategory === 'uncategorized') return { name: 'Uncategorized', color: 'bg-gray-500' };
    const cat = categories.find(c => c.id === selectedCategory);
    return { name: cat?.name || 'Unknown', color: 'bg-emerald-500' };
  }, [selectedCategory, categories]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="pt-4 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Fresh from the Farm</h1>
          <p className="text-gray-600 text-sm md:text-base">
            Discover quality produce directly from Ugandan farmers
          </p>
        </div>

        {/* Search and Filters Bar */}
        <div className="sticky top-16 z-20 bg-gray-50 pb-4 pt-2">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, farmers, locations, varieties..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-3 bg-white rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-gray-900 text-sm sm:text-base"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                  aria-label="Clear search"
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-emerald-600'}`}
                  aria-label="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-emerald-600'}`}
                  aria-label="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                  showFilters
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Filters</span>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {filteredProducts.length}
                </span>
              </button>
            </div>
          </div>

          {/* Categories Scroll */}
          <div className="relative">
            <div className="overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {categoriesWithCounts.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                      selectedCategory === category.id
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300'
                    }`}
                    title={category.name}
                  >
                    <Tag className="w-3 h-3" />
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedCategory === category.id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {category.count}
                    </span>
                    {selectedCategory === category.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Sort & Filter</h3>
              <button 
                onClick={() => setShowFilters(false)} 
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
                        sortBy === option.id
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'border border-gray-200 hover:border-emerald-300'
                      }`}
                    >
                      <option.icon className={`w-5 h-5 ${sortBy === option.id ? 'text-emerald-600' : 'text-gray-600'}`} />
                      <span className={`text-xs font-medium ${sortBy === option.id ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {option.label}
                      </span>
                      <span className="text-[10px] text-gray-500 text-center">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setQuality('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      quality === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All Qualities
                  </button>
                  {availableQualities.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        quality === q
                          ? `${qualityColors[q]} text-white`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {qualityLabels[q] || q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Price (UGX)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMaxPrice(val === '' ? '' : Number(val));
                    }}
                    placeholder="Enter maximum price"
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    min="0"
                    step="1000"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    UGX
                  </div>
                </div>
                {maxPrice !== '' && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Showing products under: <span className="font-semibold">{formatPrice(Number(maxPrice))}</span>
                    </span>
                    <button
                      onClick={() => setMaxPrice('')}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      Clear price filter
                    </button>
                  </div>
                )}
              </div>

              {/* Category Filter in Panel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition appearance-none"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                    <option value="uncategorized">Uncategorized</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setQuality('all');
                  setMaxPrice('');
                  setSortBy('newest');
                  setSearch('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Reset all filters
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {/* Results Header */}
        {!loading && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 p-3 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-lg">{filteredProducts.length}</span>
                <span className="text-gray-600">products found</span>
              </div>
              
              {selectedCategory !== 'all' && (
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {selectedCategoryInfo.name}
                </span>
              )}
              
              {quality !== 'all' && (
                <span className={`text-xs ${qualityColors[quality]} text-white px-2.5 py-1 rounded-full font-medium`}>
                  {qualityLabels[quality] || quality} Quality
                </span>
              )}
              
              {maxPrice !== '' && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-medium">
                  Max: {formatPrice(Number(maxPrice))}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Updates
              </span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
            <p className="text-gray-600">Loading fresh produce...</p>
            <p className="text-sm text-gray-500 mt-1">This may take a moment</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {search 
                ? `No products match "${search}". Try different keywords.`
                : 'Try adjusting your filters or check back later for new listings.'}
            </p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
                setQuality('all');
                setMaxPrice('');
                setSortBy('newest');
              }}
              className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-600 transition-colors inline-flex items-center gap-2"
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onView={() => handleViewProduct(product.id)}
                onCall={(e) => handleCall(e, product.farmer_phone)}
                onMessage={(e) => handleMessage(e, product.farmer_phone)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <ProductListItem
                key={product.id}
                product={product}
                onView={() => handleViewProduct(product.id)}
                onCall={(e) => handleCall(e, product.farmer_phone)}
                onMessage={(e) => handleMessage(e, product.farmer_phone)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pb-8">
          <div className="border-t border-gray-200 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">A</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">AgriConnect</p>
                  <p className="text-sm text-gray-600">Connecting farmers with buyers across Uganda</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/about" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                  About
                </Link>
                <Link href="/contact" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                  Contact
                </Link>
                <Link href="/help" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">
                  Help
                </Link>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-8">
              © {new Date().getFullYear()} AgriConnect. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProductCard({
  product,
  onView,
  onCall,
  onMessage,
}: {
  product: FarmProduce;
  onView: () => void;
  onCall: (e: React.MouseEvent) => void;
  onMessage: (e: React.MouseEvent) => void;
}) {
  const image = product.photo || getPlaceholderImage(product.category?.name);
  const hasContact = safePhone(product.farmer_phone);

  return (
    <div
      onClick={onView}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-[0.99]"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={image}
          alt={product.crop_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        />

        <div className="absolute top-2 left-2">
          <span className={`${qualityColors[product.quality] || 'bg-gray-800'} text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm`}>
            {qualityLabels[product.quality] || product.quality}
          </span>
        </div>

        {product.distance_km != null && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-semibold shadow-sm">
            {product.distance_km.toFixed(1)} km
          </div>
        )}

        {product.category && (
          <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm text-gray-800 px-2 py-1 rounded text-xs font-medium shadow-sm">
            {product.category.name}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-white font-bold text-lg">
            {formatPrice(product.price_per_unit)}
            <span className="text-sm font-normal ml-1">/{unitLabels[product.unit] || product.unit}</span>
          </p>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm group-hover:text-emerald-700">{product.crop_name}</h3>
          {product.variety && (
            <p className="text-gray-600 text-xs line-clamp-1 mt-0.5">Variety: {product.variety}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{product.farmer_name}</p>
            <div className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{product.farmer_location}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" />
            <span className="font-medium">
              {product.quantity.toLocaleString('en-UG')} {unitLabels[product.unit] || product.unit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(product.listed_at)}</span>
          </div>
        </div>

        {product.total_price && product.total_price > 0 && (
          <div className="mb-3 px-2.5 py-1.5 bg-emerald-50 rounded-lg">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-medium">Total Value:</span>
              <span className="font-bold text-emerald-900">{formatPrice(product.total_price)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCall}
            disabled={!hasContact}
            className="flex-1 bg-emerald-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:bg-emerald-700"
            title={hasContact ? `Call ${product.farmer_name}` : 'Phone number not available'}
          >
            <Phone className="w-3 h-3" />
            Call
          </button>
          <button
            onClick={onMessage}
            disabled={!hasContact}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:bg-blue-700"
            title={hasContact ? `Message ${product.farmer_name}` : 'Phone number not available'}
          >
            <MessageCircle className="w-3 h-3" />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductListItem({
  product,
  onView,
  onCall,
  onMessage,
}: {
  product: FarmProduce;
  onView: () => void;
  onCall: (e: React.MouseEvent) => void;
  onMessage: (e: React.MouseEvent) => void;
}) {
  const image = product.photo || getPlaceholderImage(product.category?.name);
  const hasContact = safePhone(product.farmer_phone);

  return (
    <div
      onClick={onView}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer active:scale-[0.995]"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-24 h-48 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
          <img src={image} alt={product.crop_name} className="w-full h-full object-cover" loading="lazy" />
          <span
            className={`absolute top-1 left-1 ${qualityColors[product.quality] || 'bg-gray-800'} text-white px-1.5 py-0.5 rounded text-xs font-semibold shadow-sm`}
          >
            {qualityLabels[product.quality]?.charAt(0) || product.quality.charAt(0)}
          </span>
          {product.distance_km != null && (
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              {product.distance_km.toFixed(1)} km
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate group-hover:text-emerald-700">
                {product.crop_name}
              </h3>
              {product.variety && (
                <p className="text-gray-600 text-xs sm:text-sm truncate mt-0.5">Variety: {product.variety}</p>
              )}
              {product.category && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-1">
                  <Tag className="w-3 h-3" />
                  {product.category.name}
                </span>
              )}
            </div>
            <p className="font-bold text-gray-900 text-lg whitespace-nowrap">
              {formatPrice(product.price_per_unit)}
              <span className="text-sm font-normal ml-1">/{unitLabels[product.unit] || product.unit}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-3 h-3 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-900 truncate">{product.farmer_name}</p>
            <span className="text-gray-300 hidden sm:inline">•</span>
            <div className="flex items-center gap-1 text-gray-500 text-sm flex-1 min-w-0">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{product.farmer_location}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-sm text-gray-500 mb-4 gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {product.quantity.toLocaleString('en-UG')} {unitLabels[product.unit] || product.unit}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Listed {formatDate(product.listed_at)}</span>
              </div>
            </div>
            
            {product.total_price && product.total_price > 0 && (
              <div className="bg-emerald-50 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-lg">
                Value: {formatPrice(product.total_price)}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onCall}
              disabled={!hasContact}
              className="flex-1 bg-emerald-500 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:bg-emerald-700"
              title={hasContact ? `Call ${product.farmer_name}` : 'Phone number not available'}
            >
              <Phone className="w-4 h-4" />
              Call Farmer
            </button>
            <button
              onClick={onMessage}
              disabled={!hasContact}
              className="flex-1 bg-blue-500 text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:bg-blue-700"
              title={hasContact ? `Message ${product.farmer_name}` : 'Phone number not available'}
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={onView}
              className="flex-1 border border-emerald-500 text-emerald-600 py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}