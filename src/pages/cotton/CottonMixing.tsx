import { useState, useEffect, Fragment } from "react";
import * as XLSX from "xlsx";

const MIXING_DASHBOARD_URL = "https://cotton-quality-dashboard.smpl-qa-manthan.workers.dev/";
const MIXING_API_URL = "https://cotton-api-ekdn.onrender.com";

const TABLE_COLUMNS = [
  { id: "issue_date", label: "Issue Date" },
  { id: "mixing_no", label: "Mixing No" },
  { id: "mixing", label: "Mixing" },
  { id: "blend_percent", label: "Blend%" },
  { id: "unit", label: "Unit" },
  { id: "line", label: "Line" },
  { id: "cotton", label: "Cotton" },
  { id: "no_of_lots", label: "No of Lots" },
  { id: "total_bales", label: "Total Bales" },
  { id: "bale_change_over_percent", label: "Bale Change Over%" },
  { id: "lot_change_over_percent", label: "Lot Changeover%" },
  { id: "mic", label: "MIC" },
  { id: "str", label: "STR" },
  { id: "uhml", label: "UHML" },
  { id: "rd", label: "Rd" },
  { id: "plus_b", label: "+b" },
  { id: "sf", label: "SF" },
  { id: "ui", label: "UI" },
  { id: "elong", label: "Elong" },
  { id: "trash", label: "Trash" },
  { id: "moist", label: "Moist" },
  { id: "min_mic", label: "Min MIC" },
  { id: "min_mic_percent", label: "Min MIC%" }
];

export default function CottonMixing({ onBack }: { onBack: () => void }) {
  const [units, setUnits] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(TABLE_COLUMNS.map(c => c.id));
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);

  const formatNumber = (val: any, decimals: number) => {
    if (val === null || val === undefined || val === "") return "-";
    const num = Number(val);
    return isNaN(num) ? "-" : num.toFixed(decimals);
  };

  const formatIssueDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    
    // Check for weekly format YYYY-MM-Wn
    const weekMatch = dateStr.match(/^(\d{4})-(\d{2})-W(\d)$/);
    if (weekMatch) {
      const [, year, month, week] = weekMatch;
      const w = parseInt(week);
      const startDay = (w - 1) * 7 + 1;
      const endDay = Math.min(w * 7, 31);
      
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIndex = parseInt(month) - 1;
      const monthName = monthNames[monthIndex] || "";
      
      return `${startDay}-${endDay} ${monthName}`;
    }
    
    return dateStr;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        // Correct endpoint found in your server.js (Line 848)
        const unitRes = await fetch(`${MIXING_API_URL}/api/cotton-mixing-summary/filters`);
        const unitData = await unitRes.json();
        
        if (unitData.units && unitData.units.length > 0) {
          // Map numeric units to "Unit X" for display if they are just numbers
          const formattedUnits = unitData.units.map((u: any) => 
            isNaN(u) ? u : `Unit ${u}`
          );
          setUnits(formattedUnits);
          setSelectedUnits(formattedUnits); // Select all by default
        } else {
          const defaultUnits = ["Unit 1", "Unit 2", "Unit 3"];
          setUnits(defaultUnits);
          setSelectedUnits(defaultUnits);
        }
      } catch (error) {
        console.error("Initial fetch error:", error);
        const defaultUnits = ["Unit 1", "Unit 2", "Unit 3"];
        setUnits(defaultUnits);
        setSelectedUnits(defaultUnits);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedUnits.length === 0) {
      setWeeklyData([]);
      return;
    }

    const fetchUnitStats = async () => {
      try {
        setLoading(true);
        // Fetch a broad range to ensure we get data even if recent weeks are missing
        const today = new Date();
        const startDate = new Date("2020-01-01"); 

        const formatDate = (date: Date) => {
          const d = date.getDate().toString().padStart(2, "0");
          const m = (date.getMonth() + 1).toString().padStart(2, "0");
          const y = date.getFullYear();
          return `${d}.${m}.${y}`;
        };

        const from = formatDate(startDate);
        const to = formatDate(today);
        
        // Convert units back to numbers for the backend
        const unitValues = selectedUnits.map(u => {
          const val = u.replace("Unit ", "");
          return isNaN(Number(val)) ? val : Number(val);
        });
        const unitParam = JSON.stringify(unitValues);

        // SSE request for summary
        const url = `${MIXING_API_URL}/api/cotton-mixing-summary?from_date=${from}&to_date=${to}&unit=${unitParam}&report_type=weekly`;
        
        console.log("Fetching from SSE URL:", url);
        const eventSource = new EventSource(url);

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            
            if (parsed.type === "data") {
              const data = parsed.data || [];
              setWeeklyData(data);
              setLoading(false);
              eventSource.close();
            } else if (parsed.type === "error") {
              console.error("SSE Backend Error:", parsed.message);
              setLoading(false);
              eventSource.close();
            }
          } catch (err) {
            console.error("SSE parse error", err);
          }
        };

        eventSource.onerror = (err) => {
          console.error("SSE Connection error:", err);
          setLoading(false);
          eventSource.close();
        };

      } catch (error) {
        console.error("Fetch unit stats error:", error);
        setLoading(false);
      }
    };

    fetchUnitStats();
  }, [selectedUnits]);

  const handleGoToExternalDashboard = () => {
    window.open(MIXING_DASHBOARD_URL, "_blank");
  };

  const handleDownloadExcel = () => {
    if (weeklyData.length === 0) return;

    // Group data by unit
    const groups: Record<string, any[]> = {};
    weeklyData.forEach(row => {
      const u = row.unit || "Unknown";
      if (!groups[u]) groups[u] = [];
      groups[u].push(row);
    });

    const exportData: any[] = [];
    const sortedUnits = Object.keys(groups).sort();

    sortedUnits.forEach((unit, idx) => {
      // Take top 8 records for each unit
      const unitRows = groups[unit].slice(0, 8).map(row => ({
        "Issue Date": formatIssueDate(row.issue_date),
        "Mixing No": row.mixing_no || "-",
        "Mixing": row.mixing || "N/A",
        "Blend%": row.blend_percent || "0",
        "Unit": row.unit || "-",
        "Line": row.line || "-",
        "Cotton": row.cotton || "-",
        "No of Lots": row.no_of_lots || "0",
        "Total Bales": row.total_bales || "0",
        "Bale Change Over%": row.bale_change_over_percent || "0",
        "Lot Changeover%": row.lot_change_over_percent || "0",
        "MIC": row.mic || "-",
        "STR": row.str || "-",
        "UHML": row.uhml || "-",
        "Rd": row.rd || "-",
        "+b": row.plus_b || "-",
        "SF": row.sf || "-",
        "UI": row.ui || "-",
        "Elong": row.elong || "-",
        "Trash": row.trash || "-",
        "Moist": row.moist || "-",
        "Min MIC": row.min_mic || "-",
        "Min MIC%": row.min_mic_percent || "-"
      }));

      exportData.push(...unitRows);

      // Add a blank row between units (except after the last one)
      if (idx < sortedUnits.length - 1) {
        exportData.push({});
      }
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mixing Results");
    const unitLabel = selectedUnits.length === units.length ? "All_Units" : selectedUnits.join("_");
    XLSX.writeFile(wb, `Mixing_Results_${unitLabel}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const toggleUnit = (unit: string) => {
    setSelectedUnits(prev => 
      prev.includes(unit) ? prev.filter(u => u !== unit) : [...prev, unit]
    );
  };

  // Helper to get grouped data for rendering
  const getGroupedData = () => {
    const groups: Record<string, any[]> = {};
    weeklyData.forEach(row => {
      const u = row.unit || "Unknown";
      if (!groups[u]) groups[u] = [];
      groups[u].push(row);
    });
    return groups;
  };

  const groupedRows = getGroupedData();
  const sortedUnitKeys = Object.keys(groupedRows).sort();

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => 
      prev.includes(columnId) 
        ? prev.filter(id => id !== columnId) 
        : [...prev, columnId]
    );
  };

  return (
    <div className="space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
            title="Go Back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <h2 className="text-2xl font-bold text-red-700">Cotton Mixing Analysis</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          {/* External Dashboard Button */}
          <button
            onClick={handleGoToExternalDashboard}
            className="bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm hover:bg-red-800 transition flex items-center gap-2 text-sm"
          >
            Open Mixing Dashboard
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </button>

          {/* Multi-Unit Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowUnitDropdown(!showUnitDropdown)}
              className="flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-200 font-semibold text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={loading && units.length === 0}
            >
              <span className="text-red-800 uppercase text-xs font-black">Units:</span>
              <span>
                {selectedUnits.length === units.length ? "All Units" : 
                 selectedUnits.length === 0 ? "None" : 
                 `${selectedUnits.length} Selected`}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>

            {showUnitDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowUnitDropdown(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-2 max-h-64 overflow-y-auto">
                  <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <button 
                      onClick={() => setSelectedUnits(units)}
                      className="text-[10px] font-bold text-blue-600 hover:underline"
                    >Select All</button>
                    <button 
                      onClick={() => setSelectedUnits([])}
                      className="text-[10px] font-bold text-red-600 hover:underline"
                    >Clear</button>
                  </div>
                  {units.map(u => (
                    <label key={u} className="flex items-center px-4 py-2 hover:bg-red-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        checked={selectedUnits.includes(u)}
                        onChange={() => toggleUnit(u)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500 mr-3 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-700">{u}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Results Table */}
      <div className="bg-white border border-black rounded-xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-black flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Mixing Results - Last 8 Records</h3>
            <p className="text-xs text-gray-500 font-medium tracking-tight">Recent quality trends for {selectedUnits.join(", ") || "No Units Selected"}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Column Visibility Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 text-red-700 flex items-center gap-1.5"
                title="Show/Hide Columns"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
                <span className="text-xs font-bold hidden sm:inline">Columns</span>
              </button>

              {showColumnDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowColumnDropdown(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-20 py-2 max-h-[70vh] overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                      <span className="text-xs font-black uppercase text-gray-500">Visible Columns</span>
                      <button 
                        onClick={() => setVisibleColumns(TABLE_COLUMNS.map(c => c.id))}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >Reset</button>
                    </div>
                    {TABLE_COLUMNS.map(col => (
                      <label key={col.id} className="flex items-center px-4 py-2 hover:bg-red-50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={visibleColumns.includes(col.id)}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500 mr-3 w-4 h-4"
                        />
                        <span className="text-xs font-medium text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={handleDownloadExcel}
              className="p-2 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200 text-green-700"
              title="Download Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100 text-gray-800 uppercase text-[10px] font-bold tracking-wider">
                {TABLE_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                  <th key={col.id} className={`px-3 py-4 border border-black whitespace-nowrap ${(col.id === 'unit' || col.id === 'line' || col.id === 'no_of_lots' || col.id === 'total_bales' || col.id.includes('percent') || col.id === 'mic' || col.id === 'str' || col.id === 'uhml' || col.id === 'rd' || col.id === 'plus_b' || col.id === 'sf' || col.id === 'ui' || col.id === 'elong' || col.id === 'trash' || col.id === 'moist' || col.id === 'min_mic') ? 'text-center' : ''}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUnitKeys.length > 0 ? (
                sortedUnitKeys.map((unitKey, groupIdx) => (
                  <Fragment key={unitKey}>
                    {groupedRows[unitKey].slice(0, 8).map((row, i) => (
                      <tr key={`${unitKey}-${i}`} className="hover:bg-red-50/30 transition-colors text-[12px]">
                        {visibleColumns.includes('issue_date') && <td className="px-3 py-3 font-semibold text-gray-700 whitespace-nowrap border border-black">{formatIssueDate(row.issue_date)}</td>}
                        {visibleColumns.includes('mixing_no') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{row.mixing_no || "-"}</td>}
                        {visibleColumns.includes('mixing') && <td className="px-3 py-3 text-gray-600 whitespace-nowrap border border-black">{row.mixing || "N/A"}</td>}
                        {visibleColumns.includes('blend_percent') && <td className="px-3 py-3 text-center font-medium text-gray-600 whitespace-nowrap border border-black">{row.blend_percent || "0"}%</td>}
                        {visibleColumns.includes('unit') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{row.unit || "-"}</td>}
                        {visibleColumns.includes('line') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{row.line || "-"}</td>}
                        {visibleColumns.includes('cotton') && <td className="px-3 py-3 text-gray-600 whitespace-nowrap border border-black">{row.cotton || "-"}</td>}
                        {visibleColumns.includes('no_of_lots') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{row.no_of_lots || "0"}</td>}
                        {visibleColumns.includes('total_bales') && <td className="px-3 py-3 text-center text-gray-600 font-bold whitespace-nowrap border border-black">{row.total_bales || "0"}</td>}
                        {visibleColumns.includes('bale_change_over_percent') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.bale_change_over_percent, 1)}%</td>}
                        {visibleColumns.includes('lot_change_over_percent') && <td className="px-3 py-3 text-center text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.lot_change_over_percent, 1)}%</td>}
                        {visibleColumns.includes('mic') && <td className="px-3 py-3 text-center font-mono font-bold text-blue-600 whitespace-nowrap border border-black">{formatNumber(row.mic, 2)}</td>}
                        {visibleColumns.includes('str') && <td className="px-3 py-3 text-center font-mono font-bold text-green-600 whitespace-nowrap border border-black">{formatNumber(row.str, 1)}</td>}
                        {visibleColumns.includes('uhml') && <td className="px-3 py-3 text-center font-mono font-bold text-purple-600 whitespace-nowrap border border-black">{formatNumber(row.uhml, 2)}</td>}
                        {visibleColumns.includes('rd') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.rd, 1)}</td>}
                        {visibleColumns.includes('plus_b') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.plus_b, 1)}</td>}
                        {visibleColumns.includes('sf') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.sf, 1)}</td>}
                        {visibleColumns.includes('ui') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.ui, 1)}</td>}
                        {visibleColumns.includes('elong') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.elong, 1)}</td>}
                        {visibleColumns.includes('trash') && <td className="px-3 py-3 text-center font-mono font-bold text-red-600 whitespace-nowrap border border-black">{formatNumber(row.trash, 1)}</td>}
                        {visibleColumns.includes('moist') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.moist, 1)}</td>}
                        {visibleColumns.includes('min_mic') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.min_mic, 2)}</td>}
                        {visibleColumns.includes('min_mic_percent') && <td className="px-3 py-3 text-center font-mono text-gray-600 whitespace-nowrap border border-black">{formatNumber(row.min_mic_percent, 1)}{row.min_mic_percent ? "%" : ""}</td>}
                      </tr>
                    ))}
                    {/* Blank Row between units */}
                    {groupIdx < sortedUnitKeys.length - 1 && (
                      <tr className="h-8 bg-gray-50/50">
                        <td colSpan={visibleColumns.length} className="border border-black"></td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-10 text-center text-gray-400 italic border border-black">
                    No historical data available for this unit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Simple helper to get week number
declare global {
  interface Date {
    getWeek(): number;
  }
}

if (!Date.prototype.getWeek) {
  Date.prototype.getWeek = function() {
    const date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };
}
