const XLSX = require("xlsx");

const rows = 1000;

function randomNormal(mean, sd) {
  let u = 0, v = 0;

  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

const data = [];

for (let i = 1; i <= rows; i++) {
  const MIC = round(clamp(randomNormal(4.1, 0.35), 2.8, 5.2), 2);
  const UHML = round(clamp(randomNormal(29.0, 1.0), 25.5, 32.5), 1);
  const UI = round(clamp(randomNormal(82.0, 2.2), 74, 88), 1);
  const STR = round(clamp(randomNormal(29.5, 2.0), 23, 35), 1);
  const SFI = round(clamp(randomNormal(8.5, 1.2), 5, 12), 1);
  const Rd = round(clamp(randomNormal(76.0, 2.0), 69, 82), 1);
  const plusB = round(clamp(randomNormal(9.8, 1.1), 6.5, 13), 1);

  data.push({
    Reading_No: i,
    MIC,
    UHML,
    UI,
    STR,
    SFI,
    Rd,
    "+b": plusB,

    MIC_Criteria: MIC < 3.9 ? "Pass" : "Fail",
    UHML_Criteria: UHML < 28.5 ? "Pass" : "Fail",
    UI_Criteria: UI < 80 ? "Pass" : "Fail",
    STR_Criteria: STR < 28.5 ? "Pass" : "Fail",
    SFI_Criteria: SFI > 9.0 ? "Pass" : "Fail",
    Rd_Criteria: Rd < 75 ? "Pass" : "Fail",
    "+b_Criteria": plusB > 10.0 ? "Pass" : "Fail"
  });
}

// Criteria sheet
const criteria = [
  {
    Parameter: "MIC",
    Criteria: "<3.9",
    "% Value": 0
  },
  {
    Parameter: "UHML",
    Criteria: "<28.5",
    "% Value": 0
  },
  {
    Parameter: "UI",
    Criteria: "<80",
    "% Value": 0
  },
  {
    Parameter: "STR",
    Criteria: "<28.5",
    "% Value": 0
  },
  {
    Parameter: "SFI",
    Criteria: ">9.0",
    "% Value": 0
  },
  {
    Parameter: "Rd",
    Criteria: "<75",
    "% Value": 0
  },
  {
    Parameter: "+b",
    Criteria: ">10.0",
    "% Value": 0
  }
];

// Create workbook
const workbook = XLSX.utils.book_new();

// Readings sheet
const readingsSheet = XLSX.utils.json_to_sheet(data);

// Criteria sheet
const criteriaSheet = XLSX.utils.json_to_sheet(criteria);

XLSX.utils.book_append_sheet(
  workbook,
  readingsSheet,
  "HVI_Readings"
);

XLSX.utils.book_append_sheet(
  workbook,
  criteriaSheet,
  "Criteria"
);

// Column widths
readingsSheet["!cols"] = [
  { wch: 12 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 10 },
  { wch: 15 },
  { wch: 17 },
  { wch: 15 },
  { wch: 17 },
  { wch: 17 },
  { wch: 15 },
  { wch: 16 }
];

criteriaSheet["!cols"] = [
  { wch: 15 },
  { wch: 15 },
  { wch: 12 }
];

// Save
const fileName = "HVI_1000_Random_Readings.xlsx";

XLSX.writeFile(workbook, fileName);

console.log(`Excel file created successfully: ${fileName}`);
console.log(`Total readings: ${rows}`);