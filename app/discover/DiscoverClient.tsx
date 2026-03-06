'use client';

import { useEffect, useMemo } from 'react';
import type { Map as LeafletMap, DivIcon } from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import Link from 'next/link';

export type ProductPin = {
  id: string;
  crop_name: string;
  crop_category: string;
  farmer_name: string;
  price_per_unit: number;
  quantity: number;
  unit: string;
  lat: number;
  lng: number;
  variety?: string | null;
  quality?: string | null;
  distanceKm?: number | null;
  google_maps_link?: string | null;
};

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

  qualityLabels?: Record<string, string>;
  qualityColors?: Record<string, string>;
  selectedPinId?: string | null;
};

function MapEvents({
  onReady,
  onZoom,
  center,
  zoom,
}: {
  onReady: (m: LeafletMap) => void;
  onZoom: (z: number) => void;
  center: [number, number];
  zoom: number;
}) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });

  useEffect(() => {
    onReady(map);
    onZoom(map.getZoom());

    const timer = window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    }, 200);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = map.getCenter();
    const [lat, lng] = center;
    const dist = Math.abs(current.lat - lat) + Math.abs(current.lng - lng);

    if (dist > 0.0005) {
      map.flyTo(center, zoom, { duration: 0.8 });
    } else {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

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
  qualityLabels,
  qualityColors,
  selectedPinId,
}: DiscoverMapProps) {
  const markers = useMemo(() => {
    return pins.map((pin) => {
      const icon = pinIcon(pin.crop_category);
      if (!icon) return null;

      const isSelected = selectedPinId === pin.id;

      return (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={icon}
          eventHandlers={{
            click: () => onPinClick(pin.id, pin.lat, pin.lng),
          }}
        >
          <Popup>
            <div className="min-w-[240px]">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">
                  {categoryIcons[pin.crop_category] || '🌱'}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-bold text-gray-900">
                    {pin.crop_name}
                  </div>
                  <div className="truncate text-sm text-gray-600">
                    {pin.farmer_name}
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-700">
                <div className="font-semibold text-emerald-600">
                  {formatPrice(pin.price_per_unit)}/{pin.unit}
                </div>

                <div>
                  {pin.quantity} {pin.unit} available
                </div>

                {pin.variety && (
                  <div className="text-gray-600">
                    Variety: <span className="font-medium">{pin.variety}</span>
                  </div>
                )}

                {qualityLabels && qualityColors && pin.quality && (
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        qualityColors[pin.quality] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {qualityLabels[pin.quality] || pin.quality}
                    </span>
                  </div>
                )}

                {pin.distanceKm != null && (
                  <div className="text-gray-600">
                    {pin.distanceKm.toFixed(1)} km away
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <Link
                  href={`/products/${pin.id}`}
                  className="flex-1 rounded-lg bg-emerald-500 py-1.5 text-center text-sm text-white transition-colors hover:bg-emerald-600"
                >
                  View Details
                </Link>

                <a
                  href={
                    pin.google_maps_link ||
                    `https://maps.google.com/?q=${pin.lat},${pin.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-gray-300 py-1.5 text-center text-sm transition-colors hover:bg-gray-50"
                >
                  Directions
                </a>
              </div>

              {isSelected && (
                <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Selected from the list.
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [
    pins,
    pinIcon,
    onPinClick,
    categoryIcons,
    formatPrice,
    selectedPinId,
    qualityLabels,
    qualityColors,
  ]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      preferCanvas={true}
    >
      <MapEvents
        onReady={onMapReady}
        onZoom={onZoomChange}
        center={center}
        zoom={zoom}
      />

      <TileLayer
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {userLoc && userDivIcon && (
        <>
          <Circle
            center={[userLoc.lat, userLoc.lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
            }}
          />
          <Marker position={[userLoc.lat, userLoc.lng]} icon={userDivIcon}>
            <Popup>
              <div className="text-sm">
                <div className="mb-1 font-semibold">Your Location</div>
                <div className="text-gray-600">
                  Showing products within {radiusKm} km
                </div>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {markers}
    </MapContainer>
  );
}