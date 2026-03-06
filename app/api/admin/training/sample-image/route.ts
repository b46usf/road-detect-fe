import { readString } from "@/lib/common-utils"
import {
  listTrainingSamples,
  readTrainingImageBuffer
} from "@/lib/server/training-storage"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = readString(url.searchParams.get("id"))

  if (!id) {
    return new Response("Parameter id wajib diisi.", { status: 400 })
  }

  const sample = (await listTrainingSamples()).find((item) => item.id === id)
  if (!sample) {
    return new Response("Sample training tidak ditemukan.", { status: 404 })
  }

  try {
    const imageBuffer = await readTrainingImageBuffer(sample)
    const safeFilename = sample.filename.replace(/[^a-zA-Z0-9._-]/g, "_")

    return new Response(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        "content-type": sample.mime || "application/octet-stream",
        "cache-control": "private, no-store",
        "content-disposition": `inline; filename="${safeFilename}"`
      }
    })
  } catch {
    return new Response("Image sample training tidak ditemukan.", { status: 404 })
  }
}
