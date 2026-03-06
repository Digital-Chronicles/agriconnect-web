'use client';

import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';

type Props = {
  initialLat: number;
  initialLng: number;
  radiusKm: number;
  onPick: (lat: number, lng: number) => void;
};

function LocationMarker({
  position,
  setPosition,
}: {
  position: [number, number];
  setPosition: (value: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend(e) {
          const marker = e.target;
          const latlng = marker.getLatLng();
          setPosition([latlng.lat, latlng.lng]);
        },
      }}
    />
  );
}

export default function LocationPicker({
  initialLat,
  initialLng,
  radiusKm,
  onPick,
}: Props) {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  useEffect(() => {
    setPosition([initialLat, initialLng]);
  }, [initialLat, initialLng]);

  useEffect(() => {
    onPick(position[0], position[1]);
  }, [position, onPick]);

  return (
    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={position} zoom={12} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <LocationMarker position={position} setPosition={setPosition} />

        <Circle
          center={position}
          radius={radiusKm * 1000}
          pathOptions={{
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.1,
          }}
        />
      </MapContainer>
    </div>
  );
}