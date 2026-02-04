import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from "../../config";

type FabricComplaint = Record<string, string | number | boolean | null>;

const TABLE_NAME = "fabric_complaints";

const DROPDOWN_COLUMNS = [
  "status",
  "customer_name",
  "bill_to_region",
  "market",
  "count",
  "unit_no",
  "complaint_type",
  "customer_type",
  "department",
  "customer_complaint",
  "nature_of_complaint",
  "cotton",
  "complaint_mode"
];

const SPECIAL_COLUMNS = ["analysis_and_outcome", "action_taken", "remark"];

const ALL_FABRIC_COLUMNS = [
  "query_received_date",
  "status",
  "customer_name",
  "bill_to_region",
  "market",
  "invoice_no",
  "invoice_date",
  "complaint_qty",
  "count",
  "fabric_lot_no",
  "invoice_qty",
  "unit_no",
  "complaint_type",
  "customer_type",
  "department",
  "customer_complaint",
  "nature_of_complaint",
  "cotton",
  "analysis_and_outcome",
  "action_taken",
  "remark",
  "reply_date",
  "complaint_mode",
  "mfg_date",
  "mfg_month"
];

const REQUIRED_FABRIC_FIELDS = ["query_received_date", "status", "customer_name", "customer_type"];

function SearchableDropdown({ 
  value, 
  options, 
  onChange, 
  placeholder 
}: { 
  value: string; 
  options: string[]; 
  onChange: (val: string) => void; 
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    return options.filter(opt => 
      opt.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500 outline-none transition-all flex justify-between items-center cursor-pointer"
      >
        <span className={value ? "text-gray-900" : "text-gray-400"}>
          {value || placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-red-50 hover:text-red-700 transition-colors ${value === opt ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-700'}`}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {opt}
                </div>
              ))
            ) : searchTerm.trim() !== "" ? (
              <div 
                className="px-4 py-3 text-sm text-red-600 font-medium cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-2"
                onClick={() => {
                  onChange(searchTerm.trim());
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add "{searchTerm}"
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 italic text-center">No results found</div>
            )}
            
            {/* Always show "Add New" if searching and no exact match */}
            {searchTerm.trim() !== "" && !options.some(opt => opt.toLowerCase() === searchTerm.trim().toLowerCase()) && filteredOptions.length > 0 && (
              <div 
                className="px-4 py-2 text-sm text-red-600 font-medium cursor-pointer border-t border-gray-50 hover:bg-red-50 transition-colors flex items-center gap-2"
                onClick={() => {
                  onChange(searchTerm.trim());
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TableLayout = {
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  wrappedColumns?: string[];
};

type SavedLayout = {
  id: string;
  table_name: string;
  layout_name: string;
  layout: TableLayout;
};

export default function FabricComplaintTable() {
  const [data, setData] = useState<FabricComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [wrappedColumns, setWrappedColumns] = useState<string[]>([]);
  const [showWrapDropdown, setShowWrapDropdown] = useState(false);

  /* ===== Layout State ===== */
  const [currentLayout, setCurrentLayout] = useState<SavedLayout | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);

  /* ===== Filter State ===== */
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  
  // Date range filter (Default to current month)
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
  });

  // Temporary date states for the inputs
  const [tempStartDate, setTempStartDate] = useState<string>(startDate);
  const [tempEndDate, setTempEndDate] = useState<string>(endDate);

  const handleApplyDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  const handleResetDates = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');
    setTempStartDate(start);
    setTempEndDate(end);
    setStartDate(start);
    setEndDate(end);
  };

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  /* ===== Edit/Delete State ===== */
  const [editingRow, setEditingRow] = useState<FabricComplaint | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  const [marketMappings, setMarketMappings] = useState<any[]>([]);

  const fetchAllDropdownOptions = useCallback(async () => {
    try {
      const results: Record<string, string[]> = {};
      
      // Fetch market mappings first
      const mapRes = await fetch("${API_BASE_URL}/api/master/market-mappings");
      const mapJson = await mapRes.json();
      if (mapJson.success) {
        setMarketMappings(mapJson.data);
        // Extract unique cities for the dropdown
        const regions = [...new Set(mapJson.data.map((m: any) => m.ship_to_city))].filter(Boolean) as string[];
        results["bill_to_region"] = regions.sort();
      }

      await Promise.all(
        DROPDOWN_COLUMNS.map(async (col) => {
          // Skip bill_to_region as we already populated it from market_master
          if (col === "bill_to_region") return;

          let fetchTable = TABLE_NAME;
          if (col === "market") fetchTable = "market_master";
          else if (col === "customer_name") fetchTable = "customer_master";

          const res = await fetch(`${API_BASE_URL}/api/unique-values/${fetchTable}/${col}`);
          const json = await res.json();
          if (json.success) {
            results[col] = json.data.map(String);
          }
        })
      );
      setDropdownOptions(results);
    } catch (err) {
      console.error("Failed to fetch dropdown options", err);
    }
  }, []);

  const handleDownloadTemplate = () => {
    const headers = allColumns.filter(c => c !== "actions");
    let csvContent = headers.join(",") + "\n";
    
    // Add the latest row as an example if data exists
    if (data.length > 0) {
      const latestRow = data[0];
      const exampleRow = headers.map(h => {
        const val = latestRow[h];
        if (val === null || val === undefined) return "";
        // Wrap in quotes and escape existing quotes for CSV safety
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
      csvContent += exampleRow + "\n";
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "fabric_complaint_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    const headers = visibleColumns.filter(c => c !== "actions");
    const worksheetData = [
      headers.map(h => h.replaceAll("_", " ").toUpperCase()),
      ...data.map(row => headers.map(h => row[h] ?? ""))
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Complaints");
    XLSX.writeFile(workbook, "fabric_complaints.xlsx");
  };

  const handleDownloadPDF = () => {
    const headerText = prompt("Enter PDF Header:", "Fabric Complaints Report");
    if (headerText === null) return; // Cancelled

    const doc = new jsPDF('landscape');
    const headers = visibleColumns.filter(c => c !== "actions");
    const tableData = data.map(row => headers.map(h => row[h] ?? ""));
    const tableHeaders = headers.map(h => h.replaceAll("_", " ").toUpperCase());

    // Add Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38); // Red color
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(headerText, pageWidth / 2, 15, { align: 'center' });

    autoTable(doc, {
      startY: 25,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] }, // Red color matching theme
    });
    doc.save("fabric_complaints.pdf");
  };

  const handleUploadCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim() !== "");
      if (lines.length < 2) {
        alert("CSV file is empty or missing data rows");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim());
      
      const normalizeDate = (val: string): string | null => {
        if (!val || val.trim() === "") return null;
        const cleanVal = val.trim();
        
        // Already in YYYY-MM-DD format?
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanVal)) return cleanVal;

        // Try parsing DD-MM-YYYY, MM-DD-YYYY, etc.
        const parts = cleanVal.split(/[-/.]/);
        if (parts.length === 3) {
          let day, month, year;
          if (parts[0].length === 4) { // YYYY-MM-DD or YYYY-DD-MM
            year = parts[0];
            month = parts[1];
            day = parts[2];
          } else {
            const p1 = parseInt(parts[0]);
            const p2 = parseInt(parts[1]);
            let p3 = parts[2];
            if (p3.length === 2) p3 = "20" + p3;
            
            if (p1 > 12) { // DD-MM-YYYY
              day = String(p1);
              month = String(p2);
              year = p3;
            } else if (p2 > 12) { // MM-DD-YYYY
              month = String(p1);
              day = String(p2);
              year = p3;
            } else { // Ambiguous, default to DD-MM-YYYY
              day = String(p1);
              month = String(p2);
              year = p3;
            }
          }

          if (year && month && day) {
            const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString('en-CA');
            }
          }
        }

        // Fallback to native Date parsing
        const d = new Date(cleanVal);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-CA');
        }

        return null; // Return null if invalid to avoid Postgres syntax error
      };

      // Simple CSV parser that handles quoted values with commas
      const parseCSVLine = (line: string) => {
        const result = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i+1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = "";
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const rows = lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const row: FabricComplaint = {};
        headers.forEach((h, i) => {
          let val = values[i] || null;
          const isDateCol = h.toLowerCase().includes("date") || h.toLowerCase().endsWith("_at");
          if (val && isDateCol) {
            val = normalizeDate(val);
          }
          row[h] = val;
        });
        return row;
      });

      try {
        const res = await fetch("${API_BASE_URL}/api/fabric-complaints/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rows),
        });
        const json = await res.json();
        if (json.success) {
          alert(`Successfully uploaded ${json.data.length} complaints`);
          loadData();
          fetchAllDropdownOptions();
          setShowEditModal(false);
        } else {
          throw new Error(json.error || "Failed to upload bulk data");
        }
      } catch (err) {
        alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);
  };

  /* ===== Resize refs ===== */
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  /* =======================
     DATA LOADING
     ======================= */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Build query params for filters
      const params = new URLSearchParams();

      // Add date filters
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      Object.entries(selectedFilters).forEach(([col, values]) => {
        if (values.length > 0) {
          params.append(col, values.join(","));
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/fabric-complaints?${params.toString()}`);
      const json = await res.json();

      if (!json.success) throw new Error("Data API failed");

      const rows = json.data;
      setData(rows);

      if (visibleColumns.length === 0) {
        const cols = ALL_FABRIC_COLUMNS;
        setVisibleColumns(["actions", ...cols]);
        const widths: Record<string, number> = {
          actions: 100
        };
        cols.forEach((c) => (widths[c] = 160));
        setColumnWidths(widths);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedFilters, visibleColumns.length, startDate, endDate]);

  // 1. Initial initialization (Layouts) - Runs only once on mount
  useEffect(() => {
    fetchAllDropdownOptions();
    
    const fetchLayouts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/table-layouts/${TABLE_NAME}`);
        const json = await res.json();
        setSavedLayouts(json.data || []);
      } catch (err) {
        console.error("Failed to pre-fetch layouts", err);
      }
    };

    const fetchLatestLayout = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/table-layout/${TABLE_NAME}`);
        const json = await res.json();
        if (json.success && json.data) {
          const layout = json.data as SavedLayout;
          setVisibleColumns(layout.layout.visibleColumns);
          setColumnWidths(layout.layout.columnWidths);
          setWrappedColumns(layout.layout.wrappedColumns || []);
          setCurrentLayout(layout);
        }
      } catch (err) {
        console.error("Failed to fetch latest layout", err);
      }
    };

    fetchLayouts();
    fetchLatestLayout();
  }, [fetchAllDropdownOptions]); // fetchAllDropdownOptions is stable due to useCallback

  // 2. Data loading - Runs when filters or dates change
  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearFilter = (col: string) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[col];
      return newFilters;
    });
  };

  /* =======================
     EDIT/DELETE HANDLERS
     ======================= */
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this complaint?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/fabric-complaints/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setData((prev) => prev.filter((row) => row.id !== id));
      } else {
        throw new Error(json.error || "Failed to delete");
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  /* =======================
     RESIZE HANDLERS
     ======================= */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingCol.current) return;
    const deltaX = e.clientX - startX.current;
    setColumnWidths((prev) => ({
      ...prev,
      [resizingCol.current!]: Math.max(startWidth.current + deltaX, 80),
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingCol.current = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  const startResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingCol.current = col;
    startX.current = e.clientX;
    startWidth.current = columnWidths[col] || 160;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  /* =======================
     SAVE LAYOUT
     ======================= */
  const handleSaveLayout = async (replaceExisting = false) => {
    const nameToSave = replaceExisting && currentLayout ? currentLayout.layout_name : layoutName;
    if (!nameToSave.trim()) return;

    // Check for duplicate names if saving as new
    if (!replaceExisting) {
      const nameExists = savedLayouts.some(
        (l) => l.layout_name.toLowerCase() === nameToSave.toLowerCase()
      );
      if (nameExists) {
        alert(`A layout named "${nameToSave}" already exists. Please use a different name.`);
        return;
      }
    }

    const payload: Partial<SavedLayout> = {
      table_name: TABLE_NAME,
      layout_name: nameToSave,
      layout: {
        visibleColumns,
        columnWidths,
        wrappedColumns,
      },
    };

    if (replaceExisting && currentLayout?.id) {
      payload.id = currentLayout.id;
    }

    try {
      const res = await fetch("${API_BASE_URL}/api/table-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        const newLayout = { 
          id: json.data?.id, 
          ...payload 
        } as SavedLayout;
        
        setCurrentLayout(newLayout);
        setLayoutName("");
        setShowSaveModal(false);
        alert(replaceExisting ? "Layout updated" : "Layout saved");
        
        // Refresh saved layouts list
        const loadRes = await fetch(`${API_BASE_URL}/api/table-layouts/${TABLE_NAME}`);
        const loadJson = await loadRes.json();
        setSavedLayouts(loadJson.data || []);
      }
    } catch {
      alert("Failed to save layout");
    }
  };

  const loadLayouts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/table-layouts/${TABLE_NAME}`);
      const json = await res.json();
      setSavedLayouts(json.data || []);
      setShowLoadModal(true);
    } catch {
      alert("Failed to load layouts");
    }
  };

  const deleteLayout = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent applying the layout when clicking delete
    if (!confirm("Are you sure you want to delete this layout?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/table-layout/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setSavedLayouts((prev) => prev.filter((l) => l.id !== id));
        if (currentLayout?.id === id) {
          setCurrentLayout(null);
        }
      } else {
        throw new Error(json.error || "Failed to delete");
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const applyLayout = async (layout: SavedLayout) => {
    setVisibleColumns(layout.layout.visibleColumns);
    setColumnWidths(layout.layout.columnWidths);
    setWrappedColumns(layout.layout.wrappedColumns || []);
    setCurrentLayout(layout);
    setShowLoadModal(false);

    // Update updated_at in backend to mark as "last used"
    try {
      await fetch("${API_BASE_URL}/api/table-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: layout.id,
          table_name: layout.table_name,
          layout_name: layout.layout_name,
          layout: layout.layout
        }),
      });
    } catch (err) {
      console.error("Failed to update last used timestamp", err);
    }
  };

  const allColumns = useMemo(() => {
    return ALL_FABRIC_COLUMNS;
  }, []);

  const totalWidth = useMemo(() => visibleColumns.reduce((sum, col) => sum + (columnWidths[col] || 160), 0), [visibleColumns, columnWidths]);

  if (loading && data.length === 0) return <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse font-medium">Loading complaints...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">{error}</div>;

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200">
      {/* ===== Toolbar ===== */}
      <div className="flex flex-col border-b border-gray-100 bg-gray-50/50 overflow-visible">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              {currentLayout && (
                <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Active Layout: {currentLayout.layout_name}
                </span>
              )}
            </div>
            
            <div className="ml-4 flex items-center gap-2">
              {/* Column Selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowColumnFilter((v) => !v);
                    setShowFilterDropdown(false);
                    setShowWrapDropdown(false);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h18"/></svg>
                  Columns
                </button>
                {showColumnFilter && (
                  <div className="absolute top-10 left-0 z-40 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                      <span className="text-xs font-bold uppercase text-gray-500">Visible Columns</span>
                    </div>
                    {allColumns.map((col) => (
                      <label key={col} className="flex items-center gap-3 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          checked={visibleColumns.includes(col)}
                          onChange={() =>
                            setVisibleColumns((prev) =>
                              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                            )
                          }
                        />
                        <span className="capitalize">{col.replaceAll("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Reorder Columns */}
              <button
                onClick={() => {
                  setShowReorderModal(true);
                  setShowColumnFilter(false);
                  setShowWrapDropdown(false);
                  setShowFilterDropdown(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 12-3-3-3 3"/><path d="m9 12 3 3 3-3"/><path d="M12 3v18"/></svg>
                Reorder
              </button>

              {/* Wrap Text Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowWrapDropdown((v) => !v);
                    setShowColumnFilter(false);
                    setShowFilterDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors shadow-sm ${wrappedColumns.length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M3 12h15"/><path d="M3 18h11"/></svg>
                  Wrap Text {wrappedColumns.length > 0 && `(${wrappedColumns.length})`}
                </button>
                {showWrapDropdown && (
                  <div className="absolute top-10 left-0 z-40 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-64 max-h-[70vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
                      <span className="text-xs font-bold uppercase text-gray-500">Wrap Text Columns</span>
                    </div>
                    {allColumns.map((col) => (
                      <label key={col} className="flex items-center gap-3 p-1.5 rounded hover:bg-gray-50 cursor-pointer transition-colors text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          checked={wrappedColumns.includes(col)}
                          onChange={() =>
                            setWrappedColumns((prev) =>
                              prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                            )
                          }
                        />
                        <span className="capitalize">{col.replaceAll("_", " ")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowFilterDropdown((v) => !v);
                    setShowColumnFilter(false);
                    setShowWrapDropdown(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm font-medium transition-colors shadow-sm ${Object.keys(selectedFilters).length > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  Filter {Object.keys(selectedFilters).length > 0 && `(${Object.keys(selectedFilters).length})`}
                </button>
                {showFilterDropdown && (
                  <div className="absolute top-10 left-0 z-40 bg-white border border-gray-200 rounded-lg shadow-xl p-2 w-56 animate-in fade-in slide-in-from-top-2">
                    <span className="block px-3 py-2 text-xs font-bold uppercase text-gray-500 border-b border-gray-50 mb-1">Select column to filter</span>
                    <div className="max-h-64 overflow-y-auto">
                      {allColumns.map((col) => (
                        <button
                          key={col}
                          onClick={() => fetchUniqueValues(col)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded transition-colors capitalize flex items-center justify-between group"
                        >
                          {col.replaceAll("_", " ")}
                          {selectedFilters[col] && (
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-gray-500">From</span>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase text-gray-500">To</span>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none transition-all bg-white"
                />
              </div>
              <button
                onClick={handleApplyDates}
                className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition-colors shadow-sm"
              >
                Apply
              </button>
              <button
                onClick={handleResetDates}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Reset to current month"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>

              <div className="h-6 w-px bg-gray-200 mx-1" />

              <button
                onClick={() => {
                  const emptyRow: FabricComplaint = {};
                  allColumns.forEach(col => {
                    if (col !== "actions") emptyRow[col] = "";
                  });
                  setEditingRow(emptyRow);
                  setShowEditModal(true);
                }}
                className="px-3 py-1.5 bg-green-600 border border-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add Complaint
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLayouts}
              className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              Load Layout
            </button>
            <button
              onClick={() => {
                setLayoutName("");
                setShowSaveModal(true);
              }}
              className="px-3 py-1.5 bg-red-600 border border-red-600 rounded-md text-sm font-medium text-white hover:bg-red-700 transition-colors shadow-sm"
            >
              Save Layout
            </button>

            <div className="h-8 w-px bg-gray-200 mx-1" />

            <button
              onClick={handleDownloadExcel}
              className="p-1.5 bg-white border border-gray-300 rounded-md text-green-600 hover:bg-green-50 transition-colors shadow-sm"
              title="Download Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="p-1.5 bg-white border border-gray-300 rounded-md text-red-600 hover:bg-red-50 transition-colors shadow-sm"
              title="Download PDF"
            >
              <svg className="h-5 w-5" viewBox="0 0 384 512" fill="currentColor">
                <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-21.5-3.3-31.5-21-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 9.2 0 14.3-3.6 23.4-13 14.8-15.3 32.5-49 46.5-74.2 24.3-11.1 55.6-21.1 82.2-22.3 22.8 28.5 53.6 57 81.3 57 18.1 0 24-11.2 24.1-18.9 0-14.7-27.4-19.4-80.1-41.5zm190.5-231.5L250.7 20.7c-4.5-4.5-10.6-7-17-7H232v128h128v-1.7c0-6.4-2.5-12.5-7-17zM350.1 393.3c-.1-12.4-11-28.4-53.1-44.5-5.2 2.7-21.8 11.4-21.8 11.4 34.1 21.4 75 43.4 74.9 33.1z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Active Filters Display */}
        {Object.keys(selectedFilters).length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            {Object.entries(selectedFilters).map(([col, values]) => (
              <div key={col} className="flex items-center gap-1 bg-white border border-red-200 rounded-full pl-3 pr-1 py-1 text-xs shadow-sm">
                <span className="font-bold text-gray-500 capitalize">{col.replaceAll("_", " ")}:</span>
                <span className="text-red-700 font-medium truncate max-w-[150px]">{values.join(", ")}</span>
                <button
                  onClick={() => clearFilter(col)}
                  className="ml-1 p-0.5 hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ))}
            <button
              onClick={() => setSelectedFilters({})}
              className="text-xs text-gray-500 hover:text-red-600 font-medium px-2"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ===== Data Grid ===== */}
      <div className="flex-1 overflow-auto relative bg-gray-50/30">
        <div style={{ width: totalWidth }} className="min-w-full">
          {/* Header */}
          <div className="flex sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
            {visibleColumns.map((col) => (
              <div
                key={col}
                style={{ width: columnWidths[col] }}
                className="group relative flex items-center h-10 px-3 bg-white border-r border-gray-100 last:border-r-0"
              >
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider truncate">
                  {col.replaceAll("_", " ")}
                </span>
                <div
                  onMouseDown={(e) => startResize(col, e)}
                  className="absolute top-0 right-0 h-full w-1 cursor-col-resize group-hover:bg-red-400/50 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex flex-col">
            {data.length > 0 ? (
              data.map((row, idx) => (
                <div key={idx} className="flex border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                  {visibleColumns.map((col) => {
                    const isWrapped = wrappedColumns.includes(col);
                    if (col === "actions") {
                      return (
                        <div
                          key={col}
                          style={{ width: columnWidths[col] || 100 }}
                          className="flex items-center gap-2 px-3 border-r border-gray-50 h-auto min-h-[40px]"
                        >
                          <button
                            onClick={() => {
                              setEditingRow({ ...row });
                              setShowEditModal(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                          </button>
                          <button
                            onClick={() => handleDelete(String(row.id))}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={col}
                        style={{ width: columnWidths[col] }}
                        className={`flex px-3 border-r border-gray-50 last:border-r-0 text-sm text-gray-700 min-h-[40px] overflow-hidden ${
                          isWrapped 
                            ? "items-start py-2 whitespace-normal break-words h-auto" 
                            : "items-center h-auto"
                        }`}
                      >
                        <span className={`min-w-0 ${isWrapped ? "" : "truncate"}`}>
                          {row[col] ?? "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : !loading && (
              <div className="flex flex-col items-center justify-center py-20 bg-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 mb-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <p className="text-gray-500 font-medium">No results match your filters</p>
                <button onClick={() => setSelectedFilters({})} className="mt-2 text-red-600 hover:underline text-sm">Clear all filters</button>
              </div>
            )}
            {loading && data.length > 0 && (
               <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                 <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-lg">
                   <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                   <span className="text-sm font-medium text-gray-700">Updating...</span>
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Footer / Stats ===== */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500 font-medium">
        <div className="flex items-center gap-4">
          <span>Total Complaints: {data.length}</span>
          <div className="h-3 w-px bg-gray-300" />
          <span>Visible Columns: {visibleColumns.length}</span>
        </div>
        <div>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* ===== Edit/Add Modal ===== */}
      {showEditModal && editingRow && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {editingRow.id ? "Edit Fabric Complaint" : "New Fabric Complaint"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {editingRow.id ? "Update the details of the fabric complaint" : "Fill in the details to record a new fabric complaint"}
                  </p>
                </div>
                
                {!editingRow.id && (
                  <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                    <button
                      onClick={handleDownloadTemplate}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Download CSV Template"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      Template
                    </button>
                    
                    <label className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer" title="Upload CSV Data">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                      Upload CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleUploadCSV} />
                    </label>
                  </div>
                )}
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingRow) return;

                // Validation
                const missingFields = REQUIRED_FABRIC_FIELDS.filter(f => !editingRow[f]);
                if (missingFields.length > 0) {
                  alert(`Please fill in required fields: ${missingFields.map(f => f.replaceAll("_", " ")).join(", ")}`);
                  return;
                }

                try {
                  const isNew = !editingRow.id;
                  const url = isNew 
                    ? "${API_BASE_URL}/api/fabric-complaints" 
                    : `${API_BASE_URL}/api/fabric-complaints/${editingRow.id}`;
                  const method = isNew ? "POST" : "PUT";

                  const res = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editingRow),
                  });
                  const json = await res.json();
                  if (json.success) {
                    if (isNew) {
                      setData((prev) => [json.data, ...prev]);
                    } else {
                      setData((prev) => prev.map((row) => (row.id === editingRow.id ? json.data : row)));
                    }
                    fetchAllDropdownOptions(); // Refresh dropdown options to include any new values
                    setShowEditModal(false);
                    setEditingRow(null);
                  } else {
                    throw new Error(json.error || `Failed to ${isNew ? 'create' : 'update'}`);
                  }
                } catch (err) {
                  alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
              }} 
              className="flex-1 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allColumns.filter(c => !SPECIAL_COLUMNS.includes(c) && c !== "actions").map((col) => {
                  // Determine input type based on column name or value
                  let inputType = "text";
                  if (col.includes("date")) inputType = "date";
                  if (typeof editingRow[col] === "number") inputType = "number";

                  const isDropdown = DROPDOWN_COLUMNS.includes(col);
                  let options = dropdownOptions[col] || [];

                  // Cascading logic for Market and Region
                  if (col === "market" && editingRow.bill_to_region) {
                    const filteredMarkets = marketMappings
                      .filter(m => m.ship_to_city === editingRow.bill_to_region)
                      .map(m => m.market)
                      .filter(Boolean);
                    if (filteredMarkets.length > 0) {
                      options = [...new Set(filteredMarkets)].sort();
                    }
                  } else if (col === "bill_to_region" && editingRow.market) {
                    const filteredRegions = marketMappings
                      .filter(m => m.market === editingRow.market)
                      .map(m => m.ship_to_city)
                      .filter(Boolean);
                    if (filteredRegions.length > 0) {
                      options = [...new Set(filteredRegions)].sort();
                    }
                  }

                  return (
                    <div key={col} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {col.replaceAll("_", " ")}
                        {REQUIRED_FABRIC_FIELDS.includes(col) && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {isDropdown ? (
                        <SearchableDropdown
                          value={(editingRow[col] ?? "") as string}
                          options={options}
                          onChange={(val) => {
                            let updated = { ...editingRow, [col]: val };
                            
                            // Auto-populate market when bill_to_region is selected
                            if (col === "bill_to_region" && val) {
                              const mapping = marketMappings.find(m => m.ship_to_city === val);
                              if (mapping) {
                                updated = {
                                  ...updated,
                                  market: mapping.market || updated.market
                                };
                              }
                            }
                            
                            setEditingRow(updated);
                          }}
                          placeholder={`Select ${col.replaceAll("_", " ")}`}
                        />
                      ) : (
                        <div className="relative flex items-center">
                          <input
                            type={inputType}
                            value={(editingRow[col] ?? "") as string | number}
                            onChange={(e) => {
                              const val = inputType === "number" ? parseFloat(e.target.value) : e.target.value;
                              setEditingRow({ ...editingRow, [col]: val });
                            }}
                            className={`w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all ${col === "invoice_no" ? "pr-24" : ""}`}
                          />
                          {col === "invoice_no" && (
                            <button
                              type="button"
                              onClick={async () => {
                                const inv = editingRow["invoice_no"];
                                if (!inv) return;
                                try {
                                  const res = await fetch(`${API_BASE_URL}/api/dispatch-data/by-invoice/${inv}`);
                                  const json = await res.json();
                                  if (json.success) {
                                    const d = json.data;
                                    setEditingRow({
                                      ...editingRow,
                                      customer_name: d.customer_name || d.bill_to_customer || editingRow.customer_name,
                                      bill_to_region: d.bill_to_region || editingRow.bill_to_region,
                                      market: d.market || editingRow.market,
                                      invoice_date: d.billing_date || editingRow.invoice_date,
                                      invoice_qty: d.billed_quantity || editingRow.invoice_qty,
                                      fabric_lot_no: d.lot_no || editingRow.fabric_lot_no,
                                      unit_no: d.plant || editingRow.unit_no,
                                      count: d.item_description || editingRow.count
                                    });
                                  } else {
                                    alert(json.message || "Invoice not found");
                                  }
                                } catch (err) {
                                  alert("Error fetching invoice info");
                                }
                              }}
                              className="absolute right-2 px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded hover:bg-red-200 transition-colors"
                            >
                              Fetch Info
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Special Columns at the bottom */}
              <div className="mt-8 space-y-6">
                {SPECIAL_COLUMNS.map((col) => (
                  <div key={col} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {col.replaceAll("_", " ")}
                    </label>
                    <textarea
                      value={(editingRow[col] ?? "") as string}
                      onChange={(e) => setEditingRow({ ...editingRow, [col]: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all min-h-[120px] resize-y"
                      placeholder={`Enter ${col.replaceAll("_", " ")}...`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  {editingRow.id ? "Save Changes" : "Create Complaint"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Layout Modals (Save/Load) ===== */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Save Layout</h3>
            <p className="text-sm text-gray-500 mb-6">Save current column visibility and widths.</p>
            {currentLayout ? (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <p className="text-sm text-gray-700">Currently using: <span className="font-bold text-red-600">"{currentLayout.layout_name}"</span></p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => handleSaveLayout(true)} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2">Replace Existing</button>
                  <div className="relative py-2 text-center text-xs uppercase text-gray-400">Or save as new</div>
                  <input autoFocus value={layoutName} onChange={(e) => setLayoutName(e.target.value)} placeholder="New layout name" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                  <button disabled={!layoutName.trim()} onClick={() => handleSaveLayout(false)} className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">Save as New</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <input autoFocus value={layoutName} onChange={(e) => setLayoutName(e.target.value)} placeholder="Layout name" className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-500" />
                <button disabled={!layoutName.trim()} onClick={() => handleSaveLayout(false)} className="w-full px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">Save Layout</button>
              </div>
            )}
            <div className="flex justify-center mt-4"><button onClick={() => setShowSaveModal(false)} className="text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button></div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Load Layout</h3>
            <div className="max-h-64 overflow-y-auto space-y-1 my-4">
              {savedLayouts.length > 0 ? (
                savedLayouts.map((l) => (
                  <div key={l.id} className="group relative">
                    <button
                      onClick={() => applyLayout(l)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all ${
                        currentLayout?.id === l.id ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`font-medium ${currentLayout?.id === l.id ? "text-red-700" : "text-gray-700"}`}>
                        {l.layout_name}
                      </span>
                    </button>
                    <button
                      onClick={(e) => deleteLayout(l.id, e)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      title="Delete Layout"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                      </svg>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 italic">No saved layouts found</div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showReorderModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-96 border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Reorder Columns</h3>
              <button onClick={() => setShowReorderModal(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {visibleColumns.filter(c => c !== "actions").map((col, index) => (
                <div key={col} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg group">
                  <span className="text-sm font-medium text-gray-700 capitalize">{col.replaceAll("_", " ")}</span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={index === 0}
                      onClick={() => {
                        const newCols = [...visibleColumns];
                        const actIdx = newCols.indexOf(col);
                        if (actIdx > 0 && newCols[actIdx-1] !== "actions") {
                           [newCols[actIdx], newCols[actIdx - 1]] = [newCols[actIdx - 1], newCols[actIdx]];
                           setVisibleColumns(newCols);
                        } else if (actIdx > 1 && newCols[0] === "actions") {
                           [newCols[actIdx], newCols[actIdx - 1]] = [newCols[actIdx - 1], newCols[actIdx]];
                           setVisibleColumns(newCols);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button
                      disabled={index === visibleColumns.filter(c => c !== "actions").length - 1}
                      onClick={() => {
                        const newCols = [...visibleColumns];
                        const actIdx = newCols.indexOf(col);
                        if (actIdx < newCols.length - 1) {
                          [newCols[actIdx], newCols[actIdx + 1]] = [newCols[actIdx + 1], newCols[actIdx]];
                          setVisibleColumns(newCols);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowReorderModal(false)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
