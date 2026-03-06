import type { Metadata } from "next"
import { ROADSTER_ADMIN_DESCRIPTION, ROADSTER_NAME } from "@/lib/app-brand"

export const metadata: Metadata = {
  title: `${ROADSTER_NAME} Admin Training`,
  description: `${ROADSTER_ADMIN_DESCRIPTION} Modul ini dipakai untuk kurasi sample dataset dan pipeline training.`
}

export default function AdminTrainingLayout({ children }: { children: React.ReactNode }) {
  return children
}
