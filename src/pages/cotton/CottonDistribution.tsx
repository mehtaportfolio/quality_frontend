import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useRolePermissions, type Role } from "../../hooks/useRolePermissions";
import { API_BASE_URL } from "../../config";

/* ====== CONFIG ====== */
const excludedCols = ["LEAF", "CG", "AREA", "COUNT", "MAT", "SCI", "CSP"];
/* ==================== */

interface SectionData {
  header: string[];
  rows: any[][];
}

interface CottonCriterion {
  id: number;
  parameter: string;
  operator: string;
  criteria_value: number;
  percent_value: number | null;
}

interface CottonDistributionProps {
  user: {
    role: Role;
    full_name: string;
    id: string;
  };
  onBack: () => void;
}

const CottonDistribution: React.FC<CottonDistributionProps> = ({ user, onBack }) => {
  const permissions = useRolePermissions(user.role);
  const [rows, setRows] = useState<any[][]>([]);
  const [header, setHeader] = useState<string[]>([]);
  const [uniqueLots, setUniqueLots] = useState<string[]>([]);
  const [uniqueSuppliers, setUniqueSuppliers] = useState<string[]>([]);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [pdfHeader, setPdfHeader] = useState("Bale Summary Report");
  const [pdfRemarks, setPdfRemarks] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [activeView, setActiveView] = useState<"distribution" | "averages">("distribution");
  const [criteria, setCriteria] = useState<CottonCriterion[]>([]);
  const [criteriaDraft, setCriteriaDraft] = useState<CottonCriterion[]>([]);
  const [criteriaLoaded, setCriteriaLoaded] = useState(false);
  const [criteriaError, setCriteriaError] = useState("");
  const [isEditingCriteria, setIsEditingCriteria] = useState(false);
  const [isSavingCriteria, setIsSavingCriteria] = useState(false);
  
  const [sectionBlocks, setSectionBlocks] = useState<Record<string, any[][]>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [showLotDropdown, setShowLotDropdown] = useState(false);
  const [showSupDropdown, setShowSupDropdown] = useState(false);

  const resetState = () => {
    setRows([]);
    setHeader([]);
    setUniqueLots([]);
    setUniqueSuppliers([]);
    setSelectedLots(new Set());
    setSelectedSuppliers(new Set());
    setActiveView("distribution");
    setSectionBlocks({});
    setSectionOrder([]);
    setSelectedSections(new Set());
  };

  const roundTo = (num: number, decimals: number) => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  const computeDecimalsForStep = (step: number) => {
    if (step >= 1) return 0;
    const s = String(step);
    if (s.includes(".")) return s.split(".")[1].length;
    return 0;
  };

  const cleanNumericValue = (val: any): number | null => {
    if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) return null;
    const n = Number(val);
    return Number.isFinite(n) ? n : null;
  };

  const formatNum = (n: number) => {
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const formatAverageParameterHeader = (name: string) => {
    const aliases: Record<string, string> = {
      MIC: "MIC",
      MICRON: "MIC",
      LEN: "LEN",
      LENGTH: "LEN",
      UNIF: "UNIF",
      STR: "STR",
      STRENGTH: "STR",
      ELONG: "ELG",
      ELG: "ELG",
    };
    return aliases[name.trim().toUpperCase()] || name;
  };

  const summarizeParameterValues = (values: number[]) => {
    if (values.length === 0) return { max: null, min: null, cv: null };
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return {
      max: Math.max(...values),
      min: Math.min(...values),
      cv: mean === 0 ? null : (Math.sqrt(variance) / Math.abs(mean)) * 100,
    };
  };

  const averageResults = useMemo(() => {
    const filtered = rows.filter((row) =>
      selectedLots.has(String(row[1]).trim()) &&
      selectedSuppliers.has(String(row[0]).trim())
    );
    const parameterColumns = header
      .map((name, index) => ({ name: String(name).trim(), index }))
      .filter(({ name, index }) => index >= 2 && name && filtered.some((row) => cleanNumericValue(row[index]) !== null));
    const byLot = new Map<string, Map<number, number[]>>();

    filtered.forEach((row) => {
      const lot = String(row[1] ?? "").trim();
      if (!lot) return;
      if (!byLot.has(lot)) byLot.set(lot, new Map());
      const lotParameters = byLot.get(lot)!;
      parameterColumns.forEach(({ index }) => {
        const value = cleanNumericValue(row[index]);
        if (value === null) return;
        const values = lotParameters.get(index) || [];
        values.push(value);
        lotParameters.set(index, values);
      });
    });

    const lots = Array.from(byLot, ([lot, valuesByColumn]) => ({
      lot,
      averages: parameterColumns.map(({ index }) => {
        const values = valuesByColumn.get(index) || [];
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }),
      statistics: parameterColumns.map(({ index }) => summarizeParameterValues(valuesByColumn.get(index) || [])),
    }));
    const overall = parameterColumns.map(({ index }) => {
      const values = filtered.map((row) => cleanNumericValue(row[index])).filter((value): value is number => value !== null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    });
    const overallStatistics = parameterColumns.map(({ index }) => summarizeParameterValues(
      filtered.map((row) => cleanNumericValue(row[index])).filter((value): value is number => value !== null)
    ));

    return { parameterColumns, lots, overall, overallStatistics };
  }, [header, rows, selectedLots, selectedSuppliers]);

  const averageDisplayColumns = averageResults.parameterColumns.flatMap(({ name }, parameterIndex) => {
    const normalizedName = name.trim().toUpperCase();
    const isMic = normalizedName === "MIC" || normalizedName === "MICRON";
    const isPlusB = normalizedName === "+B";
    const columns: Array<{ parameterIndex: number; kind: "average" | "max" | "min" | "cv"; label: string; highlightAbove?: number }> = [
      { parameterIndex, kind: "average", label: formatAverageParameterHeader(name) },
    ];
    if (isMic || isPlusB) {
      const metricLabel = isMic ? "MIC" : "+B";
      columns.push(
        { parameterIndex, kind: "max", label: `${metricLabel} MAX` },
        { parameterIndex, kind: "min", label: `${metricLabel} MIN` },
        { parameterIndex, kind: "cv", label: `${metricLabel} CV%`, highlightAbove: isMic ? 4.5 : 5 },
      );
    }
    return columns;
  });

  const formatAverageRow = (averages: Array<number | null>, statistics: Array<{ max: number | null; min: number | null; cv: number | null }>) =>
    averageDisplayColumns.map(({ parameterIndex, kind }) => {
      const value = kind === "average" ? averages[parameterIndex] : statistics[parameterIndex]?.[kind];
      if (value === null || value === undefined) return "N/A";
      const parameterName = averageResults.parameterColumns[parameterIndex].name.trim().toUpperCase();
      const isMic = parameterName === "MIC" || parameterName === "MICRON";
      const decimalPlaces = isMic && kind !== "cv" ? 2 : 1;
      return kind === "cv" ? `${value.toFixed(decimalPlaces)}%` : value.toFixed(decimalPlaces);
    });

  const formatOverallStatisticRow = (kind: "min" | "max" | "range" | "cv") =>
    averageDisplayColumns.map(({ parameterIndex, kind: displayKind }) => {
      if (displayKind !== "average") return "";
      const statistics = averageResults.overallStatistics[parameterIndex];
      const value = kind === "range"
        ? statistics.max !== null && statistics.min !== null ? statistics.max - statistics.min : null
        : statistics[kind];
      if (value === null) return "N/A";
      const parameterName = averageResults.parameterColumns[parameterIndex].name.trim().toUpperCase();
      const isMic = parameterName === "MIC" || parameterName === "MICRON";
      const decimalPlaces = isMic && (kind === "min" || kind === "max") ? 2 : 1;
      return kind === "cv" ? `${value.toFixed(decimalPlaces)}%` : value.toFixed(decimalPlaces);
    });

  const overallStatisticRows = [
    { label: "Overall Min", kind: "min" as const },
    { label: "Overall Max", kind: "max" as const },
    { label: "Overall Range", kind: "range" as const },
    { label: "Overall CV%", kind: "cv" as const },
  ];

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetState();

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    const combined: any[][] = [];
    let headerCopied = false;
    workbook.SheetNames.forEach((name) => {
      const sheetAOA = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[name], { header: 1, defval: "" });
      if (!sheetAOA || sheetAOA.length === 0) return;
      if (!headerCopied) {
        combined.push(sheetAOA[0]);
        headerCopied = true;
      }
      for (let r = 1; r < sheetAOA.length; r++) {
        const row = sheetAOA[r];
        if (!row || row.every((v) => String(v).trim() === "")) continue;
        if (row.some((v) => String(v).toLowerCase().includes("total"))) continue;
        combined.push(row);
      }
    });

    if (combined.length < 2) {
      alert("No data rows found after merging sheets.");
      return;
    }

    const h = combined[0].map(val => String(val || "").trim());
    const r = combined.slice(1);

    setHeader(h);
    setRows(r);

    const lots = [...new Set(r.map((row) => String(row[1] || "").trim()).filter(Boolean))];
    const suppliers = [...new Set(r.map((row) => String(row[0] || "").trim()).filter(Boolean))];

    setUniqueLots(lots);
    setUniqueSuppliers(suppliers);
    setSelectedLots(new Set(lots));
    setSelectedSuppliers(new Set(suppliers));
  };

  const downloadTemplate = () => {
    const headers = ["Supplier", "Lot No", "MIC", "LEN", "UNIF", "SFI", "STR", "ELG", "RD", "+B", "TRASH"];
    const aoa = [headers];
    for (let i = 0; i < 5; i++) {
      aoa.push(new Array(headers.length).fill(""));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Sample_Template.xlsx");
  };

  const recomputeSections = () => {
    if (rows.length === 0) return;

    const filtered = rows.filter((r) =>
      selectedLots.has(String(r[1]).trim()) &&
      selectedSuppliers.has(String(r[0]).trim())
    );
    const totalBales = filtered.length;

    const newSectionBlocks: Record<string, any[][]> = {};
    const newSectionOrder: string[] = [];

    // === Lot vs Bale ===
    const lotCounts: Record<string, number> = {};
    filtered.forEach((r) => {
      const lot = r[1] !== undefined ? String(r[1]).trim() : "";
      if (!lot) return;
      lotCounts[lot] = (lotCounts[lot] || 0) + 1;
    });
    const lotAOA: any[][] = [["Lot No", "No. of Bales"]];
    Object.entries(lotCounts).forEach(([lot, count]) => lotAOA.push([lot, count]));
    lotAOA.push(["Total", totalBales]);

    newSectionBlocks["Lot vs No. of Bales"] = lotAOA;
    newSectionOrder.push("Lot vs No. of Bales");

    // === Criteria Summary ===
    const sourceParameters: Record<string, string[]> = {
      MIC: ["MIC", "MICRON"],
      UHML: ["LEN", "LENGTH", "UHML"],
      UI: ["UNIF", "UI"],
      STR: ["STR", "STRENGTH"],
      SFI: ["SFI"],
      RD: ["RD"],
      "+B": ["+B"],
    };

    const criteriaAOA = [["Parameter", "Criteria", "% Value"]];
    criteria.forEach((criterion) => {
      const parameterAliases = sourceParameters[criterion.parameter.toUpperCase()] || [criterion.parameter];
      const colIdx = header.findIndex((h) => parameterAliases.includes(String(h).trim().toUpperCase()));
      if (colIdx !== -1) {
        const values = filtered.map((r) => cleanNumericValue(r[colIdx])).filter((v): v is number => v !== null);
        if (values.length === 0) return;

        const threshold = Number(criterion.criteria_value);
        const count = values.filter((v) => {
          const value = roundTo(v, 8);
          switch (criterion.operator) {
            case "<": return value < threshold;
            case "<=": return value <= threshold;
            case ">": return value > threshold;
            case ">=": return value >= threshold;
            case "=": return value === threshold;
            default: return false;
          }
        }).length;
        const pct = (count / values.length) * 100;
        criteriaAOA.push([criterion.parameter, `${criterion.operator}${formatNum(Number(criterion.criteria_value))}`, pct.toFixed(1) + "%"]);
      }
    });
    newSectionBlocks["Criteria Summary"] = criteriaAOA;
    newSectionOrder.push("Criteria Summary");

    // === Parameters ===
    for (let c = 2; c < header.length; c++) {
      const paramName = String(header[c]).trim();
      if (!paramName) continue;
      if (excludedCols.includes(paramName.toUpperCase())) continue;

      const values = filtered.map((r) => cleanNumericValue(r[c])).filter((v): v is number => v !== null);
      if (values.length === 0) continue;

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);

      let stepSize = 1;
      switch (paramName.toUpperCase()) {
        case "MICRON": stepSize = 0.1; break;
        case "LENGTH": stepSize = 1; break;
        case "RD": stepSize = 2; break;
        case "SCI": stepSize = 10; break;
        case "CSP": stepSize = 100; break;
      }

      const decimals = computeDecimalsForStep(stepSize);
      const lowerBound = Math.floor(minVal / stepSize) * stepSize - stepSize;
      const upperBound = Math.ceil(maxVal / stepSize) * stepSize + stepSize;

      const bins: any[][] = [];
      const upperThresholds: Record<string, number> = {
        "MICRON": 4.2,
        "LENGTH": 31,
        "UNIF": 82,
        "STRENGTH": 31,
        "RD": 78
      };
      const pName = paramName.toUpperCase();
      const threshold = upperThresholds[pName];

      for (let i = roundTo(lowerBound + stepSize, decimals); i <= roundTo(upperBound + 1e-12, decimals); i = roundTo(i + stepSize, decimals)) {
        const lower = roundTo(i - stepSize, decimals);
        const upper = roundTo(i, decimals);

        if (threshold !== undefined && lower >= threshold) break;

        let count = 0;
        for (let v of values) {
          const rv = roundTo(v, 8);
          if (rv > lower && rv <= upper) count++;
        }
        if (count > 0) {
          const displayLower = (lower + stepSize / 10).toFixed(decimals + 1);
          const displayUpper = upper.toFixed(decimals + 1);
          const label = `${displayLower} - ${displayUpper}`;
          bins.push([label, count]);
        }
      }

      if (threshold !== undefined) {
        const overThresholdCount = values.filter((v) => roundTo(v, 8) > threshold).length;
        if (overThresholdCount > 0) {
          bins.push(["> " + threshold, overThresholdCount]);
        }
      }

      const rangedTotal = bins.reduce((s, b) => s + b[1], 0);
      const binsWithPct = bins.map((b) => {
        const pct = (rangedTotal > 0) ? ((b[1] / rangedTotal) * 100) : 0;
        return [b[0], b[1], pct.toFixed(1) + "%"];
      });
      binsWithPct.push(["Total", rangedTotal, "100%"]);

      newSectionBlocks[paramName] = [["Range", "No. of Bales", "%"], ...binsWithPct];
      newSectionOrder.push(paramName);
    }

    setSectionBlocks(newSectionBlocks);
    setSectionOrder(newSectionOrder);
    if (selectedSections.size === 0) {
      setSelectedSections(new Set(newSectionOrder));
    }
  };

  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/cotton/criteria`);
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || `Backend request failed (HTTP ${response.status})`);
        }

        setCriteria((result.data || []).map((row: CottonCriterion) => ({
          ...row,
          criteria_value: Number(row.criteria_value),
          percent_value: row.percent_value === null ? null : Number(row.percent_value),
        })));
      } catch (error) {
        setCriteriaError(`Unable to load criteria: ${error instanceof Error ? error.message : "Request failed"}`);
      } finally {
        setCriteriaLoaded(true);
      }
    };

    void loadCriteria();
  }, []);

  useEffect(() => {
    recomputeSections();
  }, [rows, selectedLots, selectedSuppliers, criteria]);

  const applyCriteria = async () => {
    if (criteriaDraft.some((criterion) => !Number.isFinite(criterion.criteria_value))) {
      setCriteriaError("Enter a valid numeric value for every criterion.");
      return;
    }

    setIsSavingCriteria(true);
    setCriteriaError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/cotton/criteria`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          criteria: criteriaDraft.map(({ id, operator, criteria_value }) => ({ id, operator, criteria_value })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || `Backend request failed (HTTP ${response.status})`);
      }

      setCriteria((result.data || []).map((row: CottonCriterion) => ({
        ...row,
        criteria_value: Number(row.criteria_value),
        percent_value: row.percent_value === null ? null : Number(row.percent_value),
      })));
      setIsEditingCriteria(false);
    } catch (error) {
      setCriteriaError(`Unable to save criteria: ${error instanceof Error ? error.message : "Request failed"}`);
    } finally {
      setIsSavingCriteria(false);
    }
  };

  const toggleSelection = (set: Set<string>, val: string, updater: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    updater(newSet);
  };

  const toggleAll = (all: string[], currentSet: Set<string>, updater: (s: Set<string>) => void) => {
    if (currentSet.size === all.length) updater(new Set());
    else updater(new Set(all));
  };

  const downloadExcel = async () => {
    if (activeView === "averages") {
      const averageAOA: any[][] = [
        ["Lot No", ...averageDisplayColumns.map(({ label }) => label)],
        ...averageResults.lots.map(({ lot, averages, statistics }) => [
          lot,
          ...formatAverageRow(averages, statistics),
        ]),
        ["Overall Average", ...formatAverageRow(averageResults.overall, averageResults.overallStatistics)],
        ...overallStatisticRows.map(({ label, kind }) => [label, ...formatOverallStatisticRow(kind)]),
      ];
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Average Results");
      averageAOA.forEach((row) => ws.addRow(row));
      ws.columns = [
        { width: 22 },
        ...averageDisplayColumns.map(() => ({ width: 14 })),
      ];

      let imageRow = averageAOA.length + 1;
      for (const chart of metricChartConfigs) {
        const chartElement = document.getElementById(chart.chartId);
        if (!chartElement) continue;

        const sourceCanvas = await html2canvas(chartElement, { backgroundColor: "#ffffff", scale: 1 });
        const maxImageWidth = 700;
        const imageWidth = Math.min(sourceCanvas.width, maxImageWidth);
        const imageHeight = sourceCanvas.height * (imageWidth / sourceCanvas.width);
        const resizedCanvas = document.createElement("canvas");
        resizedCanvas.width = imageWidth;
        resizedCanvas.height = imageHeight;
        const context = resizedCanvas.getContext("2d");
        if (!context) continue;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, imageWidth, imageHeight);
        context.drawImage(sourceCanvas, 0, 0, imageWidth, imageHeight);

        const jpegData = resizedCanvas.toDataURL("image/jpeg", 0.55).split(",")[1];
        const imageId = wb.addImage({ base64: jpegData, extension: "jpeg" });
        ws.getCell(imageRow + 1, 1).value = chart.title;
        ws.getCell(imageRow + 1, 1).font = { bold: true };
        ws.addImage(imageId, {
          tl: { col: 0, row: imageRow + 1 },
          ext: { width: imageWidth, height: imageHeight },
        });
        imageRow += Math.ceil(imageHeight / 20) + 3;
      }

      const workbookBuffer = await wb.xlsx.writeBuffer();
      const workbookBlob = new Blob([workbookBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = URL.createObjectURL(workbookBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = downloadUrl;
      downloadLink.download = "Average_Results.xlsx";
      downloadLink.click();
      URL.revokeObjectURL(downloadUrl);
      return;
    }

    const exportAOA: any[][] = [];
    const setExportCell = (r: number, c: number, v: any) => {
      if (!exportAOA[r]) exportAOA[r] = [];
      exportAOA[r][c] = v;
    };

    // Lot vs Bales
    const lotAOA = sectionBlocks["Lot vs No. of Bales"];
    if (lotAOA) {
      lotAOA.forEach((row, rIdx) => {
        setExportCell(rIdx, 0, row[0]);
        setExportCell(rIdx, 1, row[1]);
      });
    }

    // Criteria Summary
    const critAOA = sectionBlocks["Criteria Summary"];
    if (critAOA) {
      critAOA.forEach((row, rIdx) => {
        setExportCell(rIdx, 3, row[0]);
        setExportCell(rIdx, 4, row[1]);
        setExportCell(rIdx, 5, row[2]);
      });
    }

    // Parameters
    let colOffset = 7;
    sectionOrder.forEach(name => {
      if (name === "Lot vs No. of Bales" || name === "Criteria Summary") return;
      const aoa = sectionBlocks[name];
      if (!aoa) return;

      setExportCell(0, colOffset, name + " Range");
      setExportCell(0, colOffset + 1, "No. of Bales");
      setExportCell(0, colOffset + 2, "%");

      aoa.slice(1).forEach((row, rIdx) => {
        setExportCell(rIdx + 1, colOffset, row[0]);
        setExportCell(rIdx + 1, colOffset + 1, row[1]);
        setExportCell(rIdx + 1, colOffset + 2, row[2]);
      });
      colOffset += 4;
    });

    const ws = XLSX.utils.aoa_to_sheet(exportAOA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bale Summary");
    XLSX.writeFile(wb, "Bale_Summary.xlsx");
  };

  const downloadChartPng = async (chartId: string, filename: string) => {
    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;

    const canvas = await html2canvas(chartElement, { backgroundColor: "#ffffff", scale: 2 });
    const downloadLink = document.createElement("a");
    downloadLink.download = filename;
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.click();
  };

  const downloadPDF = async () => {
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const gutter = 4;
    const columnCount = 4;
    const colWidth = (pageWidth - 2 * margin - (columnCount - 1) * gutter) / columnCount;
    
    let columnY = Array(columnCount).fill(25);

    const drawHeaderFooter = (pageDoc: jsPDF, pageNum: number) => {
      // Header
      pageDoc.setFontSize(16);
      pageDoc.setTextColor(185, 28, 28); // red-700
      pageDoc.setFont("helvetica", "bold");
      pageDoc.text(pdfHeader, pageWidth / 2, 12, { align: "center" });

      pageDoc.setFontSize(8);
      pageDoc.setTextColor(0);
      pageDoc.setFont("helvetica", "normal");
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
      pageDoc.text(`Date: ${dateStr}`, pageWidth - margin, 10, { align: "right" });

      // Page Number
      pageDoc.setFontSize(8);
      pageDoc.setTextColor(100);
      pageDoc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    };

    // Initial Header/Footer
    drawHeaderFooter(doc, 1);
    let currentPage = 1;

    if (activeView === "averages") {
      const averageHead = [["Lot No", ...averageDisplayColumns.map(({ label }) => label)]];
      const averageBody = [
        ...averageResults.lots.map(({ lot, averages, statistics }) => [
          lot,
          ...formatAverageRow(averages, statistics),
        ]),
        ["Overall Average", ...formatAverageRow(averageResults.overall, averageResults.overallStatistics)],
        ...overallStatisticRows.map(({ label, kind }) => [label, ...formatOverallStatisticRow(kind)]),
      ];

      autoTable(doc, {
        head: averageHead,
        body: averageBody,
        startY: 25,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 1, textColor: [0, 0, 0], halign: "center" },
        headStyles: { fillColor: [185, 28, 28], halign: "center", textColor: [255, 255, 255] },
        theme: "grid",
        didDrawPage: () => drawHeaderFooter(doc, doc.getNumberOfPages()),
        didParseCell: (cellData) => {
          const rawRow = cellData.row.raw as any[];
          if (cellData.row.section === "body" && String(rawRow[0]).startsWith("Overall ")) {
            cellData.cell.styles.fontStyle = "bold";
            cellData.cell.styles.fillColor = rawRow[0] === "Overall Average" ? [254, 242, 242] : [243, 244, 246];
          }
        },
      });

      const averageCharts = [
        { id: "cotton-mic-chart", title: "MIC Value Distribution" },
        { id: "cotton-plus-b-chart", title: "+b Value Distribution" },
      ];
      const chartImages: Array<{ title: string; canvas: HTMLCanvasElement }> = [];
      for (const chart of averageCharts) {
        const chartElement = document.getElementById(chart.id);
        if (!chartElement) continue;
        const canvas = await html2canvas(chartElement, { backgroundColor: "#ffffff", scale: 2 });
        chartImages.push({ title: chart.title, canvas });
      }

      let contentBottomY = (doc as any).lastAutoTable.finalY;
      if (chartImages.length > 0) {
        const chartGap = 8;
        const chartWidth = (pageWidth - 2 * margin - chartGap) / 2;
        const chartHeights = chartImages.map(({ canvas }) => chartWidth * canvas.height / canvas.width);
        const chartRowHeight = Math.max(...chartHeights);
        let titleY = contentBottomY + 11;
        let imageY = titleY + 2;

        if (imageY + chartRowHeight > pageHeight - 12) {
          doc.addPage();
          currentPage++;
          drawHeaderFooter(doc, currentPage);
          titleY = 25;
          imageY = titleY + 2;
        }

        chartImages.forEach(({ title, canvas }, index) => {
          const x = margin + index * (chartWidth + chartGap);
          const chartHeight = chartHeights[index];
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text(title, x, titleY);
          doc.addImage(canvas.toDataURL("image/png"), "PNG", x, imageY, chartWidth, chartHeight);
        });
        contentBottomY = imageY + chartRowHeight;
      }

      if (pdfRemarks.trim()) {
        let remarksY = contentBottomY + 5;
        if (remarksY > pageHeight - 25) {
          doc.addPage();
          currentPage++;
          drawHeaderFooter(doc, currentPage);
          remarksY = 25;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Remarks:", margin, remarksY);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(pdfRemarks, pageWidth - 2 * margin), margin, remarksY + 5);
      }

      doc.save("Average_Results.pdf");
      return;
    }

    const sectionsToRender = sectionOrder.filter(name => selectedSections.has(name));
    
    sectionsToRender.forEach((name, index) => {
      const data = sectionBlocks[name];
      if (!data) return;

      const minY = Math.min(...columnY);
      const colIndex = columnY.indexOf(minY);
      const xPos = margin + colIndex * (colWidth + gutter);
      let currentY = minY;

      if (currentY > 175) {
        doc.addPage();
        currentPage++;
        drawHeaderFooter(doc, currentPage);
        columnY = Array(columnCount).fill(25);
        currentY = 25;
      }

      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(name, xPos, currentY + 3);
      
      autoTable(doc, {
        head: [data[0]],
        body: data.slice(1),
        startY: currentY + 4,
        styles: { fontSize: 7.5, cellPadding: 0.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [185, 28, 28], halign: 'center', textColor: [255, 255, 255] },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'center' },
        },
        margin: { left: xPos },
        tableWidth: colWidth,
        theme: "grid",
        didParseCell: (data) => {
          const rawRow = data.row.raw as any[];
          if (data.row.section === "body" && rawRow[0] === "Total") {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [0, 0, 0];
          }
        }
      });

      // 3. Update the height tracker for this specific column
      const finalY = (doc as any).lastAutoTable.finalY;
      columnY[colIndex] = finalY + 8;
    });

    // Add Remarks below the tables
    if (pdfRemarks.trim()) {
      const maxY = Math.max(...columnY);
      let finalY = maxY + 5;

      // Check for page overflow
      if (finalY > 185) {
        doc.addPage();
        currentPage++;
        drawHeaderFooter(doc, currentPage);
        finalY = 25;
      }

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Remarks:", margin, finalY);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const splitRemarks = doc.splitTextToSize(pdfRemarks, pageWidth - 2 * margin);
      doc.text(splitRemarks, margin, finalY + 5);
    }

    doc.save("Bale_Summary.pdf");
  };

  const metricChartConfigs = [
    { title: "MIC Value Distribution", axisLabel: "MIC Value", aliases: ["MIC", "MICRON"], color: "#dc2626", chartId: "cotton-mic-chart", filename: "MIC_Value_Distribution.png", rangeWidth: 0.3, thresholdRanges: true },
    { title: "+b Value Distribution", axisLabel: "+b Value", aliases: ["+B"], color: "#0f766e", chartId: "cotton-plus-b-chart", filename: "Plus_B_Value_Distribution.png", rangeWidth: 0.5, tickAngle: -45 },
  ].flatMap(({ title, axisLabel, aliases, color, chartId, filename, rangeWidth, thresholdRanges = false, tickAngle = 0 }) => {
    const columnIndex = header.findIndex((name) => aliases.includes(String(name).trim().toUpperCase()));
    if (columnIndex === -1) return [];
    const countByValue = new Map<number, number>();
    rows.forEach((row) => {
      if (!selectedLots.has(String(row[1]).trim()) || !selectedSuppliers.has(String(row[0]).trim())) return;
      const rawValue = cleanNumericValue(row[columnIndex]);
      if (rawValue === null) return;
      const value = roundTo(rawValue, 2);
      countByValue.set(value, (countByValue.get(value) || 0) + 1);
    });
    const values = Array.from(countByValue.keys()).sort((left, right) => left - right);
    let data: Array<{ value: string | number; count: number }>;
    if (rangeWidth !== undefined && values.length > 0) {
      const min = values[0];
      const max = values[values.length - 1];
      const bins: Array<{ lower: number; upper: number; count: number }> = [];
      if (thresholdRanges) {
        const addIntervals = (start: number, end: number, width: number) => {
          for (let lower = start; lower < end - 1e-8; lower = roundTo(lower + width, 8)) {
            bins.push({ lower, upper: Math.min(roundTo(lower + width, 8), end), count: 0 });
          }
        };

        if (min < 4) addIntervals(Math.floor(min * 10 + 1e-8) / 10, 4, 0.1);
        addIntervals(4, 5, 0.3);
        if (max >= 5) {
          for (let lower = 5; lower <= max + 1e-8; lower = roundTo(lower + 0.2, 8)) {
            bins.push({ lower, upper: roundTo(lower + 0.2, 8), count: 0 });
          }
        }
      } else if (min === max) {
        bins.push({ lower: min, upper: max, count: 0 });
      } else {
        for (let lower = min; lower < max; lower = roundTo(lower + rangeWidth, 8)) {
          bins.push({ lower, upper: Math.min(roundTo(lower + rangeWidth, 8), max), count: 0 });
        }
      }

      countByValue.forEach((count, value) => {
        const binIndex = bins.findIndex((bin, index) =>
          value >= bin.lower && (value < bin.upper || (index === bins.length - 1 && value <= bin.upper))
        );
        if (binIndex >= 0) bins[binIndex].count += count;
      });

      data = bins
        .filter(({ count }) => count > 0)
        .map(({ lower, upper, count }) => ({
          value: thresholdRanges
            ? `${lower.toFixed(2)} - ${Math.max(lower, upper - 0.01).toFixed(2)}`
            : `${lower.toFixed(1)} - ${upper.toFixed(1)}`,
          count,
        }));
    } else {
      data = Array.from(countByValue, ([value, count]) => ({ value, count }));
    }
    return data.length ? [{ title, axisLabel, color, chartId, filename, tickAngle, data }] : [];
  });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between border-b pb-4 border-red-100">
        <h1 className="text-2xl font-bold text-red-700">Bale Summary — Fixed Counting</h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded hover:bg-gray-200 transition"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-red-50 p-4 rounded-lg">
        {permissions.canUpload && (
          <>
            <input
              type="file"
              id="fileInput"
              accept=".xlsx,.xls,.xlsm"
              onChange={handleFile}
              className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700"
            />
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded hover:bg-green-700 transition"
            >
              ⬇ Download Sample Template
            </button>
          </>
        )}
        {rows.length > 0 && (
          <>
            {permissions.canUpload && (
              <button
                onClick={() => {
                  document.getElementById("fileInput") && ((document.getElementById("fileInput") as HTMLInputElement).value = "");
                  resetState();
                }}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded hover:bg-orange-600 transition"
              >
                Reset File
              </button>
            )}
            <button
              onClick={() => {
                setSelectedLots(new Set(uniqueLots));
                setSelectedSuppliers(new Set(uniqueSuppliers));
              }}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-bold rounded hover:bg-blue-600 transition"
            >
              Reset Filters
            </button>
            <button
              onClick={downloadExcel}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 transition"
            >
              Download Excel
            </button>
            <button
              onClick={() => setShowPdfModal(true)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700 transition"
            >
              Download PDF
            </button>
          </>
        )}
      </div>

      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">PDF Configuration</h3>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="text-white hover:text-red-100 transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Header Title</label>
                <input
                  type="text"
                  value={pdfHeader}
                  onChange={(e) => setPdfHeader(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Enter header title..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={pdfRemarks}
                  onChange={(e) => setPdfRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition"
                  placeholder="Enter remarks..."
                  rows={3}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await downloadPDF();
                    setShowPdfModal(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition"
                >
                  Generate PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="inline-flex overflow-hidden rounded border border-gray-300" role="group" aria-label="Cotton results view">
          <button
            type="button"
            onClick={() => setActiveView("distribution")}
            aria-pressed={activeView === "distribution"}
            className={`px-4 py-2 text-sm font-semibold transition ${activeView === "distribution" ? "bg-red-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Distribution Summary
          </button>
          <button
            type="button"
            onClick={() => setActiveView("averages")}
            aria-pressed={activeView === "averages"}
            className={`border-l border-gray-300 px-4 py-2 text-sm font-semibold transition ${activeView === "averages" ? "bg-red-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Average Results
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-4 items-start">
          {/* Lots Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowLotDropdown(!showLotDropdown)}
              className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              Select Lots ({selectedLots.size}) <span className="text-[10px]">▼</span>
            </button>
            {showLotDropdown && (
              <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded shadow-xl max-h-64 overflow-y-auto p-2">
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={selectedLots.size === uniqueLots.length}
                    onChange={() => toggleAll(uniqueLots, selectedLots, setSelectedLots)}
                  />
                  All
                </label>
                {uniqueLots.map((lot) => (
                  <label key={lot} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedLots.has(lot)}
                      onChange={() => toggleSelection(selectedLots, lot, setSelectedLots)}
                    />
                    {lot}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Suppliers Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSupDropdown(!showSupDropdown)}
              className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              Select Suppliers ({selectedSuppliers.size}) <span className="text-[10px]">▼</span>
            </button>
            {showSupDropdown && (
              <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded shadow-xl max-h-64 overflow-y-auto p-2">
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={selectedSuppliers.size === uniqueSuppliers.length}
                    onChange={() => toggleAll(uniqueSuppliers, selectedSuppliers, setSelectedSuppliers)}
                  />
                  All
                </label>
                {uniqueSuppliers.map((sup) => (
                  <label key={sup} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.has(sup)}
                      onChange={() => toggleSelection(selectedSuppliers, sup, setSelectedSuppliers)}
                    />
                    {sup}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Sections Dropdown */}
          {activeView === "distribution" && <div className="relative">
            <button
              onClick={() => setShowSectionDropdown(!showSectionDropdown)}
              className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
            >
              Select Sections ({selectedSections.size}) <span className="text-[10px]">▼</span>
            </button>
            {showSectionDropdown && (
              <div className="absolute z-20 mt-1 w-56 bg-white border border-gray-200 rounded shadow-xl max-h-64 overflow-y-auto p-2">
                <label className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={selectedSections.size === sectionOrder.length}
                    onChange={() => toggleAll(sectionOrder, selectedSections, setSelectedSections)}
                  />
                  All
                </label>
                {sectionOrder.map((sec) => (
                  <label key={sec} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSections.has(sec)}
                      onChange={() => toggleSelection(selectedSections, sec, setSelectedSections)}
                    />
                    {sec}
                  </label>
                ))}
              </div>
            )}
          </div>}
        </div>
      )}

      {rows.length > 0 && activeView === "averages" && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left text-gray-700">
                  <th className="whitespace-nowrap border border-gray-300 px-3 py-2">Lot No</th>
                  {averageDisplayColumns.map(({ label, parameterIndex, kind }) => (
                    <th key={`${parameterIndex}-${kind}`} className="border border-gray-300 px-3 py-2 text-right">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {averageResults.lots.map(({ lot, averages, statistics }) => (
                  <tr key={lot} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap border border-gray-300 px-3 py-2 font-medium">{lot}</td>
                    {formatAverageRow(averages, statistics).map((value, index) => {
                      const column = averageDisplayColumns[index];
                      const cv = column.kind === "cv" ? statistics[column.parameterIndex]?.cv : null;
                      const isHighlighted = column.highlightAbove !== undefined && cv !== null && cv > column.highlightAbove;
                      return (
                        <td
                          key={index}
                          className={`border border-gray-300 px-3 py-2 text-right ${isHighlighted ? "bg-yellow-200 font-bold text-red-700" : ""}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-red-50 font-bold">
                  <td className="whitespace-nowrap border border-gray-300 px-3 py-2">Overall Average</td>
                  {formatAverageRow(averageResults.overall, averageResults.overallStatistics).map((value, index) => {
                    const column = averageDisplayColumns[index];
                    const cv = column.kind === "cv" ? averageResults.overallStatistics[column.parameterIndex]?.cv : null;
                    const isHighlighted = column.highlightAbove !== undefined && cv !== null && cv > column.highlightAbove;
                    return (
                      <td
                        key={index}
                        className={`border border-gray-300 px-3 py-2 text-right ${isHighlighted ? "bg-yellow-200 font-bold text-red-700" : ""}`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
                {overallStatisticRows.map(({ label, kind }) => (
                  <tr key={label} className="bg-gray-50 font-semibold">
                    <td className="whitespace-nowrap border border-gray-300 px-3 py-2">{label}</td>
                    {formatOverallStatisticRow(kind).map((value, index) => (
                      <td key={index} className="border border-gray-300 px-3 py-2 text-right">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
                {averageResults.parameterColumns.length === 0 && (
                  <tr>
                    <td colSpan={averageDisplayColumns.length + 1} className="border border-gray-300 px-3 py-4 text-center text-gray-500">No numeric parameters in the selected data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {metricChartConfigs.length > 0 && (
            <div className="grid grid-cols-1 gap-6">
              {metricChartConfigs.map(({ title, axisLabel, color, data, chartId, filename, tickAngle }) => (
                <section key={title} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-gray-700">{title}</h2>
                    <button
                      type="button"
                      aria-label={`Download ${title} chart`}
                      title="Download chart as PNG"
                      onClick={() => void downloadChartPng(chartId, filename)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                  </div>
                  <div id={chartId} className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 32, right: 20, bottom: 20, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="value"
                          type="category"
                          interval={tickAngle === 0 ? "preserveStartEnd" : 0}
                          angle={tickAngle}
                          textAnchor={tickAngle === 0 ? "middle" : "end"}
                          height={tickAngle === 0 ? 75 : 105}
                          tickMargin={10}
                          tick={{ fontSize: 11, fontWeight: 700 }}
                          tickFormatter={(value: string | number) => typeof value === "number" ? value.toFixed(2) : value}
                          label={{ value: axisLabel, position: "insideBottom", offset: -5, style: { fontWeight: 700 } }}
                        />
                        <YAxis
                          allowDecimals={false}
                          domain={[0, (dataMax: number) => dataMax + Math.max(2, dataMax * 0.12)]}
                          tick={{ fontWeight: 700 }}
                          label={{ value: "No. of Bales", angle: -90, position: "insideLeft", style: { fontWeight: 700 } }}
                        />
                        <Tooltip
                          labelFormatter={(value) => `${axisLabel}: ${typeof value === "number" ? value.toFixed(2) : value}`}
                          formatter={(value) => [Number(value), "No. of Bales"]}
                        />
                        <Bar dataKey="count" fill={color} name="No. of Bales" radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="count" position="top" offset={8} fill="#374151" fontSize={12} fontWeight="bold" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && activeView === "distribution" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sectionOrder.map((name) => {
          if (!selectedSections.has(name)) return null;
          const data = sectionBlocks[name];
          if (!data) return null;

          return (
            <div key={name} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between gap-3">
                <span className="font-bold text-gray-700 text-sm uppercase tracking-wider">{name}</span>
                {name === "Criteria Summary" && permissions.canEdit && (
                  <div className="flex items-center gap-2">
                    {isEditingCriteria ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingCriteria(false);
                            setCriteriaError("");
                          }}
                          disabled={isSavingCriteria}
                          className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={applyCriteria}
                          disabled={isSavingCriteria}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {isSavingCriteria ? "Applying..." : "Apply"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        aria-label="Edit criteria"
                        title="Edit criteria"
                        onClick={() => {
                          setCriteriaDraft(criteria.map((criterion) => ({ ...criterion })));
                          setCriteriaError("");
                          setIsEditingCriteria(true);
                        }}
                        disabled={!criteriaLoaded || criteria.length === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-600 hover:bg-gray-200 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ✎
                      </button>
                    )}
                  </div>
                )}
              </div>
              {name === "Criteria Summary" && criteriaError && (
                <p role="alert" className="px-4 py-2 text-xs text-red-700">{criteriaError}</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 font-semibold">
                      {data[0].map((h, i) => (
                        <th key={i} className="border-b border-r px-3 py-2 text-left last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(1).map((row, rIdx) => {
                      const isTotal = row[0] === "Total";
                      return (
                        <tr key={rIdx} className={`${isTotal ? "bg-red-50 font-bold" : "hover:bg-gray-50"} transition-colors`}>
                          {row.map((cell, cIdx) => {
                            let cellContent = cell;
                            let cellClass = "border-b border-r px-3 py-2 last:border-r-0";

                            if (name === "Criteria Summary" && isEditingCriteria && cIdx === 1) {
                              const draft = criteriaDraft[rIdx];
                              if (draft) {
                                cellContent = (
                                  <div className="flex min-w-36 items-center gap-1">
                                    <select
                                      aria-label={`${draft.parameter} operator`}
                                      value={draft.operator}
                                      onChange={(event) => setCriteriaDraft((current) => current.map((item) =>
                                        item.id === draft.id ? { ...item, operator: event.target.value } : item
                                      ))}
                                      className="w-16 rounded border border-gray-300 bg-white px-1 py-1"
                                    >
                                      {["<", "<=", ">", ">=", "="].map((operator) => (
                                        <option key={operator} value={operator}>{operator}</option>
                                      ))}
                                    </select>
                                    <input
                                      aria-label={`${draft.parameter} criteria value`}
                                      type="number"
                                      step="any"
                                      value={Number.isFinite(draft.criteria_value) ? draft.criteria_value : ""}
                                      onChange={(event) => setCriteriaDraft((current) => current.map((item) =>
                                        item.id === draft.id ? {
                                          ...item,
                                          criteria_value: event.target.value === "" ? Number.NaN : Number(event.target.value),
                                        } : item
                                      ))}
                                      className="w-20 rounded border border-gray-300 px-2 py-1"
                                    />
                                  </div>
                                );
                              }
                            }
                            
                            // Color coding for Criteria Summary
                            if (name === "Criteria Summary" && cIdx === 2 && !isTotal) {
                              const pct = parseFloat(String(cell));
                              if (pct > 0) cellClass += " text-red-600 font-bold";
                              else cellClass += " text-green-600 font-bold";
                            }

                            return (
                              <td key={cIdx} className={cellClass}>
                                {cellContent}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
};

export default CottonDistribution;
