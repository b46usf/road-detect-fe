"use client"

import lazyWithSkeleton from "@/components/ui/lazyWithSkeleton"

const CameraClient = lazyWithSkeleton(() => import("@/components/camera/CameraClient"), { height: 640 })

export default function CameraPage() {
  return <CameraClient />
}
