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
} from 'lucide-react';

interface FarmProduce {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  crop_category?: string | null;
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
}

const categories = [
  { id: 'all', label: 'All', icon: '🌱' },
  { id: 'fruit', label: 'Fruits', icon: '🍎' },
  { id: 'vegetable', label: 'Vegetables', icon: '🥦' },
  { id: 'grain', label: 'Grains', icon: '🌾' },
  { id: 'poultry', label: 'Poultry', icon: '🐔' },
  { id: 'cash_crop', label: 'Cash Crops', icon: '💰' },
  { id: 'legume', label: 'Legumes', icon: '🥜' },
  { id: 'other', label: 'Other', icon: '📦' },
];

const sortOptions = [
  { id: 'newest', label: 'Newest', icon: TrendingUp },
  { id: 'price-low', label: 'Price: Low', icon: DollarSign },
  { id: 'price-high', label: 'Price: High', icon: DollarSign },
  { id: 'name', label: 'Name A-Z', icon: SortAsc },
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

const getPlaceholderImage = (category: string): string => {
  const images: Record<string, string> = {
    poultry: 'https://images.unsplash.com/photo-1562962236-2c224b5ef5f5?w=400&h=300&fit=crop',
    fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=300&fit=crop',
    legume: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop',
    cash_crop: 'https://images.unsplash.com/photo-1592921870789-04563d55041c?w=400&h=300&fit=crop',
    vegetable: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400&h=300&fit=crop',
    grain: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=300&fit=crop',
    other: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
  };
  return images[category] || images.other;
};

const formatPrice = (price: number) => `UGX ${Number(price || 0).toLocaleString('en-US')}`;

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function safePhone(phone?: string | null) {
  const p = (phone || '').trim();
  return p.length ? p : null;
}

function normalizeWhatsapp(phone: string) {
  // Keep digits only (works for +256..., 256..., 07...)
  const digits = phone.replace(/[^\d]/g, '');
  // If user stored 07xxxxxxxx, convert to 2567xxxxxxxx (Uganda)
  if (digits.length === 10 && digits.startsWith('0')) return `256${digits.slice(1)}`;
  return digits;
}

export default function ProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<FarmProduce[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('farm_produce')
        .select('*')
        .eq('is_available', true)
        .order('listed_at', { ascending: false });

      if (!active) return;

      if (error) {
        console.error('Error loading products:', error);
        setProducts([]);
      } else {
        setProducts((data || []) as FarmProduce[]);
      }
      setLoading(false);
    };

    fetchProducts();

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    let filtered = products.filter((p) => {
      const crop = (p.crop_name || '').toLowerCase();
      const farmer = (p.farmer_name || '').toLowerCase();
      const location = (p.farmer_location || '').toLowerCase();
      const category = ((p.crop_category || '') as string).toLowerCase();

      const matchesSearch =
        !q || crop.includes(q) || farmer.includes(q) || location.includes(q) || category.includes(q);

      const matchesCategory =
        selectedCategory === 'all' ||
        category === selectedCategory ||
        crop.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'price-low') return (a.price_per_unit || 0) - (b.price_per_unit || 0);
      if (sortBy === 'price-high') return (b.price_per_unit || 0) - (a.price_per_unit || 0);
      if (sortBy === 'name') return (a.crop_name || '').localeCompare(b.crop_name || '');
      return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime();
    });

    return filtered;
  }, [products, search, selectedCategory, sortBy]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
        <div className="pt-4 pb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Fresh from the Farm</h1>
          <p className="text-gray-600 text-sm md:text-base">
            Discover quality produce directly from Ugandan farmers
          </p>
        </div>

        <div className="sticky top-16 z-10 bg-gray-50 pb-4 pt-2">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products, farmers, locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-gray-900"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
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
                  className={`p-2.5 ${viewMode === 'grid' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600'}`}
                  aria-label="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 ${viewMode === 'list' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600'}`}
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
                    : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Filters</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex gap-2 min-w-max">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    selectedCategory === category.id
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span className="text-sm font-medium">{category.label}</span>
                  {selectedCategory === category.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Sort & Filter</h3>
              <button onClick={() => setShowFilters(false)} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close filters">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {sortOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSortBy(option.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                    sortBy === option.id
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'border border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <option.icon className={`w-5 h-5 ${sortBy === option.id ? 'text-emerald-600' : 'text-gray-600'}`} />
                  <span className={`text-sm font-medium ${sortBy === option.id ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-600 text-sm">
              <span className="font-semibold text-gray-900">{filteredProducts.length}</span> products found
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Live Updates
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-8 bg-gray-200 rounded mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('all');
              }}
              className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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

        <footer className="mt-12 pb-8">
          <div className="border-t border-gray-200 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold">A</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900">AgriConnect</p>
                  <p className="text-sm text-gray-600">Connecting farmers across Uganda</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/about" className="text-sm text-gray-600 hover:text-emerald-600">
                  About
                </Link>
                <Link href="/contact" className="text-sm text-gray-600 hover:text-emerald-600">
                  Contact
                </Link>
                <Link href="/help" className="text-sm text-gray-600 hover:text-emerald-600">
                  Help
                </Link>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-8">© 2024 AgriConnect. All rights reserved.</p>
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
  const image = product.photo || getPlaceholderImage((product.crop_category || 'other').toLowerCase());

  return (
    <div
      onClick={onView}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-emerald-300 hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="relative aspect-square overflow-hidden">
        <img
          src={image}
          alt={product.crop_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        <div className="absolute top-2 left-2">
          <span className={`${qualityColors[product.quality] || 'bg-gray-800'} text-white px-2 py-1 rounded-lg text-xs font-semibold`}>
            {qualityLabels[product.quality] || product.quality}
          </span>
        </div>

        {product.distance_km != null && (
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium">
            {product.distance_km.toFixed(1)} km
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <p className="text-white font-bold text-lg">
            {formatPrice(product.price_per_unit)}
            <span className="text-sm font-normal ml-1">/{product.unit}</span>
          </p>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1 text-sm">{product.crop_name}</h3>
          {product.variety && <p className="text-gray-600 text-xs line-clamp-1">Variety: {product.variety}</p>}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{product.farmer_name}</p>
            <div className="flex items-center gap-1 text-gray-500 text-xs">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{product.farmer_location}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" />
            <span>
              {product.quantity} {product.unit}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(product.listed_at)}</span>
          </div>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCall}
            disabled={!safePhone(product.farmer_phone)}
            className="flex-1 bg-emerald-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <Phone className="w-3 h-3" />
            Call
          </button>
          <button
            onClick={onMessage}
            disabled={!safePhone(product.farmer_phone)}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
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
  const image = product.photo || getPlaceholderImage((product.crop_category || 'other').toLowerCase());

  return (
    <div
      onClick={onView}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex gap-4">
        <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
          <img src={image} alt={product.crop_name} className="w-full h-full object-cover" loading="lazy" />
          <span
            className={`absolute top-1 left-1 ${qualityColors[product.quality] || 'bg-gray-800'} text-white px-1.5 py-0.5 rounded text-xs font-semibold`}
          >
            {(qualityLabels[product.quality]?.charAt(0) || product.quality.charAt(0)).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2 gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{product.crop_name}</h3>
              {product.variety && <p className="text-gray-600 text-sm truncate">Variety: {product.variety}</p>}
            </div>
            <p className="font-bold text-gray-900 text-lg whitespace-nowrap">
              {formatPrice(product.price_per_unit)}
              <span className="text-sm font-normal ml-1">/{product.unit}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
              <User className="w-3 h-3 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">{product.farmer_name}</p>
            <span className="text-gray-400">•</span>
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <MapPin className="w-3 h-3" />
              <span>{product.farmer_location}</span>
            </div>
            {product.distance_km != null && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-sm text-gray-500">{product.distance_km.toFixed(1)} km</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                <span>
                  {product.quantity} {product.unit} available
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Listed {formatDate(product.listed_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onCall}
              disabled={!safePhone(product.farmer_phone)}
              className="flex-1 bg-emerald-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Call Farmer
            </button>
            <button
              onClick={onMessage}
              disabled={!safePhone(product.farmer_phone)}
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
