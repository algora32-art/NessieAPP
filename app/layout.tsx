import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nessie 2026",
  description: "Sistema Nessie 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
