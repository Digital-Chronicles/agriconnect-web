'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import {
  Search,
  Filter,
  MapPin,
  Users,
  Package,
  Navigation,
  Send,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

interface ListingRow {
  id: string;
  farmer_id: string | null;
  crop_name: string;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  location_lat: number | null;
  location_lng: number | null;
  farmer_location: string | null;
  is_available: boolean;
  listed_at: string;
}

interface BuyerDemandRow {
  id: string;
  buyer_id: string | null;
  buyer_name: string;
  crop_name: string;
  preferred_quality: 'top' | 'standard' | 'fair' | string;
  quantity: number;
  unit: string;
  target_price_per_unit: number;
  radius_km: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  status: 'open' | 'paused' | 'closed';
  created_at: string;
}

const formatPrice = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-UG')}`;

const qualityColors: Record<string, string> = {
  top: 'bg-emerald-100 text-emerald-800',
  standard: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
};

const qualityLabels: Record<string, string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

function calcDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function relativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
  return `${Math.floor(diffHours / 168)}w ago`;
}

export default function MarketplacePage() {
  const router = useRouter();

  const [authId, setAuthId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [listings, setListings] = useState<ListingRow[]>([]);
  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);

  const [sellerLocation, setSellerLocation] = useState<{ lat: number; lng: number; source: string } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState(30);
  const [minPrice, setMinPrice] = useState<string>(''); // UGX per unit
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'top' | 'standard' | 'fair'>('all');
  const [sortBy, setSortBy] = useState<'distance' | 'newest' | 'price-low' | 'price-high'>('distance');

  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === selectedListingId) || listings[0] || null,
    [listings, selectedListingId]
  );

  // --- bootstrap auth id
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) console.error('auth.getUser error', error);
      setAuthId(data.user?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- load listings (farmer’s products) + buyer demands
  useEffect(() => {
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        // Farmer listings (only if logged in)
        if (authId) {
          const { data: listingsData, error: listingsErr } = await supabase
            .from('farm_produce')
            .select('id, farmer_id, crop_name, quality, quantity, unit, price_per_unit, location_lat, location_lng, farmer_location, is_available, listed_at')
            .eq('farmer_id', authId)
            .eq('is_available', true)
            .order('listed_at', { ascending: false });

          if (!alive) return;
          if (listingsErr) console.error('listings load error:', listingsErr);
          setListings((listingsData as ListingRow[]) || []);
        } else {
          if (!alive) return;
          setListings([]);
        }

        // Buyer demands (public marketplace - open only)
        const { data: demandsData, error: demandsErr } = await supabase
          .from('buyer_demands')
          .select('id,buyer_id,buyer_name,crop_name,preferred_quality,quantity,unit,target_price_per_unit,radius_km,location_text,location_lat,location_lng,notes,status,created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (!alive) return;
        if (demandsErr) console.error('demands load error:', demandsErr);
        setDemands((demandsData as BuyerDemandRow[]) || []);
      } catch (e) {
        if (!alive) return;
        console.error(e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [authId]);

  // --- determine seller location (listing -> profile -> browser)
  useEffect(() => {
    let alive = true;

    const determineLocation = async () => {
      setLocationError(null);

      // 1) from selected listing
      const chosen = selectedListing;
      if (chosen?.location_lat && chosen?.location_lng) {
        if (!alive) return;
        setSellerLocation({ lat: chosen.location_lat, lng: chosen.location_lng, source: 'listing' });
        return;
      }

      // 2) from profile
      if (authId) {
        const { data: profile, error } = await supabase
          .from('accounts_user')
          .select('location_lat, location_lng')
          .eq('auth_user_id', authId)
          .maybeSingle();

        if (!alive) return;

        if (error) console.error('profile location error:', error);

        if (profile?.location_lat && profile?.location_lng) {
          setSellerLocation({ lat: profile.location_lat, lng: profile.location_lng, source: 'profile' });
          return;
        }
      }

      // 3) browser geolocation
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!alive) return;
            setSellerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'browser' });
          },
          () => {
            if (!alive) return;
            setSellerLocation(null);
            setLocationError('Location access denied. Enable location for accurate nearby buyer demands.');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        if (!alive) return;
        setSellerLocation(null);
        setLocationError('Geolocation not supported in this browser.');
      }
    };

    // run if we have any demands (so distance sort makes sense), or if listings change
    if (demands.length > 0 || listings.length > 0) determineLocation();

    return () => {
      alive = false;
    };
  }, [authId, demands.length, selectedListingId, listings.length]); // keep dependencies light

  // --- realtime refresh (optional, safe)
  useEffect(() => {
    let alive = true;

    const channel = supabase
      .channel('marketplace-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyer_demands' }, async () => {
        const { data } = await supabase
          .from('buyer_demands')
          .select('id,buyer_id,buyer_name,crop_name,preferred_quality,quantity,unit,target_price_per_unit,radius_km,location_text,location_lat,location_lng,notes,status,created_at')
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        if (!alive) return;
        setDemands((data as BuyerDemandRow[]) || []);
      })
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredDemands = useMemo(() => {
    const s = search.trim().toLowerCase();
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;

    return demands
      .map((d) => {
        let distance: number | null = null;
        if (sellerLocation && d.location_lat && d.location_lng) {
          distance = calcDistanceKm(sellerLocation.lat, sellerLocation.lng, d.location_lat, d.location_lng);
        }
        return { demand: d, distance };
      })
      .filter(({ demand, distance }) => {
        // search text
        const matchesSearch =
          !s ||
          demand.crop_name.toLowerCase().includes(s) ||
          demand.buyer_name.toLowerCase().includes(s) ||
          (demand.location_text || '').toLowerCase().includes(s);

        // radius (your filter)
        const matchesRadius = distance === null || distance <= radiusKm;

        // quality filter
        const matchesQuality = qualityFilter === 'all' || demand.preferred_quality === qualityFilter;

        // price range filter (target price)
        const price = Number(demand.target_price_per_unit || 0);
        const matchesMin = min === null || price >= min;
        const matchesMax = max === null || price <= max;

        return matchesSearch && matchesRadius && matchesQuality && matchesMin && matchesMax;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.demand.created_at).getTime() - new Date(a.demand.created_at).getTime();
        if (sortBy === 'price-low') return a.demand.target_price_per_unit - b.demand.target_price_per_unit;
        if (sortBy === 'price-high') return b.demand.target_price_per_unit - a.demand.target_price_per_unit;

        // default: distance
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [demands, search, radiusKm, minPrice, maxPrice, qualityFilter, sortBy, sellerLocation]);

  const resetFilters = () => {
    setSearch('');
    setRadiusKm(30);
    setMinPrice('');
    setMaxPrice('');
    setQualityFilter('all');
    setSortBy('distance');
  };

  const handleSendOffer = async (demandId: string) => {
    if (!authId) {
      alert('Please login to send offers');
      router.push('/login');
      return;
    }
    if (!selectedListing) {
      alert('Please create/select a listing first');
      router.push('/products');
      return;
    }

    const payload = {
      demand_id: demandId,
      listing_id: selectedListing.id,
      farmer_id: authId,
      farmer_name: 'Farmer',
      crop_name: selectedListing.crop_name,
      offered_quantity: selectedListing.quantity,
      offered_price_per_unit: selectedListing.price_per_unit,
      status: 'sent',
    };

    const { error } = await supabase.from('demand_offers').insert(payload);
    if (error) {
      console.error(error);
      alert('Failed to send offer');
      return;
    }
    alert('Offer sent successfully!');
  };

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-4 bg-gray-200 rounded w-96" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Marketplace</h1>
          <p className="text-gray-600 mt-2">See active buyer demands and send offers from your listings.</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
              <Users className="w-4 h-4" />
              {demands.length} open demands
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
              <Package className="w-4 h-4" />
              {listings.length} your listings
            </span>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">
              <Navigation className="w-4 h-4" />
              Radius: {radiusKm} km
            </span>

            {sellerLocation?.source && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                <MapPin className="w-4 h-4" />
                Location source: {sellerLocation.source}
              </span>
            )}
          </div>

          {locationError && (
            <div className="mt-3 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{locationError}</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search crop, buyer, location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <button
              onClick={() => setShowFilters((s) => !s)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span className="font-medium">Filters</span>
            </button>

            <button
              onClick={resetFilters}
              className="px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 font-medium"
            >
              Reset
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Radius */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Radius: {radiusKm}km</label>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1</span>
                    <span>200</span>
                  </div>
                </div>

                {/* Min price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Target Price (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl"
                    placeholder="e.g. 500"
                  />
                </div>

                {/* Max price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Target Price (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl"
                    placeholder="e.g. 5000"
                  />
                </div>

                {/* Quality */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
                  <select
                    value={qualityFilter}
                    onChange={(e) => setQualityFilter(e.target.value as any)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white"
                  >
                    <option value="all">All</option>
                    <option value="top">Premium</option>
                    <option value="standard">Standard</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-600 flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  Sort by
                </span>
                {[
                  { id: 'distance', label: 'Distance' },
                  { id: 'newest', label: 'Newest' },
                  { id: 'price-low', label: 'Price Low→High' },
                  { id: 'price-high', label: 'Price High→Low' },
                ].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSortBy(o.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border ${
                      sortBy === o.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {/* Listing selector */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Select listing to use when sending offers</label>
                  <Link href="/products" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    Manage listings <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {listings.length === 0 ? (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <AlertCircle className="w-5 h-5 mt-0.5" />
                    <div className="text-sm">
                      You have no active listings. Create a listing to send offers.
                      <div className="mt-2">
                        <Link
                          href="/products"
                          className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700"
                        >
                          <Package className="w-4 h-4" />
                          Create Listing
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedListingId || listings[0].id}
                    onChange={(e) => setSelectedListingId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
                  >
                    {listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.crop_name} • {formatPrice(l.price_per_unit)}/{l.unit} • {l.quantity} {l.unit}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Demands */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Buyer Demands ({filteredDemands.length})</h2>
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {sellerLocation ? 'Distances available' : 'Distances unavailable'}
          </div>
        </div>

        {filteredDemands.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No demands found</h3>
            <p className="text-gray-600 mb-4">Try changing filters (radius/price/quality) or search.</p>
            <button
              onClick={resetFilters}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-emerald-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDemands.map(({ demand, distance }) => (
              <div key={demand.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100">
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{demand.crop_name}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{relativeTime(demand.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span className="font-medium">{demand.buyer_name}</span>
                    {distance !== null && (
                      <>
                        <span className="text-gray-300">•</span>
                        <MapPin className="w-4 h-4" />
                        <span>{distance.toFixed(1)} km</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Quantity</p>
                      <p className="font-semibold text-gray-900">
                        {demand.quantity} {demand.unit}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Target Price</p>
                      <p className="font-semibold text-gray-900">{formatPrice(demand.target_price_per_unit)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Quality</p>
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          qualityColors[demand.preferred_quality] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {qualityLabels[demand.preferred_quality] || demand.preferred_quality}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Buyer Radius</p>
                      <p className="font-semibold text-gray-900">{demand.radius_km} km</p>
                    </div>
                  </div>

                  {demand.location_text && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="line-clamp-1">{demand.location_text}</span>
                    </div>
                  )}

                  {demand.notes && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Notes</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{demand.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendOffer(demand.id)}
                      disabled={!authId || !selectedListing}
                      className="flex-1 bg-emerald-600 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      Send Offer
                    </button>

                    {demand.location_lat && demand.location_lng && (
                      <a
                        href={`https://maps.google.com/?q=${demand.location_lat},${demand.location_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center"
                        title="View on map"
                      >
                        <Navigation className="w-4 h-4 text-gray-700" />
                      </a>
                    )}
                  </div>

                  {selectedListing && (
                    <div className="mt-3 text-xs text-gray-500">
                      Using: <span className="font-medium">{selectedListing.crop_name}</span> • {formatPrice(selectedListing.price_per_unit)}/{selectedListing.unit}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 bg-gray-900 text-white rounded-2xl p-6">
          <h4 className="font-bold text-lg mb-3">Tips</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Use browser location to see nearest buyers first.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Set min/max target price to find best-paying buyers.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Create accurate listings so your offers are accepted quickly.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
