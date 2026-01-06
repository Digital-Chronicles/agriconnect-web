'use client';

import { useEffect } from 'react';
import type { Map as LeafletMap, DivIcon } from 'leaflet';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import Link from 'next/link';
import type { ProductPin } from './DiscoverClient';

export type DiscoverMapProps = {
  center: [number, number];
  zoom: number;
  radiusKm: number;
  userLoc: { lat: number; lng: number } | null;
  pins: ProductPin[];
  userDivIcon: DivIcon | null;
  pinIcon: (category: string) => DivIcon | null;
  onMapReady: (map: LeafletMap) => void;
  onZoomChange: (zoom: number) => void;
  onPinClick: (id: string, lat: number, lng: number) => void;
  categoryIcons: Record<string, string>;
  formatPrice: (price: number) => string;
};

function MapEvents({
  onReady,
  onZoom,
}: {
  onReady: (m: LeafletMap) => void;
  onZoom: (z: number) => void;
}) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onReady(map);
    onZoom(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function DiscoverMap({
  center,
  zoom,
  radiusKm,
  userLoc,
  pins,
  userDivIcon,
  pinIcon,
  onMapReady,
  onZoomChange,
  onPinClick,
  categoryIcons,
  formatPrice,
}: DiscoverMapProps) {
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <MapEvents onReady={onMapReady} onZoom={onZoomChange} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {userLoc && userDivIcon && (
        <>
          <Circle
            center={[userLoc.lat, userLoc.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2 }}
          />
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userDivIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">Your Location</div>
                <div className="text-gray-600">Showing products within {radiusKm} km</div>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {pins.map((pin) => {
        const icon = pinIcon(pin.crop_category);
        if (!icon) return null;

        return (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={icon}
            eventHandlers={{ click: () => onPinClick(pin.id, pin.lat, pin.lng) }}
          >
            <Popup>
              <div className="min-w-[220px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{categoryIcons[pin.crop_category] || '🌱'}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900 truncate">{pin.crop_name}</div>
                    <div className="text-sm text-gray-600 truncate">{pin.farmer_name}</div>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-700">
                  <div className="font-semibold text-emerald-600">
                    {formatPrice(pin.price_per_unit)}/{pin.unit}
                  </div>
                  <div>
                    {pin.quantity} {pin.unit} available
                  </div>
                  {pin.distanceKm != null && <div>{pin.distanceKm.toFixed(1)} km away</div>}
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/products/${pin.id}`}
                    className="flex-1 text-center bg-emerald-500 text-white py-1.5 rounded-lg text-sm hover:bg-emerald-600 transition-colors"
                  >
                    View Details
                  </Link>
                  <a
                    href={pin.google_maps_link || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center border border-gray-300 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    Directions
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
