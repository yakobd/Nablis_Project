import type { Metadata } from "next";
import { Inter, Lexend, Noto_Sans_Ethiopic } from "next/font/google";
import "./globals.css";
import "./dark-theme.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Heavy geometric face used for page titles in the design.
const lexend = Lexend({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
// Amharic (Ge'ez script) fallback; the faces above have no Ethiopic glyphs.
const ethiopic = Noto_Sans_Ethiopic({ subsets: ["ethiopic"], weight: ["400", "600", "700"], variable: "--font-ethiopic" });

export const metadata: Metadata = {
  title: {
    default: "Nablis Ministry",
    template: "%s | Nablis Ministry",
  },
  description:
    "Nablis Ministry — Spiritual guidance, counseling, and community for the Ethiopian Orthodox Christian diaspora.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable} ${ethiopic.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
