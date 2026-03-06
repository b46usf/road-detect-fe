import {
  normalizeImageInput,
  parseDetectedAt,
  parseLocation,
  readString,
  toFiniteNumber
} from "@/lib/common-utils"
import {
  getServerRoboflowModelId,
  getServerRoboflowModelVersion,
  shouldSkipRoboflowKeyValidation
} from "@/lib/env/server"
import { validateRoboflowApiKey } from "@/lib/server/roboflow-api-key-validation"
import { parseOptionalNumber, isOriginAllowed } from "@/lib/server/roboflow-inference-request"
import { applyRoboflowRateLimit } from "@/lib/server/roboflow-rate-limit"
import {
  RoboflowRouteError,
  type InferRequestBody,
  type ParsedRoboflowInferenceRequest
} from "@/lib/server/roboflow-api-types"

const MAX_IMAGE_BASE64_LENGTH = 1_500_000
const VALID_FETCH_SITES = new Set(["same-origin", "same-site", "none"])

async function validateRoboflowRequestEnvelope(request: Request, apiKey: string): Promise<void> {
  const contentType = readString(request.headers.get("content-type")).toLowerCase()
  if (!contentType.includes("application/json")) {
    throw new RoboflowRouteError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type harus application/json.")
  }

  const fetchSite = readString(request.headers.get("sec-fetch-site")).toLowerCase()
  if (fetchSite && !VALID_FETCH_SITES.has(fetchSite)) {
    throw new RoboflowRouteError(403, "FORBIDDEN_ORIGIN", "Permintaan lintas-origin tidak diizinkan.")
  }

  if (!isOriginAllowed(request)) {
    throw new RoboflowRouteError(403, "ORIGIN_NOT_ALLOWED", "Origin request tidak diizinkan.")
  }

  const rateLimit = applyRoboflowRateLimit(request)
  if (!rateLimit.ok) {
    throw new RoboflowRouteError(
      rateLimit.status,
      rateLimit.code,
      rateLimit.message,
      rateLimit.details
    )
  }

  if (shouldSkipRoboflowKeyValidation()) {
    console.info("Skipping Roboflow API key validation via ROBOFLOW_SKIP_KEY_VALIDATION")
    return
  }

  const validation = await validateRoboflowApiKey(apiKey)
  if (!validation.ok) {
    throw new RoboflowRouteError(
      401,
      "INVALID_API_KEY",
      "ROBOFLOW_API_KEY tidak valid atau tidak dapat diverifikasi.",
      { upstream: validation.info ?? null }
    )
  }
}

function parseRoboflowRequestBody(payload: InferRequestBody): ParsedRoboflowInferenceRequest {
  const imageInput = readString(payload.image)
  const modelId = readString(payload.modelId) || getServerRoboflowModelId()
  const requestedModelVersion = readString(payload.modelVersion) || getServerRoboflowModelVersion()

  if (!imageInput) {
    throw new RoboflowRouteError(400, "IMAGE_REQUIRED", "Field `image` wajib diisi (base64/data URL).")
  }

  const confidence = parseOptionalNumber(payload.confidence)
  if (confidence === "invalid") {
    throw new RoboflowRouteError(
      400,
      "INVALID_CONFIDENCE",
      "Field `confidence` harus berupa angka jika dikirim."
    )
  }

  const overlap = parseOptionalNumber(payload.overlap)
  if (overlap === "invalid") {
    throw new RoboflowRouteError(
      400,
      "INVALID_OVERLAP",
      "Field `overlap` harus berupa angka jika dikirim."
    )
  }

  const normalizedImage = normalizeImageInput(imageInput)
  const cleanedBase64 = normalizedImage.replace(/\s+/g, "")
  if (cleanedBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new RoboflowRouteError(413, "PAYLOAD_TOO_LARGE", "Ukuran gambar terlalu besar untuk diproses.", {
      maxBase64Length: MAX_IMAGE_BASE64_LENGTH
    })
  }

  try {
    const buffer = Buffer.from(cleanedBase64, "base64")
    const reencoded = buffer.toString("base64").replace(/=+$/, "")
    const originalNoPad = cleanedBase64.replace(/=+$/, "")

    if (buffer.length === 0 || reencoded !== originalNoPad) {
      throw new Error("invalid base64 payload")
    }
  } catch {
    throw new RoboflowRouteError(
      400,
      "INVALID_BASE64",
      "Field `image` berisi base64 tidak valid atau korup."
    )
  }

  return {
    imageInput,
    cleanedBase64,
    modelId,
    requestedModelVersion,
    confidence,
    overlap,
    detectedAt: parseDetectedAt(payload.detectedAt),
    requestLocation: parseLocation(payload.location),
    requestFrameWidth: toFiniteNumber(payload.frameWidth),
    requestFrameHeight: toFiniteNumber(payload.frameHeight),
    evidence: payload.evidence
  }
}

export async function parseRoboflowInferenceRequest(
  request: Request,
  apiKey: string
): Promise<ParsedRoboflowInferenceRequest> {
  await validateRoboflowRequestEnvelope(request, apiKey)

  let payload: InferRequestBody
  try {
    payload = (await request.json()) as InferRequestBody
  } catch {
    throw new RoboflowRouteError(400, "INVALID_JSON", "Body request harus berupa JSON yang valid.")
  }

  return parseRoboflowRequestBody(payload)
}
