import type { DetectionReport } from "@/lib/roboflow-client"
import type { SeverityLevel } from "@/lib/roboflow-utils"

export type CameraStatus = "starting" | "active" | "idle" | "error"
export type GpsStatus = "unsupported" | "tracking" | "ready" | "error"
export type ApiStatus = "idle" | "success" | "error"

export interface CapturedFrame {
  dataUrl: string
  width: number
  height: number
}

export interface DetectionPrediction {
  x: number
  y: number
  width: number
  height: number
  label: string
  confidence: number | null
}

export interface DetectionWithSeverity extends DetectionPrediction {
  severity: SeverityLevel
  areaPercent: number
}

export interface RenderedDetection extends DetectionWithSeverity {
  id: string
  left: number
  top: number
}

export interface SeverityAssessment {
  items: DetectionWithSeverity[]
  totalDamagePercent: number
  counts: {
    ringan: number
    sedang: number
    berat: number
  }
  distributionPercent: {
    ringan: number
    sedang: number
    berat: number
  }
  dominantSeverity: SeverityLevel | null
}

export interface GpsLocation {
  latitude: number
  longitude: number
  accuracy: number | null
  altitude: number | null
  heading: number | null
  speed: number | null
  timestamp: string
  source: string
}

export type DetectionApiReport = DetectionReport
