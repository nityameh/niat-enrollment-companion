import "server-only";
import fs from "fs";
import path from "path";
import type { DocIssue, DocRecord, DocType, Lead } from "./types";
import { aiEnabled, jsonCall, textCall } from "./llm";
import { LANG_NAMES } from "./types";
import { getUniversity, logEvent, newId, now, touch, uploadsDir } from "./store";

const DOC_LABEL: Record<DocType, string> = {
  marksheet_12: "Class 12 marksheet",
  marksheet_10: "Class 10 marksheet",
  transfer_certificate: "Transfer certificate",
};

interface Extracted {
  detected_document_type: DocType | "other";
  student_name: string;
  school_or_board: string;
  year: string;
  percentage_text: string;
  is_complete: boolean;
  is_legible: boolean;
  has_signature: boolean;
  has_seal_or_stamp: boolean;
  notes: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    detected_document_type: { type: "string", enum: ["marksheet_12", "marksheet_10", "transfer_certificate", "other"] },
    student_name: { type: "string" },
    school_or_board: { type: "string" },
    year: { type: "string" },
    percentage_text: { type: "string", description: "Overall percentage or aggregate as printed, or empty string" },
    is_complete: { type: "boolean", description: "False if a page, section or the marks table appears cut off or missing" },
    is_legible: { type: "boolean" },
    has_signature: { type: "boolean", description: "True only if a handwritten or printed signature of an official is visible" },
    has_seal_or_stamp: { type: "boolean", description: "True only if an official seal or stamp is visible" },
    notes: { type: "string" },
  },
  required: ["detected_document_type", "student_name", "school_or_board", "year", "percentage_text", "is_complete", "is_legible", "has_signature", "has_seal_or_stamp", "notes"],
  additionalProperties: false,
};

// Known values for the bundled synthetic sample files (used only in mock mode).
const SAMPLE_META: Record<string, Extracted> = {
  "ravi_marksheet_12_correct.png": { detected_document_type: "marksheet_12", student_name: "RAVI KUMAR", school_or_board: "Demo State Board of Intermediate Education", year: "2026", percentage_text: "86.4%", is_complete: true, is_legible: true, has_signature: true, has_seal_or_stamp: true, notes: "" },
  "ravi_marksheet_12_name_mismatch.png": { detected_document_type: "marksheet_12", student_name: "RAVI KUMAAR", school_or_board: "Demo State Board of Intermediate Education", year: "2026", percentage_text: "86.4%", is_complete: true, is_legible: true, has_signature: true, has_seal_or_stamp: true, notes: "" },
  "ravi_marksheet_10_correct.png": { detected_document_type: "marksheet_10", student_name: "RAVI KUMAR", school_or_board: "Demo Board of Secondary Education", year: "2024", percentage_text: "91.0%", is_complete: true, is_legible: true, has_signature: true, has_seal_or_stamp: true, notes: "" },
  "ravi_transfer_certificate_correct.png": { detected_document_type: "transfer_certificate", student_name: "RAVI KUMAR", school_or_board: "Demo Junior College, Warangal", year: "2026", percentage_text: "", is_complete: true, is_legible: true, has_signature: true, has_seal_or_stamp: true, notes: "" },
  "ravi_transfer_certificate_cut.png": { detected_document_type: "transfer_certificate", student_name: "RAVI KUMAR", school_or_board: "Demo Junior College, Warangal", year: "", percentage_text: "", is_complete: false, is_legible: true, has_signature: false, has_seal_or_stamp: false, notes: "Bottom half (signature and seal) missing" },
};

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();

function validate(lead: Lead, expected: DocType, x: Extracted): DocIssue[] {
  const issues: DocIssue[] = [];
  const uni = getUniversity(lead.universityId);
  if (x.detected_document_type !== expected) {
    issues.push({
      code: "wrong_document",
      message: `This looks like ${x.detected_document_type === "other" ? "a different document" : `a ${DOC_LABEL[x.detected_document_type]}`}, not a ${DOC_LABEL[expected]}.`,
    });
  }
  if (!x.is_legible) issues.push({ code: "not_legible", message: "The photo is hard to read. Please upload a clearer, well-lit photo." });
  // For transfer certificates the concrete signature/seal check below is more reliable
  // than asking a vision model whether the page is "complete".
  if (!x.is_complete && expected !== "transfer_certificate") issues.push({ code: "incomplete", message: `Part of the document seems missing${x.notes ? ` (${x.notes})` : ""}. Please upload the full page.` });
  if (expected === "transfer_certificate" && (!x.has_signature || !x.has_seal_or_stamp)) {
    const missing = [!x.has_signature && "signature", !x.has_seal_or_stamp && "seal/stamp"].filter(Boolean).join(" and ");
    issues.push({
      code: "missing_signature_or_seal",
      message: `No ${missing} is visible. A transfer certificate must be signed and stamped by the school; please upload the full page.`,
    });
  }
  if (x.student_name && norm(x.student_name) !== norm(lead.studentName)) {
    issues.push({
      code: "name_mismatch",
      message: `Name on the document is "${x.student_name}" but the application says "${lead.studentName}". Names must match exactly, or the university may reject it. Ask the school to correct it, or tell your counsellor.`,
    });
  }
  if (expected === "marksheet_12" && uni) {
    const pct = parseFloat(x.percentage_text);
    if (!Number.isNaN(pct) && pct < uni.minClass12Percent) {
      issues.push({ code: "check_eligibility", message: `Percentage (${pct}%) is below this demo university's ${uni.minClass12Percent}% threshold. Please confirm eligibility with your counsellor.` });
    }
  }
  return issues;
}

export async function checkDocument(
  lead: Lead,
  expected: DocType,
  fileName: string,
  bytes: Buffer,
  mediaType: "image/png" | "image/jpeg" | "image/webp",
): Promise<DocRecord> {
  // Keep a copy (demo only). Real deployments need consent and auto-deletion.
  const dir = path.join(uploadsDir(), lead.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${Date.now()}_${path.basename(fileName)}`), bytes);

  let extracted: Extracted;
  let mode: "ai" | "mock";
  if (aiEnabled()) {
    extracted = await jsonCall<Extracted>({
      system:
        "You read photos of Indian school documents (marksheets, transfer certificates) for an admissions helper. Extract exactly what is printed. Never guess: use an empty string if a field is not visible. Mark is_complete false if any part of the page is cut off.",
      user: `The family says this is their ${DOC_LABEL[expected]}. Extract the fields.`,
      image: { mediaType, base64: bytes.toString("base64") },
      schema: SCHEMA,
      schemaName: "document_fields",
      effort: "low",
    });
    mode = "ai";
  } else {
    const known = SAMPLE_META[path.basename(fileName)];
    extracted = known ?? {
      detected_document_type: "other",
      student_name: "",
      school_or_board: "",
      year: "",
      percentage_text: "",
      is_complete: true,
      is_legible: false,
      has_signature: false,
      has_seal_or_stamp: false,
      notes: "Mock mode can only read the bundled sample files.",
    };
    mode = "mock";
  }

  const issues = validate(lead, expected, extracted);
  const record: DocRecord = {
    id: newId("doc"),
    type: expected,
    fileName,
    status: issues.length ? "flagged" : "ok",
    issues,
    extracted: extracted as unknown as Record<string, unknown>,
    ts: now(),
    mode,
  };
  lead.docs.push(record);

  // Advance the journey when every required document is verified.
  const uni = getUniversity(lead.universityId);
  const ok = new Set(lead.docs.filter((d) => d.status === "ok").map((d) => d.type));
  if (uni && uni.requiredDocs.every((d) => ok.has(d.id)) && lead.stage !== "enrolled") {
    lead.stage = "documents_done";
  } else if (lead.stage === "deciding" && record.status === "ok") {
    lead.stage = "applying";
  }

  if (lead.mode !== "university_enrollment" && lead.stage !== "documents_done") {
    lead.mode = "university_enrollment";
    logEvent(lead.id, "mode_changed", { mode: "university_enrollment", reason: "document" });
  }
  logEvent(lead.id, "document_checked", { type: expected, status: record.status, issues: issues.map((i) => i.code) });
  const summary =
    record.status === "ok"
      ? `${DOC_LABEL[expected]} checked: looks good.`
      : `${DOC_LABEL[expected]} needs attention:\n- ${issues.map((i) => i.message).join("\n- ")}`;
  let message = summary;
  if (mode === "ai" && lead.language !== "en") {
    try {
      message =
        (await textCall({
          system: `Translate this message for an Indian parent into ${LANG_NAMES[lead.language]}, in simple everyday words. Keep names, document names and numbers exactly. Output only the translation.`,
          user: summary,
          maxTokens: 800,
        })) || summary;
    } catch {
      // Fall back to English if translation fails.
    }
  }
  lead.chat.push({ id: newId("m"), role: "agent", text: `${message}${mode === "mock" ? "\n\n(mock mode)" : ""}`, ts: now(), kind: "document" });
  touch(lead);
  return record;
}
