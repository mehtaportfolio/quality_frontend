import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { API_BASE_URL } from "../../config";
import html2canvas from "html2canvas";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

type DispatchData = Record<string, string | number | boolean | null>;

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

// Simple client-side cache to speed up re-fetches
const dataCache: Record<string, DispatchData[]> = {};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const TABLE_NAME = "dispatch_data";

type ChartType = "month" | "plant" | "smpl_count" | "market" | "customer" | "distribution_channel";

interface ChartConfig {
  id: ChartType;
  title: string;
  dataKey: string;
}

const DEFAULT_CHART_ORDER: ChartConfig[] = [
  { id: "month", title: "Dispatch by Month", dataKey: "month" },
  { id: "plant", title: "Dispatch by Plant", dataKey: "plant" },
  { id: "smpl_count", title: "Top 10 Sample Count by Billed Qty", dataKey: "smpl_count" },
  { id: "market", title: "Dispatch by Market", dataKey: "market" },
  { id: "customer", title: "Top 10 Customers by Billed Qty", dataKey: "customer" },
  { id: "distribution_channel", title: "Dispatch by Distribution Channel", dataKey: "distribution_channel" },
];

interface DispatchChartProps {
  division: string;
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
}

export default function DispatchChart({ 
  division,
  selectedFilters,
  setSelectedFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: DispatchChartProps) {
  const [data, setData] = useState<DispatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPercentage, setShowPercentage] = useState(false);
  
  // Bar click filters
  const [activeBarFilters, setActiveBarFilters] = useState<Partial<Record<ChartType, string | null>>>({
    month: null, plant: null, smpl_count: null, market: null, customer: null, distribution_channel: null
  });

  const selectedYear = useMemo(() => {
    if (!startDate || !endDate) return "";
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === 0 && s.getDate() === 1 && e.getMonth() === 11 && e.getDate() === 31) {
      return s.getFullYear().toString();
    }
    return "";
  }, [startDate, endDate]);

  const handleYearSelect = (y: string) => {
    if (selectedYear === y) {
      // Reset to current month or something?
      // For now just clear it
      setStartDate("");
      setEndDate("");
    } else {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  // Dropdown filters UI state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterValuesRef = useRef<HTMLDivElement>(null);

  const [chartOrder, setChartOrder] = useState<ChartConfig[]>(DEFAULT_CHART_ORDER);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Fetch available years once for the division to keep UI stable
  useEffect(() => {
    async function fetchYears() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/available-years/dispatch_data/billing_date`);
        const json = await res.json();
        if (json.success) {
          setAvailableYears(json.data);
        }
      } catch (e) {
        console.error("Failed to fetch years:", e);
      }
    }
    fetchYears();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id.replace("chart-", ""));
          }
        });
      },
      { threshold: 0.3, rootMargin: "-10% 0px -70% 0px" }
    );

    chartOrder.forEach((config) => {
      const el = document.getElementById(`chart-${config.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [chartOrder]);

  const loadData = useCallback(async () => {
    const cacheKey = `${division}-${startDate}-${endDate}`;
    if (dataCache[cacheKey]) {
      setData(dataCache[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("division_description", division);
      
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      // We only fetch based on division and date. 
      // Dropdown and bar filters are applied client-side for speed.
      const res = await fetch(`${API_BASE_URL}/api/dispatch-data?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        dataCache[cacheKey] = json.data;
        setData(json.data);
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [division, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (filterValuesRef.current && !filterValuesRef.current.contains(event.target as Node)) {
        setActiveFilterCol(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const years = useMemo(() => {
    const y = new Set<string>();
    data.forEach(item => {
      if (item.billing_date) {
        const date = new Date(item.billing_date as string);
        if (!isNaN(date.getTime())) y.add(date.getFullYear().toString());
      }
    });
    return Array.from(y).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const handleBarClick = (type: ChartType, value: string) => {
    setActiveBarFilters(prev => ({
      ...prev,
      [type]: prev[type] === value ? null : value
    }));
  };

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
      }
    } catch (err) {
      console.error("Failed to fetch unique values", err);
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

  const clearAllFilters = () => {
    setActiveBarFilters({
      month: null, plant: null, smpl_count: null, market: null, customer: null, distribution_channel: null
    });
    setSelectedFilters({});
    setStartDate("");
    setEndDate("");
  };

  const scrollToChart = (id: string) => {
    const el = document.getElementById(`chart-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (selectedYear && item.billing_date) {
        const date = new Date(item.billing_date as string);
        if (date.getFullYear().toString() !== selectedYear) return false;
      } else if (selectedYear) return false;

      // Dropdown Filters
      for (const [col, values] of Object.entries(selectedFilters)) {
        if (values.length > 0 && !values.includes(String(item[col] || "Unknown"))) return false;
      }

      // Bar Interactivity Filters
      if (activeBarFilters.plant && String(item.plant || "Unknown") !== activeBarFilters.plant) return false;
      if (activeBarFilters.market && String(item.market || "Unknown") !== activeBarFilters.market) return false;
      if (activeBarFilters.smpl_count && String(item.smpl_count || "Unknown") !== activeBarFilters.smpl_count) return false;
      if (activeBarFilters.distribution_channel && String(item.distribution_channel_description || "Unknown") !== activeBarFilters.distribution_channel) return false;
      if (activeBarFilters.customer && String(item.customer_name || "Unknown") !== activeBarFilters.customer) return false;

      if (item.billing_date && activeBarFilters.month) {
        const date = new Date(item.billing_date as string);
        if (!isNaN(date.getTime())) {
          if (MONTH_NAMES[date.getMonth()] !== activeBarFilters.month) return false;
        } else return false;
      } else if (activeBarFilters.month) return false;

      return true;
    });
  }, [data, activeBarFilters, selectedYear, selectedFilters]);

  const summaryStats = useMemo(() => {
    let totalKg = 0;
    filteredData.forEach(item => {
      const q = Number(String(item.billed_quantity || "0").replace(/[^0-9.-]/g, ""));
      totalKg += q;
    });
    
    const useMT = totalKg > 10000;
    const displayTotal = useMT ? `${Math.round(totalKg / 1000)} MT` : `${Math.round(totalKg)} kg`;
    const avgQty = filteredData.length > 0 ? Math.round(totalKg / filteredData.length) : 0;

    return {
      total: displayTotal,
      count: filteredData.length,
      avg: `${avgQty} Kg`,
      useMT
    };
  }, [filteredData]);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const aggregate = (items: DispatchData[]) => {
      const monthData: Record<string, number> = {};
      const plantData: Record<string, number> = {};
      const smplData: Record<string, number> = {};
      const marketData: Record<string, number> = {};
      const customerData: Record<string, number> = {};
      const channelData: Record<string, number> = {};

      items.forEach((item) => {
        // Handle billed_quantity as text by converting to number
        const qtyKg = Number(String(item.billed_quantity || "0").replace(/[^0-9.-]/g, ""));

        if (item.billing_date) {
          const date = new Date(item.billing_date as string);
          if (!isNaN(date.getTime())) {
            const m = MONTH_NAMES[date.getMonth()];
            monthData[m] = (monthData[m] || 0) + qtyKg;
          }
        }

        const plant = String(item.plant || "Unknown");
        plantData[plant] = (plantData[plant] || 0) + qtyKg;

        const smpl = String(item.smpl_count || "Unknown");
        smplData[smpl] = (smplData[smpl] || 0) + qtyKg;

        const market = String(item.market || "Unknown");
        marketData[market] = (marketData[market] || 0) + qtyKg;

        const customer = String(item.customer_name || "Unknown");
        customerData[customer] = (customerData[customer] || 0) + qtyKg;

        const channel = String(item.distribution_channel_description || "Unknown");
        channelData[channel] = (channelData[channel] || 0) + qtyKg;
      });

      const totalQtyKg = Object.values(monthData).reduce((a, b) => a + b, 0);

      const toChartArray = (record: Record<string, number>) => 
        Object.entries(record)
          .map(([name, qtyKg]) => {
            // Logic: divide by 1000 for MT if > 10000, else show raw kg
            const displayLabel = summaryStats.useMT ? `${Math.round(qtyKg / 1000)}` : `${Math.round(qtyKg)}`;
            return {
              name,
              value: summaryStats.useMT ? Number((qtyKg / 1000).toFixed(3)) : qtyKg,
              displayLabel,
              rawQtyKg: qtyKg,
              percentage: totalQtyKg > 0 ? Number(((qtyKg / totalQtyKg) * 100).toFixed(1)) : 0
            };
          })
          .sort((a, b) => b.rawQtyKg - a.rawQtyKg);

      // Month chart preserves chronological order
      const monthChart = MONTH_NAMES.map(m => {
        const qtyKg = monthData[m] || 0;
        const displayLabel = summaryStats.useMT ? `${Math.round(qtyKg / 1000)}` : `${Math.round(qtyKg)}`;
        return {
          name: m,
          value: summaryStats.useMT ? Number((qtyKg / 1000).toFixed(3)) : qtyKg,
          displayLabel,
          rawQtyKg: qtyKg,
          percentage: totalQtyKg > 0 ? Number(((qtyKg / totalQtyKg) * 100).toFixed(1)) : 0
        };
      });

      return {
        month: monthChart,
        plant: toChartArray(plantData).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'})),
        smpl_count: toChartArray(smplData).slice(0, 10),
        market: toChartArray(marketData),
        customer: toChartArray(customerData).slice(0, 10),
        distribution_channel: toChartArray(channelData)
      };
    };

    return aggregate(filteredData);
  }, [filteredData, summaryStats.useMT]);

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium animate-pulse">Loading {division} analytics...</p>
      </div>
    );
  }

  const handleDownloadChart = async (chartId: string, title: string) => {
    const element = document.getElementById(chartId);
    if (!element) return;
    
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
        onclone: (clonedDoc) => {
          const styleElements = clonedDoc.getElementsByTagName("style");
          for (let i = 0; i < styleElements.length; i++) {
            styleElements[i].innerHTML = styleElements[i].innerHTML.replaceAll(/oklch\([^)]+\)/g, "#777");
          }
          
          // Also handle inline styles and SVG attributes which might contain oklch
          const allElements = clonedDoc.querySelectorAll("*");
          allElements.forEach(el => {
            if (el instanceof HTMLElement || el instanceof SVGElement) {
              const inlineStyle = el.getAttribute("style");
              if (inlineStyle && inlineStyle.includes("oklch")) {
                el.setAttribute("style", inlineStyle.replaceAll(/oklch\([^)]+\)/g, "#777"));
              }
              
              const fill = el.getAttribute("fill");
              if (fill && fill.includes("oklch")) {
                el.setAttribute("fill", "#777");
              }
              
              const stroke = el.getAttribute("stroke");
              if (stroke && stroke.includes("oklch")) {
                el.setAttribute("stroke", "#777");
              }
            }
          });
        }
      });
      
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${title.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download chart:", err);
    }
  };

  const renderChart = (config: ChartConfig) => {
    if (!chartData) return null;
    const cData = chartData[config.id as keyof typeof chartData] || [];
    const activeVal = activeBarFilters[config.id];

    return (
      <div key={config.id} id={`chart-${config.id}`} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${activeVal ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-800">
            {config.title} {summaryStats.useMT ? "(MT)" : "(kg)"}
          </h3>
          <div className="flex items-center gap-2">
            {activeVal && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 animate-in fade-in zoom-in-95">
                Selected: {activeVal}
                <button onClick={() => handleBarClick(config.id, activeVal)} className="hover:text-red-900 ml-1">×</button>
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadChart(`chart-${config.id}`, config.title);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
        </div>
        
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart 
              data={cData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              onClick={(state) => {
                if (state && state.activeLabel) {
                  handleBarClick(config.id, String(state.activeLabel));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                interval={0} 
                height={50}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <Tooltip 
                cursor={{ fill: "#fef2f2" }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any, name: any, props: any) => {
                  return [props.payload.displayLabel, "Quantity"];
                }}
              />
              <Bar 
                dataKey={showPercentage ? "percentage" : "value"} 
                radius={[4, 4, 0, 0]}
                barSize={32}
              >
                {cData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={activeVal === entry.name ? "#dc2626" : COLORS[index % COLORS.length]}
                    fillOpacity={activeVal && activeVal !== entry.name ? 0.3 : 1}
                    className="cursor-pointer"
                  />
                ))}
                <LabelList 
                  dataKey={showPercentage ? "percentage" : "displayLabel"} 
                  position="top" 
                  formatter={(v: any) => showPercentage ? `${v}%` : v}
                  style={{ fontSize: 10, fontWeight: 600, fill: "#4b5563" }}
                  offset={10}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const allFilterCols = ["plant", "market", "smpl_count", "customer_name", "distribution_channel_description"];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
      {/* Dashboard Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Reorder Button */}
          <button 
            onClick={() => setShowReorderModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 12-3-3-3 3"/><path d="m9 12 3 3 3-3"/><path d="M12 3v18"/></svg>
            Reorder
          </button>

          {/* Consolidated Filter Button */}
          <div className="relative" ref={filterDropdownRef}>
            <button 
              onClick={() => {
                setShowFilterDropdown(!showFilterDropdown);
                setActiveFilterCol(null);
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
                  {allFilterCols.map(col => (
                    <button
                      key={col}
                      onClick={() => fetchUniqueValues(col)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 rounded transition-colors capitalize flex items-center justify-between group"
                    >
                      {col.replaceAll("_", " ")}
                      {selectedFilters[col] && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeFilterCol && (
              <div className="absolute top-10 left-60 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl p-2 w-64 animate-in fade-in slide-in-from-left-2" ref={filterValuesRef}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 mb-2">
                  <span className="text-xs font-bold uppercase text-red-600 truncate">{activeFilterCol.replaceAll("_", " ")}</span>
                  <button onClick={() => setActiveFilterCol(null)} className="text-gray-400 hover:text-gray-600">×</button>
                </div>
                <div className="p-2 pt-0">
                  <input
                    autoFocus
                    type="text"
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-red-500 mb-2"
                    placeholder="Search values..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto px-1">
                  {loadingOptions ? (
                    <div className="px-3 py-4 text-center text-xs text-gray-400 italic">Loading values...</div>
                  ) : (
                    filterOptions.filter(opt => opt.toLowerCase().includes(filterSearch.toLowerCase())).map(val => (
                      <div
                        key={val}
                        className={`px-3 py-2 text-xs cursor-pointer rounded hover:bg-red-50 hover:text-red-700 transition-colors flex items-center gap-3 ${selectedFilters[activeFilterCol]?.includes(val) ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600'}`}
                        onClick={() => toggleFilterValue(val)}
                      >
                        <input
                          type="checkbox"
                          readOnly
                          checked={selectedFilters[activeFilterCol]?.includes(val) || false}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="truncate">{val}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Year Filter Buttons */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
            <span className="text-xs font-bold uppercase text-gray-400 mr-1">Year:</span>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-inner">
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!selectedYear ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ALL
              </button>
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => handleYearSelect(year)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedYear === year ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Value Display Toggle */}
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
            <span className="text-xs font-bold uppercase text-gray-400 mr-1">Display:</span>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-inner">
              <button
                onClick={() => setShowPercentage(false)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!showPercentage ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Count (#)
              </button>
              <button
                onClick={() => setShowPercentage(true)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${showPercentage ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Percent (%)
              </button>
            </div>
          </div>

          {(Object.keys(selectedFilters).length > 0 || selectedYear || Object.values(activeBarFilters).some(v => v !== null)) && (
            <button 
              onClick={clearAllFilters}
              className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Sticky Navigation Bar */}
      <div className="flex justify-center sticky top-2 z-30 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md px-2 py-1.5 rounded-full border border-gray-200 shadow-lg flex gap-1 pointer-events-auto items-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all mr-1 border-r pr-2 border-gray-100"
            title="Back to Top"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
          </button>
          {chartOrder.map((chart) => (
            <button
              key={chart.id}
              onClick={() => scrollToChart(chart.id)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
                activeSection === chart.id 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              {chart.title.replace("Dispatch by ", "")}
            </button>
          ))}
          <button
            onClick={scrollToBottom}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all ml-1 border-l pl-2 border-gray-100"
            title="Go to Bottom"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Quantity</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-gray-900">{summaryStats.total}</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Dispatches</p>
          <h4 className="text-2xl font-black text-gray-900">{summaryStats.count}</h4>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Avg per Dispatch</p>
          <h4 className="text-2xl font-black text-gray-900">{summaryStats.avg}</h4>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartOrder.map(config => renderChart(config))}
      </div>

      {/* Reorder Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Reorder Charts</h3>
              <button onClick={() => setShowReorderModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {chartOrder.map((config, index) => (
                <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                  <span className="font-bold text-gray-700 flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                    {config.title}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      disabled={index === 0}
                      onClick={() => {
                        const next = [...chartOrder];
                        [next[index], next[index-1]] = [next[index-1], next[index]];
                        setChartOrder(next);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-all disabled:opacity-30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button 
                      disabled={index === chartOrder.length - 1}
                      onClick={() => {
                        const next = [...chartOrder];
                        [next[index], next[index+1]] = [next[index+1], next[index]];
                        setChartOrder(next);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-md transition-all disabled:opacity-30"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowReorderModal(false)}
                className="px-8 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100"
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
