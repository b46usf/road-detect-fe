"use client"

import React from "react"

export default function Skeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`animate-pulse ${className}`}>
      <div className="bg-slate-800/60 rounded-md p-4">
        <div className="mb-3 h-4 w-3/4 rounded bg-slate-700/60" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-700/50" />
          <div className="h-3 w-5/6 rounded bg-slate-700/50" />
          <div className="h-3 w-2/3 rounded bg-slate-700/50" />
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  )
}
