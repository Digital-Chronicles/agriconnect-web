'use client';

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";
import {
  MapPin,
  Users,
  Package,
  Send,
  Search,
  Image as ImageIcon,
  Navigation,
} from "lucide-react";

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
  `UGX ${Number(n || 0).toLocaleString("en-UG")}`;

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

  if (key.includes("coffee")) {
    return "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&h=600&fit=crop";
  }
  if (key.includes("maize") || key.includes("corn")) {
    return "https://images.unsplash.com/photo-1601593768799-76d2e4f7c1a9?w=800&h=600&fit=crop";
  }
  if (key.includes("beans")) {
    return "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=800&h=600&fit=crop";
  }
  if (key.includes("banana") || key.includes("matooke")) {
    return "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&h=600&fit=crop";
  }
  if (key.includes("rice")) {
    return "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop";
  }

  return "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop";
}

export default function MarketplacePage() {
  const [authId, setAuthId] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [demands, setDemands] = useState<BuyerDemandRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sellerLocation, setSellerLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [search, setSearch] = useState("");
  const [radiusKm, setRadiusKm] = useState(30);

  const [selectedListing, setSelectedListing] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setAuthId(data.user?.id ?? null);
    }

    load();

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
                .from("farm_produce")
                .select(
                  "id,crop_name,quantity,unit,price_per_unit,location_lat,location_lng,farmer_location,listed_at"
                )
                .eq("farmer_id", authId)
                .eq("is_available", true)
                .order("listed_at", { ascending: false })
            : Promise.resolve({ data: [] }),

          supabase
            .from("buyer_demands")
            .select(
              "id,buyer_name,crop_name,preferred_quality,quantity,unit,target_price_per_unit,radius_km,location_text,location_lat,location_lng,notes,status,created_at,image_urls"
            )
            .eq("status", "open")
            .order("created_at", { ascending: false }),
        ]);

        if (!alive) return;

        setListings((listingsRes.data as ListingRow[]) || []);
        setDemands((demandsRes.data as BuyerDemandRow[]) || []);

        if (listingsRes.data?.length) {
          setSelectedListing(listingsRes.data[0].id);
        }
      } catch (e) {
        console.error(e);
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
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSellerLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {}
    );
  }, []);

  const filteredDemands = useMemo(() => {
    const s = search.toLowerCase().trim();

    return demands
      .map((d) => {
        let distance = null;

        if (
          sellerLocation &&
          d.location_lat &&
          d.location_lng
        ) {
          distance = distanceKm(
            sellerLocation.lat,
            sellerLocation.lng,
            d.location_lat,
            d.location_lng
          );
        }

        return { demand: d, distance };
      })
      .filter(({ demand, distance }) => {
        const textMatch =
          !s ||
          demand.crop_name.toLowerCase().includes(s) ||
          demand.buyer_name.toLowerCase().includes(s) ||
          (demand.location_text || "").toLowerCase().includes(s);

        const radiusMatch = distance === null || distance <= radiusKm;

        return textMatch && radiusMatch;
      })
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }, [demands, search, radiusKm, sellerLocation]);

  async function sendOffer(demandId: string) {
    if (!authId) {
      alert("Please login");
      return;
    }

    if (!selectedListing) {
      alert("Select a listing first");
      return;
    }

    const listing = listings.find((l) => l.id === selectedListing);
    if (!listing) return;

    const payload = {
      demand_id: demandId,
      listing_id: listing.id,
      farmer_id: authId,
      crop_name: listing.crop_name,
      offered_quantity: listing.quantity,
      offered_price_per_unit: listing.price_per_unit,
      status: "sent",
    };

    const { error } = await supabase.from("demand_offers").insert(payload);

    if (error) {
      alert("Failed to send offer");
      return;
    }

    alert("Offer sent!");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10 text-center">
          Loading marketplace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">Marketplace</h1>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search crop, buyer or location"
              className="border rounded-xl pl-10 pr-4 py-3 w-full bg-white"
            />
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-xl px-4 py-3">
            <Navigation className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Radius:</span>
            <input
              type="range"
              min="1"
              max="200"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-sm font-medium text-gray-800">{radiusKm} km</span>
          </div>
        </div>

        {listings.length > 0 && (
          <div className="mb-6 bg-white border rounded-2xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select listing to use when sending offers
            </label>
            <select
              value={selectedListing || listings[0].id}
              onChange={(e) => setSelectedListing(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl bg-gray-50"
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.crop_name} • {formatPrice(l.price_per_unit)}/{l.unit} • {l.quantity} {l.unit}
                </option>
              ))}
            </select>
          </div>
        )}

        {filteredDemands.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">No demands found</h3>
            <p className="text-gray-600 mt-1">Try changing your search or radius.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDemands.map(({ demand, distance }) => {
              const gallery =
                demand.image_urls && demand.image_urls.length > 0
                  ? demand.image_urls
                  : [demandImageFallback(demand.crop_name)];

              const coverImage = gallery[0];

              return (
                <div
                  key={demand.id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
                >
                  <div className="aspect-[16/10] bg-gray-100 overflow-hidden">
                    <img
                      src={coverImage}
                      alt={demand.crop_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-lg line-clamp-1">
                        {demand.crop_name}
                      </h3>

                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        <Package className="w-3 h-3" />
                        {demand.quantity} {demand.unit}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Buyer: {demand.buyer_name}
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Target Price</p>
                        <p className="font-semibold text-gray-900">
                          {formatPrice(demand.target_price_per_unit)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Quality</p>
                        <p className="font-semibold text-gray-900 capitalize">
                          {demand.preferred_quality}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Buyer Radius</p>
                        <p className="font-semibold text-gray-900">{demand.radius_km} km</p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">Distance</p>
                        <p className="font-semibold text-gray-900">
                          {distance !== null ? `${distance.toFixed(1)} km` : "Unknown"}
                        </p>
                      </div>
                    </div>

                    {gallery.length > 1 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-2">
                          <ImageIcon className="w-4 h-4" />
                          Product images
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {gallery.slice(0, 4).map((url, index) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block aspect-square rounded-lg overflow-hidden border bg-gray-100"
                            >
                              <img
                                src={url}
                                alt={`${demand.crop_name} ${index + 1}`}
                                className="w-full h-full object-cover hover:scale-105 transition-transform"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {demand.location_text && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
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
                        onClick={() => sendOffer(demand.id)}
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
                        Using listing:{" "}
                        <span className="font-medium">
                          {listings.find((l) => l.id === selectedListing)?.crop_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}