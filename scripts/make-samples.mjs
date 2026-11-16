// Generates SYNTHETIC sample documents for the demo (no real person, board or school).
// Run: node scripts/make-samples.mjs
import sharp from "sharp";
import fs from "fs";

const OUT = "public/samples";
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function marksheet({ title, board, name, year, rows, total, pct }) {
  const rowSvg = rows
    .map(([subj, max, got], i) => {
      const y = 330 + i * 34;
      return `<text x="70" y="${y}" font-size="20">${esc(subj)}</text><text x="560" y="${y}" font-size="20">${max}</text><text x="700" y="${y}" font-size="20">${got}</text>`;
    })
    .join("");
  const endY = 330 + rows.length * 34;
  return `
  <text x="450" y="70" font-size="26" font-weight="bold" text-anchor="middle">${esc(board)}</text>
  <text x="450" y="110" font-size="22" text-anchor="middle">${esc(title)} - ${year}</text>
  <text x="70" y="180" font-size="21">Name of candidate: <tspan font-weight="bold">${esc(name)}</tspan></text>
  <text x="70" y="215" font-size="21">Roll number: DEMO-${year}-004521</text>
  <line x1="60" y1="270" x2="840" y2="270" stroke="#333"/>
  <text x="70" y="295" font-size="20" font-weight="bold">Subject</text><text x="560" y="295" font-size="20" font-weight="bold">Max</text><text x="700" y="295" font-size="20" font-weight="bold">Obtained</text>
  ${rowSvg}
  <line x1="60" y1="${endY}" x2="840" y2="${endY}" stroke="#333"/>
  <text x="70" y="${endY + 40}" font-size="21" font-weight="bold">Total: ${total}   Percentage: ${pct}</text>
  <text x="70" y="${endY + 80}" font-size="20">Result: PASS</text>`;
}

function tc({ name, college, year, cut }) {
  const top = `
  <text x="450" y="70" font-size="26" font-weight="bold" text-anchor="middle">${esc(college)}</text>
  <text x="450" y="110" font-size="24" text-anchor="middle">TRANSFER CERTIFICATE</text>
  <text x="70" y="190" font-size="21">This is to certify that <tspan font-weight="bold">${esc(name)}</tspan></text>
  <text x="70" y="225" font-size="21">was a bonafide student of this college in Intermediate (MPC)</text>
  <text x="70" y="260" font-size="21">and has left the college on completing the course.</text>
  <text x="70" y="315" font-size="21">Conduct: Good</text>`;
  const bottom = `
  <text x="70" y="370" font-size="21">Date of leaving: 30-04-${year}</text>
  <path d="M600 495 C 615 465, 630 505, 645 475 S 675 500, 690 470 S 720 505, 745 478" fill="none" stroke="#1a2a6c" stroke-width="3"/>
  <text x="600" y="520" font-size="20">Principal (signature)</text>
  <circle cx="680" cy="600" r="45" fill="none" stroke="#1b4f9c" stroke-width="3"/>
  <text x="680" y="606" font-size="14" text-anchor="middle" fill="#1b4f9c">SEAL</text>`;
  return cut ? top : top + bottom;
}

function page(inner, height = 760) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" font-family="Arial, sans-serif">
  <rect width="100%" height="100%" fill="#fbf8f0"/>
  <rect x="20" y="20" width="860" height="${height - 40}" fill="none" stroke="#8a7a50" stroke-width="3"/>
  ${inner}
  <text x="450" y="${height / 2 + 40}" font-size="64" fill="#d33" fill-opacity="0.18" text-anchor="middle" transform="rotate(-20 450 ${height / 2})">SAMPLE - NOT A REAL DOCUMENT</text>
</svg>`);
}

const m12 = {
  title: "Intermediate (Class 12) Marks Memo",
  board: "Demo State Board of Intermediate Education",
  year: "2026",
  rows: [["English", 100, 82], ["Mathematics A", 75, 70], ["Mathematics B", 75, 68], ["Physics", 60, 51], ["Chemistry", 60, 50], ["Telugu", 100, 84]],
  total: "405 / 470",
  pct: "86.4%",
};
const m10 = {
  title: "Secondary School Certificate (Class 10)",
  board: "Demo Board of Secondary Education",
  year: "2024",
  rows: [["First Language", 100, 90], ["English", 100, 88], ["Mathematics", 100, 97], ["Science", 100, 92], ["Social Studies", 100, 88]],
  total: "455 / 500",
  pct: "91.0%",
};

const files = {
  "ravi_marksheet_12_correct.png": page(marksheet({ ...m12, name: "RAVI KUMAR" })),
  "ravi_marksheet_12_name_mismatch.png": page(marksheet({ ...m12, name: "RAVI KUMAAR" })),
  "ravi_marksheet_10_correct.png": page(marksheet({ ...m10, name: "RAVI KUMAR" })),
  "ravi_transfer_certificate_correct.png": page(tc({ name: "RAVI KUMAR", college: "Demo Junior College, Warangal", year: "2026" }), 700),
  "ravi_transfer_certificate_cut.png": page(tc({ name: "RAVI KUMAR", college: "Demo Junior College, Warangal", year: "2026", cut: true }), 340),
};

for (const [name, svg] of Object.entries(files)) {
  await sharp(svg).png().toFile(`${OUT}/${name}`);
  console.log("wrote", name);
}
