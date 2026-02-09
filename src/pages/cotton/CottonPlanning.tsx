import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface CottonVariety {
  id: string;
  cotton_group: string;
  cotton_variety: string;
  avg_bale_weight: number;
}

interface CottonPlan {
  id: string;
  unit: string;
  laydown_consumption: number;
  no_of_bales_per_laydown: number;
  cotton_planning_blend: any[];
}

export default function CottonPlanning({ onBack }: { onBack?: () => void }) {
  const [plans, setPlans] = useState<CottonPlan[]>([]);
  const [varieties, setVarieties] = useState<CottonVariety[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Matrix state
  const [matrix, setMatrix] = useState<Record<string, Record<string, number | "">>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});

  // Modals visibility
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showVarietyModal, setShowVarietyModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfHeader, setPdfHeader] = useState("COTTON PLANNING REPORT");
  const [pdfRemarks, setPdfRemarks] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVarietiesTable, setShowVarietiesTable] = useState(false);
  const [showUnitsTable, setShowUnitsTable] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // Report Data Calculation
  const reportData = useMemo(() => {
    const varietyReport: Record<string, { totalBales: number; totalWeight: number; group: string }> = {};
    const groupReport: Record<string, { totalBales: number; totalWeight: number }> = {};
    let grandTotalWeight = 0;
    let grandTotalBales = 0;

    plans.forEach(plan => {
      const rowPercents = matrix[plan.id] || {};
      const targetBales = plan.laydown_consumption * plan.no_of_bales_per_laydown;
      
      const blend = Object.entries(rowPercents)
        .filter(([_, percent]) => Number(percent) > 0)
        .map(([vName, percent]) => {
          const v = varieties.find(varItem => varItem.cotton_variety === vName);
          return {
            cotton_variety: vName,
            cotton_group: v?.cotton_group || "Unknown",
            percentage: Number(percent),
            avg_bale_weight: v?.avg_bale_weight || 170
          };
        });

      if (blend.length === 0) return;

      const weightFactor = blend.reduce((sum, item) => sum + (item.percentage / 100) / item.avg_bale_weight, 0);
      const totalWeightOfUnit = weightFactor > 0 ? targetBales / weightFactor : 0;

      blend.forEach(item => {
        const calculatedBales = (totalWeightOfUnit * (item.percentage / 100)) / item.avg_bale_weight;
        const calculatedWeight = calculatedBales * item.avg_bale_weight;
        
        // Variety aggregation
        if (!varietyReport[item.cotton_variety]) {
          varietyReport[item.cotton_variety] = { totalBales: 0, totalWeight: 0, group: item.cotton_group };
        }
        varietyReport[item.cotton_variety].totalBales += calculatedBales;
        varietyReport[item.cotton_variety].totalWeight += calculatedWeight;

        // Group aggregation
        if (!groupReport[item.cotton_group]) {
          groupReport[item.cotton_group] = { totalBales: 0, totalWeight: 0 };
        }
        groupReport[item.cotton_group].totalBales += calculatedBales;
        groupReport[item.cotton_group].totalWeight += calculatedWeight;

        grandTotalWeight += calculatedWeight;
        grandTotalBales += calculatedBales;
      });
    });

    return {
      varietyItems: Object.entries(varietyReport).map(([variety, data]) => ({
        variety,
        group: data.group,
        totalBales: data.totalBales,
        percentage: grandTotalWeight > 0 ? (data.totalWeight / grandTotalWeight) * 100 : 0,
        groupPercentage: groupReport[data.group]?.totalBales > 0 ? (data.totalBales / groupReport[data.group].totalBales) * 100 : 0
      })).sort((a, b) => {
        const groupA = (a.group || "").toLowerCase();
        const groupB = (b.group || "").toLowerCase();
        
        // Indian first (non-imported), then Imported
        const isImportA = groupA.includes("import");
        const isImportB = groupB.includes("import");
        
        if (isImportA && !isImportB) return 1;
        if (!isImportA && isImportB) return -1;
        
        if (groupA !== groupB) return groupA.localeCompare(groupB);
        return a.variety.localeCompare(b.variety);
      }),
      groupItems: Object.entries(groupReport).map(([group, data]) => ({
        group,
        totalBales: data.totalBales,
        percentage: grandTotalWeight > 0 ? (data.totalWeight / grandTotalWeight) * 100 : 0
      })).sort((a, b) => {
        const groupA = (a.group || "").toLowerCase();
        const groupB = (b.group || "").toLowerCase();
        const isImportA = groupA.includes("import");
        const isImportB = groupB.includes("import");
        if (isImportA && !isImportB) return 1;
        if (!isImportA && isImportB) return -1;
        return a.group.localeCompare(b.group);
      }),
      grandTotalBales
    };
  }, [plans, matrix, varieties]);

  const unitDetails = useMemo(() => {
    if (!selectedUnitId) return null;
    const plan = plans.find(p => String(p.id) === String(selectedUnitId));
    if (!plan) return null;

    const rowPercents = matrix[plan.id] || {};
    const targetBales = plan.laydown_consumption * plan.no_of_bales_per_laydown;
    
    const blend = Object.entries(rowPercents)
      .filter(([_, percent]) => Number(percent) > 0)
      .map(([vName, percent]) => {
        const v = varieties.find(varItem => varItem.cotton_variety === vName);
        return {
          cotton_variety: vName,
          percentage: Number(percent),
          avg_bale_weight: v?.avg_bale_weight || 170
        };
      });

    if (blend.length === 0) return { items: [], totalBales: 0 };

    const weightFactor = blend.reduce((sum, item) => sum + (item.percentage / 100) / item.avg_bale_weight, 0);
    const totalWeight = weightFactor > 0 ? targetBales / weightFactor : 0;

    const items = blend.map(item => ({
      variety: item.cotton_variety,
      percentage: item.percentage,
      calculatedBales: (totalWeight * (item.percentage / 100)) / item.avg_bale_weight
    }));

    return {
      items,
      totalBales: items.reduce((sum, i) => sum + i.calculatedBales, 0)
    };
  }, [selectedUnitId, plans, matrix, varieties]);

  // Plan Modal State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planUnit, setPlanUnit] = useState("");
  const [planLD, setPlanLD] = useState<number | "">("");
  const [planBL, setPlanBL] = useState<number | "">("");
  const [savingPlan, setSavingPlan] = useState(false);

  // Variety Modal State
  const [editingVarietyId, setEditingVarietyId] = useState<string | null>(null);
  const [varGroup, setVarGroup] = useState("");
  const [varVariety, setVarVariety] = useState("");
  const [varWeight, setVarWeight] = useState<number | "">("");
  const [savingVariety, setSavingVariety] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, varietiesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/cotton/planning`),
        axios.get(`${API_BASE_URL}/api/cotton/groups`)
      ]);

      if (plansRes.data.success && varietiesRes.data.success) {
        const sortedPlans = plansRes.data.data.sort((a: CottonPlan, b: CottonPlan) => 
          a.unit.localeCompare(b.unit, undefined, { numeric: true, sensitivity: 'base' })
        );
        const sortedVarieties = varietiesRes.data.data.sort((a: any, b: any) => {
          const groupA = (a.cotton_group || "").toLowerCase();
          const groupB = (b.cotton_group || "").toLowerCase();
          
          if (groupA.includes("import") && !groupB.includes("import")) return -1;
          if (!groupA.includes("import") && groupB.includes("import")) return 1;
          
          if (groupA !== groupB) return groupA.localeCompare(groupB);
          return a.cotton_variety.localeCompare(b.cotton_variety);
        });

        setPlans(sortedPlans);
        setVarieties(sortedVarieties);

        const initialMatrix: Record<string, Record<string, number | "">> = {};
        sortedPlans.forEach((plan: CottonPlan) => {
          initialMatrix[plan.id] = {};
          plan.cotton_planning_blend.forEach((b: any) => {
            initialMatrix[plan.id][b.cotton_variety] = Number(b.percentage);
          });
        });
        setMatrix(initialMatrix);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchData();
      alert("Data refreshed successfully!");
    } catch (err) {
      alert("Failed to refresh data.");
    }
  };

  const handlePercentChange = (planId: string, varietyName: string, value: string) => {
    setMatrix(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [varietyName]: value === "" ? "" : Number(value)
      }
    }));
  };

  const handleSaveRow = async (plan: CottonPlan) => {
    const rowPercents = matrix[plan.id] || {};
    const totalPercent = Object.values(rowPercents).reduce((sum, val) => sum + Number(val || 0), 0);
    
    if (Math.abs(totalPercent - 100) > 0.01 && totalPercent !== 0) {
      alert(`Total percentage for ${plan.unit} must be 100%`);
      return;
    }

    setSavingRows(prev => ({ ...prev, [plan.id]: true }));
    try {
      const totalBalesTarget = plan.laydown_consumption * plan.no_of_bales_per_laydown;
      const blendToSave = Object.entries(rowPercents)
        .filter(([_, percent]) => Number(percent) > 0)
        .map(([vName, percent]) => {
          const v = varieties.find(varItem => varItem.cotton_variety === vName);
          return {
            cotton_variety: vName,
            percentage: Number(percent),
            avg_bale_weight: v?.avg_bale_weight || 170
          };
        });

      const weightFactor = blendToSave.reduce((sum, item) => sum + (item.percentage / 100) / item.avg_bale_weight, 0);
      const totalWeight = weightFactor > 0 ? totalBalesTarget / weightFactor : 0;
      
      const finalBlend = blendToSave.map(item => ({
        cotton_variety: item.cotton_variety,
        percentage: item.percentage,
        calculated_bales: Number(((totalWeight * (item.percentage / 100)) / item.avg_bale_weight).toFixed(2))
      }));

      await axios.put(`${API_BASE_URL}/api/cotton/planning/${plan.id}`, {
        unit: plan.unit,
        laydown_consumption: plan.laydown_consumption,
        no_of_bales_per_laydown: plan.no_of_bales_per_laydown,
        blend: finalBlend
      });
      alert(`Saved ${plan.unit}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingRows(prev => ({ ...prev, [plan.id]: false }));
    }
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      // 1. Validation
      for (const plan of plans) {
        const rowPercents = matrix[plan.id] || {};
        const totalPercent = Object.values(rowPercents).reduce((sum, val) => sum + Number(val || 0), 0);
        
        if (totalPercent > 0 && Math.abs(totalPercent - 100) > 0.01) {
          alert(`Total percentage for ${plan.unit} must be 100% (currently ${totalPercent.toFixed(1)}%)`);
          setLoading(false);
          return;
        }
      }

      // 2. Saving
      const savePromises = plans.map(async (plan) => {
        const rowPercents = matrix[plan.id] || {};
        const targetBales = plan.laydown_consumption * plan.no_of_bales_per_laydown;
        
        const blendToSave = Object.entries(rowPercents)
          .filter(([_, percent]) => Number(percent) > 0)
          .map(([vName, percent]) => {
            const v = varieties.find(varItem => varItem.cotton_variety === vName);
            return {
              cotton_variety: vName,
              percentage: Number(percent),
              avg_bale_weight: v?.avg_bale_weight || 170
            };
          });

        if (blendToSave.length === 0) return;

        const weightFactor = blendToSave.reduce((sum, item) => sum + (item.percentage / 100) / item.avg_bale_weight, 0);
        const totalWeight = weightFactor > 0 ? targetBales / weightFactor : 0;
        
        const finalBlend = blendToSave.map(item => ({
          cotton_variety: item.cotton_variety,
          percentage: item.percentage,
          calculated_bales: Number(((totalWeight * (item.percentage / 100)) / item.avg_bale_weight).toFixed(2))
        }));

        return axios.put(`${API_BASE_URL}/api/cotton/planning/${plan.id}`, {
          unit: plan.unit,
          laydown_consumption: plan.laydown_consumption,
          no_of_bales_per_laydown: plan.no_of_bales_per_laydown,
          blend: finalBlend
        });
      });

      await Promise.all(savePromises);
      alert("All changes saved successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error saving changes");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Header
    doc.setFontSize(16);
    doc.setTextColor(185, 28, 28); // red-700
    doc.text(pdfHeader, pageWidth / 2, 12, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(100);
    
    // Format date as dd-mm-yyyy
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    doc.text(`Date: ${formattedDate}`, pageWidth - 15, 8, { align: "right" });

    // 2. Main Planning Matrix Table
    // Identify varieties with any non-zero percentage
    const activeVarieties = varieties.filter(v => {
      return plans.some(plan => {
        const val = matrix[plan.id]?.[v.cotton_variety];
        return val !== undefined && val !== "" && Number(val) > 0;
      });
    });

    const matrixHeaders = [
      ["Unit", "Bales per day", ...activeVarieties.map(v => v.cotton_variety)]
    ];

    const matrixRows = plans.map(plan => {
      const targetBales = (plan.laydown_consumption * plan.no_of_bales_per_laydown).toFixed(0);
      const rowData = [
        plan.unit,
        targetBales
      ];
      activeVarieties.forEach(v => {
        const val = matrix[plan.id]?.[v.cotton_variety];
        rowData.push(val && Number(val) > 0 ? `${val}%` : "");
      });
      return rowData;
    });

    const totalMatrixCols = activeVarieties.length + 2;
    const matrixColWidth = (pageWidth - 30) / totalMatrixCols;

    autoTable(doc, {
      head: matrixHeaders,
      body: matrixRows,
      startY: 20,
      styles: { 
        fontSize: 10, 
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center',
        overflow: 'linebreak'
      },
      headStyles: { 
        fillColor: [185, 28, 28], 
        textColor: 255,
        halign: 'center'
      },
      columnStyles: Object.fromEntries(
        Array.from({ length: totalMatrixCols }, (_, i) => [i, { cellWidth: matrixColWidth }])
      ),
      alternateRowStyles: { fillColor: [245, 245, 245] },
      theme: 'grid'
    });

    // 3. Variety Wise Summary Table
    const finalY = (doc as any).lastAutoTable.finalY || 20;
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61); // green-700
    doc.text("VARIETY WISE SUMMARY", 15, finalY + 8);

    const varietySummaryHeaders = [["Variety", "Group", "Total Bales/Day", "% (Weighted)", "% (Group Bales)"]];
    const varietySummaryRows = reportData.varietyItems.map(item => [
      item.variety,
      item.group,
      item.totalBales.toFixed(0),
      `${item.percentage.toFixed(1)}%`,
      `${item.groupPercentage.toFixed(1)}%`
    ]);

    autoTable(doc, {
      head: varietySummaryHeaders,
      body: varietySummaryRows,
      startY: finalY + 11,
      styles: { 
        fontSize: 10,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center'
      },
      headStyles: { 
        fillColor: [21, 128, 61],
        halign: 'center'
      },
      columnStyles: {
        // All columns centered
      },
      foot: [["Grand Total", "", reportData.grandTotalBales.toFixed(0), "100.0%", "-"]],
      footStyles: { 
        fillColor: [240, 240, 240], 
        textColor: 0, 
        fontStyle: 'bold',
        halign: 'center'
      },
      theme: 'grid'
    });

    // 4. Group Wise Summary Table
    const groupY = (doc as any).lastAutoTable.finalY || finalY + 11;
    doc.setFontSize(11);
    doc.setTextColor(21, 128, 61); // green-700
    doc.text("GROUP WISE SUMMARY", 15, groupY + 8);

    const groupSummaryHeaders = [["Cotton Group", "Total Bales/Day", "% (Weighted)"]];
    const groupSummaryRows = reportData.groupItems.map(item => [
      item.group,
      item.totalBales.toFixed(0),
      `${item.percentage.toFixed(1)}%`
    ]);

    autoTable(doc, {
      head: groupSummaryHeaders,
      body: groupSummaryRows,
      startY: groupY + 11,
      styles: { 
        fontSize: 10,
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        halign: 'center'
      },
      headStyles: { 
        fillColor: [21, 128, 61],
        halign: 'center'
      },
      columnStyles: {
        // All columns centered
      },
      foot: [["Grand Total", reportData.grandTotalBales.toFixed(0), "100.0%"]],
      footStyles: { 
        fillColor: [240, 240, 240], 
        textColor: 0, 
        fontStyle: 'bold',
        halign: 'center'
      },
      theme: 'grid'
    });

    // 5. Remarks
    if (pdfRemarks) {
      const remarksY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.setFont("helvetica", "bold");
      doc.text("Remarks:", 15, remarksY);
      doc.setFont("helvetica", "normal");
      const splitRemarks = doc.splitTextToSize(pdfRemarks, pageWidth - 30);
      doc.text(splitRemarks, 15, remarksY + 5);
    }

    doc.save("Cotton_Planning_Report.pdf");
    setShowPdfModal(false);
  };

  const generateExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Planning Matrix Sheet
    const matrixWSData = plans.map(plan => {
      const targetBales = (plan.laydown_consumption * plan.no_of_bales_per_laydown).toFixed(0);
      const row: any = {
        "Unit": plan.unit,
        "Bales per day": targetBales
      };
      varieties.forEach(v => {
        const val = matrix[plan.id]?.[v.cotton_variety];
        row[v.cotton_variety] = val && Number(val) > 0 ? `${val}%` : "";
      });
      return row;
    });
    const matrixWS = XLSX.utils.json_to_sheet(matrixWSData);
    XLSX.utils.book_append_sheet(wb, matrixWS, "Planning Matrix");

    // 2. Variety Wise Summary Sheet
    const varietyWSData = reportData.varietyItems.map(item => ({
      "Variety": item.variety,
      "Group": item.group,
      "Total Bales/Day": item.totalBales.toFixed(0),
      "% (Weighted)": `${item.percentage.toFixed(1)}%`,
      "% (Group Bales)": `${item.groupPercentage.toFixed(1)}%`
    }));
    // Add Total Row
    varietyWSData.push({
      "Variety": "Grand Total",
      "Group": "",
      "Total Bales/Day": reportData.grandTotalBales.toFixed(0),
      "% (Weighted)": "100.0%",
      "% (Group Bales)": "-"
    });
    const varietyWS = XLSX.utils.json_to_sheet(varietyWSData);
    XLSX.utils.book_append_sheet(wb, varietyWS, "Variety Summary");

    // 3. Group Wise Summary Sheet
    const groupWSData = reportData.groupItems.map(item => ({
      "Cotton Group": item.group,
      "Total Bales/Day": item.totalBales.toFixed(0),
      "% (Weighted)": `${item.percentage.toFixed(1)}%`
    }));
    // Add Total Row
    groupWSData.push({
      "Cotton Group": "Grand Total",
      "Total Bales/Day": reportData.grandTotalBales.toFixed(0),
      "% (Weighted)": "100.0%"
    });
    const groupWS = XLSX.utils.json_to_sheet(groupWSData);
    XLSX.utils.book_append_sheet(wb, groupWS, "Group Summary");

    XLSX.writeFile(wb, "Cotton_Planning_Data.xlsx");
  };

  // CRUD Handlers
  const handleAddPlan = () => { setEditingPlanId(null); setPlanUnit(""); setPlanLD(""); setPlanBL(""); setShowPlanModal(true); };
  const handleEditPlan = (plan: CottonPlan) => { setEditingPlanId(plan.id); setPlanUnit(plan.unit); setPlanLD(plan.laydown_consumption); setPlanBL(plan.no_of_bales_per_laydown); setShowPlanModal(true); };
  const handleDeletePlan = async (id: string) => { 
    if (!window.confirm("Delete plan?")) return;
    await axios.delete(`${API_BASE_URL}/api/cotton/planning/${id}`);
    fetchData();
  };
  const handleSavePlan = async () => {
    if (!planUnit || !planLD || !planBL) return;
    setSavingPlan(true);
    const payload = { unit: planUnit, laydown_consumption: planLD, no_of_bales_per_laydown: planBL };
    if (editingPlanId) await axios.put(`${API_BASE_URL}/api/cotton/planning/${editingPlanId}`, payload);
    else await axios.post(`${API_BASE_URL}/api/cotton/planning`, { ...payload, blend: [] });
    setShowPlanModal(false);
    fetchData();
    setSavingPlan(false);
  };

  const handleAddVariety = () => { setEditingVarietyId(null); setVarGroup(""); setVarVariety(""); setVarWeight(""); setShowVarietyModal(true); };
  const handleEditVariety = (v: CottonVariety) => { setEditingVarietyId(v.id); setVarGroup(v.cotton_group); setVarVariety(v.cotton_variety); setVarWeight(v.avg_bale_weight); setShowVarietyModal(true); };
  const handleDeleteVariety = async (id: string) => {
    if (!window.confirm("Delete variety?")) return;
    await axios.delete(`${API_BASE_URL}/api/cotton/groups/${id}`);
    fetchData();
  };
  const handleSaveVariety = async () => {
    if (!varGroup || !varVariety || !varWeight) return;
    setSavingVariety(true);
    const payload = { cotton_group: varGroup, cotton_variety: varVariety, avg_bale_weight: varWeight };
    if (editingVarietyId) await axios.put(`${API_BASE_URL}/api/cotton/groups/${editingVarietyId}`, payload);
    else await axios.post(`${API_BASE_URL}/api/cotton/groups`, payload);
    setShowVarietyModal(false);
    fetchData();
    setSavingVariety(false);
  };

  return (
    <div className="p-4 bg-gray-50 min-h-screen flex gap-4">
      {/* Main Matrix Area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-red-700">Cotton Planning Matrix</h2>
            {onBack && (
              <button onClick={onBack} className="text-gray-500 hover:text-red-700 font-semibold flex items-center gap-1 text-[10px] mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Back to Dashboard
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowReportModal(true)} 
              className="bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-800 shadow-sm flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Report
            </button>
            <button 
              onClick={() => setShowPdfModal(true)} 
              className="bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-800 shadow-sm flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
            <button 
              onClick={generateExcel} 
              className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-800 shadow-sm flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Excel
            </button>
            <button 
              onClick={() => {
                if (plans.length > 0) setSelectedUnitId(String(plans[0].id));
                setShowDetailsModal(true);
              }} 
              className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-900 shadow-sm flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Details
            </button>
            <button onClick={handleRefresh} className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-gray-50 shadow-sm">Refresh</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-black">
                  <th className="px-2 py-2 text-left font-bold text-gray-700 sticky left-0 bg-gray-50 z-10 border-r border-black w-20 text-[13px]">Unit</th>
                  {varieties.map(v => (
                    <th key={v.id} className="px-0.5 py-2 text-center font-bold text-gray-600 min-w-[50px] border-r border-black">
                      <div className="text-[9px] uppercase text-gray-400 leading-tight">{v.cotton_group}</div>
                      <div className="text-red-700 text-[11px] truncate px-1">{v.cotton_variety}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black border-b border-black">
                {plans.map(plan => {
                  const rowPercents = matrix[plan.id] || {};
                  const targetBales = (plan.laydown_consumption * plan.no_of_bales_per_laydown).toFixed(0);

                  return (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-3 font-bold text-gray-800 sticky left-0 bg-white z-10 border-r border-black text-[11px]">
                        {plan.unit}
                        <div className="text-[8px] text-black font-bold leading-tight">
                          {targetBales} Bales
                        </div>
                      </td>
                      {varieties.map(v => (
                        <td key={v.id} className="p-0 border-r border-black">
                          <input 
                            type="number"
                            value={rowPercents[v.cotton_variety] ?? ""}
                            onChange={(e) => handlePercentChange(plan.id, v.cotton_variety, e.target.value)}
                            className={`w-full text-center py-3 px-0.5 border-transparent focus:ring-0 outline-none transition-all text-[11px] focus:bg-gray-200 focus:text-black focus:font-bold ${
                              Number(rowPercents[v.cotton_variety]) > 0 ? 'bg-red-50 font-bold text-red-700' : 'bg-transparent text-gray-200'
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-gray-50 border-t border-black flex justify-center">
            <button 
              onClick={handleSaveAll}
              disabled={loading}
              className="bg-red-700 text-white px-12 py-2.5 rounded-xl font-bold text-sm hover:bg-red-800 shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><path d="M7 3v5h8"/></svg>
              {loading ? 'Saving Changes...' : 'Save All Planning Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex flex-col gap-4">
        {/* Unit Planning Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-3 py-1.5 border-b flex justify-between items-center cursor-pointer select-none" onClick={() => setShowUnitsTable(!showUnitsTable)}>
            <div className="flex items-center gap-2">
              <span className={`text-red-700 transition-transform duration-200 ${showUnitsTable ? 'rotate-0' : '-rotate-90'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </span>
              <span className="text-[10px] font-bold uppercase text-gray-600">Unit wise Bale Consumption</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleAddPlan(); }} className="text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
          </div>
          {showUnitsTable && (
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr><th className="px-2 py-1 text-left">Unit</th><th className="px-1 py-1 text-center">L/D</th><th className="px-1 py-1 text-center">B/L</th><th className="px-2 py-1"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map(p => (
                  <tr key={p.id}>
                    <td className="px-2 py-1.5 font-medium">{p.unit}</td>
                    <td className="px-1 py-1.5 text-center">{p.laydown_consumption}</td>
                    <td className="px-1 py-1.5 text-center">{p.no_of_bales_per_laydown}</td>
                    <td className="px-2 py-1.5 text-right flex gap-1 justify-end">
                      <button onClick={() => handleEditPlan(p)} className="text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button onClick={() => handleDeletePlan(p.id)} className="text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Cotton Groups Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-100 px-3 py-1.5 border-b flex justify-between items-center cursor-pointer select-none" onClick={() => setShowVarietiesTable(!showVarietiesTable)}>
            <div className="flex items-center gap-2">
              <span className={`text-red-700 transition-transform duration-200 ${showVarietiesTable ? 'rotate-0' : '-rotate-90'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </span>
              <span className="text-[10px] font-bold uppercase text-gray-600">Variety wise Avg Bale Weight</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleAddVariety(); }} className="text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
          </div>
          {showVarietiesTable && (
            <table className="w-full text-[10px]">
              <thead className="bg-gray-50 text-gray-500 border-b">
                <tr><th className="px-2 py-1 text-left">Variety</th><th className="px-2 py-1 text-center">Wt</th><th className="px-2 py-1"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {varieties.map(v => (
                  <tr key={v.id}>
                    <td className="px-2 py-1.5 font-medium">{v.cotton_variety}<span className="text-[8px] text-gray-400 block">{v.cotton_group}</span></td>
                    <td className="px-2 py-1.5 text-center">{v.avg_bale_weight}</td>
                    <td className="px-2 py-1.5 text-right flex gap-1 justify-end">
                      <button onClick={() => handleEditVariety(v)} className="text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                      <button onClick={() => handleDeleteVariety(v.id)} className="text-red-600"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
            <div className="p-4 border-b bg-red-50 flex justify-between items-center"><h3 className="font-bold text-red-700 text-sm">Unit Info</h3><button onClick={() => setShowPlanModal(false)}>✕</button></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Unit Name</label><input type="text" value={planUnit} onChange={e => setPlanUnit(e.target.value)} className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-red-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-bold text-gray-400 uppercase">L/D Cons.</label><input type="number" value={planLD} onChange={e => setPlanLD(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none" /></div>
                <div><label className="text-[10px] font-bold text-gray-400 uppercase">B/L Req.</label><input type="number" value={planBL} onChange={e => setPlanBL(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none" /></div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2"><button onClick={() => setShowPlanModal(false)} className="flex-1 py-2 font-bold text-gray-400 text-xs">Cancel</button><button onClick={handleSavePlan} disabled={savingPlan} className="flex-1 bg-red-700 text-white py-2 rounded-lg font-bold text-xs">{savingPlan ? '...' : 'Save'}</button></div>
          </div>
        </div>
      )}

      {/* Variety Modal */}
      {showVarietyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs overflow-hidden">
            <div className="p-4 border-b bg-red-50 flex justify-between items-center"><h3 className="font-bold text-red-700 text-sm">Variety Info</h3><button onClick={() => setShowVarietyModal(false)}>✕</button></div>
            <div className="p-4 space-y-3">
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Group Name</label><input type="text" value={varGroup} onChange={e => setVarGroup(e.target.value)} placeholder="e.g. S-6" className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Variety Name</label><input type="text" value={varVariety} onChange={e => setVarVariety(e.target.value)} placeholder="e.g. MCU-5" className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 uppercase">Avg Bale Weight</label><input type="number" value={varWeight} onChange={e => setVarWeight(e.target.value ? Number(e.target.value) : "")} placeholder="170" className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none" /></div>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2"><button onClick={() => setShowVarietyModal(false)} className="flex-1 py-2 font-bold text-gray-400 text-xs">Cancel</button><button onClick={handleSaveVariety} disabled={savingVariety} className="flex-1 bg-red-700 text-white py-2 rounded-lg font-bold text-xs">{savingVariety ? '...' : 'Save'}</button></div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b bg-blue-50 flex justify-between items-center">
              <h3 className="font-bold text-blue-700 text-sm">PDF Export Options</h3>
              <button onClick={() => setShowPdfModal(false)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">PDF Header</label>
                <input 
                  type="text" 
                  value={pdfHeader} 
                  onChange={e => setPdfHeader(e.target.value)} 
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" 
                  placeholder="Enter PDF Title"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Footer Remarks</label>
                <textarea 
                  value={pdfRemarks} 
                  onChange={e => setPdfRemarks(e.target.value)} 
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 min-h-[100px]" 
                  placeholder="Enter any remarks for the footer..."
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex gap-2">
              <button onClick={() => setShowPdfModal(false)} className="flex-1 py-2 font-bold text-gray-400 text-xs">Cancel</button>
              <button onClick={generatePDF} className="flex-1 bg-blue-700 text-white py-2 rounded-lg font-bold text-xs hover:bg-blue-800 shadow-md transition-all active:scale-95">Download PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b bg-red-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-red-700 text-sm">Cotton Variety Wise Report</h3>
                <p className="text-[10px] text-gray-500">Based on currently entered planning percentages</p>
              </div>
              <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-0 max-h-[70vh] overflow-y-auto">
              {/* Variety Wise Table */}
              <div className="bg-gray-50 px-4 py-1.5 border-b text-xs font-bold uppercase text-green-700">Variety Wise Summary</div>
              <table className="w-full text-xs">
                <thead className="bg-white text-gray-600 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Variety</th>
                    <th className="px-4 py-2 text-left text-gray-400">Group</th>
                    <th className="px-4 py-2 text-center">Total Bales/Day</th>
                    <th className="px-4 py-2 text-center">% (Weighted)</th>
                    <th className="px-4 py-2 text-center text-blue-700">% (Group Bales)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.varietyItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{item.variety}</td>
                      <td className="px-4 py-2.5 text-left text-[10px] text-gray-400">{item.group}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-red-700">{item.totalBales.toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{item.percentage.toFixed(1)}%</td>
                      <td className="px-4 py-2.5 text-center text-blue-600 font-bold">{item.groupPercentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {reportData.varietyItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">No planning data entered yet</td>
                    </tr>
                  )}
                </tbody>
                {reportData.varietyItems.length > 0 && (
                  <tfoot className="bg-gray-50 border-t font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 text-left">Grand Total</td>
                      <td className="px-4 py-2 text-center text-red-700">{reportData.grandTotalBales.toFixed(0)}</td>
                      <td className="px-4 py-2 text-center">100.0%</td>
                      <td className="px-4 py-2 text-center">-</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* Group Wise Table */}
              {reportData.groupItems.length > 0 && (
                <>
                  <div className="bg-gray-50 px-4 py-1.5 border-b border-t text-xs font-bold uppercase text-green-700">Group Wise Summary</div>
                  <table className="w-full text-xs">
                    <thead className="bg-white text-gray-600 border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Cotton Group</th>
                        <th className="px-4 py-2 text-center">Total Bales/Day</th>
                        <th className="px-4 py-2 text-center">% (Weighted)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {reportData.groupItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{item.group}</td>
                          <td className="px-4 py-2.5 text-center font-bold text-red-700">{item.totalBales.toFixed(0)}</td>
                          <td className="px-4 py-2.5 text-center text-gray-600">{item.percentage.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t font-bold">
                      <tr>
                        <td className="px-4 py-2 text-left">Grand Total</td>
                        <td className="px-4 py-2 text-center text-red-700">{reportData.grandTotalBales.toFixed(0)}</td>
                        <td className="px-4 py-2 text-center">100.0%</td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
            <div className="p-4 bg-gray-50 flex justify-end">
              <button onClick={() => setShowReportModal(false)} className="px-6 py-2 bg-red-700 text-white rounded-lg font-bold text-xs hover:bg-red-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-700 text-sm">Unit Wise Calculation Details</h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-4 bg-white border-b">
              <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Select Unit</label>
              <select 
                value={selectedUnitId} 
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-red-500 bg-white"
              >
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.unit}</option>
                ))}
              </select>
            </div>
            <div className="p-0 max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Variety</th>
                    <th className="px-4 py-2 text-center">Bales/Day</th>
                    <th className="px-4 py-2 text-center">% (Weighted)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unitDetails?.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{item.variety}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-red-700">{item.calculatedBales.toFixed(0)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{item.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {(!unitDetails || unitDetails.items.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">No blend data for this unit</td>
                    </tr>
                  )}
                </tbody>
                {unitDetails && unitDetails.items.length > 0 && (
                  <tfoot className="bg-gray-50 border-t font-bold sticky bottom-0">
                    <tr>
                      <td className="px-4 py-2 text-left">Total</td>
                      <td className="px-4 py-2 text-center text-red-700">{unitDetails.totalBales.toFixed(0)}</td>
                      <td className="px-4 py-2 text-center">
                        {unitDetails.items.reduce((s, i) => s + i.percentage, 0).toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end">
              <button onClick={() => setShowDetailsModal(false)} className="px-6 py-2 bg-gray-800 text-white rounded-lg font-bold text-xs hover:bg-gray-900">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
