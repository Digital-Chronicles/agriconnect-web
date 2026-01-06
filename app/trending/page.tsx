'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supabase from '@/lib/supabaseClient';
import Navbar from '@/components/Navbar';
import { 
  TrendingUp, Clock, Star, Users, Package, DollarSign, 
  MapPin, Calendar, ChevronRight, ArrowRight, Filter, 
  Award, Target, Zap, TrendingDown, BarChart3, RefreshCw
} from 'lucide-react';

interface Product {
  id: string;
  farmer_id: string | null;
  farmer_name: string;
  farmer_location: string;
  crop_name: string;
  crop_category: string;
  variety: string | null;
  quality: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  is_available: boolean;
  listed_at: string;
  photo: string | null;
}

interface CategoryStats {
  category: string;
  count: number;
  icon: string;
}

interface FarmerStats {
  farmer: string;
  count: number;
}

interface DemandStats {
  crop: string;
  count: number;
}

const qualityLabels: Record<string, string> = {
  top: 'Premium',
  standard: 'Standard',
  fair: 'Fair',
};

const qualityColors: Record<string, string> = {
  top: 'bg-gradient-to-r from-emerald-500 to-green-500',
  standard: 'bg-gradient-to-r from-blue-500 to-cyan-500',
  fair: 'bg-gradient-to-r from-amber-500 to-orange-500',
};

const categoryData: Record<string, { icon: string; label: string; color: string }> = {
  fruit: { icon: '🍎', label: 'Fruits', color: 'bg-red-100 text-red-800' },
  vegetable: { icon: '🥦', label: 'Vegetables', color: 'bg-green-100 text-green-800' },
  grain: { icon: '🌾', label: 'Grains', color: 'bg-amber-100 text-amber-800' },
  poultry: { icon: '🐔', label: 'Poultry', color: 'bg-purple-100 text-purple-800' },
  cash_crop: { icon: '💰', label: 'Cash Crops', color: 'bg-yellow-100 text-yellow-800' },
  legume: { icon: '🥜', label: 'Legumes', color: 'bg-orange-100 text-orange-800' },
  other: { icon: '🌱', label: 'Other', color: 'bg-gray-100 text-gray-800' },
};

const formatPrice = (n: number) => `UGX ${Number(n || 0).toLocaleString('en-US')}`;

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
  return `${Math.floor(diffHours / 168)}w ago`;
};

const getCategoryInfo = (category: string) => {
  return categoryData[category] || categoryData.other;
};

export default function TrendingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [premiumProducts, setPremiumProducts] = useState<Product[]>([]);
  const [topCategories, setTopCategories] = useState<CategoryStats[]>([]);
  const [topFarmers, setTopFarmers] = useState<FarmerStats[]>([]);
  const [topDemands, setTopDemands] = useState<DemandStats[]>([]);
  const [topCrops, setTopCrops] = useState<DemandStats[]>([]);
  
  const [activeTab, setActiveTab] = useState<'products' | 'stats'>('products');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

  useEffect(() => {
    loadTrendingData();
  }, [timeRange]);

  const loadTrendingData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load products
      const { data: products } = await supabase
        .from('farm_produce')
        .select('*')
        .eq('is_available', true)
        .order('listed_at', { ascending: false })
        .limit(50);

      const productList: Product[] = (products || []).map(p => ({
        id: p.id,
        farmer_id: p.farmer_id,
        farmer_name: p.farmer_name || 'Unknown Farmer',
        farmer_location: p.farmer_location || 'Uganda',
        crop_name: p.crop_name || 'Produce',
        crop_category: (p.crop_category || 'other').toLowerCase(),
        variety: p.variety,
        quality: (p.quality || 'standard').toLowerCase(),
        quantity: Number(p.quantity || 0),
        unit: p.unit || 'kg',
        price_per_unit: Number(p.price_per_unit || 0),
        is_available: Boolean(p.is_available),
        listed_at: p.listed_at,
        photo: p.photo,
      }));

      // New arrivals (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const arrivals = productList
        .filter(p => new Date(p.listed_at) > sevenDaysAgo)
        .slice(0, 8);

      // Premium products
      const premium = productList
        .filter(p => p.quality === 'top')
        .slice(0, 8);

      // Top categories
      const categoryCounts: Record<string, number> = {};
      productList.forEach(p => {
        const cat = p.crop_category;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      const topCats = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          category,
          count,
          icon: getCategoryInfo(category).icon,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Top farmers
      const farmerCounts: Record<string, number> = {};
      productList.forEach(p => {
        const farmer = p.farmer_name;
        farmerCounts[farmer] = (farmerCounts[farmer] || 0) + 1;
      });

      const topFarms = Object.entries(farmerCounts)
        .map(([farmer, count]) => ({ farmer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Top crops
      const cropCounts: Record<string, number> = {};
      productList.forEach(p => {
        const crop = p.crop_name;
        cropCounts[crop] = (cropCounts[crop] || 0) + 1;
      });

      const topCropList = Object.entries(cropCounts)
        .map(([crop, count]) => ({ crop, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Top demands (if available)
      const { data: demands } = await supabase
        .from('buyer_demands')
        .select('crop_name')
        .eq('status', 'open')
        .limit(100);

      const demandCounts: Record<string, number> = {};
      demands?.forEach(d => {
        if (d.crop_name) {
          const crop = d.crop_name;
          demandCounts[crop] = (demandCounts[crop] || 0) + 1;
        }
      });

      const topDemandList = Object.entries(demandCounts)
        .map(([crop, count]) => ({ crop, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Set all data
      setNewArrivals(arrivals);
      setPremiumProducts(premium);
      setTopCategories(topCats);
      setTopFarmers(topFarms);
      setTopCrops(topCropList);
      setTopDemands(topDemandList);

    } catch (err) {
      setError('Failed to load trending data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    loadTrendingData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64" />
            <div className="h-4 bg-gray-200 rounded w-96" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Market Trends</h1>
            </div>
            <p className="text-gray-600">
              Discover what's hot in the marketplace. Updated in real-time.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-3 font-medium text-sm relative ${activeTab === 'products' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Trending Products
            </div>
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 font-medium text-sm relative ${activeTab === 'stats' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Market Stats
            </div>
          </button>
        </div>

        {activeTab === 'products' ? (
          <>
            {/* New Arrivals */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">New Arrivals</h2>
                  <p className="text-gray-600 text-sm">Fresh listings from farmers</p>
                </div>
                <Link
                  href="/products"
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
                >
                  View all
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              {newArrivals.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No new listings in the last 7 days</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {newArrivals.map(product => {
                    const category = getCategoryInfo(product.crop_category);
                    
                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.id}`}
                        className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <div className="aspect-square bg-gray-100 relative overflow-hidden">
                          {product.photo ? (
                            <img
                              src={product.photo}
                              alt={product.crop_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-4xl">{category.icon}</span>
                            </div>
                          )}
                          <div className="absolute top-2 left-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${qualityColors[product.quality]} text-white`}>
                              {qualityLabels[product.quality] || product.quality}
                            </span>
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1 mb-1">
                            {product.crop_name}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-1 mb-2">
                            {product.farmer_location}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-600 text-sm">
                              {formatPrice(product.price_per_unit)}
                            </span>
                            <span className="text-xs text-gray-500">{product.unit}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Premium Spotlight */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-5 h-5 text-amber-500" />
                    <h2 className="text-xl font-bold text-gray-900">Premium Spotlight</h2>
                  </div>
                  <p className="text-gray-600 text-sm">Top quality products</p>
                </div>
                <Link
                  href="/products?quality=top"
                  className="text-emerald-600 hover:text-emerald-700 font-medium text-sm flex items-center gap-1"
                >
                  View premium
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              
              {premiumProducts.length === 0 ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-8 text-center border border-amber-200">
                  <Award className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                  <p className="text-gray-700">No premium listings available yet</p>
                  <p className="text-gray-600 text-sm mt-1">Check back soon for top quality products</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {premiumProducts.map(product => {
                    const category = getCategoryInfo(product.crop_category);
                    
                    return (
                      <Link
                        key={product.id}
                        href={`/products/${product.id}`}
                        className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-amber-100"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-12 h-12 bg-gradient-to-r from-amber-100 to-orange-100 rounded-lg flex items-center justify-center">
                              <span className="text-2xl">{category.icon}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{product.crop_name}</h3>
                              {product.variety && (
                                <p className="text-sm text-gray-600">Variety: {product.variety}</p>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>{product.farmer_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span>{product.farmer_location}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Package className="w-4 h-4" />
                              <span>{product.quantity} {product.unit} available</span>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-emerald-600">
                                {formatPrice(product.price_per_unit)}
                              </span>
                              <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full text-xs font-semibold">
                                Premium
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Market Stats Tab */
          <div className="space-y-6">
            {/* Top Categories */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Top Categories</h3>
                  <p className="text-sm text-gray-600">Most listed categories</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {topCategories.map((cat, index) => (
                  <div
                    key={cat.category}
                    className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="text-3xl mb-2">{cat.icon}</div>
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {getCategoryInfo(cat.category).label}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{cat.count} listings</span>
                      <span className="text-xs font-bold text-gray-700">#{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Crops & Top Demands */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Top Crops</h3>
                    <p className="text-sm text-gray-600">Most listed crops</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {topCrops.map((crop, index) => (
                    <div
                      key={crop.crop}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{crop.crop}</div>
                          <div className="text-xs text-gray-500">{crop.count} listings</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-700">
                        {Math.round((crop.count / (topCrops[0]?.count || 1)) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Target className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Top Demands</h3>
                    <p className="text-sm text-gray-600">Most requested crops</p>
                  </div>
                </div>
                
                {topDemands.length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600">No demand data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topDemands.map((demand, index) => (
                      <div
                        key={demand.crop}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                            <Target className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{demand.crop}</div>
                            <div className="text-xs text-gray-500">{demand.count} requests</div>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-purple-700">
                          High Demand
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top Farmers */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Top Farmers</h3>
                  <p className="text-sm text-gray-600">Most active sellers</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {topFarmers.map((farmer, index) => (
                  <div
                    key={farmer.farmer}
                    className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold">
                          {farmer.farmer.charAt(0)}
                        </div>
                        {index < 3 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                            {index + 1}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{farmer.farmer}</div>
                        <div className="text-xs text-gray-500">{farmer.count} active listings</div>
                      </div>
                    </div>
                    <div className="text-emerald-600 font-bold">
                      #{index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Market Insights */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-2xl p-6 md:p-8 mt-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-bold">Market Insights</h3>
              </div>
              <p className="text-gray-300 max-w-2xl">
                Based on analysis of {newArrivals.length + premiumProducts.length} listings from the last {timeRange === '24h' ? '24 hours' : timeRange === '7d' ? '7 days' : '30 days'}
              </p>
              <div className="flex flex-wrap gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm">Real-time updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm">Data from {topFarmers.length} farmers</span>
                </div>
              </div>
            </div>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
            >
              Explore Marketplace
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 bg-white rounded-2xl p-6 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Want to be featured here?</h3>
              <p className="text-gray-600">
                List premium quality products and they might appear in Trending!
              </p>
            </div>
            <Link
              href="/products"
              className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <Package className="w-5 h-5" />
              Create Listing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}