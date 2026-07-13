import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "What’s Next? — 今日、何をする？";
const description = "仕事、遊び、一人時間、回復、自転車の旅、筋トレ、自由な6枠をルーレットで決めるオフラインアプリ。";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "What’s Next?",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "What’s Next?" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: `${basePath}/icon-192.png`, type: "image/png" }], apple: [{ url: `${basePath}/icon-192.png`, type: "image/png" }] },
  openGraph: { title, description, type: "website", images: [{ url: `${basePath}/og.png`, width: 1536, height: 1024, alt: "What’s Next?" }] },
  twitter: { card: "summary_large_image", title, description, images: [`${basePath}/og.png`] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff5701",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
