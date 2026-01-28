'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin } from 'lucide-react';

type Props = {
  initialLat: number;
  initialLng: number;
  onPick: (lat: number, lng: number) => void;
  onUseGps: () => void;
};

// Leaflet marker icon fix (Next.js)
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickToSet({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ initialLat, initialLng, onPick, onUseGps }: Props) {
  const [pos, setPos] = useState({ lat: initialLat, lng: initialLng });

  useEffect(() => {
    setPos({ lat: initialLat, lng: initialLng });
  }, [initialLat, initialLng]);

  const center = useMemo(() => [pos.lat, pos.lng] as [number, number], [pos]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          <span>
            Selected: <span className="font-semibold">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={onUseGps}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm font-medium"
        >
          <Navigation className="w-4 h-4" />
          Use GPS
        </button>
      </div>

      <MapContainer center={center} zoom={13} className="h-[420px] w-full rounded-xl border border-gray-200">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickToSet
          onPick={(lat, lng) => {
            setPos({ lat, lng });
            onPick(lat, lng);
          }}
        />

        <Marker
          position={center}
          draggable
          icon={markerIcon}
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as any;
              const p = m.getLatLng();
              setPos({ lat: p.lat, lng: p.lng });
              onPick(p.lat, p.lng);
            },
          }}
        />
      </MapContainer>

      <p className="text-xs text-gray-500 mt-2">
        Tip: Click the map to move the marker, or drag it for a precise delivery point.
      </p>
    </div>
  );
}
