import type { Metadata } from "next"
import { ROADSTER_CAMERA_DESCRIPTION, ROADSTER_NAME } from "@/lib/app-brand"

export const metadata: Metadata = {
  title: `${ROADSTER_NAME} Camera`,
  description: ROADSTER_CAMERA_DESCRIPTION
}

export default function CameraLayout({ children }: { children: React.ReactNode }) {
  return children
}
