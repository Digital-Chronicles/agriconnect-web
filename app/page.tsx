import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  ArrowRight,
  MapPin,
  ShoppingBag,
  Tractor,
  Target,
  ShieldCheck,
  BarChart3,
  Users,
  Globe,
} from 'lucide-react';

const features = [
  {
    title: 'Discover Products',
    description:
      'Browse farm produce by location, category, price, and quality from verified farmers.',
    icon: ShoppingBag,
  },
  {
    title: 'Buyer Demands',
    description:
      'Post what you need and let farmers respond with matching offers and quantities.',
    icon: Target,
  },
  {
    title: 'Smart Matching',
    description:
      'Connect nearby farmers and buyers faster using distance, quality, and pricing signals.',
    icon: MapPin,
  },
  {
    title: 'Trusted Marketplace',
    description:
      'Manage listings, compare offers, and grow trade with more transparency.',
    icon: ShieldCheck,
  },
];

const steps = [
  {
    title: 'Farmer lists produce',
    description:
      'Add crop details, quantity, price, quality, and location to reach buyers faster.',
  },
  {
    title: 'Buyer posts demand',
    description:
      'Buyers publish what they need, preferred quality, radius, and target pricing.',
  },
  {
    title: 'Marketplace matches both',
    description:
      'Farmers send offers, buyers compare options, and both sides connect directly.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />

      <main>
        <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-lime-50">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -top-24 left-[-80px] h-72 w-72 rounded-full bg-emerald-200 blur-3xl" />
            <div className="absolute right-[-80px] top-24 h-72 w-72 rounded-full bg-lime-200 blur-3xl" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-20 md:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm">
                <Globe className="h-4 w-4" />
                AgriKonnect Marketplace
              </div>

              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Connecting farmers and buyers with a smarter agricultural marketplace
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Discover produce, post buyer demands, compare offers, and trade with
                confidence. AgriKonnect helps farmers and buyers connect faster using
                location, pricing, and product quality.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/discover"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Explore Products
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Visit Marketplace
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-emerald-700">Farmers</div>
                  <div className="mt-1 text-sm text-slate-500">List products easily</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-emerald-700">Buyers</div>
                  <div className="mt-1 text-sm text-slate-500">Post demands quickly</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-emerald-700">Nearby</div>
                  <div className="mt-1 text-sm text-slate-500">Location-based matching</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-emerald-700">Secure</div>
                  <div className="mt-1 text-sm text-slate-500">Transparent offers</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-xl shadow-emerald-100/50">
                <div className="grid gap-4">
                  <div className="rounded-3xl bg-slate-900 p-6 text-white">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-white/10 p-3">
                        <Tractor className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">For Farmers</h3>
                        <p className="text-sm text-slate-300">
                          Showcase produce and receive buyer offers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 inline-flex rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                        <Users className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold">For Buyers</h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Find farmers, compare prices, and source produce efficiently.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-3 inline-flex rounded-2xl bg-lime-100 p-3 text-lime-700">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <h4 className="font-semibold">For Growth</h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Improve visibility, build trust, and grow trading networks.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-5">
                    <p className="text-sm font-medium text-emerald-800">
                      Use AgriKonnect to connect supply and demand across your agricultural network.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">
              Everything needed for agricultural trade
            </h2>
            <p className="mt-3 text-slate-600">
              Built to help farmers, buyers, and marketplace operators manage produce discovery,
              demand posting, and offer flow in one place.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="inline-flex rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
              <p className="mt-3 text-slate-600">
                A simple flow that makes the marketplace practical for both supply and demand.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Link
              href="/discover"
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="inline-flex rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Discover produce</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Browse listed products and explore nearby farm produce options.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                Open discover
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/buyer/demands"
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="inline-flex rounded-2xl bg-lime-100 p-3 text-lime-700">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Post buyer demands</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create demand posts with quantity, quality, pricing, location, and images.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                Go to buyer demands
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>

            <Link
              href="/marketplace"
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="inline-flex rounded-2xl bg-sky-100 p-3 text-sky-700">
                <MapPin className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Open marketplace</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                See active buyer demands and respond with product offers from your listings.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                Open marketplace
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
          <div className="rounded-[32px] bg-slate-900 px-6 py-10 text-white md:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight">
                  Ready to grow your agricultural marketplace?
                </h2>
                <p className="mt-3 text-slate-300">
                  Start by exploring products, posting a buyer demand, or opening the marketplace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/discover"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}