'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import {
  MapPin,
  Users,
  Package,
  Send,
  Search,
  Image as ImageIcon,
  Navigation,
  Sparkles,
  Filter,
  Leaf,
} from 'lucide-react';

interface ListingRow {
  id: string;
  crop_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  location_lat: number | null;
  location_lng: number | null;
  farmer_location: string | null;
  listed_at: string;
}

interface BuyerDemandRow {
  id: string;
  buyer_name: string;
  crop_name: string;
  preferred_quality: string;
  quantity: number;
  unit: string;
  target_price_per_unit: number;
  radius_km: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  image_urls?: string[] | null;
}

const formatPrice = (n: number) =>
  `UGX ${Number(n || 0).toLocaleString('en-UG')}`;

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
};

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function demandImageFallback(cropName: string) {
  const key = cropName.toLowerCase();

  if (key.includes('coffee')) {
    return 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&h=600&fit=crop';
  }
  if (key.includes('maize') || key.includes('corn')) {
    return 'https://images.unsplash.com/photo-1601593768799-76d2e4f7c1a9?w=800&h=600&fit=crop';
  }
  if (key.includes('beans')) {
    return 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=800&h=600&fit=crop';
  }
  if (key.includes('banana') || key.includes('matooke')) {
    return 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&h=600&fit=crop';
  }
  if (key.includes('rice')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop';
  }

  return 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop';
}

function cropAccent(cropName: string) {
  const key = cropName.toLowerCase();

  if (key.includes('coffee')) {
    return {
      badge: 'bg-amber-100 text-amber-700 border-amber-200',
      glow: 'from-amber-500/20 via-orange-500/10 to-transparent',
    };
  }
  if (key.includes('maize') || key.includes('corn')) {
    return {
      badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      glow: 'from-yellow-500/20 via-lime-500/10 to-transparent',
    };
  }
  if (key.includes('beans')) {
    return {
      badge: 'bg-rose-100 text-rose-700 border-rose-200',
      glow: 'from-rose-500/20 via-pink-500/10 to-transparent',
    };
  }
  if (key.includes('banana') || key.includes('matooke')) {
    return {
      badge: 'bg-lime-100 text-lime-700 border-lime-200',
      glow: 'from-lime-500/20 via-green-500/10 to-transparent',
    };
  }
  if (key.includes('rice')) {
    return {
      badge: 'bg-sky-100 text-sky-700 border-sky-200',
      glow: 'from-sky-500/20 via-cyan-500/10 to-transparent',
    };
  }

  return {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    glow: 'from-emerald-500/20 via-green-500/10 to-transparent',
  };
}

export default function MarketplacePage() {
  const [authId, setAuthId] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sellerLocation, setSellerLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [search, setSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState(30);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);
  const [sendingDemandId, setSendingDemandId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setAuthId(data.user?.id ?? null);
    }

    loadUser();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);

      try {
        const [listingsRes, demandsRes] = await Promise.all([
          authId
            ? supabase
                .from('farm_produce')
                .select(
                  'id,crop_name,quantity,unit,price_per_unit,location_lat,location_lng,farmer_location,listed_at'
                )
                .eq('farmer_id', authId)
                .eq('is_available', true)
                .order('listed_at', { ascending: false })
            : Promise.resolve({ data: [] as ListingRow[] }),

          supabase
            .from('buyer_demands')
            .select(
              'id,buyer_name,crop_name,preferred_quality,quantity,unit,target_price_per_unit,radius_km,location_text,location_lat,location_lng,notes,status,created_at,image_urls'
            )
            .eq('status', 'open')
            .order('created_at', { ascending: false }),
        ]);

        if (!alive) return;

        const loadedListings = (listingsRes.data as ListingRow[]) || [];
        const loadedDemands = (demandsRes.data as BuyerDemandRow[]) || [];

        setListings(loadedListings);
        setDemands(loadedDemands);

        if (loadedListings.length > 0) {
          setSelectedListing(loadedListings[0].id);
        } else {
          setSelectedListing(null);
        }
      } catch (error) {
        console.error('Failed to load marketplace:', error);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [authId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSellerLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // silently ignore if blocked
      }
    );
  }, []);

  const selectedListingData = useMemo(
    () => listings.find((item) => item.id === selectedListing) || null,
    [listings, selectedListing]
  );

  const filteredDemands = useMemo(() => {
    const s = search.toLowerCase().trim();

    return demands
      .map((demand) => {
        let distance: number | null = null;

        if (
          sellerLocation &&
          demand.location_lat !== null &&
          demand.location_lng !== null
        ) {
          distance = distanceKm(
            sellerLocation.lat,
            sellerLocation.lng,
            demand.location_lat,
            demand.location_lng
          );
        }

        return { demand, distance };
      })
      .filter(({ demand, distance }) => {
        const textMatch =
          !s ||
          demand.crop_name.toLowerCase().includes(s) ||
          demand.buyer_name.toLowerCase().includes(s) ||
          (demand.location_text || '').toLowerCase().includes(s) ||
          (demand.preferred_quality || '').toLowerCase().includes(s);

        const radiusMatch = distance === null || distance <= radiusKm;

        return textMatch && radiusMatch;
      })
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [demands, search, radiusKm, sellerLocation]);

  async function sendOffer(demandId: string) {
    if (!authId) {
      alert('Please login first.');
      return;
    }

    if (!selectedListing) {
      alert('Please select one of your listings first.');
      return;
    }

    const listing = listings.find((item) => item.id === selectedListing);
    if (!listing) return;

    try {
      setSendingDemandId(demandId);

      const payload = {
        demand_id: demandId,
        listing_id: listing.id,
        farmer_id: authId,
        crop_name: listing.crop_name,
        offered_quantity: listing.quantity,
        offered_price_per_unit: listing.price_per_unit,
        status: 'sent',
      };

      const { error } = await supabase.from('demand_offers').insert(payload);

      if (error) {
        alert('Failed to send offer.');
        return;
      }

      alert('Offer sent successfully!');
    } catch (error) {
      console.error('Send offer failed:', error);
      alert('Something went wrong while sending the offer.');
    } finally {
      setSendingDemandId(null);
    }
  }

  const totalOpenDemands = filteredDemands.length;
  const nearbyCount = filteredDemands.filter(
    (item) => item.distance !== null && item.distance <= radiusKm
  ).length;
  const avgTargetPrice =
    filteredDemands.length > 0
      ? Math.round(
          filteredDemands.reduce(
            (sum, item) => sum + Number(item.demand.target_price_per_unit || 0),
            0
          ) / filteredDemands.length
        )
      : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-lime-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-14">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-2xl bg-emerald-100" />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="h-28 rounded-3xl bg-white shadow-sm" />
              <div className="h-28 rounded-3xl bg-white shadow-sm" />
              <div className="h-28 rounded-3xl bg-white shadow-sm" />
            </div>
            <div className="h-16 rounded-3xl bg-white shadow-sm" />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-[430px] rounded-3xl bg-white shadow-sm" />
              <div className="h-[430px] rounded-3xl bg-white shadow-sm" />
              <div className="h-[430px] rounded-3xl bg-white shadow-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-lime-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-r from-emerald-600 via-green-600 to-lime-500 p-6 sm:p-8 text-white shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.16),transparent_25%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4" />
                AgriConnect Farmer Market
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Find active buyer demands and send offers faster
              </h1>

              <p className="mt-3 max-w-xl text-sm text-emerald-50 sm:text-base">
                Match your available produce with nearby buyers, compare target
                prices, and respond directly from one beautiful marketplace.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-emerald-100">
                  Open Demands
                </p>
                <p className="mt-2 text-2xl font-bold">{totalOpenDemands}</p>
              </div>

              <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-emerald-100">
                  Nearby Matches
                </p>
                <p className="mt-2 text-2xl font-bold">{nearbyCount}</p>
              </div>

              <div className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wide text-emerald-100">
                  Avg Target Price
                </p>
                <p className="mt-2 text-xl font-bold">
                  {avgTargetPrice ? formatPrice(avgTargetPrice) : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-emerald-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search crop, buyer, quality or location..."
                  className="w-full rounded-2xl border border-emerald-100 bg-emerald-50/50 py-3 pl-12 pr-4 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <Filter className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700">Radius</span>
                <input
                  type="range"
                  min="1"
                  max="200"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-28 accent-emerald-600"
                />
                <span className="min-w-[52px] text-sm font-semibold text-emerald-700">
                  {radiusKm} km
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                {filteredDemands.length} matches
              </span>
              <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">
                Search by crop or buyer
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                Location-aware results
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Listing used for offers
              </h2>
            </div>

            {listings.length > 0 ? (
              <>
                <select
                  value={selectedListing || listings[0].id}
                  onChange={(e) => setSelectedListing(e.target.value)}
                  className="mt-4 w-full rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                >
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.crop_name} • {formatPrice(listing.price_per_unit)}/
                      {listing.unit} • {listing.quantity} {listing.unit}
                    </option>
                  ))}
                </select>

                {selectedListingData && (
                  <div className="mt-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-lime-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                      Selected Listing
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">
                      {selectedListingData.crop_name}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 text-slate-700 shadow-sm">
                        {selectedListingData.quantity} {selectedListingData.unit}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-emerald-700 shadow-sm font-semibold">
                        {formatPrice(selectedListingData.price_per_unit)}/
                        {selectedListingData.unit}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                You do not have any active produce listings yet. Add a listing
                first so you can send offers to buyers.
              </div>
            )}
          </div>
        </div>

        {filteredDemands.length === 0 ? (
          <div className="mt-8 rounded-[28px] border border-emerald-100 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-5 text-xl font-bold text-slate-900">
              No buyer demands found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Try adjusting your search text or increasing your radius to discover
              more demand opportunities.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredDemands.map(({ demand, distance }) => {
              const gallery =
                demand.image_urls && demand.image_urls.length > 0
                  ? demand.image_urls
                  : [demandImageFallback(demand.crop_name)];

              const coverImage = gallery[0];
              const accent = cropAccent(demand.crop_name);
              const isSending = sendingDemandId === demand.id;

              return (
                <article
                  key={demand.id}
                  className="group overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <div
                      className={`absolute inset-0 bg-gradient-to-tr ${accent.glow} z-10`}
                    />
                    <img
                      src={coverImage}
                      alt={demand.crop_name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${accent.badge}`}
                      >
                        <Package className="h-3.5 w-3.5" />
                        {demand.quantity} {demand.unit}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                        {demand.preferred_quality}
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 z-20">
                      <div className="rounded-2xl bg-black/35 p-3 text-white backdrop-blur-md">
                        <h3 className="line-clamp-1 text-lg font-bold">
                          {demand.crop_name}
                        </h3>
                        <p className="mt-1 flex items-center gap-2 text-sm text-white/90">
                          <Users className="h-4 w-4" />
                          Buyer: {demand.buyer_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-emerald-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Target Price
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                          {formatPrice(demand.target_price_per_unit)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-sky-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Distance
                        </p>
                        <p className="mt-1 text-lg font-bold text-sky-700">
                          {distance !== null ? `${distance.toFixed(1)} km` : 'Unknown'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-amber-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Buyer Radius
                        </p>
                        <p className="mt-1 text-base font-bold text-amber-700">
                          {demand.radius_km} km
                        </p>
                      </div>

                      <div className="rounded-2xl bg-violet-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Posted
                        </p>
                        <p className="mt-1 text-base font-bold text-violet-700">
                          {formatDate(demand.created_at)}
                        </p>
                      </div>
                    </div>

                    {gallery.length > 1 && (
                      <div className="mt-5">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <ImageIcon className="h-4 w-4 text-emerald-600" />
                          Product Images
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {gallery.slice(0, 4).map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                            >
                              <img
                                src={url}
                                alt={`${demand.crop_name} ${index + 1}`}
                                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {demand.location_text && (
                      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                        <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                        <span className="line-clamp-2">{demand.location_text}</span>
                      </div>
                    )}

                    {demand.notes && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Buyer Notes
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-700">
                          {demand.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => sendOffer(demand.id)}
                        disabled={!authId || !selectedListing || isSending}
                        className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="inline-flex items-center justify-center gap-2">
                          <Send className="h-4 w-4" />
                          {isSending ? 'Sending...' : 'Send Offer'}
                        </span>
                      </button>

                      {demand.location_lat && demand.location_lng && (
                        <a
                          href={`https://maps.google.com/?q=${demand.location_lat},${demand.location_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 transition hover:bg-slate-50"
                          title="View on map"
                        >
                          <Navigation className="h-4 w-4" />
                        </a>
                      )}
                    </div>

                    {selectedListingData && (
                      <div className="mt-3 rounded-2xl bg-emerald-50/70 px-3 py-2 text-xs text-slate-600">
                        Using listing:{' '}
                        <span className="font-semibold text-emerald-700">
                          {selectedListingData.crop_name}
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}