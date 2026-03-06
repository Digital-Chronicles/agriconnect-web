'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import supabase from '@/lib/supabaseClient';
import {
  Plus,
  Loader2,
  MapPin,
  Trash2,
  Eye,
  EyeOff,
  Package,
  DollarSign,
  Leaf,
  X,
  Navigation,
  RefreshCw,
} from 'lucide-react';

type Role = 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest';

type ProfileRow = {
  id: number;
  auth_user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: Role;
  phone_number: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
};

type Category = {
  id: number;
  name: string;
};

type ProductRow = {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  distance_km: number | null;
  location_lat: number | null;
  location_lng: number | null;
  google_maps_link: string | null;
  available_from: string;
  is_available: boolean;
  listed_at: string;
  farmer_phone: string | null;
  photo: string | null;
  description: string | null;
  crop_category: string | null;
  total_price: number | null;
  category_id: number | null;
};

const unitOptions = ['kg', 'bag', 'bunch', 'piece', 'crate', 'ton'];
const qualityOptions = ['top', 'standard', 'fair'];

function formatUGX(value: number) {
  return `UGX ${Number(value || 0).toLocaleString('en-UG')}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-UG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function relativeDate(value: string) {
  const then = new Date(value).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / (1000 * 60 * 60 * 24));

  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return formatDate(value);
}

function emptyForm() {
  const today = new Date().toISOString().split('T')[0];
  return {
    crop_name: '',
    category_id: '',
    variety: '',
    quality: 'standard',
    quantity: '',
    unit: 'kg',
    price_per_unit: '',
    farmer_location: '',
    location_lat: '',
    location_lng: '',
    google_maps_link: '',
    available_from: today,
    photo: '',
    description: '',
  };
}

export default function FarmerProductsPage() {
  const router = useRouter();

  const [authId, setAuthId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const farmerName = useMemo(() => {
    if (!profile) return 'Farmer';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Farmer';
  }, [profile]);

  const stats = useMemo(() => {
    const active = products.filter((p) => p.is_available).length;
    const hidden = products.filter((p) => !p.is_available).length;
    const totalValue = products.reduce(
      (sum, p) => sum + Number(p.quantity || 0) * Number(p.price_per_unit || 0),
      0
    );

    return {
      total: products.length,
      active,
      hidden,
      totalValue,
    };
  }, [products]);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      setLoadingPage(true);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id ?? null;

      if (!uid) {
        router.push('/login');
        return;
      }

      if (!mounted) return;
      setAuthId(uid);

      const { data: prof, error: profError } = await supabase
        .from('accounts_user')
        .select(
          'id,auth_user_id,first_name,last_name,email,role,phone_number,location,location_lat,location_lng'
        )
        .eq('auth_user_id', uid)
        .maybeSingle();

      if (profError || !prof) {
        router.push('/unauthorized');
        return;
      }

      if (prof.role !== 'farmer') {
        router.push('/unauthorized');
        return;
      }

      if (!mounted) return;
      setProfile(prof as ProfileRow);

      await Promise.all([loadCategories(), loadProducts(uid)]);

      if (!mounted) return;
      setForm((prev) => ({
        ...prev,
        farmer_location: prof.location || '',
        location_lat: prof.location_lat != null ? String(prof.location_lat) : '',
        location_lng: prof.location_lng != null ? String(prof.location_lng) : '',
      }));

      setLoadingPage(false);
    };

    boot();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function loadCategories() {
    const { data } = await supabase
      .from('produce_categories')
      .select('id,name')
      .eq('is_active', true)
      .order('name');

    setCategories((data || []) as Category[]);
  }

  async function loadProducts(uid?: string) {
    const currentUid = uid || authId;
    if (!currentUid) return;

    setLoadingProducts(true);

    const { data, error } = await supabase
      .from('farm_produce')
      .select(
        `
        id,
        farmer_id,
        farmer_name,
        farmer_location,
        crop_name,
        variety,
        quality,
        quantity,
        unit,
        price_per_unit,
        distance_km,
        location_lat,
        location_lng,
        google_maps_link,
        available_from,
        is_available,
        listed_at,
        farmer_phone,
        photo,
        description,
        crop_category,
        total_price,
        category_id
      `
      )
      .eq('farmer_id', currentUid)
      .order('listed_at', { ascending: false });

    if (!error) {
      setProducts((data || []) as ProductRow[]);
    }

    setLoadingProducts(false);
  }

  function closeCreate() {
    setOpenCreate(false);
    setForm({
      ...emptyForm(),
      farmer_location: profile?.location || '',
      location_lat: profile?.location_lat != null ? String(profile.location_lat) : '',
      location_lng: profile?.location_lng != null ? String(profile.location_lng) : '',
    });
  }

  function useGps() {
    if (!navigator.geolocation) {
      alert('GPS is not supported on this browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          location_lat: String(pos.coords.latitude),
          location_lng: String(pos.coords.longitude),
        }));
      },
      (err) => {
        alert(err.message || 'Failed to get GPS location.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function createProduct() {
    if (!authId || !profile) return;

    const crop_name = form.crop_name.trim();
    const quantity = Number(form.quantity);
    const price_per_unit = Number(form.price_per_unit);

    if (!crop_name) {
      alert('Crop name is required.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }

    if (!Number.isFinite(price_per_unit) || price_per_unit <= 0) {
      alert('Price per unit must be greater than 0.');
      return;
    }

    setSaving(true);

    const payload = {
      farmer_id: authId,
      farmer_name: farmerName,
      farmer_location: form.farmer_location.trim() || profile.location || '',
      crop_name,
      variety: form.variety.trim() || null,
      quality: form.quality,
      quantity,
      unit: form.unit,
      price_per_unit,
      location_lat: form.location_lat.trim() ? Number(form.location_lat) : null,
      location_lng: form.location_lng.trim() ? Number(form.location_lng) : null,
      google_maps_link: form.google_maps_link.trim() || null,
      available_from: form.available_from,
      is_available: true,
      farmer_phone: profile.phone_number || null,
      photo: form.photo.trim() || null,
      description: form.description.trim() || null,
      crop_category:
        categories.find((c) => String(c.id) === form.category_id)?.name || null,
      category_id: form.category_id ? Number(form.category_id) : null,
    };

    const { error } = await supabase.from('farm_produce').insert(payload);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    closeCreate();
    await loadProducts();
  }

  async function toggleAvailability(product: ProductRow) {
    setTogglingId(product.id);

    const { error } = await supabase
      .from('farm_produce')
      .update({ is_available: !product.is_available })
      .eq('id', product.id);

    setTogglingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  async function deleteProduct(productId: string) {
    const ok = window.confirm('Delete this product listing?');
    if (!ok) return;

    setDeletingId(productId);

    const { error } = await supabase.from('farm_produce').delete().eq('id', productId);

    setDeletingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await loadProducts();
  }

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 text-gray-700">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading farmer workspace...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <Leaf className="w-4 h-4" />
                Farmer workspace
              </div>

              <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                My Produce Listings
              </h1>

              <p className="mt-3 text-sm md:text-base leading-7 text-gray-600">
                Add and manage the products you want buyers to see in the marketplace.
                Keep your listings accurate so you receive better offers.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => loadProducts()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700"
              >
                <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                onClick={() => setOpenCreate(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Total Listings" value={stats.total} icon={<Package className="w-5 h-5" />} />
          <StatCard label="Active Listings" value={stats.active} icon={<Eye className="w-5 h-5" />} />
          <StatCard label="Hidden Listings" value={stats.hidden} icon={<EyeOff className="w-5 h-5" />} />
          <StatCard
            label="Potential Value"
            value={formatUGX(stats.totalValue)}
            icon={<DollarSign className="w-5 h-5" />}
          />
        </section>

        <section className="mt-6 rounded-[28px] border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loadingProducts ? (
            <div className="p-10 flex items-center justify-center gap-2 text-gray-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Package className="w-8 h-8" />
              </div>
              <h3 className="mt-5 text-xl font-bold text-gray-900">No produce listed yet</h3>
              <p className="mt-2 text-sm text-gray-600 max-w-md mx-auto">
                Add your first product so buyers can discover it in the marketplace.
              </p>
              <button
                onClick={() => setOpenCreate(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create Listing
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-gray-200">
              {products.map((product) => (
                <article key={product.id} className="p-5 md:p-6 hover:bg-gray-50/70 transition-colors">
                  <div className="flex gap-4">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                      {product.photo ? (
                        <img
                          src={product.photo}
                          alt={product.crop_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Package className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
                            {product.crop_name}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                            <span className="capitalize">{product.quality}</span>
                            {product.variety && (
                              <>
                                <span>•</span>
                                <span>{product.variety}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{relativeDate(product.listed_at)}</span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            product.is_available
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {product.is_available ? 'Active' : 'Hidden'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <MiniInfo label="Quantity" value={`${product.quantity} ${product.unit}`} />
                        <MiniInfo
                          label="Price"
                          value={`${formatUGX(product.price_per_unit)} / ${product.unit}`}
                        />
                        <MiniInfo
                          label="Location"
                          value={product.farmer_location || 'Not specified'}
                        />
                        <MiniInfo label="Available From" value={formatDate(product.available_from)} />
                      </div>

                      {product.description && (
                        <p className="mt-4 text-sm text-gray-600 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => toggleAvailability(product)}
                          disabled={togglingId === product.id}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold ${
                            product.is_available
                              ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          } disabled:opacity-60`}
                        >
                          {togglingId === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : product.is_available ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                          {product.is_available ? 'Hide' : 'Show'}
                        </button>

                        <button
                          onClick={() => deleteProduct(product.id)}
                          disabled={deletingId === product.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-semibold disabled:opacity-60"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {openCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-6 md:px-8 py-5 border-b border-gray-200 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50 to-white">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Create Product Listing</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Add the product details buyers should see in the marketplace.
                </p>
              </div>

              <button
                onClick={closeCreate}
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

                <Field label="Category">
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Variety">
                  <input
                    value={form.variety}
                    onChange={(e) => setForm((p) => ({ ...p, variety: e.target.value }))}
                    placeholder="e.g. Screen 18"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Quality *">
                  <select
                    value={form.quality}
                    onChange={(e) => setForm((p) => ({ ...p, quality: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 bg-white outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  >
                    {qualityOptions.map((q) => (
                      <option key={q} value={q}>
                        {q}
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
                    {unitOptions.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Price per unit (UGX) *">
                  <input
                    value={form.price_per_unit}
                    onChange={(e) => setForm((p) => ({ ...p, price_per_unit: e.target.value }))}
                    placeholder="e.g. 6500"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Available from *">
                  <input
                    type="date"
                    value={form.available_from}
                    onChange={(e) => setForm((p) => ({ ...p, available_from: e.target.value }))}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Location text">
                  <input
                    value={form.farmer_location}
                    onChange={(e) => setForm((p) => ({ ...p, farmer_location: e.target.value }))}
                    placeholder="e.g. Kasese, Uganda"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Photo URL">
                  <input
                    value={form.photo}
                    onChange={(e) => setForm((p) => ({ ...p, photo: e.target.value }))}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Latitude">
                  <input
                    value={form.location_lat}
                    onChange={(e) => setForm((p) => ({ ...p, location_lat: e.target.value }))}
                    placeholder="e.g. 0.3476"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <Field label="Longitude">
                  <input
                    value={form.location_lng}
                    onChange={(e) => setForm((p) => ({ ...p, location_lng: e.target.value }))}
                    placeholder="e.g. 32.5825"
                    className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                  />
                </Field>

                <div className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
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
                      {form.location_lat || '—'}, {form.location_lng || '—'}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Field label="Google Maps Link">
                    <input
                      value={form.google_maps_link}
                      onChange={(e) => setForm((p) => ({ ...p, google_maps_link: e.target.value }))}
                      placeholder="https://maps.google.com/?q=..."
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Description">
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Add more details for buyers..."
                      className="w-full min-h-[120px] rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="px-6 md:px-8 py-5 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
              <button
                onClick={closeCreate}
                className="px-4 py-2.5 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={createProduct}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Listing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">{label}</div>
        <div className="rounded-2xl bg-white/80 p-2 text-emerald-700">{icon}</div>
      </div>
      <div className="mt-4 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
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