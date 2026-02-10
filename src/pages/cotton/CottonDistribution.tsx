import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useRolePermissions, type Role } from "../../hooks/useRolePermissions";

/* ====== CONFIG ====== */
const excludedCols = ["LEAF", "CG", "AREA", "COUNT", "MAT", "SCI", "CSP"];
/* ==================== */

interface SectionData {
  header: string[];
  rows: any[][];
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
    if (val === "" || val === null || val === undefined) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  };

  const formatNum = (n: number) => {
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

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
    const headers = ["Supplier", "Lot No", "MICRON", "LENGTH", "UNIF", "STRENGTH", "SFI", "ELONG", "RD", "+B"];
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
    const criteriaData = [
      { label: "MIC", param: "MICRON", crit: "<3.9", test: (v: number) => roundTo(v, 8) <= 3.9 },
      { label: "UHML", param: "LENGTH", crit: "<28.5", test: (v: number) => roundTo(v, 8) <= 28.5 },
      { label: "UI", param: "UNIF", crit: "<80", test: (v: number) => roundTo(v, 8) <= 80 },
      { label: "STR", param: "STRENGTH", crit: "<28.5", test: (v: number) => roundTo(v, 8) <= 28.5 },
      { label: "SFI", param: "SFI", crit: ">9.0", test: (v: number) => roundTo(v, 8) > 9.0 },
      { label: "Rd", param: "RD", crit: "<75", test: (v: number) => roundTo(v, 8) <= 75 },
      { label: "+b", param: "+B", crit: ">10.0", test: (v: number) => roundTo(v, 8) > 10.0 },
    ];

    const criteriaAOA = [["Parameter", "Criteria", "% Value"]];
    criteriaData.forEach((c) => {
      const colIdx = header.findIndex((h) => String(h).trim().toUpperCase() === c.param.toUpperCase());
      if (colIdx !== -1) {
        const values = filtered.map((r) => cleanNumericValue(r[colIdx])).filter((v): v is number => v !== null);
        if (values.length > 0) {
          const count = values.filter((v) => c.test(v)).length;
          const pct = (count / values.length) * 100;
          criteriaAOA.push([c.label, c.crit, pct.toFixed(1) + "%"]);
        } else {
          criteriaAOA.push([c.label, c.crit, "0.0%"]);
        }
      } else {
        criteriaAOA.push([c.label, c.crit, "N/A"]);
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
    recomputeSections();
  }, [rows, selectedLots, selectedSuppliers]);

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

  const downloadExcel = () => {
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

  const downloadPDF = () => {
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
                  onClick={() => {
                    downloadPDF();
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
          <div className="relative">
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
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sectionOrder.map((name) => {
          if (!selectedSections.has(name)) return null;
          const data = sectionBlocks[name];
          if (!data) return null;

          return (
            <div key={name} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 font-bold text-gray-700 text-sm uppercase tracking-wider">
                {name}
              </div>
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
      </div>
    </div>
  );
};

export default CottonDistribution;
