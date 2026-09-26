import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassicArt Creator — Estudio creativo",
  description: "Crea imágenes, videos, personajes y voces desde un mismo estudio creativo.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
