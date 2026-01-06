'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import { 
  Search, Filter, MapPin, Users, Package, DollarSign, 
  Navigation, Send, Calendar, ChevronRight, AlertCircle,
  CheckCircle, Star, MessageCircle, Phone, Clock, Eye
} from 'lucide-react';

interface ListingRow {
  id: string;
  farmer_id: string | null;
  crop_name: string;
  crop_category: string | null;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  location_lat: number | null;
  location_lng: number | null;
  farmer_location: string;
  is_available: boolean;
  listed_at: string;
}

interface BuyerDemandRow {
  id: string;
  buyer_id: string | null;
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
  status: 'open' | 'paused' | 'closed';
  created_at: string;
}

interface AccountUserRow {
  auth_user_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location: string | null;
}

const formatPrice = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US')}`;

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

export default function MarketplacePage() {
  const router = useRouter();
  const [authId, setAuthId] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [radiusKm, setRadiusKm] = useState(30);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [sellerLocation, setSellerLocation] = useState<{ lat: number; lng: number; source: string } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get logged-in user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setAuthId(data.user?.id ?? null);
    };
    getUser();
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load user's listings
        if (authId) {
          const { data: listingsData } = await supabase
            .from('farm_produce')
            .select('*')
            .eq('farmer_id', authId)
            .eq('is_available', true)
            .order('listed_at', { ascending: false });

          setListings((listingsData as ListingRow[]) || []);
        }

        // Load buyer demands
        const { data: demandsData } = await supabase
          .from('buyer_demands')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false });

        setDemands((demandsData as BuyerDemandRow[]) || []);
      } catch (err) {
        setError('Failed to load marketplace data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authId]);

  // Determine seller location
  useEffect(() => {
    const determineLocation = async () => {
      setLocationError(null);

      // Try from selected listing
      const selected = listings.find(l => l.id === selectedListingId) || listings[0];
      if (selected?.location_lat && selected?.location_lng) {
        setSellerLocation({
          lat: selected.location_lat,
          lng: selected.location_lng,
          source: 'listing'
        });
        return;
      }

      // Try from profile
      if (authId) {
        const { data: profile } = await supabase
          .from('accounts_user')
          .select('location_lat, location_lng')
          .eq('auth_user_id', authId)
          .single();

        if (profile?.location_lat && profile?.location_lng) {
          setSellerLocation({
            lat: profile.location_lat,
            lng: profile.location_lng,
            source: 'profile'
          });
          return;
        }
      }

      // Try browser geolocation
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setSellerLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              source: 'browser'
            });
          },
          (err) => {
            setLocationError('Location access denied. Enable location for better matches.');
          }
        );
      } else {
        setLocationError('Geolocation not supported');
      }
    };

    if (listings.length > 0) {
      determineLocation();
    }
  }, [authId, listings, selectedListingId]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buyer_demands' },
        async () => {
          const { data } = await supabase
            .from('buyer_demands')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });
          setDemands((data as BuyerDemandRow[]) || []);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'farm_produce' },
        async () => {
          if (!authId) return;
          const { data } = await supabase
            .from('farm_produce')
            .select('*')
            .eq('farmer_id', authId)
            .eq('is_available', true)
            .order('listed_at', { ascending: false });
          setListings((data as ListingRow[]) || []);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authId]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  };

  const filteredDemands = useMemo(() => {
    const searchLower = search.toLowerCase();
    const userCrops = new Set(listings.map(l => l.crop_name.toLowerCase()));

    return demands
      .map(demand => {
        let distance = null;
        if (sellerLocation && demand.location_lat && demand.location_lng) {
          distance = calculateDistance(
            sellerLocation.lat,
            sellerLocation.lng,
            demand.location_lat,
            demand.location_lng
          );
        }

        return { demand, distance };
      })
      .filter(({ demand, distance }) => {
        // Search filter
        const matchesSearch = 
          !search ||
          demand.crop_name.toLowerCase().includes(searchLower) ||
          demand.buyer_name.toLowerCase().includes(searchLower) ||
          demand.location_text?.toLowerCase().includes(searchLower);

        // Radius filter
        const matchesRadius = distance === null || distance <= radiusKm;

        // Same crop filter (only if user has listings)
        const matchesCrop = listings.length === 0 || userCrops.has(demand.crop_name.toLowerCase());

        return matchesSearch && matchesRadius && matchesCrop;
      })
      .sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [demands, search, radiusKm, sellerLocation, listings]);

  const selectedListing = useMemo(
    () => listings.find(l => l.id === selectedListingId) || listings[0],
    [listings, selectedListingId]
  );

  const handleSendOffer = async (demandId: string) => {
    if (!authId) {
      alert('Please login to send offers');
      router.push('/login');
      return;
    }

    if (!selectedListing) {
      alert('Please select a listing first');
      return;
    }

    try {
      const { error } = await supabase.from('demand_offers').insert({
        demand_id: demandId,
        listing_id: selectedListing.id,
        farmer_id: authId,
        farmer_name: selectedListing.farmer_id ? 'Farmer' : 'Farmer',
        crop_name: selectedListing.crop_name,
        offered_quantity: selectedListing.quantity,
        offered_price_per_unit: selectedListing.price_per_unit,
        status: 'sent',
      });

      if (error) throw error;
      
      alert('Offer sent successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to send offer');
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
    return `${Math.floor(diffHours / 168)}w ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-4 bg-gray-200 rounded w-96" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-64 bg-gray-200 rounded-xl" />
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Buyer Marketplace</h1>
          <p className="text-gray-600 mt-2">
            Connect with buyers looking for products like yours
          </p>
        </div>

        {/* Stats & Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Buyers</p>
                <p className="text-xl font-bold text-gray-900">{demands.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Your Listings</p>
                <p className="text-xl font-bold text-gray-900">{listings.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Navigation className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Search Radius</p>
                <p className="text-xl font-bold text-gray-900">{radiusKm} km</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg mb-6">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search buyers, crops, locations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-5 h-5" />
              <span className="font-medium">Filters</span>
            </button>
          </div>

          {showFilters && (
            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Radius: {radiusKm} km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="200"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 km</span>
                    <span>200 km</span>
                  </div>
                </div>
                
                {locationError && (
                  <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{locationError}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Listing Selector */}
          {listings.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Select Listing to Offer</label>
                <Link
                  href="/products"
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Manage listings
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <select
                value={selectedListingId || listings[0].id}
                onChange={(e) => setSelectedListingId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50"
              >
                {listings.map(listing => (
                  <option key={listing.id} value={listing.id}>
                    {listing.crop_name} • {formatPrice(listing.price_per_unit)}/{listing.unit} • {listing.quantity} {listing.unit} available
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Buyer Demands Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Buyer Demands ({filteredDemands.length})
            </h2>
            <div className="text-sm text-gray-500">
              Sorted by distance
            </div>
          </div>

          {filteredDemands.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No buyers found</h3>
              <p className="text-gray-600 mb-4">
                {search ? 'Try changing your search terms' : 'Try increasing your search radius'}
              </p>
              <button
                onClick={() => {
                  setSearch('');
                  setRadiusKm(50);
                }}
                className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDemands.map(({ demand, distance }) => (
                <div
                  key={demand.id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg line-clamp-1">
                        {demand.crop_name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(demand.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">{demand.buyer_name}</span>
                      {distance !== null && (
                        <>
                          <span className="text-gray-300">•</span>
                          <MapPin className="w-4 h-4" />
                          <span>{distance.toFixed(1)} km away</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Quantity Needed</p>
                        <p className="font-semibold text-gray-900">
                          {demand.quantity} {demand.unit}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Target Price</p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(demand.target_price_per_unit)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Quality</p>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${qualityColors[demand.preferred_quality] || 'bg-gray-100 text-gray-800'}`}>
                          {qualityLabels[demand.preferred_quality] || demand.preferred_quality}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Radius</p>
                        <p className="font-semibold text-gray-900">{demand.radius_km} km</p>
                      </div>
                    </div>

                    {demand.notes && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{demand.notes}</p>
                      </div>
                    )}

                    {/* Location */}
                    {demand.location_text && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="line-clamp-1">{demand.location_text}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSendOffer(demand.id)}
                        disabled={!selectedListing || !authId}
                        className={`flex-1 bg-emerald-500 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
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
                          <Navigation className="w-4 h-4 text-gray-600" />
                        </a>
                      )}
                    </div>

                    {/* Selected Listing Info */}
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
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Find Buyers</h4>
                <p className="text-sm text-gray-600">
                  Browse buyers looking for products you sell
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Send Offers</h4>
                <p className="text-sm text-gray-600">
                  Propose your listing to interested buyers
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-600 font-bold">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">Connect & Sell</h4>
                <p className="text-sm text-gray-600">
                  Negotiate directly and complete the sale
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* No Listings Notice */}
        {listings.length === 0 && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">No Active Listings</h4>
                <p className="text-gray-600 mb-3">
                  Create listings to see buyer demands for your products
                </p>
                <Link
                  href="/products"
                  className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Create Listing
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="mt-6 bg-gray-900 text-white rounded-2xl p-6">
          <h4 className="font-bold text-lg mb-3">Tips for Success</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Keep your listings updated with accurate quantities and prices</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Respond quickly to buyer inquiries</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>Include clear location information for better matching</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}