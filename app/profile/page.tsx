// app/profile/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BadgeDollarSign,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Globe,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Upload,
  User,
  X,
  Eye,
} from 'lucide-react';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';

// -------------------- Types --------------------
type Role = 'admin' | 'farmer' | 'buyer' | 'logistics' | 'finance' | 'guest';

type AccountUser = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  role?: Role | string | null;
};

type ProduceCategory = {
  id: number;
  name: string;
  description?: string | null;
  is_active?: boolean | null;
};

type FarmProduceRow = {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  variety: string | null;
  quality: 'top' | 'standard' | 'fair' | string;
  quantity: number;
  unit: 'kg' | 'bag' | 'bunch' | 'piece' | string;
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
  category_id: number | null;
  produce_categories?: { id: number; name: string } | { id: number; name: string }[] | null;
};

type BuyerOrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  buyer_name: string;
  farmer_name: string;
  crop_name: string;
  quantity_kg: number;
  agreed_price_per_kg: number;
  distance_km: number | null;
  quality: string;
  status: 'pending' | 'confirmed' | 'completed' | string;
  created_at: string;
};

// farmer_orders view row (optional)
type FarmerOrderRow = {
  id: string;
  listing_id: string;
  buyer_id: string | null;
  buyer_name: string;
  farmer_name: string;
  crop_name: string;
  quantity_kg: number;
  agreed_price_per_kg: number;
  distance_km: number | null;
  quality: string;
  status: string;
  created_at: string;
  total_price: number | null;
};

type TabKey = 'overview' | 'products' | 'orders' | 'analytics';

// -------------------- Constants --------------------
const PRODUCE_BUCKET = 'produce-photos';

// -------------------- Helpers --------------------
function cap(s?: string | null) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-UG', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-UG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    date
  );
}

function getQualityColor(quality: string) {
  switch (String(quality).toLowerCase()) {
    case 'top':
      return 'bg-gradient-to-r from-amber-500 to-yellow-500';
    case 'standard':
      return 'bg-gradient-to-r from-emerald-500 to-green-500';
    case 'fair':
      return 'bg-gradient-to-r from-blue-500 to-cyan-500';
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-400';
  }
}

function getRoleColor(role?: string | null) {
  switch (String(role || 'guest').toLowerCase()) {
    case 'farmer':
      return 'bg-gradient-to-r from-emerald-500 to-green-600';
    case 'buyer':
      return 'bg-gradient-to-r from-blue-500 to-cyan-600';
    case 'admin':
      return 'bg-gradient-to-r from-purple-500 to-violet-600';
    default:
      return 'bg-gradient-to-r from-gray-500 to-gray-700';
  }
}

function buildGoogleMapsLink(lat?: number | null, lng?: number | null) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function safeRole(role?: string | null): Role {
  const r = String(role || 'guest').toLowerCase();
  const allowed: Role[] = ['admin', 'farmer', 'buyer', 'logistics', 'finance', 'guest'];
  return (allowed.includes(r as Role) ? (r as Role) : 'guest');
}

// -------------------- Component --------------------
export default function ProfilePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auth + profile
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const role = safeRole(user?.role || 'guest');

  // Farmer products
  const [products, setProducts] = useState<FarmProduceRow[]>([]);
  const [categories, setCategories] = useState<ProduceCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Orders
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrderRow[]>([]);
  const [farmerOrders, setFarmerOrders] = useState<FarmerOrderRow[]>([]);

  // Errors & Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add Product Modal (farmer-only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form fields
  const [cropName, setCropName] = useState('');
  const [variety, setVariety] = useState('');
  const [quality, setQuality] = useState<'top' | 'standard' | 'fair'>('standard');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'kg' | 'bag' | 'bunch' | 'piece'>('kg');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [availableFrom, setAvailableFrom] = useState(todayISO());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  // Location
  const [farmerLocation, setFarmerLocation] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const initials = useMemo(() => {
    const f = user?.first_name?.trim()?.[0] ?? '';
    const l = user?.last_name?.trim()?.[0] ?? '';
    const out = (f + l).toUpperCase();
    return out || user?.email?.trim()?.[0]?.toUpperCase() || 'G';
  }, [user]);

  const fullName = useMemo(() => {
    const f = user?.first_name?.trim() || '';
    const l = user?.last_name?.trim() || '';
    const name = `${f} ${l}`.trim();
    return name || (role === 'guest' ? 'Guest' : 'Unnamed user');
  }, [user, role]);

  const isLoggedIn = Boolean(authUserId);

  // Farmer stats
  const totalRevenue = useMemo(() => products.reduce((sum, p) => sum + Number(p.price_per_unit) * Number(p.quantity), 0), [
    products,
  ]);
  const activeProducts = useMemo(() => products.filter((p) => p.is_available).length, [products]);
  const avgPrice = useMemo(() => {
    const qty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
    if (!qty) return 0;
    return totalRevenue / qty;
  }, [products, totalRevenue]);

  // Buyer stats
  const buyerSpend = useMemo(
    () => buyerOrders.reduce((s, o) => s + Number(o.quantity_kg || 0) * Number(o.agreed_price_per_kg || 0), 0),
    [buyerOrders]
  );

  // -------------------- Data loaders --------------------
  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('produce_categories')
        .select('id,name,description,is_active')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadAll = async () => {
    setError(null);
    setSuccess(null);

    const { data: sessionResp } = await supabase.auth.getSession();
    const sessionUser = sessionResp?.session?.user || null;

    // Guest mode
    if (!sessionUser) {
      setAuthUserId(null);
      setUser({ id: 'guest', email: 'guest', first_name: 'Guest', last_name: null, role: 'guest', phone_number: null });
      setProducts([]);
      setBuyerOrders([]);
      setFarmerOrders([]);
      setSuccess(null);
      return;
    }

    const authId = sessionUser.id;
    const email = sessionUser.email?.trim().toLowerCase() || null;

    setAuthUserId(authId);

    if (!email) {
      setError('No email found in session.');
      return;
    }

    // Load profile from accounts_user
    const { data: profile, error: profileError } = await supabase
      .from('accounts_user')
      .select('id,email,first_name,last_name,phone_number,role')
      .eq('email', email)
      .maybeSingle<AccountUser>();

    if (profileError || !profile) {
      setError('Profile not found. Please contact support.');
      setUser(null);
      return;
    }

    setUser(profile);

    const r = safeRole(profile.role);

    // Role-specific loads
    if (r === 'farmer') {
      const [{ data: productsData, error: productsError }, { data: farmerOrdersData }] = await Promise.all([
        supabase.from('farm_produce').select('*, produce_categories(id,name)').eq('farmer_id', authId).order('listed_at', {
          ascending: false,
        }),
        // farmer_orders view doesn’t have farmer_id. We'll filter by farmer_name (works if you store consistent farmer_name).
        supabase.from('farmer_orders').select('*').eq('farmer_name', `${(profile.first_name || '').trim()} ${(profile.last_name || '').trim()}`.trim()).order('created_at', { ascending: false }),
      ]);

      if (productsError) {
        setProducts([]);
        setError('Failed to load products. Please try again.');
      } else {
        setProducts((productsData || []) as FarmProduceRow[]);
      }

      setFarmerOrders((farmerOrdersData || []) as FarmerOrderRow[]);
    }

    if (r === 'buyer') {
      const { data: ordersData, error: ordersError } = await supabase
        .from('market_matches')
        .select('id, listing_id, buyer_id, buyer_name, farmer_name, crop_name, quantity_kg, agreed_price_per_kg, distance_km, quality, status, created_at')
        .eq('buyer_id', authId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (ordersError) {
        setBuyerOrders([]);
        setError('Failed to load your orders.');
      } else {
        setBuyerOrders((ordersData || []) as BuyerOrderRow[]);
      }
    }

    setSuccess('Data loaded');
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      await Promise.all([loadAll(), loadCategories()]);
      if (mounted) setLoading(false);
    };

    init();

    const { data } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return;
      await init();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([loadAll(), loadCategories()]);
    setRefreshing(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // -------------------- Farmer-only Modal helpers --------------------
  const resetForm = () => {
    setCropName('');
    setVariety('');
    setQuality('standard');
    setQuantity('');
    setUnit('kg');
    setPricePerUnit('');
    setAvailableFrom(todayISO());
    setSelectedCategoryId('');
    setDescription('');
    setFarmerLocation('');
    setDistanceKm('');
    setLat(null);
    setLng(null);
    setImageFile(null);
    setImagePreview(null);
    setModalError(null);
    setDragOver(false);
  };

  const openAddModal = () => {
    if (!isLoggedIn) return router.push('/login');
    if (role !== 'farmer') {
      setError('Only farmers can add produce listings.');
      setActiveTab('overview');
      return;
    }
    resetForm();
    setShowAddModal(true);
    if (categories.length === 0) loadCategories();
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const requestLocation = async () => {
    setModalError(null);
    setIsGettingLocation(true);

    if (!navigator.geolocation) {
      setModalError('Geolocation is not supported by this browser.');
      setIsGettingLocation(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setLat(latitude);
      setLng(longitude);

      if (!farmerLocation) setFarmerLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    } catch (err: any) {
      setModalError(`Failed to get location: ${err?.message || 'Permission denied or timeout'}`);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setModalError('Please select a valid image file (JPEG, PNG, WebP, or GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setModalError('Image size should be less than 5MB.');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    const inp = document.getElementById('image-upload') as HTMLInputElement | null;
    if (inp) inp.value = '';
  };

  const uploadProduceImage = async (file: File, farmerId: string) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `produce_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${farmerId}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from(PRODUCE_BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PRODUCE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Failed to generate public URL for image.');
    return data.publicUrl;
  };

  const saveProduct = async () => {
    if (!user || !authUserId) {
      setModalError('User not authenticated. Please sign in again.');
      return;
    }
    if (role !== 'farmer') {
      setModalError('Only farmers can add products.');
      return;
    }

    setModalError(null);
    setSavingProduct(true);

    const name = cropName.trim();
    const locationText = farmerLocation.trim();
    const quantityNum = Number(quantity.trim());
    const priceNum = Number(pricePerUnit.trim());

    if (!name) return (setModalError('Crop name is required.'), setSavingProduct(false));
    if (!locationText) return (setModalError('Produce location is required.'), setSavingProduct(false));
    if (!Number.isFinite(quantityNum) || quantityNum <= 0)
      return (setModalError('Quantity must be a valid number greater than 0.'), setSavingProduct(false));
    if (!Number.isFinite(priceNum) || priceNum <= 0)
      return (setModalError('Price per unit must be a valid number greater than 0.'), setSavingProduct(false));
    if (!availableFrom) return (setModalError('Available from date is required.'), setSavingProduct(false));

    try {
      let photoUrl: string | null = null;
      if (imageFile) photoUrl = await uploadProduceImage(imageFile, authUserId);

      const payload: Record<string, any> = {
        farmer_id: authUserId,
        farmer_name: fullName,
        farmer_location: locationText,
        farmer_phone: user.phone_number ?? null,
        crop_name: name,
        variety: variety.trim() || null,
        quality,
        quantity: Number(quantityNum.toFixed(2)),
        unit,
        price_per_unit: priceNum,
        distance_km: distanceKm.trim() ? Number(distanceKm) : null,
        location_lat: lat,
        location_lng: lng,
        google_maps_link: buildGoogleMapsLink(lat, lng),
        available_from: availableFrom,
        is_available: true,
        photo: photoUrl,
        description: description.trim() || null,
      };

      if (selectedCategoryId !== '') payload.category_id = selectedCategoryId;

      const { error: insertError } = await supabase.from('farm_produce').insert([payload]);

      if (insertError) {
        if (insertError.code === '42501' || insertError.message.toLowerCase().includes('row-level security')) {
          setModalError('Permission denied (RLS). Please fix your RLS policies for farm_produce.');
        } else {
          setModalError(`Database Error: ${insertError.message}`);
        }
        setSavingProduct(false);
        return;
      }

      setSavingProduct(false);
      closeAddModal();
      await loadAll();
      setActiveTab('products');
      setSuccess('Product added successfully');
    } catch (err: any) {
      setModalError(`Unexpected Error: ${err?.message || 'Failed to save product'}`);
      setSavingProduct(false);
    }
  };

  // -------------------- UI bits --------------------
  const StatCard = ({
    title,
    value,
    icon: Icon,
    color = 'emerald',
    subtitle,
  }: {
    title: string;
    value: string;
    icon: any;
    color?: 'emerald' | 'blue' | 'amber' | 'purple';
    subtitle?: string;
  }) => {
    const colorClasses = {
      emerald: 'bg-gradient-to-br from-emerald-500 to-green-600',
      blue: 'bg-gradient-to-br from-blue-500 to-cyan-600',
      amber: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      purple: 'bg-gradient-to-br from-purple-500 to-violet-600',
    };

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg transition">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
            {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
          </div>
          <div className={`h-12 w-12 rounded-xl ${colorClasses[color]} text-white flex items-center justify-center shadow-md`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  };

  const TabButton = ({ tab, label, icon: Icon, count }: { tab: TabKey; label: string; icon: any; count?: number }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-medium transition ${
        activeTab === tab
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm'
          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <div className={`rounded-lg p-2.5 ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span>{label}</span>
      {typeof count === 'number' ? (
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {count}
        </span>
      ) : null}
    </button>
  );

  const ProductCard = ({ product }: { product: FarmProduceRow }) => {
    const totalPrice = Number(product.quantity || 0) * Number(product.price_per_unit || 0);
    const qualityColor = getQualityColor(product.quality);

    const categoryName = (() => {
      const pc = product.produce_categories;
      if (!pc) return '—';
      if (Array.isArray(pc)) return pc[0]?.name || '—';
      return pc.name || '—';
    })();

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-xl hover:border-emerald-200 transition">
        <div className="flex items-start gap-5">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
            {product.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.photo} alt={product.crop_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            )}
            {product.is_available && (
              <div className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-1 text-xs font-medium text-white">
                Active
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{product.crop_name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                    <Tag className="h-3 w-3" />
                    {categoryName}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white ${qualityColor}`}>
                    <Star className="h-3 w-3" />
                    {cap(product.quality)}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-emerald-600">
                  {formatCurrency(Number(product.price_per_unit || 0))}/{product.unit}
                </div>
                <div className="text-sm text-gray-500">Total: {formatCurrency(totalPrice)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Package className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {product.quantity} {product.unit}
                  </div>
                  <div className="text-xs text-gray-500">Quantity</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 truncate">{product.farmer_location}</div>
                  <div className="text-xs text-gray-500">Location</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{formatDateTime(product.listed_at)}</div>
                  <div className="text-xs text-gray-500">Listed</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <BadgeDollarSign className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{formatDate(product.available_from)}</div>
                  <div className="text-xs text-gray-500">Available</div>
                </div>
              </div>
            </div>

            {product.description ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
              <div className="text-xs text-gray-500">{product.is_available ? 'Available for sale' : 'Not available'}</div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/products/${product.id}`}
                  className="rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OrderCard = ({ order }: { order: BuyerOrderRow | FarmerOrderRow }) => {
    const total = Number(order.quantity_kg || 0) * Number(order.agreed_price_per_kg || 0);
    const badge =
      order.status === 'pending'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : order.status === 'confirmed'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 hover:shadow-lg transition">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-bold text-gray-900 truncate">{order.crop_name}</p>
            <p className="text-sm text-gray-600">
              {order.quantity_kg} kg • {formatCurrency(Number(order.agreed_price_per_kg || 0))}/kg
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {('buyer_name' in order ? `Buyer: ${order.buyer_name}` : '')}
              {('farmer_name' in order ? ` • Farmer: ${order.farmer_name}` : '')}
              {order.distance_km !== null ? ` • ${Number(order.distance_km)} km` : ''}
            </p>
            <p className="mt-2 text-xs text-gray-500">Created: {formatDateTime(order.created_at)}</p>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${badge}`}>
              {cap(order.status)}
            </span>
            <p className="mt-3 text-lg font-bold text-emerald-700">{formatCurrency(total)}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
      </div>
    );
  };

  // -------------------- Loading --------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100/50">
        <Navbar />
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 w-64 rounded-xl bg-gray-200" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-gray-200" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  // -------------------- Render --------------------
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100/50">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-emerald-800 to-gray-900 bg-clip-text text-transparent sm:text-4xl">
              Profile
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              {role === 'guest'
                ? 'You are browsing as a guest.'
                : `Welcome back, ${fullName}!`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="rounded-xl border-2 border-gray-200 bg-white px-5 py-2.5 font-bold text-gray-800 hover:bg-gray-50 hover:shadow-sm transition-all inline-flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>

            {isLoggedIn ? (
              <button
                onClick={signOut}
                className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-5 py-2.5 font-bold text-white hover:shadow-lg hover:shadow-red-200 transition inline-flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 font-bold text-white hover:shadow-lg hover:shadow-emerald-200 transition inline-flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <p className="text-red-900">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
              <p className="text-emerald-900">{success}</p>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className={`h-20 w-20 rounded-2xl ${getRoleColor(role)} flex items-center justify-center text-2xl font-bold text-white shadow-xl`}>
                  {initials}
                </div>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                  <Check className="h-4 w-4 text-white" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center gap-2 rounded-full ${getRoleColor(role)} px-4 py-1.5 text-sm font-bold text-white`}>
                    <Shield className="h-3.5 w-3.5" />
                    {cap(role)}
                  </span>

                  {role !== 'guest' && user?.email ? (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {user.email}
                      </span>
                      {user.phone_number ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {user.phone_number}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/products"
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-2.5 font-bold text-white hover:shadow-xl hover:shadow-emerald-200 transition inline-flex items-center gap-2"
              >
                <Globe className="h-4 w-4" />
                Marketplace
              </Link>

              <Link
                href="/discover"
                className="rounded-xl border-2 border-gray-200 bg-white px-5 py-2.5 font-bold text-gray-800 hover:bg-gray-50 transition inline-flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Discover
              </Link>

              {role === 'farmer' ? (
                <button
                  onClick={openAddModal}
                  className="rounded-xl border-2 border-emerald-600 bg-white px-5 py-2.5 font-bold text-emerald-700 hover:bg-emerald-50 transition inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              ) : null}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            {role === 'farmer' && (
              <>
                <StatCard title="Total Products" value={String(products.length)} icon={Package} color="emerald" subtitle={`${activeProducts} active`} />
                <StatCard title="Potential Revenue" value={formatCurrency(totalRevenue)} icon={BadgeDollarSign} color="amber" subtitle="Based on listed stock" />
                <StatCard title="Avg. Price" value={formatCurrency(avgPrice)} icon={DollarSign} color="blue" subtitle="Per unit avg" />
                <StatCard title="Orders" value={String(farmerOrders.length)} icon={ShoppingBag} color="purple" subtitle="From buyers" />
              </>
            )}

            {role === 'buyer' && (
              <>
                <StatCard title="My Orders" value={String(buyerOrders.length)} icon={ShoppingBag} color="blue" subtitle="All statuses" />
                <StatCard title="Estimated Spend" value={formatCurrency(buyerSpend)} icon={BadgeDollarSign} color="amber" subtitle="Based on orders" />
                <StatCard title="Explore" value={'Discover'} icon={MapPin} color="emerald" subtitle="Sellers near you" />
                <StatCard title="Trending" value={'Hot'} icon={BarChart3} color="purple" subtitle="Popular listings" />
              </>
            )}

            {role === 'guest' && (
              <>
                <StatCard title="Mode" value="Guest" icon={User} color="blue" subtitle="Limited features" />
                <StatCard title="Browse" value="Marketplace" icon={Globe} color="emerald" subtitle="See listings" />
                <StatCard title="Discover" value="Near me" icon={MapPin} color="amber" subtitle="Use map view" />
                <StatCard title="Sign in" value="Unlock" icon={Shield} color="purple" subtitle="Orders & selling" />
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-3">
          <TabButton tab="overview" label="Overview" icon={User} />

          {role === 'farmer' ? (
            <TabButton tab="products" label="My Products" icon={Package} count={products.length} />
          ) : null}

          {(role === 'buyer' || role === 'farmer') ? (
            <TabButton
              tab="orders"
              label={role === 'buyer' ? 'My Orders' : 'Orders'}
              icon={ShoppingBag}
              count={role === 'buyer' ? buyerOrders.length : farmerOrders.length}
            />
          ) : null}

          {role !== 'guest' ? <TabButton tab="analytics" label="Analytics" icon={BarChart3} /> : null}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50">
                <User className="h-10 w-10 text-emerald-600" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-gray-900">
                {role === 'farmer'
                  ? 'Manage your produce listings'
                  : role === 'buyer'
                  ? 'Track your orders and discover sellers'
                  : 'Browse as guest'}
              </h3>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
                {role === 'farmer'
                  ? 'Use “My Products” to add and manage your listings. Buyers will contact you directly.'
                  : role === 'buyer'
                  ? 'Use “My Orders” to track purchases and “Discover” to find sellers near you.'
                  : 'You can browse products, trending, and discover sellers. Sign in to buy or sell.'}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/products"
                  className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 transition"
                >
                  Browse Marketplace
                </Link>

                <Link
                  href="/discover"
                  className="rounded-xl border-2 border-gray-200 px-6 py-3 font-bold text-gray-800 hover:bg-gray-50 transition"
                >
                  Discover Nearby
                </Link>

                {!isLoggedIn ? (
                  <Link
                    href="/login"
                    className="rounded-xl border-2 border-emerald-600 px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    Sign In
                  </Link>
                ) : null}

                {role === 'farmer' ? (
                  <button
                    onClick={openAddModal}
                    className="rounded-xl border-2 border-emerald-600 px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    Add Product
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === 'products' && role === 'farmer' && (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">My Products</h2>
                  <p className="mt-1 text-gray-600">Manage your produce listings</p>
                </div>
                <button
                  onClick={openAddModal}
                  className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 transition inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add New Product
                </button>
              </div>

              {products.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-4 text-xl font-bold text-gray-900">No Products Yet</h3>
                  <p className="mt-2 text-gray-600">Add your first product to start selling.</p>
                  <button
                    onClick={openAddModal}
                    className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 transition"
                  >
                    Add Product
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'orders' && (role === 'buyer' || role === 'farmer') && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{role === 'buyer' ? 'My Orders' : 'Orders'}</h2>
                <p className="mt-1 text-gray-600">
                  {role === 'buyer' ? 'Your orders placed with sellers.' : 'Orders buyers placed for your listings.'}
                </p>
              </div>

              {role === 'buyer' && buyerOrders.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                  <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-4 text-xl font-bold text-gray-900">No Orders Yet</h3>
                  <p className="mt-2 text-gray-600">Browse the marketplace and place your first order.</p>
                  <Link href="/products" className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 transition">
                    Browse Marketplace
                  </Link>
                </div>
              ) : null}

              {role === 'farmer' && farmerOrders.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                  <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-4 text-xl font-bold text-gray-900">No Orders Yet</h3>
                  <p className="mt-2 text-gray-600">When buyers order your listings, they will appear here.</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {(role === 'buyer' ? buyerOrders : farmerOrders).map((o: any) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            </>
          )}

          {activeTab === 'analytics' && role !== 'guest' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="mt-4 text-xl font-bold text-gray-900">Analytics</h3>
              <p className="mt-2 text-gray-600">We’ll add charts here (sales over time, top crops, demand areas, etc.).</p>
            </div>
          )}
        </div>
      </main>

      {/* Farmer-only: Add Product Modal */}
      {showAddModal && role === 'farmer' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAddModal} />

          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Add New Product</h3>
                  <p className="mt-1 text-gray-600">Fill in details to list your produce</p>
                </div>
                <button
                  onClick={closeAddModal}
                  className="rounded-xl border border-gray-200 p-2.5 text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-8 py-6">
              {modalError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <p className="text-red-700 text-sm">{modalError}</p>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {/* Product Info */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Crop Name *</label>
                      <input
                        value={cropName}
                        onChange={(e) => setCropName(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. Coffee"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Category</label>
                      <select
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={categoriesLoading}
                      >
                        <option value="">Select category (optional)</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Variety</label>
                      <input
                        value={variety}
                        onChange={(e) => setVariety(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="optional"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Quality *</label>
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="top">Premium</option>
                        <option value="standard">Standard</option>
                        <option value="fair">Fair</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Quantity & Pricing */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Quantity *</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="0.01"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Unit *</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value as any)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="kg">kg</option>
                        <option value="bag">bag</option>
                        <option value="bunch">bunch</option>
                        <option value="piece">piece</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Price / Unit *</label>
                      <input
                        type="number"
                        value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        min="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-bold text-gray-900">Location</p>
                    <button
                      type="button"
                      onClick={requestLocation}
                      disabled={isGettingLocation}
                      className="rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white hover:bg-blue-700 transition inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <Navigation className={`h-4 w-4 ${isGettingLocation ? 'animate-spin' : ''}`} />
                      Use GPS
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Location Name *</label>
                      <input
                        value={farmerLocation}
                        onChange={(e) => setFarmerLocation(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Kasese, Fort Portal..."
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Distance (km)</label>
                      <input
                        type="number"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Latitude</label>
                      <input
                        type="number"
                        value={lat ?? ''}
                        onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="any"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Longitude</label>
                      <input
                        type="number"
                        value={lng ?? ''}
                        onChange={(e) => setLng(e.target.value ? Number(e.target.value) : null)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="any"
                      />
                    </div>
                  </div>
                </div>

                {/* Image */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <p className="font-bold text-gray-900 mb-4">Product Image</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div
                      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
                        dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-emerald-400'
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0] || null;
                        handleFileSelect(file);
                      }}
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                      <p className="text-sm font-bold text-gray-900">Drop image here or click to upload</p>
                      <p className="text-xs text-gray-600 mt-1">Max 5MB</p>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-gray-700 mb-2">Preview</p>
                      <div className="relative h-48 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        {imagePreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute right-3 top-3 h-10 w-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition"
                              aria-label="Remove image"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-gray-400">
                            No image selected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dates & Description */}
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Available From *</label>
                      <input
                        type="date"
                        value={availableFrom}
                        onChange={(e) => setAvailableFrom(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-gray-700">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        rows={4}
                        placeholder="Describe your produce..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 bg-gray-50 px-8 py-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">*</span> Required fields
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    disabled={savingProduct}
                    className="rounded-xl border-2 border-gray-200 px-5 py-2.5 font-bold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveProduct}
                    disabled={savingProduct}
                    className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white hover:bg-emerald-700 transition inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingProduct ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Save Product
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
