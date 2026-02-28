import type { Metadata } from "next"
import { ROADSTER_ADMIN_DESCRIPTION, ROADSTER_NAME } from "@/lib/app-brand"

export const metadata: Metadata = {
  title: `${ROADSTER_NAME} Admin Dashboard`,
  description: ROADSTER_ADMIN_DESCRIPTION
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
