import { StockDashboard } from "@/components/StockDashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <StockDashboard />
      </div>
    </main>
  );
}
