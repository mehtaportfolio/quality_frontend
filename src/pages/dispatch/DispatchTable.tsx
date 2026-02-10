import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from "../../config";
import { useRolePermissions, type Role } from "../../hooks/useRolePermissions";

type DispatchData = Record<string, string | number | boolean | null>;

interface DispatchTableProps {
  user: {
    role: Role;
    full_name: string;
    id: string;
  };
  division: string;
  startDate: string;
  endDate: string;
  selectedFilters: Record<string, string[]>;
}

const TABLE_NAME = "dispatch_data";

const EXCLUDED_COLUMNS = [
  "id",
  "created_at",
  "distribution_channel_description",
  "division_description",
  "billing_type",
  "canceled",
  "canceled_bill_doc",
  "customer_material_description",
  "control_code",
  "transporter_full_name",
  "agent_full_name",
  "bill_to_region",
  "remarks",
  "remarks_1",
  "container_number",
  "clearing_status",
  "e_way_bill_no",
  "irn_status",
  "sales_unit"
];

const DROPDOWN_COLUMNS = [
  "distribution_channel_description",
  "billing_type",
  "bill_to_customer",
  "product",
  "plant",
  "transporter_full_name",
  "bill_to_city",
  "ship_to_city",
  "clearing_status",
  "irn_status",
  "sales_unit"
];

const SPECIAL_COLUMNS = ["remarks", "remarks_1"];

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

interface DispatchTableProps {
  division: string;
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
}

export default function DispatchTable({ 
  user,
  division,
  selectedFilters,
  setSelectedFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: DispatchTableProps) {
  const permissions = useRolePermissions(user.role);
  const [data, setData] = useState<DispatchData[]>([]);
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

  const [tempStartDate, setTempStartDate] = useState<string>(startDate);
  const [tempEndDate, setTempEndDate] = useState<string>(endDate);

  const handleApplyDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
  };

  const handleResetDates = () => {
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    const start = lastWeek.toLocaleDateString('en-CA');
    const end = now.toLocaleDateString('en-CA');
    setTempStartDate(start);
    setTempEndDate(end);
    setStartDate(start);
    setEndDate(end);
  };

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  
  /* ===== Edit/Delete State ===== */
  const [editingRow, setEditingRow] = useState<DispatchData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});

  const fetchAllDropdownOptions = useCallback(async () => {
    try {
      const results: Record<string, string[]> = {};
      await Promise.all(
        DROPDOWN_COLUMNS.map(async (col) => {
          const params = new URLSearchParams();
          params.append("division_description", division);
          const res = await fetch(`${API_BASE_URL}/api/unique-values/${TABLE_NAME}/${col}?${params.toString()}`);
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

  const handleDownloadExcel = () => {
    const headers = visibleColumns.filter(c => c !== "actions");
    const worksheetData = [
      headers.map(h => h.replaceAll("_", " ").toUpperCase()),
      ...data.map(row => headers.map(h => row[h] ?? ""))
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dispatch");
    XLSX.writeFile(workbook, `dispatch_${division}.xlsx`);
  };

  const handleDownloadPDF = () => {
    const headerText = prompt("Enter PDF Header:", `Dispatch Report - ${division}`);
    if (headerText === null) return;

    const doc = new jsPDF('landscape');
    const headers = visibleColumns.filter(c => c !== "actions");
    const tableData = data.map(row => headers.map(h => row[h] ?? ""));
    const tableHeaders = headers.map(h => h.replaceAll("_", " ").toUpperCase());

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(headerText, pageWidth / 2, 15, { align: 'center' });

    autoTable(doc, {
      startY: 25,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] },
    });
    doc.save(`dispatch_${division}.pdf`);
  };

  /* ===== Resize refs ===== */
  const resizingCol = useRef<string | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("division_description", division);

      Object.entries(selectedFilters).forEach(([col, values]) => {
        if (values.length > 0) {
          params.append(col, values.join(","));
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/dispatch-data?${params.toString()}`);
      const json = await res.json();

      if (!json.success) throw new Error("Data API failed");

      const rows = json.data;
      setData(rows);

      if (rows.length > 0 && visibleColumns.length === 0) {
        const cols = Object.keys(rows[0]).filter(c => !EXCLUDED_COLUMNS.includes(c));
        setVisibleColumns(["actions", ...cols]);
        const widths: Record<string, number> = { actions: 100 };
        cols.forEach((c) => (widths[c] = 160));
        setColumnWidths(widths);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [selectedFilters, visibleColumns.length, startDate, endDate, division]);

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
  }, [fetchAllDropdownOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const fetchUniqueValues = async (col: string) => {
    setLoadingOptions(true);
    setActiveFilterCol(col);
    setShowFilterDropdown(false);
    setFilterSearch("");
    try {
      const params = new URLSearchParams();
      params.append("division_description", division);
      
      const res = await fetch(`${API_BASE_URL}/api/unique-values/${TABLE_NAME}/${col}?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setFilterOptions(json.data.map(String));
      } else {
        throw new Error(json.error || "Failed to fetch values");
      }
    } catch (err) {
      console.error("Failed to fetch unique values", err);
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setActiveFilterCol(null);
    } finally {
      setLoadingOptions(false);
    }
  };

  const toggleFilterValue = (val: string) => {
    if (!activeFilterCol) return;
    setSelectedFilters((prev) => {
      const current = prev[activeFilterCol] || [];
      const updated = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];
      const newFilters = { ...prev, [activeFilterCol]: updated };
      if (updated.length === 0) delete newFilters[activeFilterCol];
      return newFilters;
    });
  };

  const clearFilter = (col: string) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[col];
      return newFilters;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/dispatch-data/${id}?deleted_by=${encodeURIComponent(user.full_name)}`, {
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

  const handleSaveLayout = async (replaceExisting = false) => {
    const nameToSave = replaceExisting && currentLayout ? currentLayout.layout_name : layoutName;
    if (!nameToSave.trim()) return;

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
      const res = await fetch(`${API_BASE_URL}/api/table-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        const newLayout = { id: json.data?.id, ...payload } as SavedLayout;
        setCurrentLayout(newLayout);
        setLayoutName("");
        setShowSaveModal(false);
        alert(replaceExisting ? "Layout updated" : "Layout saved");
        
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
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this layout?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/table-layout/${id}?deleted_by=${encodeURIComponent(user.full_name)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setSavedLayouts((prev) => prev.filter((l) => l.id !== id));
        if (currentLayout?.id === id) setCurrentLayout(null);
      }
    } catch {
      alert("Failed to delete layout");
    }
  };

  const applyLayout = (layout: SavedLayout) => {
    setVisibleColumns(layout.layout.visibleColumns);
    setColumnWidths(layout.layout.columnWidths);
    setWrappedColumns(layout.layout.wrappedColumns || []);
    setCurrentLayout(layout);
    setShowLoadModal(false);
  };

  const allColumns = useMemo(() => {
    if (data.length === 0) return [];
    const cols = Object.keys(data[0]).filter(c => !EXCLUDED_COLUMNS.includes(c));
    const regular = cols.filter(c => !SPECIAL_COLUMNS.includes(c));
    const special = cols.filter(c => SPECIAL_COLUMNS.includes(c));
    return [...regular, ...special];
  }, [data]);

  const totalWidth = useMemo(() => visibleColumns.reduce((sum, col) => sum + (columnWidths[col] || 160), 0), [visibleColumns, columnWidths]);

  if (loading && data.length === 0) return <div className="flex items-center justify-center h-64 text-gray-500 animate-pulse font-medium">Loading dispatch data...</div>;
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
                  const emptyRow: DispatchData = {
                    division_description: division
                  };
                  allColumns.forEach(col => {
                    if (col !== "actions") emptyRow[col] = "";
                  });
                  setEditingRow(emptyRow);
                  setShowEditModal(true);
                }}
                className="px-3 py-1.5 bg-green-600 border border-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                Add Entry
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-4">
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
                          {permissions.canEdit && (
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
                          )}
                          {permissions.canDelete && (
                            <button
                              onClick={() => handleDelete(String(row.id))}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          )}
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
          </div>
        </div>
      </div>

      {/* ===== Modals ===== */}
      
      {/* Save Layout Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Save Table Layout</h3>
              <p className="text-sm text-gray-500 mb-6">Give this layout a name to easily switch back to it later.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Layout Name</label>
                  <input
                    type="text"
                    value={layoutName}
                    onChange={(e) => setLayoutName(e.target.value)}
                    placeholder="e.g., Summary View, Export Ready"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex items-center justify-between gap-3">
              {currentLayout && (
                <button
                  onClick={() => handleSaveLayout(true)}
                  className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Update Existing
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveLayout(false)}
                  disabled={!layoutName.trim()}
                  className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-200"
                >
                  Save New
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Load Layout Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Saved Layouts</h3>
                <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
              
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                {savedLayouts.length > 0 ? (
                  savedLayouts.map((layout) => (
                    <div
                      key={layout.id}
                      onClick={() => applyLayout(layout)}
                      className={`group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        currentLayout?.id === layout.id 
                          ? 'border-red-200 bg-red-50 ring-1 ring-red-200' 
                          : 'border-gray-100 bg-gray-50 hover:border-red-200 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${currentLayout?.id === layout.id ? 'bg-red-600 text-white' : 'bg-white text-gray-400 group-hover:text-red-600 group-hover:bg-red-50'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7h18"/><path d="M3 12h18"/><path d="M3 17h18"/></svg>
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${currentLayout?.id === layout.id ? 'text-red-900' : 'text-gray-700'}`}>{layout.layout_name}</p>
                          <p className="text-xs text-gray-400">{layout.layout.visibleColumns.length} columns</p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteLayout(layout.id, e)}
                        className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400">No saved layouts yet.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowLoadModal(false)}
                className="px-6 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reorder Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Reorder Columns</h3>
                <button onClick={() => setShowReorderModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Click the arrows to move columns up or down in the display order.</p>
              
              <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-2">
                {visibleColumns.map((col, idx) => (
                  <div key={col} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg group">
                    <span className="text-sm font-bold text-gray-700 capitalize">{col.replaceAll("_", " ")}</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => {
                          const newCols = [...visibleColumns];
                          [newCols[idx - 1], newCols[idx]] = [newCols[idx], newCols[idx - 1]];
                          setVisibleColumns(newCols);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-md disabled:opacity-20 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                      </button>
                      <button
                        disabled={idx === visibleColumns.length - 1}
                        onClick={() => {
                          const newCols = [...visibleColumns];
                          [newCols[idx], newCols[idx + 1]] = [newCols[idx + 1], newCols[idx]];
                          setVisibleColumns(newCols);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-md disabled:opacity-20 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowReorderModal(false)}
                className="px-8 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all shadow-lg shadow-red-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Options Modal */}
      {activeFilterCol && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 capitalize">Filter: {activeFilterCol.replaceAll("_", " ")}</h3>
                <button onClick={() => setActiveFilterCol(null)} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
              
              <div className="mb-4">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search values..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm"
                />
              </div>
              
              <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-2">
                {loadingOptions ? (
                  <div className="py-12 flex flex-col items-center justify-center text-gray-400">
                    <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs font-medium">Loading values...</p>
                  </div>
                ) : filterOptions
                  .filter(opt => opt.toLowerCase().includes(filterSearch.toLowerCase()))
                  .map((opt) => (
                    <label key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        checked={(selectedFilters[activeFilterCol] || []).includes(opt)}
                        onChange={() => toggleFilterValue(opt)}
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt}</span>
                    </label>
                  ))
                }
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => {
                  clearFilter(activeFilterCol);
                  setActiveFilterCol(null);
                }}
                className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear Column
              </button>
              <button
                onClick={() => setActiveFilterCol(null)}
                className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showEditModal && editingRow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">
                {editingRow.id ? 'Edit Dispatch Entry' : 'Add New Dispatch Entry'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allColumns.map(col => {
                  if (col === "actions") return null;
                  
                  const isDropdown = DROPDOWN_COLUMNS.includes(col);
                  const isSpecial = SPECIAL_COLUMNS.includes(col);
                  const isDate = col.toLowerCase().includes("date") || col.toLowerCase().endsWith("_at");
                  
                  return (
                    <div key={col} className={isSpecial ? "md:col-span-2 lg:col-span-3" : ""}>
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                        {col.replaceAll("_", " ")}
                      </label>
                      
                      {isDropdown ? (
                        <SearchableDropdown
                          value={String(editingRow[col] || "")}
                          options={dropdownOptions[col] || []}
                          onChange={(val) => setEditingRow({ ...editingRow, [col]: val })}
                          placeholder={`Select ${col.replaceAll("_", " ")}...`}
                        />
                      ) : isSpecial ? (
                        <textarea
                          value={String(editingRow[col] || "")}
                          onChange={(e) => setEditingRow({ ...editingRow, [col]: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm min-h-[100px] resize-y"
                          placeholder={`Enter ${col.replaceAll("_", " ")}...`}
                        />
                      ) : (
                        <input
                          type={isDate ? "date" : "text"}
                          value={String(editingRow[col] || "")}
                          onChange={(e) => setEditingRow({ ...editingRow, [col]: e.target.value })}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm"
                          placeholder={`Enter ${col.replaceAll("_", " ")}...`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const method = editingRow.id ? "PUT" : "POST";
                    const url = editingRow.id 
                      ? `${API_BASE_URL}/api/dispatch-data/${editingRow.id}`
                      : `${API_BASE_URL}/api/dispatch-data/bulk`;
                    
                    const payload = editingRow.id ? editingRow : [editingRow];
                    
                    const res = await fetch(url, {
                      method,
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    
                    if (json.success) {
                      setShowEditModal(false);
                      loadData();
                      fetchAllDropdownOptions();
                    } else {
                      throw new Error(json.error || "Failed to save");
                    }
                  } catch (err) {
                    alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
                  }
                }}
                className="px-10 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
              >
                {editingRow.id ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
