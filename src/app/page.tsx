import { Suspense } from "react";
import { StockDashboard } from "@/components/StockDashboard";

/**
 * Loading fallback for the dashboard while URL params are being read.
 */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="h-20 animate-pulse rounded-xl bg-neutral-800/50" />
      {/* Chart + stats skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-neutral-800/50 lg:col-span-2" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-800/50" />
          ))}
        </div>
      </div>
      {/* Multi-stock + correlation skeleton */}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="h-72 animate-pulse rounded-2xl bg-neutral-800/50 xl:col-span-3" />
        <div className="h-72 animate-pulse rounded-2xl bg-neutral-800/50 xl:col-span-2" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <StockDashboard />
        </Suspense>
      </div>
    </main>
  );
}
