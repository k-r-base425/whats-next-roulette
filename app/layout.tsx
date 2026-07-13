import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "What’s Next? — 暇な時間を、次の一歩に。";
  const description = "仕事の休憩、遊び、暇つぶし、自転車の旅をルーレットで決めるオフラインアプリ。";
  return {
    title,
    description,
    applicationName: "What’s Next?",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "What’s Next?" },
    formatDetection: { telephone: false },
    icons: { icon: [{ url: "/icon-192.png", type: "image/png" }], apple: [{ url: "/icon-192.png", type: "image/png" }] },
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "What’s Next?" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ff5701",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
