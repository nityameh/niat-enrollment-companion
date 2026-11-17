import type { Db, DocType, Lead, ObjectionType, University } from "./types";
import { seedKnowledge } from "./knowledge";

const DAY = 86_400_000;

// Demo universities. Names, documents and deadlines are invented for the demo.
export const DEMO_UNIVERSITIES: University[] = [
  {
    id: "uni-a",
    name: "Collaborating University A (demo)",
    city: "Hyderabad",
    demo: true,
    requiredDocs: [
      { id: "marksheet_12", label: "Class 12 marksheet" },
      { id: "marksheet_10", label: "Class 10 marksheet" },
      { id: "transfer_certificate", label: "Transfer certificate" },
    ],
    applicationDeadlineDays: 10,
    minClass12Percent: 50,
    steps: [
      "Fill the university application form",
      "Upload Class 10 and 12 marksheets and transfer certificate",
      "Pay the university application fee (if any) on the university portal",
      "Confirm NIAT enrolment with the first-term payment",
    ],
  },
  {
    id: "uni-b",
    name: "Collaborating University B (demo)",
    city: "Pune",
    demo: true,
    requiredDocs: [
      { id: "marksheet_12", label: "Class 12 marksheet" },
      { id: "transfer_certificate", label: "Transfer certificate" },
    ],
    applicationDeadlineDays: 14,
    minClass12Percent: 50,
    steps: [
      "Fill the university application form",
      "Upload Class 12 marksheet and transfer certificate",
      "Confirm NIAT enrolment with the first-term payment",
    ],
  },
];

function lead(partial: Partial<Lead> & Pick<Lead, "id" | "studentName" | "parentName" | "language" | "city" | "universityId" | "stage">, now: number): Lead {
  return {
    scholarshipPaid: false,
    counselledAt: now - 2 * DAY,
    counsellingNotes: "",
    lastActivityAt: now - 1 * DAY,
    decision: "undecided",
    arm: "companion",
    parentEngaged: false,
    chat: [],
    apiMessages: [],
    objections: [],
    docs: [],
    nudges: [],
    escalations: [],
    phone: [],
    risk: { score: 0, band: "green", reasons: [] },
    ...partial,
  };
}

export function seedDb(): Db {
  const now = Date.now();
  const leads: Lead[] = [
    lead(
      {
        id: "ravi",
        studentName: "Ravi Kumar",
        parentName: "Srinivas Kumar",
        language: "te",
        city: "Warangal",
        universityId: "uni-a",
        stage: "deciding",
        scholarshipPaid: true,
        counselledAt: now - 3 * DAY,
        lastActivityAt: now - 2 * DAY,
        counsellingNotes:
          "Interested in AI. Scored well in NAT maths. Father worried the degree is not 'real' and about placements. Ravi unsure about moving to Hyderabad. Scholarship payment done (demo).",
      },
      now,
    ),
    lead(
      {
        id: "priya",
        studentName: "Priya Sharma",
        parentName: "Anita Sharma",
        language: "hi",
        city: "Pune",
        universityId: "uni-b",
        stage: "applying",
        scholarshipPaid: true,
        counselledAt: now - 6 * DAY,
        lastActivityAt: now - 4 * DAY,
        decision: "joining",
        parentEngaged: true,
        counsellingNotes:
          "Family decided to join. Stuck on university application documents; transfer certificate not yet collected from school.",
      },
      now,
    ),
    lead(
      {
        id: "arjun",
        studentName: "Arjun Reddy",
        parentName: "Lakshmi Reddy",
        language: "en",
        city: "Vijayawada",
        universityId: "uni-a",
        stage: "deciding",
        scholarshipPaid: true,
        counselledAt: now - 8 * DAY,
        lastActivityAt: now - 7 * DAY,
        counsellingNotes:
          "Also waiting for state counselling seat allotment. Mentioned comparing with Scaler School of Technology. Went quiet after counselling.",
      },
      now,
    ),
    lead(
      {
        id: "karthik",
        studentName: "Karthik Murugan",
        parentName: "Meena Murugan",
        language: "ta",
        city: "Madurai",
        universityId: "uni-b",
        stage: "deciding",
        scholarshipPaid: true,
        counselledAt: now - 4 * DAY,
        lastActivityAt: now - 3 * DAY,
        counsellingNotes:
          "Mother prefers Tamil. Worried about hostel safety and the total cost; Karthik is keen on robotics.",
      },
      now,
    ),
    lead(
      {
        id: "sneha",
        studentName: "Sneha Iyer",
        parentName: "Ramesh Iyer",
        language: "en",
        city: "Chennai",
        universityId: "uni-b",
        stage: "enrolled",
        scholarshipPaid: true,
        decision: "joining",
        parentEngaged: true,
        counselledAt: now - 12 * DAY,
        lastActivityAt: now - 1 * DAY,
        counsellingNotes: "Enrolled. All documents verified.",
      },
      now,
    ),
    ...moreFamilies(now),
  ];
  return {
    version: 1,
    clockOffsetDays: 0,
    universities: DEMO_UNIVERSITIES,
    leads,
    events: [],
    knowledge: seedKnowledge(),
    settings: { answerMode: "company_and_public" },
  };
}

// ---------------------------------------------------------------------------
// More synthetic families so the dashboard shows realistic variety.
// ---------------------------------------------------------------------------
type Worry = [ObjectionType, "low" | "medium" | "high", boolean, string];

interface FamilySpec {
  id: string;
  student: string;
  parent: string;
  language: Lead["language"];
  city: string;
  uni: "uni-a" | "uni-b";
  stage: Lead["stage"];
  mode: NonNullable<Lead["mode"]>;
  counselledDaysAgo: number;
  quietDays: number;
  parentEngaged?: boolean;
  decision?: Lead["decision"];
  decisionReason?: string;
  notes: string;
  worries?: Worry[];
  escalation?: string;
  docs?: [DocType, "ok" | "flagged", string?][];
}

const SPECS: FamilySpec[] = [
  { id: "ananya", student: "Ananya Rao", parent: "Shobha Rao", language: "kn", city: "Bengaluru", uni: "uni-b", stage: "deciding", mode: "college_choice", counselledDaysAgo: 3, quietDays: 1, parentEngaged: true, notes: "Mother wants a campus close to Bengaluru; asking about hostel safety for girls.", worries: [["hostel_and_location", "high", false, "Hostel safety for a daughter far from home"]] },
  { id: "faiz", student: "Mohammed Faiz", parent: "Ayesha Begum", language: "hi", city: "Hyderabad", uni: "uni-a", stage: "deciding", mode: "fees_guidance", counselledDaysAgo: 5, quietDays: 2, parentEngaged: true, notes: "Single-income family. Needs clarity on total cost and EMI before committing.", worries: [["fees_and_loans", "high", false, "Total 4-year cost and EMI options"]], escalation: "Family wants an exact fee breakdown and EMI options" },
  { id: "lakshmi", student: "Lakshmi Prasanna", parent: "Venkata Rao", language: "te", city: "Guntur", uni: "uni-a", stage: "applying", mode: "university_enrollment", counselledDaysAgo: 7, quietDays: 4, parentEngaged: true, decision: "joining", notes: "Decided to join. Name on the Class 12 marksheet is spelt differently.", worries: [["paperwork", "medium", false, "Name mismatch on the Class 12 marksheet"]], docs: [["marksheet_12", "flagged", "Name on the document does not match the application"], ["marksheet_10", "ok"]] },
  { id: "aditya", student: "Aditya Kulkarni", parent: "Sunil Kulkarni", language: "en", city: "Pune", uni: "uni-b", stage: "deciding", mode: "program_guidance", counselledDaysAgo: 2, quietDays: 1, notes: "Strong in maths. Wants to know what he will build in year 1 and the placement reality.", worries: [["placements", "medium", false, "Wants realistic placement numbers"]] },
  { id: "fathima", student: "Fathima Nazar", parent: "Nazar Ahmed", language: "ml", city: "Kochi", uni: "uni-b", stage: "deciding", mode: "decision_support", counselledDaysAgo: 6, quietDays: 5, notes: "Father unsure whether the degree is recognised because NIAT is not a university.", worries: [["degree_validity", "high", false, "Is the B.Tech recognised?"]] },
  { id: "rohit", student: "Rohit Verma", parent: "Sanjay Verma", language: "hi", city: "Lucknow", uni: "uni-a", stage: "documents_done", mode: "niat_enrollment", counselledDaysAgo: 9, quietDays: 2, parentEngaged: true, decision: "joining", notes: "All documents verified. Asking how to pay safely and when classes start.", docs: [["marksheet_12", "ok"], ["marksheet_10", "ok"], ["transfer_certificate", "ok"]] },
  { id: "divya", student: "Divya Nair", parent: "Rema Nair", language: "ml", city: "Thiruvananthapuram", uni: "uni-b", stage: "applying", mode: "fees_guidance", counselledDaysAgo: 8, quietDays: 3, parentEngaged: true, decision: "joining", notes: "Joining. Loan question answered; waiting for the transfer certificate from school.", worries: [["fees_and_loans", "medium", true, "Education loan responsibilities"]], docs: [["marksheet_12", "ok"]] },
  { id: "suresh", student: "Suresh Gowda", parent: "Manjunath Gowda", language: "kn", city: "Mysuru", uni: "uni-b", stage: "deciding", mode: "decision_support", counselledDaysAgo: 10, quietDays: 6, notes: "Waiting for a state counselling seat and comparing options. Went quiet.", worries: [["competitor_or_other_option", "high", false, "Waiting for a state college seat"]] },
  { id: "harini", student: "Harini Subramanian", parent: "Subramanian K", language: "ta", city: "Coimbatore", uni: "uni-b", stage: "applying", mode: "university_enrollment", counselledDaysAgo: 8, quietDays: 3, parentEngaged: true, decision: "joining", notes: "Joining. The transfer certificate photo was missing the school seal.", docs: [["marksheet_12", "ok"], ["transfer_certificate", "flagged", "No seal/stamp is visible"]] },
  { id: "vikram", student: "Vikram Singh", parent: "Rajendra Singh", language: "hi", city: "Jaipur", uni: "uni-a", stage: "enrolled", mode: "niat_enrollment", counselledDaysAgo: 14, quietDays: 1, parentEngaged: true, decision: "joining", notes: "Enrolled after the companion answered fee and hostel questions.", worries: [["fees_and_loans", "medium", true, "Fee breakdown"], ["hostel_and_location", "low", true, "Hostel availability"]], docs: [["marksheet_12", "ok"], ["marksheet_10", "ok"], ["transfer_certificate", "ok"]] },
  { id: "neha", student: "Neha Joshi", parent: "Kavita Joshi", language: "en", city: "Indore", uni: "uni-b", stage: "dropped", mode: "closing", counselledDaysAgo: 11, quietDays: 4, decision: "not_joining", decisionReason: "Got a seat in a state college", notes: "Chose a state college seat. Reminders stopped." },
  { id: "saiteja", student: "Sai Teja", parent: "Ramana Murthy", language: "te", city: "Vijayawada", uni: "uni-a", stage: "deciding", mode: "decision_support", counselledDaysAgo: 4, quietDays: 2, parentEngaged: true, notes: "Student keen; father prefers a traditional college. Family disagreement.", worries: [["family_disagreement", "high", false, "Father prefers a traditional college"]] },
  { id: "pooja", student: "Pooja Reddy", parent: "Sravanthi Reddy", language: "te", city: "Hyderabad", uni: "uni-a", stage: "deciding", mode: "college_choice", counselledDaysAgo: 3, quietDays: 1, parentEngaged: true, notes: "Wants to visit the campus before deciding; asks about hostel and transport.", worries: [["hostel_and_location", "medium", false, "Hostel and transport"]] },
  { id: "imran", student: "Imran Khan", parent: "Salma Khan", language: "hi", city: "Bhopal", uni: "uni-b", stage: "applying", mode: "university_enrollment", counselledDaysAgo: 6, quietDays: 2, decision: "joining", notes: "Joining. Class 10 uploaded; Class 12 marksheet pending from the board.", docs: [["marksheet_10", "ok"]] },
];

function moreFamilies(now: number): Lead[] {
  return SPECS.map((f) =>
    lead(
      {
        id: f.id,
        studentName: f.student,
        parentName: f.parent,
        language: f.language,
        city: f.city,
        universityId: f.uni,
        stage: f.stage,
        mode: f.mode,
        scholarshipPaid: true,
        counselledAt: now - f.counselledDaysAgo * DAY,
        lastActivityAt: now - f.quietDays * DAY,
        parentEngaged: Boolean(f.parentEngaged),
        decision: f.decision ?? "undecided",
        decisionReason: f.decisionReason,
        counsellingNotes: f.notes,
        objections: (f.worries ?? []).map(([type, severity, resolved, summary], i) => ({
          id: `${f.id}_obj${i}`,
          type,
          severity,
          resolved,
          summary,
          ts: now - (f.quietDays + 1) * DAY,
        })),
        escalations: f.escalation
          ? [{ id: `${f.id}_esc`, reason: f.escalation, urgency: "normal" as const, ts: now - f.quietDays * DAY, resolved: false }]
          : [],
        docs: (f.docs ?? []).map(([type, status, issue], i) => ({
          id: `${f.id}_doc${i}`,
          type,
          fileName: `${type}.jpg`,
          status,
          issues: issue ? [{ code: "demo", message: issue }] : [],
          extracted: {},
          ts: now - (f.quietDays + 1) * DAY,
          mode: "mock" as const,
        })),
      },
      now,
    ),
  );
}
