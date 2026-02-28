"use client"

import { useEffect } from "react"
import type { StoredDetectionRecord } from "@/lib/admin-storage"
import { closeRoadsterSwal, showDetectionResultSwal } from "@/lib/ui/roadster-swal"

interface DetectionResultModalProps {
  record: StoredDetectionRecord | null
  onClose: () => void
}

export default function DetectionResultModal(props: DetectionResultModalProps) {
  const { record, onClose } = props

  useEffect(() => {
    if (!record) {
      return
    }

    let active = true

    void showDetectionResultSwal(record).finally(() => {
      if (active) {
        onClose()
      }
    })

    return () => {
      active = false
      void closeRoadsterSwal()
    }
  }, [onClose, record])

  return null
}
