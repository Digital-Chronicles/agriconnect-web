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
  Edit,
  Globe,
  LogOut,
  Mail,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShoppingBag,
  Star,
  Tag,
  Trash2,
  Upload,
  User,
  X,
  Eye,
  Settings,
  Building,
  Home,
  Award,
  Calendar,
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
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  preferred_language?: string | null;
  updated_at?: string;
  verified?: boolean;
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

type FarmerProfile = {
  id: string;
  auth_user_id: string | null;
  accounts_user_id: string | null;
  farm_name: string;
  farm_location: string;
  farm_size: number | null;
  farm_size_unit: string | null;
  crops_grown: string[] | null;
  years_of_experience: number | null;
  certification: string | null;
  bio: string | null;
  profile_image_url: string | null;
  total_products_listed: number | null;
  total_sales: number | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
};

type TabKey = 'overview' | 'products' | 'orders' | 'analytics' | 'settings';

// -------------------- Constants --------------------
const PRODUCE_BUCKET = 'produce-photos';
const PROFILE_BUCKET = 'profile-images';

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

  // Farmer data
  const [products, setProducts] = useState<FarmProduceRow[]>([]);
  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(null);
  const [farmerOrders, setFarmerOrders] = useState<BuyerOrderRow[]>([]);

  // Buyer data
  const [buyerOrders, setBuyerOrders] = useState<BuyerOrderRow[]>([]);

  // Settings state
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingFarmerProfile, setEditingFarmerProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Profile form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Farmer profile form fields
  const [farmName, setFarmName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [farmSize, setFarmSize] = useState<string>('');
  const [farmSizeUnit, setFarmSizeUnit] = useState('acres');
  const [yearsOfExperience, setYearsOfExperience] = useState<string>('');
  const [certification, setCertification] = useState('');
  const [bio, setBio] = useState('');
  const [cropsGrown, setCropsGrown] = useState<string[]>([]);
  const [newCrop, setNewCrop] = useState('');

  // Profile image
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  // Add Product Modal (farmer-only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [cropName, setCropName] = useState('');
  const [variety, setVariety] = useState('');
  const [quality, setQuality] = useState<'top' | 'standard' | 'fair'>('standard');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<'kg' | 'bag' | 'bunch' | 'piece'>('kg');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [availableFrom, setAvailableFrom] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Errors & Messages
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Stats
  const totalRevenue = useMemo(() => products.reduce((sum, p) => sum + Number(p.price_per_unit) * Number(p.quantity), 0), [products]);
  const activeProducts = useMemo(() => products.filter((p) => p.is_available).length, [products]);
  const avgPrice = useMemo(() => {
    const qty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
    if (!qty) return 0;
    return totalRevenue / qty;
  }, [products, totalRevenue]);
  const buyerSpend = useMemo(
    () => buyerOrders.reduce((s, o) => s + Number(o.quantity_kg || 0) * Number(o.agreed_price_per_kg || 0), 0),
    [buyerOrders]
  );

  // -------------------- Data loaders --------------------
  const loadAll = async () => {
    setError(null);
    setSuccess(null);

    const { data: sessionResp } = await supabase.auth.getSession();
    const sessionUser = sessionResp?.session?.user || null;

    if (!sessionUser) {
      setAuthUserId(null);
      setUser({ id: 'guest', email: 'guest', first_name: 'Guest', last_name: null, role: 'guest', phone_number: null });
      setProducts([]);
      setBuyerOrders([]);
      setFarmerOrders([]);
      setFarmerProfile(null);
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
      .select('*')
      .eq('email', email)
      .maybeSingle<AccountUser>();

    if (profileError || !profile) {
      setError('Profile not found. Please contact support.');
      setUser(null);
      return;
    }

    setUser(profile);

    // Set profile form fields
    setFirstName(profile.first_name || '');
    setLastName(profile.last_name || '');
    setPhoneNumber(profile.phone_number || '');
    setLocation(profile.location || '');
    setLocationLat(profile.location_lat || null);
    setLocationLng(profile.location_lng || null);

    const r = safeRole(profile.role);

    // Role-specific loads
    if (r === 'farmer') {
      const [
        { data: productsData },
        { data: farmerOrdersData },
        { data: farmerProfileData }
      ] = await Promise.all([
        supabase
          .from('farm_produce')
          .select('*, produce_categories(id,name)')
          .eq('farmer_id', authId)
          .order('listed_at', { ascending: false }),
        supabase
          .from('market_matches')
          .select('*')
          .eq('farmer_id', authId)
          .order('created_at', { ascending: false }),
        supabase
          .from('farmer_profiles')
          .select('*')
          .eq('auth_user_id', authId)
          .maybeSingle<FarmerProfile>()
      ]);

      setProducts((productsData || []) as FarmProduceRow[]);
      setFarmerOrders(farmerOrdersData || []);
      
      if (farmerProfileData) {
        setFarmerProfile(farmerProfileData);
        // Set farmer profile form fields
        setFarmName(farmerProfileData.farm_name || '');
        setFarmLocation(farmerProfileData.farm_location || '');
        setFarmSize(farmerProfileData.farm_size?.toString() || '');
        setFarmSizeUnit(farmerProfileData.farm_size_unit || 'acres');
        setYearsOfExperience(farmerProfileData.years_of_experience?.toString() || '');
        setCertification(farmerProfileData.certification || '');
        setBio(farmerProfileData.bio || '');
        setCropsGrown(farmerProfileData.crops_grown || []);
        setProfileImagePreview(farmerProfileData.profile_image_url);
      }
    }

    if (r === 'buyer') {
      const { data: ordersData } = await supabase
        .from('market_matches')
        .select('*')
        .eq('buyer_id', authId)
        .order('created_at', { ascending: false });

      setBuyerOrders(ordersData || []);
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      setLoading(true);
      await loadAll();
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
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  // -------------------- Profile Update Functions --------------------
  const requestLocation = async () => {
    setIsGettingLocation(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
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
      setLocationLat(latitude);
      setLocationLng(longitude);
      
      if (!location) {
        setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (err: any) {
      setError(`Failed to get location: ${err?.message || 'Permission denied or timeout'}`);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const uploadProfileImage = async (file: File, userId: string) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `profile_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${userId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Failed to generate public URL for image.');
    return data.publicUrl;
  };

  const handleProfileImageSelect = (file: File | null) => {
    if (!file) {
      setProfileImageFile(null);
      setProfileImagePreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Image size should be less than 3MB.');
      return;
    }

    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
  };

  const removeProfileImage = () => {
    setProfileImageFile(null);
    setProfileImagePreview(null);
  };

  const saveUserProfile = async () => {
    if (!user || !authUserId) {
      setError('User not authenticated.');
      return;
    }

    setSavingProfile(true);
    setError(null);

    try {
      const updates: any = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phoneNumber.trim() || null,
        location: location.trim() || null,
        location_lat: locationLat,
        location_lng: locationLng,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('accounts_user')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update farmer profile if exists
      if (role === 'farmer' && farmerProfile) {
        const farmerUpdates: any = {
          farm_name: farmName.trim(),
          farm_location: farmLocation.trim(),
          farm_size: farmSize ? parseFloat(farmSize) : null,
          farm_size_unit: farmSizeUnit,
          years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          certification: certification.trim() || null,
          bio: bio.trim() || null,
          crops_grown: cropsGrown.length > 0 ? cropsGrown : null,
          updated_at: new Date().toISOString(),
        };

        // Upload profile image if selected
        if (profileImageFile) {
          const imageUrl = await uploadProfileImage(profileImageFile, authUserId);
          farmerUpdates.profile_image_url = imageUrl;
        }

        const { error: farmerUpdateError } = await supabase
          .from('farmer_profiles')
          .update(farmerUpdates)
          .eq('id', farmerProfile.id);

        if (farmerUpdateError) throw farmerUpdateError;
      }

      // Create farmer profile if doesn't exist and user is farmer
      if (role === 'farmer' && !farmerProfile) {
        const newFarmerProfile: any = {
          auth_user_id: authUserId,
          accounts_user_id: user.id,
          farm_name: farmName.trim(),
          farm_location: farmLocation.trim(),
          farm_size: farmSize ? parseFloat(farmSize) : null,
          farm_size_unit: farmSizeUnit,
          years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          certification: certification.trim() || null,
          bio: bio.trim() || null,
          crops_grown: cropsGrown.length > 0 ? cropsGrown : null,
        };

        if (profileImageFile) {
          const imageUrl = await uploadProfileImage(profileImageFile, authUserId);
          newFarmerProfile.profile_image_url = imageUrl;
        }

        const { error: createError } = await supabase
          .from('farmer_profiles')
          .insert([newFarmerProfile]);

        if (createError) throw createError;
      }

      setEditingProfile(false);
      setEditingFarmerProfile(false);
      await loadAll();
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(`Failed to update profile: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const addCrop = () => {
    const crop = newCrop.trim();
    if (crop && !cropsGrown.includes(crop)) {
      setCropsGrown([...cropsGrown, crop]);
      setNewCrop('');
    }
  };

  const removeCrop = (crop: string) => {
    setCropsGrown(cropsGrown.filter(c => c !== crop));
  };

  // -------------------- Product Modal Functions --------------------
  const resetProductForm = () => {
    setCropName('');
    setVariety('');
    setQuality('standard');
    setQuantity('');
    setUnit('kg');
    setPricePerUnit('');
    setAvailableFrom(todayISO());
    setDescription('');
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
    resetProductForm();
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    resetProductForm();
  };

  const uploadProduceImage = async (file: File, farmerId: string) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `produce_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
    const path = `${farmerId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(PRODUCE_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });
    
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(PRODUCE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('Failed to generate public URL for image.');
    return data.publicUrl;
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
  };

  const saveProduct = async () => {
    if (!user || !authUserId) {
      setModalError('User not authenticated.');
      return;
    }

    setModalError(null);
    setSavingProduct(true);

    const name = cropName.trim();
    const quantityNum = Number(quantity.trim());
    const priceNum = Number(pricePerUnit.trim());

    if (!name) {
      setModalError('Crop name is required.');
      setSavingProduct(false);
      return;
    }
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setModalError('Quantity must be a valid number greater than 0.');
      setSavingProduct(false);
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setModalError('Price per unit must be a valid number greater than 0.');
      setSavingProduct(false);
      return;
    }
    if (!availableFrom) {
      setModalError('Available from date is required.');
      setSavingProduct(false);
      return;
    }

    try {
      let photoUrl: string | null = null;
      if (imageFile) {
        photoUrl = await uploadProduceImage(imageFile, authUserId);
      }

      const payload = {
        farmer_id: authUserId,
        farmer_name: fullName,
        farmer_location: farmLocation || location || 'Unknown',
        farmer_phone: phoneNumber || null,
        crop_name: name,
        variety: variety.trim() || null,
        quality,
        quantity: Number(quantityNum.toFixed(2)),
        unit,
        price_per_unit: priceNum,
        distance_km: distanceKm.trim() ? Number(distanceKm) : null,
        location_lat: lat || locationLat,
        location_lng: lng || locationLng,
        available_from: availableFrom,
        is_available: true,
        photo: photoUrl,
        description: description.trim() || null,
        listed_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('farm_produce')
        .insert([payload]);

      if (insertError) throw insertError;

      closeAddModal();
      await loadAll();
      setSuccess('Product added successfully!');
    } catch (err: any) {
      setModalError(`Failed to save product: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingProduct(false);
    }
  };

  // -------------------- UI Components --------------------
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
            {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
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
      {typeof count === 'number' && (
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-medium ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {count}
        </span>
      )}
    </button>
  );

  const ProductCard = ({ product }: { product: FarmProduceRow }) => {
    const totalPrice = Number(product.quantity || 0) * Number(product.price_per_unit || 0);
    const qualityColor = getQualityColor(product.quality);

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

            {product.description && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm text-gray-600 line-clamp-2">{product.description}</p>
              </div>
            )}

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

  const OrderCard = ({ order }: { order: BuyerOrderRow }) => {
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
              {role === 'buyer' ? `Farmer: ${order.farmer_name}` : `Buyer: ${order.buyer_name}`}
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

  // -------------------- Settings Tab Content --------------------
  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Profile Settings</h3>
            <p className="text-sm text-gray-600">Update your personal information</p>
          </div>
          <button
            onClick={() => setEditingProfile(!editingProfile)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
          >
            {editingProfile ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            {editingProfile ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {editingProfile ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5"
              />
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="+256 700 123456"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={isGettingLocation}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Navigation className={`h-3 w-3 ${isGettingLocation ? 'animate-spin' : ''}`} />
                  {isGettingLocation ? 'Getting location...' : 'Use current location'}
                </button>
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                placeholder="City, Region"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationLat || ''}
                  onChange={(e) => setLocationLat(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="-1.2921"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={locationLng || ''}
                  onChange={(e) => setLocationLng(e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="36.8219"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">First Name</label>
                <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{firstName || 'Not set'}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Last Name</label>
                <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{lastName || 'Not set'}</p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Email</label>
              <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{user?.email}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Phone Number</label>
              <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{phoneNumber || 'Not set'}</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Location</label>
              <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{location || 'Not set'}</p>
            </div>

            {locationLat && locationLng && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Coordinates</label>
                <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">
                  {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Farmer Profile Section */}
      {role === 'farmer' && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Farm Profile</h3>
              <p className="text-sm text-gray-600">Update your farm information</p>
            </div>
            <button
              onClick={() => setEditingFarmerProfile(!editingFarmerProfile)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
            >
              {editingFarmerProfile ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
              {editingFarmerProfile ? 'Cancel' : 'Edit Farm Profile'}
            </button>
          </div>

          {editingFarmerProfile ? (
            <div className="space-y-4">
              {/* Profile Image */}
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <label className="mb-2 block text-sm font-medium text-gray-700">Profile Image</label>
                  <div className="relative">
                    <div className="h-48 w-full rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                      {profileImagePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profileImagePreview} alt="Profile" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-16 w-16 text-gray-400" />
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleProfileImageSelect(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <div className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-emerald-700 transition">
                          Upload
                        </div>
                      </label>
                      {profileImagePreview && (
                        <button
                          onClick={removeProfileImage}
                          className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-center text-sm font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:w-2/3 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Farm Name *</label>
                    <input
                      type="text"
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Green Valley Farm"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Farm Location *</label>
                    <input
                      type="text"
                      value={farmLocation}
                      onChange={(e) => setFarmLocation(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Wakiso, Central Region"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Farm Size</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={farmSize}
                          onChange={(e) => setFarmSize(e.target.value)}
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                          placeholder="5.0"
                        />
                        <select
                          value={farmSizeUnit}
                          onChange={(e) => setFarmSizeUnit(e.target.value)}
                          className="rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                        >
                          <option value="acres">Acres</option>
                          <option value="hectares">Hectares</option>
                          <option value="square_meters">Square Meters</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Years of Experience</label>
                      <input
                        type="number"
                        value={yearsOfExperience}
                        onChange={(e) => setYearsOfExperience(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                        placeholder="5"
                        min="0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Certification</label>
                    <input
                      type="text"
                      value={certification}
                      onChange={(e) => setCertification(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Organic, Fair Trade, etc."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Tell us about your farm..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Crops Grown</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newCrop}
                        onChange={(e) => setNewCrop(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 focus:border-emerald-500 focus:ring-emerald-500"
                        placeholder="Add a crop"
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCrop())}
                      />
                      <button
                        type="button"
                        onClick={addCrop}
                        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-white hover:bg-emerald-700 transition"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cropsGrown.map((crop) => (
                        <span
                          key={crop}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800"
                        >
                          {crop}
                          <button
                            type="button"
                            onClick={() => removeCrop(crop)}
                            className="text-emerald-600 hover:text-emerald-800"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <div className="h-48 w-full rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                    {farmerProfile?.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={farmerProfile.profile_image_url}
                        alt="Farm Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Home className="h-16 w-16 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:w-2/3 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Farm Name</label>
                    <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{farmName || 'Not set'}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Farm Location</label>
                    <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{farmLocation || 'Not set'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Farm Size</label>
                      <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">
                        {farmSize ? `${farmSize} ${farmSizeUnit}` : 'Not set'}
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Years of Experience</label>
                      <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">
                        {yearsOfExperience || 'Not set'} years
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Certification</label>
                    <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{certification || 'Not set'}</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Bio</label>
                    <p className="rounded-lg bg-gray-50 px-4 py-2.5 text-gray-900">{bio || 'Not set'}</p>
                  </div>

                  {cropsGrown.length > 0 && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Crops Grown</label>
                      <div className="flex flex-wrap gap-2">
                        {cropsGrown.map((crop) => (
                          <span
                            key={crop}
                            className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800"
                          >
                            {crop}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      {(editingProfile || editingFarmerProfile) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                setEditingProfile(false);
                setEditingFarmerProfile(false);
              }}
              className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveUserProfile}
              disabled={savingProfile}
              className="rounded-xl bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {savingProfile ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

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

                  {role !== 'guest' && user?.email && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {user.email}
                      </span>
                      {phoneNumber && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="inline-flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {phoneNumber}
                          </span>
                        </>
                      )}
                    </div>
                  )}
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

              {role === 'farmer' && (
                <button
                  onClick={openAddModal}
                  className="rounded-xl border-2 border-emerald-600 bg-white px-5 py-2.5 font-bold text-emerald-700 hover:bg-emerald-50 transition inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            {role === 'farmer' ? (
              <>
                <StatCard title="Total Products" value={String(products.length)} icon={Package} color="emerald" subtitle={`${activeProducts} active`} />
                <StatCard title="Potential Revenue" value={formatCurrency(totalRevenue)} icon={BadgeDollarSign} color="amber" subtitle="Based on listed stock" />
                <StatCard title="Avg. Price" value={formatCurrency(avgPrice)} icon={DollarSign} color="blue" subtitle="Per unit avg" />
                <StatCard title="Orders" value={String(farmerOrders.length)} icon={ShoppingBag} color="purple" subtitle="From buyers" />
              </>
            ) : role === 'buyer' ? (
              <>
                <StatCard title="My Orders" value={String(buyerOrders.length)} icon={ShoppingBag} color="blue" subtitle="All statuses" />
                <StatCard title="Estimated Spend" value={formatCurrency(buyerSpend)} icon={BadgeDollarSign} color="amber" subtitle="Based on orders" />
                <StatCard title="Explore" value="Discover" icon={MapPin} color="emerald" subtitle="Sellers near you" />
                <StatCard title="Trending" value="Hot" icon={BarChart3} color="purple" subtitle="Popular listings" />
              </>
            ) : (
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

          {role === 'farmer' && (
            <TabButton tab="products" label="My Products" icon={Package} count={products.length} />
          )}

          {(role === 'buyer' || role === 'farmer') && (
            <TabButton
              tab="orders"
              label={role === 'buyer' ? 'My Orders' : 'Orders'}
              icon={ShoppingBag}
              count={role === 'buyer' ? buyerOrders.length : farmerOrders.length}
            />
          )}

          {role !== 'guest' && <TabButton tab="analytics" label="Analytics" icon={BarChart3} />}
          
          {role !== 'guest' && <TabButton tab="settings" label="Settings" icon={Settings} />}
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
                  ? 'Use "My Products" to add and manage your listings. Buyers will contact you directly.'
                  : role === 'buyer'
                  ? 'Use "My Orders" to track purchases and "Discover" to find sellers near you.'
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

                {!isLoggedIn && (
                  <Link
                    href="/login"
                    className="rounded-xl border-2 border-emerald-600 px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    Sign In
                  </Link>
                )}

                {role === 'farmer' && (
                  <button
                    onClick={openAddModal}
                    className="rounded-xl border-2 border-emerald-600 px-6 py-3 font-bold text-emerald-700 hover:bg-emerald-50 transition"
                  >
                    Add Product
                  </button>
                )}
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
              ) : role === 'farmer' && farmerOrders.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                  <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto" />
                  <h3 className="mt-4 text-xl font-bold text-gray-900">No Orders Yet</h3>
                  <p className="mt-2 text-gray-600">When buyers order your listings, they will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {(role === 'buyer' ? buyerOrders : farmerOrders).map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'analytics' && role !== 'guest' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="mt-4 text-xl font-bold text-gray-900">Analytics</h3>
              <p className="mt-2 text-gray-600">We'll add charts here (sales over time, top crops, demand areas, etc.).</p>
            </div>
          )}

          {activeTab === 'settings' && role !== 'guest' && renderSettingsTab()}
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