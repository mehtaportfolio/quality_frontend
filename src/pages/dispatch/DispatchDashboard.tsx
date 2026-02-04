import { useEffect, useState, useMemo, useCallback } from "react";
import html2canvas from "html2canvas";
import { API_BASE_URL } from "../../config";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
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

const dashboardDataCache: Record<string, DispatchData[]> = {};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

interface DispatchDashboardProps {
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
}

export default function DispatchDashboard({
  selectedFilters,
  setSelectedFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: DispatchDashboardProps) {
  const [data, setData] = useState<DispatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [distributionChannels, setDistributionChannels] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");

  const DASHBOARD_CHARTS = [
    { id: "division", title: "Division Share" },
    { id: "monthly", title: "Monthly Trend" },
    { id: "market", title: "Market Breakdown" },
    { id: "plant", title: "Plant Breakdown" },
    { id: "customer", title: "Top Customers" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id.replace("dashboard-chart-", ""));
          }
        });
      },
      { threshold: 0.3, rootMargin: "-10% 0px -70% 0px" }
    );

    DASHBOARD_CHARTS.forEach((chart) => {
      const el = document.getElementById(`dashboard-chart-${chart.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToChart = (id: string) => {
    const el = document.getElementById(`dashboard-chart-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  const fetchInitialData = useCallback(async () => {
    try {
      const [divRes, distRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/unique-values/dispatch_data/division_description`),
        fetch(`${API_BASE_URL}/api/unique-values/dispatch_data/distribution_channel_description`)
      ]);
      
      const divJson = await divRes.json();
      const distJson = await distRes.json();

      if (divJson.success) setDivisions(divJson.data);
      if (distJson.success) setDistributionChannels(distJson.data);
    } catch (err) {
      console.error("Failed to fetch divisions/channels:", err);
    }
  }, []);

  const fetchYears = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/available-years/dispatch_data/billing_date`);
      const json = await res.json();
      if (json.success) {
        setAvailableYears(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch years:", e);
    }
  }, []);

  const loadData = useCallback(async () => {
    const cacheKey = `${startDate}-${endDate}`;
    if (dashboardDataCache[cacheKey]) {
      setData(dashboardDataCache[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      
      // We fetch all data for the date range once.
      // Division filtering is done client-side for performance.
      const res = await fetch(`${API_BASE_URL}/api/dispatch-data?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        dashboardDataCache[cacheKey] = json.data;
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchYears();
    fetchInitialData();
  }, [fetchYears, fetchInitialData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      setStartDate("");
      setEndDate("");
    } else {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const toggleDivision = (div: string) => {
    setSelectedFilters(prev => {
      const current = prev["division_description"] || [];
      const updated = current.includes(div)
        ? current.filter(v => v !== div)
        : [...current, div];
      
      const newFilters = { ...prev, ["division_description"]: updated };
      if (updated.length === 0) delete newFilters["division_description"];
      return newFilters;
    });
  };

  const toggleDistChannel = (channel: string) => {
    setSelectedFilters(prev => {
      if (channel === "All") {
        const newFilters = { ...prev };
        delete newFilters["distribution_channel_description"];
        return newFilters;
      }
      
      const updated = [channel]; // Single select dropdown behavior
      const newFilters = { ...prev, ["distribution_channel_description"]: updated };
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters({});
    setStartDate("");
    setEndDate("");
  };

  const stats = useMemo(() => {
    let totalQtyKg = 0;
    const divisionQty: Record<string, number> = {};
    const monthQty: Record<string, number> = {};
    const marketQty: Record<string, number> = {};
    const plantQty: Record<string, number> = {};
    const customerQty: Record<string, number> = {};

    // Apply filters client-side for speed
    const filtered = data.filter(item => {
      for (const [col, values] of Object.entries(selectedFilters)) {
        if (values.length > 0 && !values.includes(String(item[col] || "Other"))) return false;
      }
      return true;
    });

    filtered.forEach(item => {
      const qtyKg = Number(String(item.billed_quantity || "0").replace(/[^0-9.-]/g, ""));
      totalQtyKg += qtyKg;

      const div = String(item.division_description || "Other");
      divisionQty[div] = (divisionQty[div] || 0) + qtyKg;

      const mkt = String(item.market || "Other");
      marketQty[mkt] = (marketQty[mkt] || 0) + qtyKg;

      const plant = String(item.plant || "Other");
      plantQty[plant] = (plantQty[plant] || 0) + qtyKg;

      const cust = String(item.customer_name || "Other");
      customerQty[cust] = (customerQty[cust] || 0) + qtyKg;

      if (item.billing_date) {
        const date = new Date(item.billing_date as string);
        if (!isNaN(date.getTime())) {
          const m = MONTH_NAMES[date.getMonth()];
          monthQty[m] = (monthQty[m] || 0) + qtyKg;
        }
      }
    });

    const toSortedMTArray = (record: Record<string, number>) => 
      Object.entries(record)
        .map(([name, qtyKg]) => ({
          name,
          value: Math.round(qtyKg / 1000),
          rawQtyKg: qtyKg,
          percentage: totalQtyKg > 0 ? Number(((qtyKg / totalQtyKg) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.value - a.value);

    const monthData = MONTH_NAMES.map(m => ({
      name: m,
      value: Math.round((monthQty[m] || 0) / 1000)
    }));

    return {
      totalQtyMT: Math.round(totalQtyKg / 1000).toString(),
      totalBills: filtered.length,
      avgBillQtyKg: filtered.length > 0 ? Math.round(totalQtyKg / filtered.length).toString() : "0",
      divisionData: toSortedMTArray(divisionQty),
      monthData,
      marketData: toSortedMTArray(marketQty).slice(0, 7),
      plantData: toSortedMTArray(plantQty).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'})),
      customerData: toSortedMTArray(customerQty).slice(0, 5)
    };
  }, [data, selectedFilters]);

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

  if (loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Loading Global Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 pb-20">
      {/* Date & Division Filters Header */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Timeframe:</span>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className={`px-6 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  !selectedYear 
                    ? "bg-white text-red-700 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                ALL
              </button>
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => handleYearSelect(y)}
                  className={`px-6 py-1.5 text-sm font-bold rounded-lg transition-all ${
                    selectedYear === y 
                      ? "bg-white text-red-700 shadow-sm" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-sm font-bold text-gray-700 focus:outline-none"
              />
              <span className="text-gray-300 font-bold">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-sm font-bold text-gray-700 focus:outline-none"
              />
            </div>
            {(startDate || endDate || Object.keys(selectedFilters).length > 0) && (
              <button 
                onClick={clearAllFilters}
                className="px-4 py-2 text-xs font-black text-red-600 uppercase tracking-widest hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider mr-2">Divisions:</span>
            {divisions.map(div => {
              const isSelected = (selectedFilters["division_description"] || []).includes(div);
              return (
                <button
                  key={div}
                  onClick={() => toggleDivision(div)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all ${
                    isSelected 
                      ? "bg-red-600 border-red-600 text-white shadow-md shadow-red-100" 
                      : "bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600"
                  }`}
                >
                  {div}
                </button>
              );
            })}
          </div>

          {/* Distribution Channel Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Channel:</span>
            <select
              className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg focus:ring-red-500 focus:border-red-500 block p-2 outline-none"
              value={selectedFilters["distribution_channel_description"]?.[0] || "All"}
              onChange={(e) => toggleDistChannel(e.target.value)}
            >
              <option value="All">ALL Channels</option>
              {distributionChannels.map(channel => (
                <option key={channel} value={channel}>{channel}</option>
              ))}
            </select>
          </div>
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
          {DASHBOARD_CHARTS.map((chart) => (
            <button
              key={chart.id}
              onClick={() => scrollToChart(chart.id)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${
                activeSection === chart.id 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-600 hover:text-red-600 hover:bg-red-50'
              }`}
            >
              {chart.title}
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
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Quantity</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-4xl font-black text-gray-900">{stats.totalQtyMT}</h4>
            <span className="text-sm font-bold text-red-600">MT</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Dispatches</p>
          <h4 className="text-4xl font-black text-gray-900">{stats.totalBills}</h4>
        </div>
        <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
          <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Avg per Dispatch</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-4xl font-black text-gray-900">{stats.avgBillQtyKg}</h4>
            <span className="text-sm font-bold text-gray-500">kg</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Division Breakdown */}
        <div id="dashboard-chart-division" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[480px] flex flex-col scroll-mt-20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800 flex items-center gap-3 text-lg">
              <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
              Division Share (MT)
            </h3>
            <button
              onClick={() => handleDownloadChart("dashboard-chart-division", "Division Share")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={stats.divisionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  label={({ value, percentage }) => `${value} (${percentage}%)`}
                >
                  {stats.divisionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white/90 backdrop-blur-md p-4 border border-gray-100 shadow-2xl rounded-2xl">
                          <p className="font-black text-gray-900 mb-1">{d.name}</p>
                          <p className="text-sm text-red-600 font-black">{d.value}</p>
                          <p className="text-xs text-gray-400 font-bold">{d.percentage}% Total Share</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Trend */}
        <div id="dashboard-chart-monthly" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[480px] flex flex-col scroll-mt-20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800 flex items-center gap-3 text-lg">
              <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
              Monthly Volume (MT)
            </h3>
            <button
              onClick={() => handleDownloadChart("dashboard-chart-monthly", "Monthly Volume")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.monthData} margin={{ bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize: 12, fontWeight: 600, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fontSize: 12, fontWeight: 600, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#f3f4f6', radius: 8}}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white/90 backdrop-blur-md p-3 border border-gray-100 shadow-xl rounded-xl">
                          <p className="text-sm font-black text-gray-800 mb-1">{label}</p>
                          <p className="text-xs text-blue-600 font-black">{payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={32}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#3b82f6" }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Breakdown */}
        <div id="dashboard-chart-market" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[480px] flex flex-col scroll-mt-20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800 flex items-center gap-3 text-lg">
              <span className="w-1.5 h-6 bg-emerald-600 rounded-full"></span>
              Top Markets (MT)
            </h3>
            <button
              onClick={() => handleDownloadChart("dashboard-chart-market", "Top Markets")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.marketData} layout="vertical" margin={{ left: 40, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 600, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#ecfdf5', radius: 4}}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                          <p className="text-sm font-black text-gray-800 mb-1">{payload[0].payload.name}</p>
                          <p className="text-xs text-emerald-600 font-black">{payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: "#10b981" }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Plants */}
        <div id="dashboard-chart-plant" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-[480px] flex flex-col scroll-mt-20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-gray-800 flex items-center gap-3 text-lg">
              <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
              Plant Distribution (MT)
            </h3>
            <button
              onClick={() => handleDownloadChart("dashboard-chart-plant", "Plant Distribution")}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={stats.plantData} margin={{ bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 600, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={5} />
                <YAxis tick={{fontSize: 12, fontWeight: 600, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: '#fff7ed', radius: 8}}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-xl">
                          <p className="text-sm font-black text-gray-800 mb-1">Plant {label}</p>
                          <p className="text-xs text-orange-600 font-black">{payload[0].value}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={32}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#f59e0b" }} offset={8} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers - Large horizontal bar chart */}
      <div id="dashboard-chart-customer" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col scroll-mt-20">
        <div className="flex justify-between items-center mb-8">
          <h3 className="font-black text-gray-800 flex items-center gap-3 text-lg">
            <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
            Top 5 Customers by Volume (MT)
          </h3>
          <button
            onClick={() => handleDownloadChart("dashboard-chart-customer", "Top Customers")}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
            title="Download Chart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {stats.customerData.map((cust, idx) => (
            <div key={idx} className="bg-gray-50 p-6 rounded-2xl flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-black mb-4">
                {idx + 1}
              </div>
              <p className="text-sm font-bold text-gray-800 line-clamp-2 min-h-[2.5rem] mb-2">{cust.name}</p>
              <p className="text-xl font-black text-purple-600">{cust.value}</p>
              <div className="w-full bg-gray-200 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-purple-600 h-full rounded-full" 
                  style={{ width: `${cust.percentage}%` }}
                ></div>
              </div>
              <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wider">{cust.percentage}% Share</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
