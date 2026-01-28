'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import {
  Plus,
  Search,
  MapPin,
  Package,
  DollarSign,
  X,
  Edit,
  Trash2,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
  Grid,
  List,
  ChevronDown,
  Target,
  RefreshCw,
  Loader2,
  Navigation,
  Check,
  Tag,
} from 'lucide-react';

/**
 * Buyer Demands UI (Buyers only)
 * - Frontend route guard: requires auth + profile.role === 'buyer'
 * - CRUD buyer_demands
 * - Leaflet picker modal (dynamic import; no SSR)
 * - Uses browser GPS for quick set + draggable marker for precision
 */

// ---------- Types ----------
type UUID = string;

interface AccountsUserRow {
  id: number;
  auth_user_id: UUID | null;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest';
  is_active: boolean;
  phone_number: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
}

interface BuyerDemand {
  id: UUID;
  buyer_id: UUID | null;
  buyer_name: string;
  crop_name: string;
  category_id: number | null;
  preferred_quality: 'top' | 'standard' | 'fair';
  quantity: number;
  unit: string;
  target_price_per_unit: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  radius_km: number;
  notes: string | null;
  status: 'open' | 'paused' | 'closed';
  created_at: string;
  updated_at: string;
  category?: { id: number; name: string } | null;
}

interface Category {
  id: number;
  name: string;
}

// ---------- Labels ----------
const unitLabels: Record<string, string> = {
  kg: 'kg',
  bag: 'bag',
  bunch: 'bunch',
  piece: 'piece',
  ton: 'ton',
  sack: 'sack',
  crate: 'crate',
};

const qualityLabels: Record<'top' | 'standard' | 'fair', string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

const qualityBadge: Record<'top' | 'standard' | 'fair', string> = {
  top: 'bg-gradient-to-r from-purple-500 to-pink-500',
  standard: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  fair: 'bg-gradient-to-r from-amber-500 to-orange-500',
};

const statusConfig: Record<
  'open' | 'paused' | 'closed',
  {
    label: string;
    Icon: any;
    pill: string;
  }
> = {
  open: { label: 'Active', Icon: CheckCircle, pill: 'bg-green-100 text-green-800 border-green-200' },
  paused: { label: 'Paused', Icon: Clock, pill: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  closed: { label: 'Closed', Icon: AlertCircle, pill: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const formatPrice = (price: number) => `UGX ${Number(price).toLocaleString('en-UG')}`;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ---------- Leaflet picker (dynamic; no SSR) ----------
const LocationPicker = dynamic(() => import('./_components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading map...
      </div>
    </div>
  ),
});

// ---------- Page ----------
export default function BuyerDemandsPage() {
  const router = useRouter();

  const [authUserId, setAuthUserId] = useState<UUID | null>(null);
  const [profile, setProfile] = useState<AccountsUserRow | null>(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingDemands, setLoadingDemands] = useState(false);

  const [demands, setDemands] = useState<BuyerDemand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [deleteId, setDeleteId] = useState<UUID | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paused' | 'closed'>('all');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'top' | 'standard' | 'fair'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'uncategorized' | string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high' | 'quantity' | 'name' | 'radius'>(
    'newest'
  );

  // Location picker modal
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Form
  const [selectedDemand, setSelectedDemand] = useState<BuyerDemand | null>(null);
  const [form, setForm] = useState({
    crop_name: '',
    category_id: '',
    preferred_quality: 'standard' as 'top' | 'standard' | 'fair',
    quantity: '',
    unit: 'kg',
    target_price_per_unit: '',
    location_text: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    radius_km: '20',
    notes: '',
    status: 'open' as 'open' | 'paused' | 'closed',
  });

  const resetForm = useCallback(() => {
    setForm({
      crop_name: '',
      category_id: '',
      preferred_quality: 'standard',
      quantity: '',
      unit: 'kg',
      target_price_per_unit: '',
      location_text: '',
      location_lat: null,
      location_lng: null,
      radius_km: '20',
      notes: '',
      status: 'open',
    });
  }, []);

  // ---------- Guard: buyers only ----------
  useEffect(() => {
    const run = async () => {
      setLoadingPage(true);

      const { data: auth } = await supabase.auth.getUser();
      const u = auth?.user;

      if (!u) {
        router.replace('/login');
        return;
      }

      const { data: prof, error } = await supabase
        .from('accounts_user')
        .select(
          'id,auth_user_id,email,first_name,last_name,role,is_active,phone_number,location,location_lat,location_lng'
        )
        .eq('auth_user_id', u.id)
        .single();

      if (error || !prof) {
        router.replace('/login');
        return;
      }

      if (prof.role !== 'buyer' || prof.is_active !== true) {
        router.replace('/unauthorized');
        return;
      }

      setAuthUserId(u.id);
      setProfile(prof as AccountsUserRow);
      setLoadingPage(false);
    };

    run();
  }, [router]);

  // ---------- Categories ----------
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('produce_categories')
        .select('id,name')
        .eq('is_active', true)
        .order('name');
      if (!error) setCategories((data as Category[]) || []);
    };
    fetchCategories();
  }, []);

  // ---------- Demands ----------
  const fetchDemands = useCallback(async () => {
    if (!authUserId) return;
    setLoadingDemands(true);

    const { data, error } = await supabase
      .from('buyer_demands')
      .select(
        `
        *,
        category:category_id (
          id,
          name
        )
      `
      )
      .eq('buyer_id', authUserId)
      .order('created_at', { ascending: false });

    if (!error) setDemands((data as BuyerDemand[]) || []);
    setLoadingDemands(false);
  }, [authUserId]);

  useEffect(() => {
    if (!authUserId) return;
    fetchDemands();
  }, [authUserId, fetchDemands]);

  // ---------- Derived stats ----------
  const stats = useMemo(() => {
    const active = demands.filter((d) => d.status === 'open').length;
    const totalValue = demands.reduce((sum, d) => sum + d.quantity * d.target_price_per_unit, 0);
    return { active, totalValue };
  }, [demands]);

  // ---------- Filtering ----------
  const filteredDemands = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();

    const out = demands
      .filter((d) => {
        if (statusFilter !== 'all' && d.status !== statusFilter) return false;
        if (qualityFilter !== 'all' && d.preferred_quality !== qualityFilter) return false;

        if (categoryFilter !== 'all') {
          if (categoryFilter === 'uncategorized' && d.category_id) return false;
          if (categoryFilter !== 'uncategorized' && (d.category_id?.toString() || '') !== categoryFilter) return false;
        }

        if (term) {
          const hay = [
            d.crop_name,
            d.location_text,
            d.notes,
            d.category?.name,
            d.preferred_quality,
            d.unit,
            d.buyer_name,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const words = term.split(/\s+/);
          if (!words.some((w) => hay.includes(w))) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return a.target_price_per_unit - b.target_price_per_unit;
          case 'price-high':
            return b.target_price_per_unit - a.target_price_per_unit;
          case 'quantity':
            return b.quantity - a.quantity;
          case 'name':
            return a.crop_name.localeCompare(b.crop_name);
          case 'radius':
            return a.radius_km - b.radius_km;
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

    return out;
  }, [demands, searchQuery, statusFilter, qualityFilter, categoryFilter, sortBy]);

  // ---------- Helpers ----------
  const buyerName = useMemo(() => {
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    return name || 'Anonymous Buyer';
  }, [profile]);

  const openCreate = () => {
    setSelectedDemand(null);
    resetForm();
    setModalMode('create');
    setModalOpen(true);
  };

  const openEdit = (d: BuyerDemand) => {
    setSelectedDemand(d);
    setForm({
      crop_name: d.crop_name,
      category_id: d.category_id?.toString() || '',
      preferred_quality: d.preferred_quality,
      quantity: String(d.quantity),
      unit: d.unit,
      target_price_per_unit: String(d.target_price_per_unit),
      location_text: d.location_text || '',
      location_lat: d.location_lat,
      location_lng: d.location_lng,
      radius_km: String(d.radius_km),
      notes: d.notes || '',
      status: d.status,
    });
    setModalMode('edit');
    setModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setQualityFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  // ---------- GPS quick set ----------
  const useGps = () => {
    if (!navigator.geolocation) {
      alert('GPS not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((p) => ({
          ...p,
          location_lat: pos.coords.latitude,
          location_lng: pos.coords.longitude,
        }));
      },
      () => alert('Unable to get location. Please allow location permission.'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ---------- CRUD ----------
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUserId) return;

    // basic validation for location
    if (!form.location_text.trim()) {
      alert('Please enter a delivery location name.');
      return;
    }

    const payload = {
      buyer_id: authUserId,
      buyer_name: buyerName,
      crop_name: form.crop_name.trim(),
      category_id: form.category_id ? Number(form.category_id) : null,
      preferred_quality: form.preferred_quality,
      quantity: Number(form.quantity),
      unit: form.unit,
      target_price_per_unit: Number(form.target_price_per_unit),
      location_text: form.location_text.trim() || null,
      location_lat: form.location_lat,
      location_lng: form.location_lng,
      radius_km: Number(form.radius_km),
      notes: form.notes.trim() || null,
      status: form.status,
    };

    try {
      if (modalMode === 'create') {
        const { data, error } = await supabase.from('buyer_demands').insert([payload]).select().single();
        if (error) throw error;

        setDemands((prev) => [data as BuyerDemand, ...prev]);
      } else if (modalMode === 'edit' && selectedDemand) {
        const { data, error } = await supabase
          .from('buyer_demands')
          .update({
            crop_name: payload.crop_name,
            category_id: payload.category_id,
            preferred_quality: payload.preferred_quality,
            quantity: payload.quantity,
            unit: payload.unit,
            target_price_per_unit: payload.target_price_per_unit,
            location_text: payload.location_text,
            location_lat: payload.location_lat,
            location_lng: payload.location_lng,
            radius_km: payload.radius_km,
            notes: payload.notes,
            status: payload.status,
          })
          .eq('id', selectedDemand.id)
          .select()
          .single();
        if (error) throw error;

        setDemands((prev) => prev.map((x) => (x.id === (data as BuyerDemand).id ? (data as BuyerDemand) : x)));
      }

      setModalOpen(false);
      resetForm();
      setSelectedDemand(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed. Please try again.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('buyer_demands').delete().eq('id', deleteId);
      if (error) throw error;

      setDemands((prev) => prev.filter((d) => d.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to delete.');
    }
  };

  // ---------- Render ----------
  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Buyer Demands</h1>
              <p className="text-gray-600 mt-1">Post what you need and let farmers find you</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Clear Filters
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                New Demand
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Active Demands"
            value={String(stats.active)}
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            iconBg="bg-green-100"
          />
          <StatCard
            label="Total Value"
            value={`UGX ${stats.totalValue.toLocaleString('en-UG')}`}
            icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            label="Avg. Response"
            value="24h"
            icon={<Clock className="w-5 h-5 text-purple-600" />}
            iconBg="bg-purple-100"
          />
          <StatCard
            label="Match Rate"
            value="85%"
            icon={<Target className="w-5 h-5 text-amber-600" />}
            iconBg="bg-amber-100"
          />
        </div>

        {/* Search + controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by crop, location, notes, category..."
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600 mt-2">
                  Found {filteredDemands.length} demand{filteredDemands.length === 1 ? '' : 's'} for "
                  <span className="font-semibold">{searchQuery}</span>"
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                  showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-gray-300 text-gray-700'
                }`}
              >
                <Filter className="w-5 h-5" />
                <span className="font-medium">Filters</span>
                <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2 py-1 rounded-full">
                  {[statusFilter, qualityFilter, categoryFilter].filter((f) => f !== 'all').length}
                </span>
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                  aria-label="Grid view"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                  aria-label="List view"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'open', 'paused', 'closed'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          statusFilter === s
                            ? s === 'all'
                              ? 'bg-gray-800 text-white'
                              : `${statusConfig[s].pill}`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {s === 'all' ? 'All Status' : statusConfig[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
                  <div className="flex flex-wrap gap-2">
                    {(['all', 'top', 'standard', 'fair'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQualityFilter(q)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          qualityFilter === q
                            ? q === 'all'
                              ? 'bg-gray-800 text-white'
                              : `${qualityBadge[q as 'top' | 'standard' | 'fair']} text-white`
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {q === 'all' ? 'All Quality' : qualityLabels[q as 'top' | 'standard' | 'fair']}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <div className="relative">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value as any)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none appearance-none bg-white"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                      <option value="uncategorized">Uncategorized</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Sort */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'newest', label: 'Newest' },
                    { id: 'price-low', label: 'Price: Low to High' },
                    { id: 'price-high', label: 'Price: High to Low' },
                    { id: 'quantity', label: 'Quantity: High to Low' },
                    { id: 'name', label: 'Crop Name A-Z' },
                    { id: 'radius', label: 'Small Radius First' },
                  ].map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setSortBy(o.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        sortBy === o.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {loadingDemands ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
            <p className="text-gray-600">Loading your demands...</p>
          </div>
        ) : filteredDemands.length === 0 ? (
          <EmptyState onCreate={openCreate} hasSearch={!!searchQuery} />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDemands.map((d) => (
              <DemandCard key={d.id} demand={d} onEdit={() => openEdit(d)} onDelete={() => setDeleteId(d.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDemands.map((d) => (
              <DemandListItem key={d.id} demand={d} onEdit={() => openEdit(d)} onDelete={() => setDeleteId(d.id)} />
            ))}
          </div>
        )}

        {/* Tips */}
        <div className="mt-12 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl border border-emerald-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Tips for Better Matches
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TipCard title="Set Competitive Prices" icon={<DollarSign className="w-5 h-5 text-emerald-600" />} />
            <TipCard title="Specify Location" icon={<MapPin className="w-5 h-5 text-blue-600" />} />
            <TipCard title="Be Specific" icon={<Package className="w-5 h-5 text-purple-600" />} />
            <TipCard title="Update Regularly" icon={<RefreshCw className="w-5 h-5 text-amber-600" />} />
          </div>
        </div>
      </main>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <DemandModal
          mode={modalMode}
          title={modalMode === 'create' ? 'Create New Demand' : 'Edit Demand'}
          submitText={modalMode === 'create' ? 'Create Demand' : 'Update Demand'}
          onClose={() => {
            setModalOpen(false);
            setSelectedDemand(null);
            resetForm();
          }}
          onSubmit={submit}
          form={form}
          setForm={setForm}
          categories={categories}
          onOpenMap={() => setShowLocationPicker(true)}
          onUseGps={useGps}
        />
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <ModalShell
          title="Pick delivery point"
          subtitle="Drag the marker to adjust the exact delivery location"
          onClose={() => setShowLocationPicker(false)}
        >
          <LocationPicker
            initialLat={form.location_lat ?? profile?.location_lat ?? 0.3476} // Kampala fallback-ish
            initialLng={form.location_lng ?? profile?.location_lng ?? 32.5825}
            onPick={(lat, lng) => setForm((p) => ({ ...p, location_lat: lat, location_lng: lng }))}
            onUseGps={() => useGps()}
          />
          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              onClick={() => setShowLocationPicker(false)}
              className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </ModalShell>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Demand</h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">Are you sure you want to delete this demand?</p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Small UI components ----------
function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>{icon}</div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, hasSearch }: { onCreate: () => void; hasSearch: boolean }) {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Package className="w-8 h-8 text-emerald-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No demands found</h3>
      <p className="text-gray-600 mb-6">
        {hasSearch ? 'No demands match your search. Try different keywords.' : "You haven't created any demands yet."}
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Create Demand
      </button>
    </div>
  );
}

function TipCard({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4">
      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-3">{icon}</div>
      <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-600">Improve your chances of getting offers quickly</p>
    </div>
  );
}

// ---------- Demand cards ----------
function DemandCard({
  demand,
  onEdit,
  onDelete,
}: {
  demand: BuyerDemand;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { Icon, label, pill } = statusConfig[demand.status];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 border ${pill}`}>
                <Icon className="w-3 h-3" />
                {label}
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${qualityBadge[demand.preferred_quality]}`}>
                {qualityLabels[demand.preferred_quality]}
              </span>
            </div>

            <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors truncate">
              {demand.crop_name}
            </h3>

            {demand.category && (
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {demand.category.name}
              </p>
            )}
          </div>

          <div className="flex gap-1">
            <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit demand">
              <Edit className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete demand">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Quantity</p>
              <p className="text-lg font-bold text-gray-900">
                {demand.quantity.toLocaleString()} {unitLabels[demand.unit] || demand.unit}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Target Price</p>
              <p className="text-lg font-bold text-emerald-600">
                {formatPrice(demand.target_price_per_unit)}/{unitLabels[demand.unit] || demand.unit}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{demand.location_text || 'Location not set'}</span>
            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Within {demand.radius_km}km</span>
          </div>

          {demand.notes && (
            <div className="text-sm text-gray-600 border-l-2 border-emerald-500 pl-3 py-1">
              <p className="line-clamp-2">{demand.notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(demand.created_at)}</span>
            </div>
            <button className="text-emerald-600 hover:text-emerald-700 font-medium text-xs">View Offers</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemandListItem({
  demand,
  onEdit,
  onDelete,
}: {
  demand: BuyerDemand;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { Icon, label, pill } = statusConfig[demand.status];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 border ${pill}`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium text-white ${qualityBadge[demand.preferred_quality]}`}>
              {qualityLabels[demand.preferred_quality]}
            </span>
            {demand.category && (
              <span className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">{demand.category.name}</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-bold text-gray-900 text-lg truncate">{demand.crop_name}</h3>
              <p className="text-sm text-gray-600 mt-1">Crop</p>
            </div>

            <div>
              <p className="font-bold text-gray-900">
                {demand.quantity.toLocaleString()} {unitLabels[demand.unit] || demand.unit}
              </p>
              <p className="text-sm text-gray-600">Quantity</p>
            </div>

            <div>
              <p className="font-bold text-emerald-600">
                {formatPrice(demand.target_price_per_unit)}/{unitLabels[demand.unit] || demand.unit}
              </p>
              <p className="text-sm text-gray-600">Target Price</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{demand.location_text || 'No location'}</span>
            </div>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded">Within {demand.radius_km}km</span>
            {demand.notes && <span className="text-sm text-gray-500 truncate">{demand.notes}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Modal Shell ----------
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="text-gray-600 text-sm mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---------- Demand Modal ----------
function DemandModal({
  mode,
  title,
  submitText,
  onClose,
  onSubmit,
  form,
  setForm,
  categories,
  onOpenMap,
  onUseGps,
}: {
  mode: 'create' | 'edit';
  title: string;
  submitText: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  form: any;
  setForm: (v: any) => void;
  categories: Category[];
  onOpenMap: () => void;
  onUseGps: () => void;
}) {
  return (
    <ModalShell title={title} subtitle="Fill in your buying requirements" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Crop */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Crop Name *</label>
            <input
              required
              value={form.crop_name}
              onChange={(e) => setForm({ ...form, crop_name: e.target.value })}
              placeholder="e.g., Maize, Beans, Tomatoes"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              <option value="">Select category (optional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quality Preference *</label>
            <div className="flex gap-2">
              {(['top', 'standard', 'fair'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setForm({ ...form, preferred_quality: q })}
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    form.preferred_quality === q
                      ? `${qualityBadge[q]} text-white border-transparent`
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {qualityLabels[q]}
                </button>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
            <select
              required
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            >
              {Object.entries(unitLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="e.g., 100"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Price (UGX) *</label>
            <div className="relative">
              <input
                type="number"
                required
                min="1"
                value={form.target_price_per_unit}
                onChange={(e) => setForm({ ...form, target_price_per_unit: e.target.value })}
                placeholder="e.g., 2000"
                className="w-full pl-3 pr-16 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                /{unitLabels[form.unit] || form.unit}
              </span>
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Radius (km) *</label>
            <input
              type="number"
              required
              min="1"
              max="500"
              value={form.radius_km}
              onChange={(e) => setForm({ ...form, radius_km: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location *</label>
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <div className="flex-1">
              <input
                required
                value={form.location_text}
                onChange={(e) => setForm({ ...form, location_text: e.target.value })}
                placeholder="e.g., Kampala, Nakawa Market"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            <button
              type="button"
              onClick={onUseGps}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Navigation className="w-4 h-4" />
              Use GPS
            </button>

            <button
              type="button"
              onClick={onOpenMap}
              className="px-4 py-2.5 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <MapPin className="w-4 h-4" />
              Pick on Map
            </button>
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
            <span>Farmers within {form.radius_km}km will see this demand.</span>
            <span className="bg-gray-100 px-2 py-1 rounded">
              Lat/Lng:{' '}
              {form.location_lat && form.location_lng
                ? `${form.location_lat.toFixed(5)}, ${form.location_lng.toFixed(5)}`
                : 'Not set'}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any specific requirements, delivery preferences, or notes for farmers..."
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
          <div className="flex gap-2">
            {(['open', 'paused', 'closed'] as const).map((s) => {
              const C = statusConfig[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    form.status === s ? `border-transparent ${C.pill}` : 'border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <C.Icon className="w-4 h-4" />
                  {C.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            {mode === 'create' ? <Plus className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            {submitText}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
