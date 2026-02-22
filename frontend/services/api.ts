/**
 * API client for the Olea Insurance backend.
 *
 * Base URL is picked up from EXPO_PUBLIC_API_URL env var,
 * falling back to http://localhost:8000 for local dev.
 */

import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host machine's localhost
const DEFAULT_URL = Platform.select({
  android: 'http://10.0.2.2:8000',
  default: 'http://localhost:8000',
});

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL;

// ─── OCR Types ──────────────────────────────────────────────

export interface ExtractionStats {
  total_lines: number;
  matched_fields: number;
  empty_fields: number;
  missing_fields: number;
  failed_fields: number;
  total_files?: number;
}

export interface OCRResponse {
  filename: string;
  extracted_text: string;
  ocr_engine: string;
  fields: Record<string, any>;
  field_confidences: Record<string, number>;
  field_statuses: Record<string, string>; // "extracted"|"empty"|"failed"|"missing"
  confidence: number;
  stats: ExtractionStats;
  unmatched_lines: string[];
}

// ─── OCR Upload ─────────────────────────────────────────────

/**
 * Upload a single image to the OCR extraction endpoint.
 *
 * @param imageUri  Local file URI (from expo-image-picker).
 * @param filename  Display filename (e.g. "scan.jpg").
 * @returns         Parsed OCR response with all 27 fields.
 */
export async function uploadForOCR(
  imageUri: string,
  filename = 'scan.jpg',
): Promise<OCRResponse> {
  const formData = new FormData();

  // React Native FormData accepts { uri, name, type } objects
  formData.append('file', {
    uri: imageUri,
    name: filename,
    type: 'image/jpeg',
  } as any);

  const res = await fetch(`${BASE_URL}/api/v1/ocr/extract`, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type — fetch sets it with the boundary
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OCR request failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Upload multiple images for merged OCR extraction.
 */
export async function uploadMultipleForOCR(
  images: { uri: string; filename: string }[],
): Promise<OCRResponse> {
  const formData = new FormData();

  for (const img of images) {
    formData.append('files', {
      uri: img.uri,
      name: img.filename,
      type: 'image/jpeg',
    } as any);
  }

  const res = await fetch(`${BASE_URL}/api/v1/ocr/extract-multiple`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OCR multi-request failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ─── Prediction Types ───────────────────────────────────────

export interface PredictionRequest {
  User_ID?: string;
  Region_Code?: string;
  Broker_ID?: number | string;
  Broker_Agency_Type?: string;
  Employer_ID?: string;
  Estimated_Annual_Income: number;
  Employment_Status: string;
  Adult_Dependents: number;
  Child_Dependents?: number;
  Infant_Dependents: number;
  Previous_Policy_Duration_Months: number;
  Previous_Claims_Filed: number;
  Years_Without_Claims: number;
  Deductible_Tier?: string;
  Vehicles_on_Policy: number;
  Custom_Riders_Requested: number;
  Acquisition_Channel?: string;
  Payment_Schedule: string;
  Days_Since_Quote: number;
  Underwriting_Processing_Days: number;
  Policy_Start_Month: string;
  Policy_Cancelled_Post_Purchase: number;
  Policy_Start_Year: number;
  Policy_Start_Week: number;
  Policy_Start_Day: number;
  Grace_Period_Extensions: number;
  Existing_Policyholder: number;
  Policy_Amendments_Count: number;
}

export interface PredictionResponse {
  id: string;
  form_id: string;
  model_version: string;
  result: Record<string, any>;
  confidence: number;
  explanation: Record<string, any> | null;
  created_at: string;
}

// ─── Explanation Types ──────────────────────────────────────

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ExplanationResponse {
  prediction_id: string;
  method: string;
  feature_importances: FeatureImportance[];
  summary: string;
  llm_explanation: string | null;
}

// ─── Prediction API ─────────────────────────────────────────

/**
 * Submit form features to get a coverage bundle prediction.
 */
export async function predictFromFeatures(
  features: PredictionRequest,
): Promise<PredictionResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/predictions/from-features`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(features),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Prediction failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Fetch the SHAP/AI explanation for a given prediction.
 */
export async function getExplanation(
  predictionId: string,
): Promise<ExplanationResponse> {
  const res = await fetch(
    `${BASE_URL}/api/v1/explain/${predictionId}`,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Explanation fetch failed (${res.status}): ${body}`);
  }

  return res.json();
}
