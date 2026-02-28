import { useEffect, useState } from "react"
import { mapGeolocationError } from "./camera-utils"
import type { GpsLocation, GpsStatus } from "./types"

export function useGpsTracking() {
  const geolocationSupported = typeof navigator !== "undefined" && !!navigator.geolocation
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>(
    geolocationSupported ? "tracking" : "unsupported"
  )
  const [gpsError, setGpsError] = useState<string | null>(
    geolocationSupported ? null : "Browser tidak mendukung geolokasi GPS."
  )
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null)

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = position.coords

        setGpsLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          altitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
          heading: Number.isFinite(coords.heading) ? coords.heading : null,
          speed: Number.isFinite(coords.speed) ? coords.speed : null,
          timestamp: new Date(position.timestamp).toISOString(),
          source: "gnss"
        })

        setGpsStatus("ready")
        setGpsError(null)
      },
      (error) => {
        setGpsStatus("error")
        setGpsError(mapGeolocationError(error))
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 3_000
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  return {
    gpsStatus,
    gpsError,
    gpsLocation
  }
}
