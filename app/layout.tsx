import type { Metadata } from "next"
import {
  ROADSTER_APP_DESCRIPTION,
  ROADSTER_LOGO_PATH,
  ROADSTER_NAME
} from "@/lib/app-brand"
import { getClientAppUrl } from "@/lib/env/client"
import { DEFAULT_LOCAL_APP_URL } from "@/lib/env/shared"
import "./globals.css"

const metadataBaseUrl = (() => {
  const rawAppUrl = getClientAppUrl()
  try {
    return new URL(rawAppUrl)
  } catch {
    return new URL(DEFAULT_LOCAL_APP_URL)
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
      <body className="antialiased">{children}</body>
    </html>
  )
}
