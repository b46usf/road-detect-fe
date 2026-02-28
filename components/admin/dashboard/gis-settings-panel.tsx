import { boolLabel } from "@/lib/ui-utils"
import type { GisMapSettings } from "@/lib/admin-storage"

interface GisSettingsPanelProps {
  settings: GisMapSettings
  draft: GisMapSettings
  saveStatus: string | null
  onDraftChange: (key: keyof GisMapSettings, value: GisMapSettings[keyof GisMapSettings]) => void
  onApply: () => void
  onReset: () => void
}

const fieldClassName =
  "w-full rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70"

const toggleClassName =
  "inline-flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200"

export default function GisSettingsPanel(props: GisSettingsPanelProps) {
  const { settings, draft, saveStatus, onDraftChange, onApply, onReset } = props

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm sm:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Konfigurasi GIS Formal</h2>
          <p className="mt-1 text-xs text-slate-400">
            Leaflet + CRS + WMS/WFS + boundary Indonesia dengan struktur konfigurasi siap scale.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] sm:flex sm:flex-wrap">
          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-center">
            Deteksi: {boolLabel(settings.showDetectionPoints)}
          </span>
          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-center">
            Indonesia: {boolLabel(settings.showIndonesiaBoundary)}
          </span>
          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-center">
            WMS: {boolLabel(settings.wmsEnabled)}
          </span>
          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-center">
            WFS: {boolLabel(settings.wfsEnabled)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Spatial & Boundary</h3>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">CRS</span>
              <select
                value={draft.crs}
                onChange={(event) => onDraftChange("crs", event.target.value as GisMapSettings["crs"])}
                className={fieldClassName}
              >
                <option value="EPSG:3857">EPSG:3857 (Web Mercator)</option>
                <option value="EPSG:4326">EPSG:4326 (Geographic)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">Indonesia GeoJSON URL</span>
              <input
                value={draft.indonesiaGeoJsonUrl}
                onChange={(event) => onDraftChange("indonesiaGeoJsonUrl", event.target.value)}
                placeholder="/geo/indonesia-simplified.geojson"
                className={fieldClassName}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Service Layers</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-300">WMS URL</span>
              <input
                value={draft.wmsUrl}
                onChange={(event) => onDraftChange("wmsUrl", event.target.value)}
                placeholder="https://your-geoserver/wms"
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WMS Layer Name</span>
              <input
                value={draft.wmsLayers}
                onChange={(event) => onDraftChange("wmsLayers", event.target.value)}
                placeholder="road-damage-ai atau workspace/model"
                className={fieldClassName}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-300">WMS Format</span>
              <input
                value={draft.wmsFormat}
                onChange={(event) => onDraftChange("wmsFormat", event.target.value)}
                placeholder="image/png"
                className={fieldClassName}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-slate-300">WFS URL</span>
              <input
                value={draft.wfsUrl}
                onChange={(event) => onDraftChange("wfsUrl", event.target.value)}
                placeholder="https://your-geoserver/wfs?typename=..."
                className={fieldClassName}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Layer Toggles</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <label className={toggleClassName}>
            <span>Tampilkan titik deteksi</span>
            <input
              type="checkbox"
              checked={draft.showDetectionPoints}
              onChange={(event) => onDraftChange("showDetectionPoints", event.target.checked)}
            />
          </label>
          <label className={toggleClassName}>
            <span>Tampilkan boundary Indonesia</span>
            <input
              type="checkbox"
              checked={draft.showIndonesiaBoundary}
              onChange={(event) => onDraftChange("showIndonesiaBoundary", event.target.checked)}
            />
          </label>
          <label className={toggleClassName}>
            <span>Aktifkan layer WMS</span>
            <input
              type="checkbox"
              checked={draft.wmsEnabled}
              onChange={(event) => onDraftChange("wmsEnabled", event.target.checked)}
            />
          </label>
          <label className={toggleClassName}>
            <span>WMS transparan</span>
            <input
              type="checkbox"
              checked={draft.wmsTransparent}
              onChange={(event) => onDraftChange("wmsTransparent", event.target.checked)}
            />
          </label>
          <label className={toggleClassName}>
            <span>Aktifkan layer WFS</span>
            <input
              type="checkbox"
              checked={draft.wfsEnabled}
              onChange={(event) => onDraftChange("wfsEnabled", event.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium transition hover:bg-white/10"
        >
          Reset Default GIS
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Terapkan Konfigurasi GIS
        </button>
      </div>

      {saveStatus && (
        <p className="mt-2 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">
          {saveStatus}
        </p>
      )}
    </section>
  )
}
