'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus,
  X,
  MapPin,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Navigation,
  Package,
  DollarSign,
  Calendar,
  ExternalLink,
  Target,
  Sparkles,
  BadgeCheck,
  ClipboardList,
  ArrowRight,
} from 'lucide-react';

import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';

const LocationPicker = dynamic(() => import('./_components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-3xl border border-gray-200 bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-2 text-gray-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading map...
      </div>
    </div>
  ),
});

type DemandStatus = 'open' | 'paused' | 'closed';
type DemandQuality = 'top' | 'standard' | 'fair';

type BuyerDemand = {
  id: string;
  buyer_id: string | null;
  buyer_name: string;
  crop_name: string;
  category_id: number | null;
  crop_id?: number | null;
  variety_id?: number | null;
  preferred_quality: DemandQuality;
  quantity: number;
  unit: string;
  target_price_per_unit: number;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  radius_km: number;
  notes: string | null;
  status: DemandStatus;
  created_at: string;
  updated_at?: string;
  image_urls?: string[] | null;
};

type ProfileRow = {
  first_name: string | null;
  last_name: string | null;
  role: string;
};

const qualityOptions: { value: DemandQuality; label: string; tone: string }[] = [
  { value: 'top', label: 'Top', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { value: 'standard', label: 'Standard', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'fair', label: 'Fair', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
];

const statusOptions: { value: DemandStatus; label: string; tone: string }[] = [
  { value: 'open', label: 'Open', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { value: 'paused', label: 'Paused', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'closed', label: 'Closed', tone: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const unitOptions = ['kg', 'bag', 'bunch', 'piece', 'crate', 'ton'];

function formatUGX(value: number) {
  return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function relativeDate(date: string) {
  const then = new Date(date).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return formatDate(date);
}

function isValidImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function emptyForm() {
  return {
    crop_name: '',
    preferred_quality: 'standard' as DemandQuality,
    quantity: '',
    unit: 'kg',
    target_price_per_unit: '',
    location_text: '',
    location_lat: null as number | null,
    location_lng: null as number | null,
    radius_km: '20',
    notes: '',
    status: 'open' as DemandStatus,
    image_urls: [''],
  };
}

function getQualityTone(quality: DemandQuality) {
  return (
    qualityOptions.find((q) => q.value === quality)?.tone ||
    'bg-gray-100 text-gray-700 border-gray-200'
  );
}

function getStatusTone(status: DemandStatus) {
  return (
    statusOptions.find((s) => s.value === status)?.tone ||
    'bg-gray-100 text-gray-700 border-gray-200'
  );
}

export default function BuyerDemandsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState('Buyer');

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingDemands, setLoadingDemands] = useState(false);
  const [saving, setSaving] = useState(false);

  const [demands, setDemands] = useState<BuyerDemand[]>([]);

  const [openModal, setOpenModal] = useState(false);
  const [openMap, setOpenMap] = useState(false);

  const [form, setForm] = useState(emptyForm());

  const validImageUrls = useMemo(
    () => form.image_urls.map((u) => u.trim()).filter((u) => u.length > 0),
    [form.image_urls]
  );

  const formValid = useMemo(() => {
    const quantity = Number(form.quantity);
    const price = Number(form.target_price_per_unit);
    const radius = Number(form.radius_km);

    return (
      form.crop_name.trim().length > 0 &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(radius) &&
      radius > 0
    );
  }, [form]);

  const stats = useMemo(() => {
    const open = demands.filter((d) => d.status === 'open').length;
    const paused = demands.filter((d) => d.status === 'paused').length;
    const totalImages = demands.reduce((sum, d) => sum + (d.image_urls?.length || 0), 0);

    return {
      total: demands.length,
      open,
      paused,
      images: totalImages,
    };
  }, [demands]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setLoadingPage(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      if (!uid) {
        router.push('/login');
        return;
      }

      if (!mounted) return;
      setUserId(uid);

      const { data: profile, error: profileError } = await supabase
        .from('accounts_user')
        .select('first_name,last_name,role')
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (profileError || !profile) {
        router.push('/unauthorized');
        return;
      }

      const p = profile as ProfileRow;

      if (p.role !== 'buyer') {
        router.push('/unauthorized');
        return;
      }

      const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Buyer';
      if (mounted) setBuyerName(fullName);

      await loadDemands(uid);

      if (mounted) setLoadingPage(false);
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function loadDemands(uid?: string) {
    const currentUserId = uid || userId;
    if (!currentUserId) return;

    setLoadingDemands(true);

    const { data, error } = await supabase
      .from('buyer_demands')
      .select('*')
      .eq('buyer_id', currentUserId)
      .order('created_at', { ascending: false });

    if (!error) {
      setDemands((data || []) as BuyerDemand[]);
    }

    setLoadingDemands(false);
  }

  function closeModal() {
    setOpenModal(false);
    setOpenMap(false);
    setForm(emptyForm());
  }

  function addImageField() {
    setForm((prev) => ({
      ...prev,
      image_urls: [...prev.image_urls, ''],
    }));
  }

  function updateImageField(index: number, value: string) {
    setForm((prev) => {
      const next = [...prev.image_urls];
      next[index] = value;
      return { ...prev, image_urls: next };
    });
  }

  function removeImageField(index: number) {
    setForm((prev) => {
      const next = prev.image_urls.filter((_, i) => i !== index);
      return {
        ...prev,
        image_urls: next.length ? next : [''],
      };
    });
  }

  function useGps() {
    if (!navigator.geolocation) {
      alert('GPS is not supported on this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
        }));
      },
      (error) => {
        alert(error.message || 'Failed to get your location.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function createDemand() {
    if (!userId) return;

    if (!formValid) {
      alert('Please fill all required fields correctly.');
      return;
    }

    const badImage = validImageUrls.find((url) => !isValidImageUrl(url));
    if (badImage) {
      alert(`Invalid image link: ${badImage}`);
      return;
    }

    const payload = {
      buyer_id: userId,
      buyer_name: buyerName,
      crop_name: form.crop_name.trim(),
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
      image_urls: validImageUrls.length ? validImageUrls : null,
    };

    setSaving(true);

    const { error } = await supabase.from('buyer_demands').insert(payload);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    closeModal();
    await loadDemands();
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 text-gray-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="relative overflow-hidden rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 md:p-8">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-100 blur-3xl" />
          <div className="absolute left-0 bottom-0 h-32 w-32 rounded-full bg-lime-100 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <Sparkles className="w-4 h-4" />
                Buyer workspace
              </div>

              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                Buyer Demands
              </h1>
              <p className="mt-3 text-sm md:text-base leading-7 text-gray-600">
                Post what you need, add product reference images, define price and search radius,
                and let farmers respond with matching offers.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-gray-700">
                  <BadgeCheck className="w-4 h-4 text-emerald-600" />
                  Targeted sourcing
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Location-based demand
                </div>
                <div className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-gray-700">
                  <ImageIcon className="w-4 h-4 text-emerald-600" />
                  Visual product references
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setOpenModal(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Demand
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            icon={<ClipboardList className="w-5 h-5" />}
            label="Total Demands"
            value={stats.total}
            tone="emerald"
          />
          <StatCard
            icon={<Target className="w-5 h-5" />}
            label="Open Demands"
            value={stats.open}
            tone="blue"
          />
          <StatCard
            icon={<Calendar className="w-5 h-5" />}
            label="Paused Demands"
            value={stats.paused}
            tone="amber"
          />
          <StatCard
            icon={<ImageIcon className="w-5 h-5" />}
            label="Images Added"
            value={stats.images}
            tone="purple"
          />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-gray-900">Your demand posts</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage the products you want farmers to respond to.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white overflow-hidden shadow-sm">
            {loadingDemands ? (
              <div className="p-10 flex items-center justify-center gap-2 text-gray-600">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading demands...
              </div>
            ) : demands.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Package className="w-8 h-8" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">No demands yet</h3>
                <p className="mt-2 text-sm md:text-base text-gray-600 max-w-md mx-auto">
                  Create your first demand and let farmers see exactly what you need,
                  how much you want, and the price you are targeting.
                </p>
                <button
                  onClick={() => setOpenModal(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  Add Demand
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-gray-200">
                {demands.map((demand) => (
                  <article
                    key={demand.id}
                    className="p-5 md:p-6 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900 line-clamp-1">
                              {demand.crop_name}
                            </h3>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getQualityTone(
                                demand.preferred_quality
                              )}`}
                            >
                              {demand.preferred_quality}
                            </span>
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusTone(
                                demand.status
                              )}`}
                            >
                              {demand.status}
                            </span>
                          </div>

                          <div className="mt-2 text-sm text-gray-500">
                            Posted {relativeDate(demand.created_at)}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right shrink-0">
                          <div className="text-xs uppercase tracking-wide text-gray-500">
                            Radius
                          </div>
                          <div className="mt-1 text-lg font-bold text-gray-900">
                            {Number(demand.radius_km).toLocaleString()} km
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <InfoMiniCard
                          icon={<Package className="w-4 h-4" />}
                          label="Quantity"
                          value={`${Number(demand.quantity).toLocaleString()} ${demand.unit}`}
                        />
                        <InfoMiniCard
                          icon={<DollarSign className="w-4 h-4" />}
                          label="Target Price"
                          value={`${formatUGX(demand.target_price_per_unit)} / ${demand.unit}`}
                        />
                        <InfoMiniCard
                          icon={<Calendar className="w-4 h-4" />}
                          label="Date"
                          value={formatDate(demand.created_at)}
                        />
                        <InfoMiniCard
                          icon={<MapPin className="w-4 h-4" />}
                          label="Location"
                          value={demand.location_text || 'Not specified'}
                        />
                      </div>

                      {demand.notes && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Notes
                          </div>
                          <p className="text-sm leading-6 text-gray-700">{demand.notes}</p>
                        </div>
                      )}

                      {!!demand.image_urls?.length && (
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                            <ImageIcon className="w-4 h-4 text-emerald-600" />
                            Product images
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {demand.image_urls.map((url, index) => (
                              <a
                                key={`${demand.id}-${index}`}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block"
                              >
                                <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                                  <img
                                    src={url}
                                    alt={`${demand.crop_name} image ${index + 1}`}
                                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="flex items-center justify-between text-white text-xs">
                                      <span>View image</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {openModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-gray-200 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50 to-white">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  Create Buyer Demand
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Fill in the details clearly so farmers can send accurate offers.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-white text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Crop name *">
                  <input
                    value={form.crop_name}
                    onChange={(e) => setForm((p) => ({ ...p, crop_name: e.target.value }))}
                    placeholder="e.g. Robusta coffee"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Preferred quality *">
                  <select
                    value={form.preferred_quality}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        preferred_quality: e.target.value as DemandQuality,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  >
                    {qualityOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Quantity *">
                  <input
                    value={form.quantity}
                    onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                    placeholder="e.g. 500"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Unit *">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target price per unit (UGX) *">
                  <input
                    value={form.target_price_per_unit}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        target_price_per_unit: e.target.value,
                      }))
                    }
                    placeholder="e.g. 6500"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        status: e.target.value as DemandStatus,
                      }))
                    }
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  >
                    {statusOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Location text">
                  <input
                    value={form.location_text}
                    onChange={(e) => setForm((p) => ({ ...p, location_text: e.target.value }))}
                    placeholder="e.g. Kampala, Nakawa"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Radius (km) *">
                  <input
                    value={form.radius_km}
                    onChange={(e) => setForm((p) => ({ ...p, radius_km: e.target.value }))}
                    placeholder="e.g. 20"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Map location">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenMap(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
                      >
                        <MapPin className="w-4 h-4" />
                        Pick on map
                      </button>

                      <button
                        type="button"
                        onClick={useGps}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
                      >
                        <Navigation className="w-4 h-4" />
                        Use GPS
                      </button>

                      <div className="text-xs text-gray-600 bg-gray-100 px-4 py-2.5 rounded-2xl">
                        <span className="font-semibold">Lat/Lng:</span>{' '}
                        {form.location_lat != null ? Number(form.location_lat).toFixed(5) : '—'},{' '}
                        {form.location_lng != null ? Number(form.location_lng).toFixed(5) : '—'}
                      </div>
                    </div>
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Add extra details for farmers..."
                      className="w-full min-h-[120px] rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Image links">
                    <div className="space-y-3">
                      {form.image_urls.map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="relative flex-1">
                            <ImageIcon className="w-4 h-4 text-gray-400 absolute left-4 top-3.5" />
                            <input
                              value={url}
                              onChange={(e) => updateImageField(index, e.target.value)}
                              placeholder="https://example.com/image.jpg"
                              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-300 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImageField(index)}
                            className="px-3 py-2 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addImageField}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
                      >
                        <Plus className="w-4 h-4" />
                        Add image link
                      </button>

                      {!!validImageUrls.length && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                          {validImageUrls.map((url, index) => (
                            <div
                              key={`${url}-${index}`}
                              className="rounded-2xl border border-gray-200 p-3 bg-gray-50"
                            >
                              <div className="text-xs font-semibold text-gray-500 mb-2">
                                Preview {index + 1}
                              </div>
                              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white aspect-square">
                                <img
                                  src={url}
                                  alt={`Preview ${index + 1}`}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 underline break-all"
                              >
                                Open image
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            <div className="px-6 md:px-8 py-5 border-t border-gray-200 flex items-center justify-between gap-3 bg-gray-50">
              <div className="text-xs md:text-sm text-gray-500">
                Farmers will use this information to send matching offers.
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={createDemand}
                  disabled={!formValid || saving}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white ${
                    !formValid || saving
                      ? 'bg-emerald-300 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Create Demand
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openMap && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-gray-200 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50 to-white">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-gray-900">Pick Location</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Click on the map or drag the marker to choose the demand location.
                </p>
              </div>
              <button
                onClick={() => setOpenMap(false)}
                className="p-2 rounded-xl hover:bg-white text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8">
              <LocationPicker
                initialLat={form.location_lat ?? 0.3476}
                initialLng={form.location_lng ?? 32.5825}
                radiusKm={Number(form.radius_km) || 20}
                onPick={(lat: number, lng: number) =>
                  setForm((prev) => ({
                    ...prev,
                    location_lat: lat,
                    location_lng: lng,
                  }))
                }
              />

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={() => setOpenMap(false)}
                  className="px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'emerald' | 'blue' | 'amber' | 'purple';
}) {
  const tones: Record<string, string> = {
    emerald: 'from-emerald-50 to-green-50 border-emerald-100 text-emerald-700',
    blue: 'from-blue-50 to-cyan-50 border-blue-100 text-blue-700',
    amber: 'from-amber-50 to-yellow-50 border-amber-100 text-amber-700',
    purple: 'from-purple-50 to-fuchsia-50 border-purple-100 text-purple-700',
  };

  return (
    <div className={`rounded-3xl border bg-gradient-to-r p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <div className="rounded-2xl bg-white/70 p-2">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-bold">{value}</div>
    </div>
  );
}

function InfoMiniCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-800 mb-2">{label}</div>
      {children}
    </label>
  );
}