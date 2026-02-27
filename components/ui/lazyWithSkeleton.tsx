"use client"

import dynamic from "next/dynamic"
import React from "react"
import Skeleton from "./skeleton"

type ImportFunc = () => Promise<{ default: React.ComponentType<any> }>

export function lazyWithSkeleton(importer: ImportFunc, opts?: { height?: string | number }) {
  const { height } = opts ?? {}
  const className = typeof height === "number" ? `h-[${height}px]` : (typeof height === "string" ? `h-${height}` : "h-80")

  return dynamic(importer, {
    ssr: false,
    loading: () => <Skeleton className={className} />
  })
}

export default lazyWithSkeleton
