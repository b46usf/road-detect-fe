import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import {
  ROADSTER_APP_DESCRIPTION,
  ROADSTER_LOGO_PATH,
  ROADSTER_NAME
} from "@/lib/app-brand"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

const metadataBaseUrl = (() => {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!rawAppUrl) {
    return new URL("http://localhost:3000")
  }

  try {
    return new URL(rawAppUrl)
  } catch {
    return new URL("http://localhost:3000")
  }
})()

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: ROADSTER_NAME,
    template: `%s | ${ROADSTER_NAME}`
  },
  description: ROADSTER_APP_DESCRIPTION,
  applicationName: ROADSTER_NAME,
  icons: {
    icon: [{ url: ROADSTER_LOGO_PATH, type: "image/png" }],
    shortcut: [{ url: ROADSTER_LOGO_PATH, type: "image/png" }],
    apple: [{ url: ROADSTER_LOGO_PATH, type: "image/png" }]
  },
  openGraph: {
    title: ROADSTER_NAME,
    description: ROADSTER_APP_DESCRIPTION,
    type: "website",
    images: [{ url: ROADSTER_LOGO_PATH, alt: ROADSTER_NAME }]
  },
  twitter: {
    card: "summary",
    title: ROADSTER_NAME,
    description: ROADSTER_APP_DESCRIPTION,
    images: [ROADSTER_LOGO_PATH]
  }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
