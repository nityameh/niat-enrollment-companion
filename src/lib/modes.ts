// Agent modes: the same agent behaves like a different specialist depending on where the
// family is in the journey and what they are asking about right now.
import type { Lead, Stage } from "./types";

export type ModeId =
  | "decision_support"
  | "college_choice"
  | "fees_guidance"
  | "program_guidance"
  | "university_enrollment"
  | "niat_enrollment"
  | "closing";

export interface Mode {
  id: ModeId;
  label: string;
  icon: string;
  summary: string; // shown in the UI and the About page
  playbook: string; // added to the agent's instructions while in this mode
  quickReplies: { student: string[]; parent: string[] };
}

export const MODES: Record<ModeId, Mode> = {
  decision_support: {
    id: "decision_support",
    label: "Decision support",
    icon: "🧭",
    summary: "Family is unsure whether to join at all. Help them weigh it honestly.",
    playbook: `MODE: DECISION SUPPORT. The family is deciding whether this is the right step.
- Always answer the question they asked first, with balanced points from the knowledge, including limits (no job guarantee). Never push.
- Then, if useful, ask at most one short question about what matters most to them (career goal, cost, distance, alternatives).
- Offer the written Decision Brief (offer_decision_brief) or a chat with a current student when useful.`,
    quickReplies: {
      student: ["Is this degree actually valid?", "Is it better than a state college seat?", "Should I join or wait for state counselling?"],
      parent: ["ఈ డిగ్రీ నిజమైనదేనా?", "क्या यह डिग्री मान्य है?", "Is this the right choice for my child?"],
    },
  },
  college_choice: {
    id: "college_choice",
    label: "College choice",
    icon: "🏫",
    summary: "Confused about the suggested partner college: location, hostel, which campus.",
    playbook: `MODE: COLLEGE CHOICE. The family is unsure about the suggested partner university or campus.
- Use get_lead_status to see the suggested university. Explain that the degree comes from that university and hostels depend on it, only as the knowledge allows.
- Help them list what to check about the campus (distance, hostel, safety, approvals) without inventing details about any campus.
- If they want a different campus, escalate to a counsellor; you cannot change the allotment yourself.`,
    quickReplies: {
      student: ["Can I choose a different campus?", "Is there a hostel?", "How far is the college?"],
      parent: ["Is the hostel safe for girls?", "Can we visit the campus first?", "हॉस्टल की सुविधा है क्या?"],
    },
  },
  fees_guidance: {
    id: "fees_guidance",
    label: "Fees & scholarship",
    icon: "💰",
    summary: "Questions about total cost, scholarship, loans, refunds and paying safely.",
    playbook: `MODE: FEES & SCHOLARSHIP. Money questions.
- Never state a fee, scholarship amount, refund rule or loan approval that is not in the knowledge. Say exact numbers come from the counsellor in writing.
- Always add the safe-payment rule if the knowledge has it (only official payment links; never share OTP/PIN).
- Escalate to a counsellor for the exact breakdown and offer to book a call.`,
    quickReplies: {
      student: ["How much is the total fee?", "Can I get an education loan?", "Is the scholarship payment refundable?"],
      parent: ["What is the total cost for 4 years?", "నెలవారీ వాయిదాల్లో కట్టొచ్చా?", "Someone asked for my OTP. Is that okay?"],
    },
  },
  program_guidance: {
    id: "program_guidance",
    label: "NIAT programme",
    icon: "🎓",
    summary: "What NIAT teaches, the certificate, placements and student life.",
    playbook: `MODE: NIAT PROGRAMME. Questions about the programme itself.
- Explain curriculum, certificate, clubs and placement facts only from the knowledge, with citations.
- Be explicit that outcomes are not guaranteed if placements come up.
- Offer a chat with current students when the knowledge allows.`,
    quickReplies: {
      student: ["What will I learn in year 1?", "What clubs are there?", "What is the Industry Ready Certificate?"],
      parent: ["Who teaches the classes?", "What are the placement results?", "प्लेसमेंट की गारंटी है क्या?"],
    },
  },
  university_enrollment: {
    id: "university_enrollment",
    label: "University application",
    icon: "📑",
    summary: "The separate university application: documents, mistakes, deadline.",
    playbook: `MODE: UNIVERSITY APPLICATION. The family is applying to the partner university separately.
- Call get_lead_status first. Tell them exactly which documents are missing or flagged and the deadline, nothing more.
- Ask them to send a clear photo of the next missing document with the attachment button.
- If a document was flagged, explain the fix in simple words. Schedule a reminder for the next missing item.`,
    quickReplies: {
      student: ["Which documents are still missing?", "My TC is not ready yet", "What is the last date?"],
      parent: ["What documents do you need?", "ఆఖరి తేదీ ఎప్పుడు?", "Name is spelled wrong on the marksheet"],
    },
  },
  niat_enrollment: {
    id: "niat_enrollment",
    label: "NIAT enrolment",
    icon: "✅",
    summary: "Documents are done. Final step: confirm NIAT enrolment safely.",
    playbook: `MODE: NIAT ENROLMENT. Documents are verified; the last step is confirming the NIAT enrolment.
- Explain that enrolment is confirmed with the first-term payment through the official link from the counsellor (only as the knowledge allows), and the safe-payment rule.
- Answer final doubts briefly and offer a counsellor call. No pressure about timing.`,
    quickReplies: {
      student: ["What happens after I pay?", "When do classes start?", "Can I talk to the counsellor once more?"],
      parent: ["How do we pay safely?", "Will we get a receipt?", "भुगतान के बाद क्या होगा?"],
    },
  },
  closing: {
    id: "closing",
    label: "Respectful close",
    icon: "🤝",
    summary: "Family said no. Thank them, stop reminders, leave the door open.",
    playbook: `MODE: RESPECTFUL CLOSE. The family has decided not to join.
- Thank them warmly, confirm reminders are stopped, and say they can message any time. Do not try to change their mind.`,
    quickReplies: { student: ["Thank you"], parent: ["Thank you"] },
  },
};

/** Default mode from the journey stage, when the message itself does not point elsewhere. */
export function modeForStage(stage: Stage): ModeId {
  switch (stage) {
    case "applying":
      return "university_enrollment";
    case "documents_done":
      return "niat_enrollment";
    case "enrolled":
      return "niat_enrollment";
    case "dropped":
      return "closing";
    default:
      return "decision_support";
  }
}

// Keyword hints in English, Hindi and Telugu. Checked in order; first match wins.
const HINTS: [ModeId, RegExp][] = [
  ["fees_guidance", /fee|fees|cost|price|loan|emi|scholarship|refund|pay|payment|otp|money|lakh|rupee|₹|फीस|शुल्क|लोन|खर्च|पैसा|भुगतान|स्कॉलरशिप|फ़ीस|ఫీజు|ఖర్చు|లోన్|డబ్బు|చెల్లింపు|వాయిదా|స్కాలర్/i],
  ["university_enrollment", /document|marksheet|marks memo|transfer certificate|\btc\b|upload|deadline|last date|application form|apply to|spelled wrong|दस्तावेज़|डॉक्यूमेंट|मार्कशीट|आखिरी तारीख|టీసీ|డాక్యుమెంట్|మార్కుల|ఆఖరి తేదీ|గడువు/i],
  // Comparing with other options is a decision question, even if it mentions a college.
  ["decision_support", /compare|scaler|newton|state seat|state college|eamcet|jee|other college|better than/i],
  ["college_choice", /campus|hostel|college|location|far|distance|visit|which university|safe for|हॉस्टल|कॉलेज|कैंपस|दूर|హాస్టల్|కాలేజీ|క్యాంపస్|దూరం/i],
  ["program_guidance", /curriculum|syllabus|learn|course|subject|certificate|club|placement|job|package|salary|teach|faculty|class|सिलेबस|पढ़ाई|प्लेसमेंट|नौकरी|సిలబస్|ప్లేస్‌మెంట్|ఉద్యోగ|నేర్చు/i],
  ["decision_support", /worth|should i|should we|join|confus|not sure|right choice|valid|real degree|ugc|aicte|मान्य|असली|सोच|నిజమైన|చేరాలా|ఆలోచ/i],
];

/** Pick the mode for this message: what they are asking about now, else the stage default. */
export function routeMode(lead: Pick<Lead, "stage" | "decision">, text: string): { mode: ModeId; reason: "message" | "stage" } {
  if (lead.stage === "dropped" || lead.decision === "not_joining") return { mode: "closing", reason: "stage" };
  // Once documents are done, payment and "what next" questions are about confirming the NIAT enrolment.
  if (
    (lead.stage === "documents_done" || lead.stage === "enrolled") &&
    /pay|payment|receipt|after|start|counsellor|confirm|भुगतान|रसीद|बाद|చెల్లింపు|రసీదు|తర్వాత/i.test(text)
  ) {
    return { mode: "niat_enrollment", reason: "message" };
  }
  for (const [mode, re] of HINTS) if (re.test(text)) return { mode, reason: "message" };
  return { mode: modeForStage(lead.stage), reason: "stage" };
}
