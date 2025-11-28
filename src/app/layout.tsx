import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nasdaq Stock Dashboard",
  description: "Interactive Nasdaq stock dashboard powered by Next.js and Alpha Vantage",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
