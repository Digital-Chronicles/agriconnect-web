'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import { 
  ArrowLeft, Phone, MessageCircle, MapPin, Calendar, 
  Package, User, Shield, Truck, Star, ChevronRight,
  CheckCircle, Share2, Heart, AlertCircle, Globe, Eye
} from 'lucide-react';

interface Product {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  farmer_phone: string | null;
  crop_name: string;
  crop_category: string;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  available_from: string;
  listed_at: string;
  is_available: boolean;
  photo: string | null;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  google_maps_link: string | null;
}

const qualityLabels: Record<string, string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

const qualityColors: Record<string, string> = {
  top: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  fair: 'bg-amber-100 text-amber-800 border-amber-200',
};

const categoryIcons: Record<string, { icon: string; label: string }> = {
  fruit: { icon: '🍎', label: 'Fruits' },
  vegetable: { icon: '🥦', label: 'Vegetables' },
  grain: { icon: '🌾', label: 'Grains' },
  poultry: { icon: '🐔', label: 'Poultry' },
  cash_crop: { icon: '💰', label: 'Cash Crops' },
  legume: { icon: '🥜', label: 'Legumes' },
  other: { icon: '🌱', label: 'Other' },
};

const formatPrice = (price: number) => `UGX ${Number(price || 0).toLocaleString('en-US')}`;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric' 
  });
};

const formatRelativeDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

const getPlaceholderImage = (category: string): string => {
  const images: Record<string, string> = {
    poultry: 'https://images.unsplash.com/photo-1562962236-2c224b5ef5f5?w=400&h=300&fit=crop',
    fruit: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=300&fit=crop',
    legume: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&h=300&fit=crop',
    cash_crop: 'https://images.unsplash.com/photo-1592921870789-04563d55041c?w=400&h=300&fit=crop',
    vegetable: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=400&h=300&fit=crop',
    grain: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&h=300&fit=crop',
    other: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
  };
  return images[category] || images.other;
};

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'farmer'>('details');
  const [views, setViews] = useState(124); // Initial view count

  // Fetch main product
  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('farm_produce')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        setError('Product not found or has been removed');
        setLoading(false);
        return;
      }

      const normalizedProduct: Product = {
        id: data.id,
        farmer_id: data.farmer_id,
        farmer_name: data.farmer_name || 'Unknown Farmer',
        farmer_location: data.farmer_location || 'Uganda',
        farmer_phone: data.farmer_phone,
        crop_name: data.crop_name || 'Produce',
        crop_category: (data.crop_category || 'other').toLowerCase(),
        variety: data.variety,
        quality: (data.quality || 'standard').toLowerCase(),
        quantity: Number(data.quantity || 0),
        unit: data.unit || 'kg',
        price_per_unit: Number(data.price_per_unit || 0),
        available_from: data.available_from,
        listed_at: data.listed_at,
        is_available: Boolean(data.is_available),
        photo: data.photo,
        description: data.description,
        location_lat: data.location_lat,
        location_lng: data.location_lng,
        google_maps_link: data.google_maps_link,
      };

      setProduct(normalizedProduct);
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  // Fetch similar products
  useEffect(() => {
    if (!product?.crop_category) return;

    const fetchSimilarProducts = async () => {
      const { data } = await supabase
        .from('farm_produce')
        .select('*')
        .eq('is_available', true)
        .eq('crop_category', product.crop_category)
        .neq('id', product.id)
        .order('listed_at', { ascending: false })
        .limit(4);

      if (data) {
        const normalized = data.map(item => ({
          id: item.id,
          farmer_id: item.farmer_id,
          farmer_name: item.farmer_name || 'Unknown Farmer',
          farmer_location: item.farmer_location || 'Uganda',
          farmer_phone: item.farmer_phone,
          crop_name: item.crop_name || 'Produce',
          crop_category: (item.crop_category || 'other').toLowerCase(),
          variety: item.variety,
          quality: (item.quality || 'standard').toLowerCase(),
          quantity: Number(item.quantity || 0),
          unit: item.unit || 'kg',
          price_per_unit: Number(item.price_per_unit || 0),
          available_from: item.available_from,
          listed_at: item.listed_at,
          is_available: Boolean(item.is_available),
          photo: item.photo,
          description: item.description,
          location_lat: item.location_lat,
          location_lng: item.location_lng,
          google_maps_link: item.google_maps_link,
        }));
        setSimilarProducts(normalized);
      }
    };

    fetchSimilarProducts();
  }, [product?.crop_category, product?.id]);

  // Realtime subscription for the main product
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`product-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'farm_produce',
          filter: `id=eq.${id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setError('Product has been deleted');
            setProduct(null);
            return;
          }

          if (payload.new) {
            const data = payload.new as any;
            const updatedProduct: Product = {
              id: data.id,
              farmer_id: data.farmer_id,
              farmer_name: data.farmer_name || 'Unknown Farmer',
              farmer_location: data.farmer_location || 'Uganda',
              farmer_phone: data.farmer_phone,
              crop_name: data.crop_name || 'Produce',
              crop_category: (data.crop_category || 'other').toLowerCase(),
              variety: data.variety,
              quality: (data.quality || 'standard').toLowerCase(),
              quantity: Number(data.quantity || 0),
              unit: data.unit || 'kg',
              price_per_unit: Number(data.price_per_unit || 0),
              available_from: data.available_from,
              listed_at: data.listed_at,
              is_available: Boolean(data.is_available),
              photo: data.photo,
              description: data.description,
              location_lat: data.location_lat,
              location_lng: data.location_lng,
              google_maps_link: data.google_maps_link,
            };
            setProduct(updatedProduct);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Realtime subscription for similar products
  useEffect(() => {
    if (!product?.crop_category) return;

    const channel = supabase
      .channel(`similar-${product.crop_category}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'farm_produce',
          filter: `crop_category=eq.${product.crop_category}`
        },
        async () => {
          // Refresh similar products when something changes in this category
          const { data } = await supabase
            .from('farm_produce')
            .select('*')
            .eq('is_available', true)
            .eq('crop_category', product.crop_category)
            .neq('id', product.id)
            .order('listed_at', { ascending: false })
            .limit(4);

          if (data) {
            const normalized = data.map(item => ({
              id: item.id,
              farmer_id: item.farmer_id,
              farmer_name: item.farmer_name || 'Unknown Farmer',
              farmer_location: item.farmer_location || 'Uganda',
              farmer_phone: item.farmer_phone,
              crop_name: item.crop_name || 'Produce',
              crop_category: (item.crop_category || 'other').toLowerCase(),
              variety: item.variety,
              quality: (item.quality || 'standard').toLowerCase(),
              quantity: Number(item.quantity || 0),
              unit: item.unit || 'kg',
              price_per_unit: Number(item.price_per_unit || 0),
              available_from: item.available_from,
              listed_at: item.listed_at,
              is_available: Boolean(item.is_available),
              photo: item.photo,
              description: item.description,
              location_lat: item.location_lat,
              location_lng: item.location_lng,
              google_maps_link: item.google_maps_link,
            }));
            setSimilarProducts(normalized);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [product?.crop_category, product?.id]);

  // Increment view count on page load (simulated)
  useEffect(() => {
    if (product) {
      // In a real app, you would send this to your backend
      setViews(prev => prev + 1);
    }
  }, [product]);

  const handleCallFarmer = () => {
    if (!product?.farmer_phone) return;
    window.open(`tel:${product.farmer_phone}`, '_self');
  };

  const handleMessageFarmer = () => {
    if (!product?.farmer_phone) return;
    const phone = product.farmer_phone.replace(/[^\d+]/g, '');
    if (phone.startsWith('0')) {
      window.open(`https://wa.me/256${phone.slice(1)}`, '_blank');
    } else {
      window.open(`https://wa.me/${phone.replace('+', '')}`, '_blank');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.crop_name || 'Farm Product',
        text: `Check out this ${product?.crop_name} from AgriConnect`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  // Check if product is in favorites (from localStorage for now)
  useEffect(() => {
    if (!product) return;
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    setIsFavorite(favorites.includes(product.id));
  }, [product]);

  const handleToggleFavorite = () => {
    if (!product) return;
    
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const newFavorites = isFavorite 
      ? favorites.filter((favId: string) => favId !== product.id)
      : [...favorites, product.id];
    
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    setIsFavorite(!isFavorite);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-[400px] bg-gray-200 rounded-2xl" />
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded-lg" />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-6 bg-gray-200 rounded w-24" />
                <div className="h-32 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {error || 'This product may have been removed or is no longer available.'}
            </p>
            <button
              onClick={() => router.push('/products')}
              className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  const category = categoryIcons[product.crop_category] || categoryIcons.other;
  const imageUrl = product.photo || getPlaceholderImage(product.crop_category);
  const isAvailable = product.is_available && product.quantity > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Back Navigation */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Image Gallery */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-lg">
              <div className="relative aspect-square">
                <img
                  src={imageUrl}
                  alt={product.crop_name}
                  className="w-full h-full object-cover"
                />
                {!isAvailable && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white px-4 py-2 rounded-lg">
                      <span className="font-semibold text-gray-900">Sold Out</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Product Actions */}
              <div className="p-4 flex items-center justify-between border-t">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleFavorite}
                    className={`p-2 rounded-lg ${isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Eye className="w-4 h-4" />
                  <span>{views} views</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{category.icon}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${qualityColors[product.quality]}`}>
                  {qualityLabels[product.quality] || product.quality}
                </span>
              </div>
              
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {product.crop_name}
              </h1>
              
              {product.variety && (
                <p className="text-gray-600 mb-3">Variety: {product.variety}</p>
              )}
              
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-emerald-600">
                  {formatPrice(product.price_per_unit)}
                </span>
                <span className="text-gray-500">/ {product.unit}</span>
              </div>
            </div>

            {/* Stock & Availability */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-900">Available Stock</span>
                </div>
                <span className={`text-sm font-semibold ${isAvailable ? 'text-emerald-600' : 'text-red-600'}`}>
                  {isAvailable ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  {product.quantity} {product.unit} available
                </span>
                <span className="text-sm text-gray-500">
                  Listed {formatRelativeDate(product.listed_at)}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-4">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`pb-3 font-medium text-sm relative ${
                    activeTab === 'details'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Product Details
                </button>
                <button
                  onClick={() => setActiveTab('farmer')}
                  className={`pb-3 font-medium text-sm relative ${
                    activeTab === 'farmer'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Farmer Info
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {activeTab === 'details' ? (
                <>
                  {product.description && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                      <p className="text-gray-600 leading-relaxed">{product.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-medium text-gray-900">{category.label}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Quality Grade</p>
                      <p className="font-medium text-gray-900">{qualityLabels[product.quality] || product.quality}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Available From</p>
                      <p className="font-medium text-gray-900">{formatDate(product.available_from)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">{product.farmer_location}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{product.farmer_name}</h3>
                      <p className="text-sm text-gray-600">Verified Farmer</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{product.farmer_location}</span>
                    </div>
                    
                    {product.farmer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{product.farmer_phone}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">Member since 2023</span>
                    </div>
                  </div>
                  
                  {product.google_maps_link && (
                    <button
                      onClick={() => window.open(product.google_maps_link!, '_blank')}
                      className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="font-medium">View Farm Location</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-gray-500">Verified</p>
                  <p className="text-sm font-medium text-gray-900">Quality Checked</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-xs text-gray-500">Delivery</p>
                  <p className="text-sm font-medium text-gray-900">Negotiable</p>
                </div>
              </div>
            </div>

            {/* Contact Buttons */}
            <div className="sticky bottom-6 lg:static bg-white rounded-2xl p-4 shadow-lg lg:shadow">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleCallFarmer}
                  disabled={!product.farmer_phone || !isAvailable}
                  className="flex-1 bg-emerald-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Call Farmer
                </button>
                <button
                  onClick={handleMessageFarmer}
                  disabled={!product.farmer_phone || !isAvailable}
                  className="flex-1 bg-blue-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </button>
              </div>
              
              {!isAvailable && (
                <p className="text-sm text-red-600 text-center mt-2">
                  This product is currently unavailable
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Similar Products</h2>
              <Link
                href="/products"
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
              >
                View all
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {similarProducts.map((item) => {
                const itemCategory = categoryIcons[item.crop_category] || categoryIcons.other;
                const itemImage = item.photo || getPlaceholderImage(item.crop_category);
                
                return (
                  <Link
                    key={item.id}
                    href={`/products/${item.id}`}
                    className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  >
                    <div className="relative aspect-square overflow-hidden">
                      <img
                        src={itemImage}
                        alt={item.crop_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 left-2">
                        <span className="text-lg">{itemCategory.icon}</span>
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-1 mb-1">
                        {item.crop_name}
                      </h3>
                      {item.variety && (
                        <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                          {item.variety}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-600 text-sm">
                          {formatPrice(item.price_per_unit)}
                        </span>
                        <span className="text-xs text-gray-500">{item.unit}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Safety Tips */}
        <div className="mt-8 bg-emerald-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Safety Tips</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Always verify product quality before purchase</li>
                <li>• Meet in safe, public locations for exchanges</li>
                <li>• Use AgriConnect's secure messaging for communication</li>
                <li>• Report any suspicious activity to our support team</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}