'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import {
  Search,
  MapPin,
  Filter,
  Navigation,
  Package,
  User,
  DollarSign,
  Loader2,
  ZoomIn,
  ZoomOut,
  Target,
  Maximize2,
} from 'lucide-react';

type L = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type DivIcon = import('leaflet').DivIcon;

interface ProduceRow {
  id: string;
  farmer_name: string | null;
  farmer_location: string | null;
  crop_name: string | null;
  crop_category: string | null;
  variety: string | null;
  quality: string | null;
  quantity: number | null;
  unit: string | null;
  price_per_unit: number | null;
  photo: string | null;
  farmer_phone: string | null;
  location_lat: number | null;
  location_lng: number | null;
  google_maps_link: string | null;
  is_available: boolean | null;
  listed_at: string | null;
}

export type ProductPin = {
  id: string;
  crop_name: string;
  crop_category: string;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  farmer_name: string;
  farmer_location: string;
  lat: number;
  lng: number;
  google_maps_link: string | null;
  distanceKm: number | null;
};

const DiscoverMap = dynamic(() => import('./DiscoverMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  ),
});

const qualityLabels: Record<string, string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

const qualityColors: Record<string, string> = {
  top: 'bg-emerald-100 text-emerald-800',
  standard: 'bg-blue-100 text-blue-800',
  fair: 'bg-amber-100 text-amber-800',
};

const categoryIcons: Record<string, string> = {
  fruit: '🍎',
  vegetable: '🥦',
  legume: '🥜',
  grain: '🌾',
  cash_crop: '💰',
  poultry: '🐔',
  other: '🌱',
};

const categoryColors: Record<string, string> = {
  fruit: '#ef4444',
  vegetable: '#22c55e',
  legume: '#f97316',
  grain: '#eab308',
  cash_crop: '#f59e0b',
  poultry: '#8b5cf6',
  other: '#10b981',
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatPrice = (price: number) => `UGX ${Number(price || 0).toLocaleString('en-US')}`;

function makePin(row: ProduceRow, userLat: number | null, userLng: number | null): ProductPin | null {
  if (row.location_lat == null || row.location_lng == null || !row.is_available) return null;

  const cropCategory = (row.crop_category || 'other').toLowerCase();
  const distanceKm =
    userLat != null && userLng != null ? haversineKm(userLat, userLng, row.location_lat, row.location_lng) : null;

  return {
    id: row.id,
    crop_name: row.crop_name || 'Produce',
    crop_category: cropCategory,
    variety: row.variety,
    quality: (row.quality || 'standard').toLowerCase(),
    quantity: Number(row.quantity || 0),
    unit: row.unit || 'kg',
    price_per_unit: Number(row.price_per_unit || 0),
    farmer_name: row.farmer_name || 'Unknown Farmer',
    farmer_location: row.farmer_location || 'Uganda',
    lat: row.location_lat,
    lng: row.location_lng,
    google_maps_link: row.google_maps_link || `https://maps.google.com/?q=${row.location_lat},${row.location_lng}`,
    distanceKm,
  };
}

export default function DiscoverClient() {
  const fallbackCenter = { lat: 0.3476, lng: 32.5825 }; // Kampala

  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [rows, setRows] = useState<ProduceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [radiusKm, setRadiusKm] = useState(20);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [mapLoading, setMapLoading] = useState(true);
  const [mapZoom, setMapZoom] = useState(11);
  const mapRef = useRef<LeafletMap | null>(null);

  const [L, setL] = useState<L | null>(null);
  const [userDivIcon, setUserDivIcon] = useState<DivIcon | null>(null);

  // ✅ Only load leaflet on client, inside effect
  useEffect(() => {
    let mounted = true;
    import('leaflet')
      .then((mod) => {
        if (!mounted) return;
        setL(mod);

        const icon = mod.divIcon({
          className: 'custom-div-icon',
          html: `<div style="
            background-color:#3b82f6;
            width:30px;height:42px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            position:relative;
            box-shadow:0 2px 4px rgba(0,0,0,0.3);
          ">
            <div style="
              position:absolute;width:20px;height:20px;background:white;border-radius:50%;
              top:5px;left:5px;transform:rotate(45deg);
              display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;
            ">📍</div>
          </div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 42],
          popupAnchor: [1, -34],
        });

        setUserDivIcon(icon);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const pinIcon = (category: string) => {
    if (!L) return null;
    const color = categoryColors[category] || '#10b981';

    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        background-color:${color};
        width:30px;height:42px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        position:relative;
        box-shadow:0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="
          position:absolute;width:20px;height:20px;background:white;border-radius:50%;
          top:5px;left:5px;transform:rotate(45deg);
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;
        ">📍</div>
      </div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [1, -34],
    });
  };

  // ✅ geolocation only inside effect
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Location services not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Unable to get location. Using default view.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // fetch products
  useEffect(() => {
    let active = true;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('farm_produce')
          .select('*')
          .eq('is_available', true)
          .not('location_lat', 'is', null)
          .not('location_lng', 'is', null)
          .order('listed_at', { ascending: false });

        if (error) throw error;
        if (active) setRows((data || []) as ProduceRow[]);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProducts();

    const channel = supabase
      .channel('discover-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_produce' }, () => fetchProducts())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const pins = useMemo(() => {
    const ulat = userLoc?.lat ?? null;
    const ulng = userLoc?.lng ?? null;

    const mapped = rows.map((r) => makePin(r, ulat, ulng)).filter(Boolean) as ProductPin[];

    const q = search.trim().toLowerCase();

    const filtered = mapped.filter((p) => {
      const matchesSearch =
        !q ||
        p.crop_name.toLowerCase().includes(q) ||
        p.farmer_name.toLowerCase().includes(q) ||
        p.farmer_location.toLowerCase().includes(q) ||
        p.crop_category.toLowerCase().includes(q);

      const matchesRadius = p.distanceKm == null || p.distanceKm <= radiusKm;
      return matchesSearch && matchesRadius;
    });

    filtered.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    return filtered;
  }, [rows, userLoc, radiusKm, search]);

  const mapCenter = userLoc || fallbackCenter;

  const zoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + 1);
    setMapZoom(mapRef.current.getZoom());
  };

  const zoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() - 1);
    setMapZoom(mapRef.current.getZoom());
  };

  const goToMyLocation = () => {
    if (!mapRef.current || !userLoc) return;
    mapRef.current.flyTo([userLoc.lat, userLoc.lng], 14);
    setMapZoom(14);
  };

  const resetView = () => {
    if (!mapRef.current) return;
    const z = userLoc ? 11 : 8;
    mapRef.current.flyTo([mapCenter.lat, mapCenter.lng], z);
    setMapZoom(z);
  };

  const handlePinClick = (pinId: string, lat: number, lng: number) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([lat, lng], 14);
    setMapZoom(14);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Discover Nearby</h1>
              <p className="text-gray-600 mt-2">Explore farm produce on the map and find products near you</p>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{pins.length}</span> products in view
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search crops, farmers, locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span className="font-medium">Filters</span>
            </button>
          </div>

          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Search Radius: {radiusKm} km</label>
                    <button
                      onClick={() => setRadiusKm(20)}
                      className="text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={200}
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 km</span>
                    <span>200 km</span>
                  </div>
                </div>

                {geoError && <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">{geoError}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Interactive Map</h2>
                  <div className="text-sm text-gray-600">Zoom: {mapZoom}x</div>
                </div>
              </div>

              <div className="h-[400px] md:h-[500px] w-full relative">
                {mapLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                      <p className="text-gray-600">Loading map...</p>
                    </div>
                  </div>
                )}

                <DiscoverMap
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={userLoc ? 11 : 8}
                  radiusKm={radiusKm}
                  userLoc={userLoc}
                  pins={pins}
                  userDivIcon={userDivIcon}
                  pinIcon={pinIcon}
                  onMapReady={(map: LeafletMap) => {
                    setMapLoading(false);
                    mapRef.current = map;
                    setMapZoom(map.getZoom());
                  }}
                  onZoomChange={(z: number) => setMapZoom(z)}
                  onPinClick={handlePinClick}
                  categoryIcons={categoryIcons}
                  formatPrice={formatPrice}
                />

                <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
                  <button
                    onClick={zoomIn}
                    className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-5 h-5 text-gray-700" />
                  </button>
                  <button
                    onClick={zoomOut}
                    className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-5 h-5 text-gray-700" />
                  </button>
                  {userLoc && (
                    <button
                      onClick={goToMyLocation}
                      className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                      title="Go to my location"
                    >
                      <Target className="w-5 h-5 text-gray-700" />
                    </button>
                  )}
                  <button
                    onClick={resetView}
                    className="w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
                    title="Reset view"
                  >
                    <Maximize2 className="w-5 h-5 text-gray-700" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-gray-900">Nearby Products</h2>
                <span className="text-sm text-gray-600">{pins.length} found</span>
              </div>
              <p className="text-sm text-gray-600 mt-1">Sorted by distance from you</p>
            </div>

            <div className="h-[400px] md:h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                  <p className="text-gray-600">Loading products...</p>
                </div>
              ) : pins.length === 0 ? (
                <div className="p-8 text-center">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 mb-2">No products found</h3>
                  <p className="text-gray-600 text-sm">Try increasing your search radius or check back later</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pins.map((pin) => (
                    <div
                      key={pin.id}
                      className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handlePinClick(pin.id, pin.lat, pin.lng)}
                    >
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">{categoryIcons[pin.crop_category] || '🌱'}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-gray-900 truncate">{pin.crop_name}</h3>
                            {pin.distanceKm != null && (
                              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full whitespace-nowrap">
                                {pin.distanceKm.toFixed(1)} km
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3" />
                              <span className="truncate">{pin.farmer_name}</span>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-bold text-emerald-600">{formatPrice(pin.price_per_unit)}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${qualityColors[pin.quality]}`}>
                              {qualityLabels[pin.quality] || pin.quality}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              {pin.quantity} {pin.unit}
                            </span>
                            <span className="truncate">{pin.farmer_location}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Link
                          href={`/products/${pin.id}`}
                          className="flex-1 text-center bg-emerald-500 text-white py-2 rounded-lg text-sm hover:bg-emerald-600 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Details
                        </Link>
                        <a
                          href={pin.google_maps_link || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center border border-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Get Directions
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Navigation className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Location Tips</h4>
                <p className="text-sm text-gray-600">Allow location access for accurate distance calculations</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Map Navigation</h4>
                <p className="text-sm text-gray-600">Click on markers or listings to view product details</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Filter className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Smart Filtering</h4>
                <p className="text-sm text-gray-600">Adjust search radius to find products at your preferred distance</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Want to list your products?</h3>
              <p className="text-gray-600">Get discovered by nearby buyers on the map</p>
            </div>
            <Link
              href="/products"
              className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              List Your Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
