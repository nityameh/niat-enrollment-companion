import type { Db, Lead, University } from "./types";
import { seedKnowledge } from "./knowledge";

const DAY = 86_400_000;

// Demo universities. Names, documents and deadlines are invented for the demo.
export const DEMO_UNIVERSITIES: University[] = [
  {
    id: "uni-a",
    name: "Partner University A (demo)",
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
    name: "Partner University B (demo)",
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
