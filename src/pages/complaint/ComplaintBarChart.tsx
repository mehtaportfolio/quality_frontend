import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { API_BASE_URL } from "../../config";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

type Complaint = {
  id?: string | number;
  unit_no?: string | number | null;
  query_received_date?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};

const DROPDOWN_COLUMNS = [
  "status", "customer_name", "bill_to_region", "market", "count", "unit_no",
  "complaint_type", "customer_type", "department", "customer_complaint", "nature_of_complaint",
  "cotton", "complaint_mode"
];
const SPECIAL_COLUMNS = ["analysis_and_outcome", "action_taken", "remark"];

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
        <div className="absolute z-[70] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-100">
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

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function ComplaintBarChart({ 
  selectedYear,
  selectedTab,
  filters = {}
}: { 
  selectedYear?: string;
  selectedTab?: "yarn" | "fabric";
  filters?: Record<string, string>;
}) {
  const [complaintType, setComplaintType] = useState<"yarn" | "fabric">(selectedTab || "yarn");
  const [xAxisType, setXAxisType] = useState<"unit" | "month" | "nature_of_complaint" | "customer_name">("nature_of_complaint");
  const [data, setData] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [editingRow, setEditingRow] = useState<Complaint | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  const [marketMappings, setMarketMappings] = useState<any[]>([]);

  useEffect(() => {
    if (selectedTab) {
      setComplaintType(selectedTab);
    }
  }, [selectedTab]);

  const allColumns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(c => c !== "id" && c !== "created_at");
  }, [data]);

  const fetchDropdownOptions = useCallback(async (type: "yarn" | "fabric") => {
    try {
      const results: Record<string, string[]> = {};
      const tableName = type === "yarn" ? "yarn_complaints" : "fabric_complaints";
      
      // Fetch market mappings
      const mapRes = await fetch(`${API_BASE_URL}/api/master/market-mappings`);
      const mapJson = await mapRes.json();
      if (mapJson.success) {
        setMarketMappings(mapJson.data);
        const regions = [...new Set(mapJson.data.map((m: any) => m.ship_to_city))].filter(Boolean) as string[];
        results["bill_to_region"] = regions.sort();
      }

      await Promise.all(
        DROPDOWN_COLUMNS.map(async (col) => {
          if (col === "bill_to_region") return;
          let fetchTable = tableName;
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = complaintType === "yarn" ? "yarn-complaints" : "fabric-complaints";
        const params = new URLSearchParams();
        if (selectedYear) {
          params.append("startDate", `${selectedYear}-01-01`);
          params.append("endDate", `${selectedYear}-12-31`);
        }
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });

        const url = `${API_BASE_URL}/api/${endpoint}?${params.toString()}`;
        const res = await fetch(url);
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "Failed to fetch data");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [complaintType, selectedYear, filters]);

  const chartData = useMemo(() => {
    if (!data.length) return [];

    const counts: Record<string, number> = {};

    data.forEach((item) => {
      let key = "Unknown";
      if (xAxisType === "unit") {
        key = item.unit_no ? `Unit ${item.unit_no}` : "Unknown";
      } else if (xAxisType === "month") {
        if (item.query_received_date) {
          const date = new Date(item.query_received_date);
          key = MONTH_NAMES[date.getMonth()];
        }
      } else if (xAxisType === "nature_of_complaint") {
        key = (item.nature_of_complaint as string) || "Unknown";
      } else if (xAxisType === "customer_name") {
        key = (item.customer_name as string) || "Unknown";
      }

      counts[key] = (counts[key] || 0) + 1;
    });

    const formattedData = Object.entries(counts).map(([name, count]) => ({
      name,
      count,
    }));

    if (xAxisType === "month") {
      formattedData.sort((a, b) => MONTH_NAMES.indexOf(a.name) - MONTH_NAMES.indexOf(b.name));
    } else if (xAxisType === "nature_of_complaint" || xAxisType === "customer_name") {
      formattedData.sort((a, b) => b.count - a.count);
      return formattedData.slice(0, 10);
    } else {
      formattedData.sort((a, b) => a.name.localeCompare(b.name));
    }

    return formattedData;
  }, [data, xAxisType]);

  const handleBarClick = (dataPoint: any) => {
    if (!dataPoint || !dataPoint.name) return;
    
    const { name } = dataPoint;
    setModalTitle(`${complaintType === "yarn" ? "Yarn" : "Fabric"} Complaints - ${name}`);
    
    const filtered = data.filter((item) => {
      if (xAxisType === "unit") {
        const itemUnit = item.unit_no ? `Unit ${item.unit_no}` : "Unknown";
        return itemUnit === name;
      } else if (xAxisType === "month") {
        if (item.query_received_date) {
          const date = new Date(item.query_received_date);
          const itemMonth = MONTH_NAMES[date.getMonth()];
          return itemMonth === name;
        }
        return false;
      } else if (xAxisType === "nature_of_complaint") {
        return (item.nature_of_complaint || "Unknown") === name;
      } else if (xAxisType === "customer_name") {
        return (item.customer_name || "Unknown") === name;
      }
      return false;
    });

    setFilteredComplaints(filtered);
    setShowModal(true);
  };

  const handleDownloadChart = async () => {
    const element = document.getElementById("complaint-bar-chart-container");
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
      const title = getTitle();
      link.download = `${title.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download chart:", err);
    }
  };

  const getTitle = () => {
    const type = complaintType === "yarn" ? "Yarn" : "Fabric";
    let group = "";
    switch (xAxisType) {
      case "unit": group = "Unit"; break;
      case "month": group = "Month"; break;
      case "nature_of_complaint": group = "Top 10 Nature of Complaint"; break;
      case "customer_name": group = "Top 10 Customer Name"; break;
    }
    return `${type} Complaints by ${group}`;
  };

  return (
    <div id="complaint-bar-chart-container" className="w-full bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex justify-between items-center w-full md:w-auto gap-4">
          <h3 className="text-lg font-semibold text-gray-800">
            {getTitle()}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadChart();
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
            title="Download Chart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Group By Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Group by:</span>
            <select
              value={xAxisType}
              onChange={(e) => setXAxisType(e.target.value as any)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="unit">Unit</option>
              <option value="month">Month</option>
              <option value="nature_of_complaint">Nature of Complaint</option>
              <option value="customer_name">Customer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="h-[400px] w-full">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : error ? (
          <div className="h-full w-full flex items-center justify-center text-red-500">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-gray-400 italic">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const value = payload.value;
                  const maxLength = 10;
                  
                  if (value.length <= maxLength) {
                    return (
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={600}>
                        {value}
                      </text>
                    );
                  }

                  const words = value.split(/\s+/);
                  const lines: string[] = [];
                  let currentLine = "";

                  words.forEach((word: string) => {
                    if (currentLine && (currentLine + word).length > maxLength) {
                      lines.push(currentLine.trim());
                      currentLine = word + " ";
                    } else {
                      currentLine += word + " ";
                    }
                  });
                  if (currentLine) lines.push(currentLine.trim());

                  return (
                    <text x={x} y={y + 8} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={600}>
                      {lines.slice(0, 3).map((line, index) => (
                        <tspan x={x} dy={index === 0 ? 0 : 10} key={index}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
              />
              <Bar 
                dataKey="count" 
                fill="url(#barGradient)" 
                radius={[6, 6, 0, 0]} 
                barSize={40}
                onClick={handleBarClick}
                className="cursor-pointer"
              >
                {chartData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    fillOpacity={0.9}
                    className="hover:fill-opacity-100 transition-opacity"
                  />
                ))}
                <LabelList dataKey="count" position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 800 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Complaint Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800">{modalTitle}</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Query Receive Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Unit</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Count</th>
                    {complaintType === "fabric" && <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fabric Lot No</th>}
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Yarn Lot No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Customer Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredComplaints.length > 0 ? (
                    filteredComplaints.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.query_received_date ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.unit_no ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.customer_name ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.count ?? "-"}</td>
                        {complaintType === "fabric" && <td className="px-4 py-3 text-sm text-gray-700">{row.fabric_lot_no ?? "-"}</td>}
                        <td className="px-4 py-3 text-sm text-gray-700">{row.yarn_lot_no ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{row.customer_type ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-medium">
                          <span className={`px-2 py-1 rounded-full text-[10px] ${
                            (row.status === 'Closed' || row.status === 'Close') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {row.status ?? "Open"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button 
                            onClick={() => {
                              setEditingRow({ ...row });
                              fetchDropdownOptions(complaintType);
                              setShowEditModal(true);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={complaintType === "fabric" ? 9 : 8} className="px-4 py-10 text-center text-gray-500 italic">No data found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRow && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Edit Complaint</h3>
                  <p className="text-xs text-gray-500 font-medium">ID: {editingRow.id}</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingRow) return;

                // Validation
                const requiredFields = ["query_received_date", "status", "customer_name", "customer_type"];
                const missingFields = requiredFields.filter(f => !editingRow[f]);
                if (missingFields.length > 0) {
                  alert(`Please fill in required fields: ${missingFields.map(f => f.replaceAll("_", " ")).join(", ")}`);
                  return;
                }

                try {
                  const endpoint = complaintType === "yarn" ? "yarn-complaints" : "fabric-complaints";
                  const res = await fetch(`${API_BASE_URL}/api/${endpoint}/${editingRow.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editingRow),
                  });
                  const json = await res.json();
                  if (json.success) {
                    // Update both main data and filtered data
                    const updatedRow = json.data;
                    setData(prev => prev.map(r => r.id === editingRow.id ? updatedRow : r));
                    setFilteredComplaints(prev => prev.map(r => r.id === editingRow.id ? updatedRow : r));
                    setShowEditModal(false);
                    setEditingRow(null);
                  } else {
                    throw new Error(json.error || "Failed to update");
                  }
                } catch (err) {
                  alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
                }
              }} 
              className="flex-1 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allColumns.filter(c => !SPECIAL_COLUMNS.includes(c)).map((col) => {
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

                  const requiredFields = ["query_received_date", "status", "customer_name", "customer_type"];

                  return (
                    <div key={col} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {col === "customer_type" ? "Customer Type" : col.replaceAll("_", " ")}
                        {requiredFields.includes(col) && <span className="text-red-500 ml-1">*</span>}
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
                                  market: (mapping.market || updated.market) as string
                                };
                              }
                            }
                            setEditingRow(updated);
                          }}
                          placeholder={`Select ${col === "customer_type" ? "Customer Type" : col.replaceAll("_", " ")}`}
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
                                      [selectedTab === 'fabric' ? 'fabric_lot_no' : 'yarn_lot_no']: d.lot_no || editingRow[selectedTab === 'fabric' ? 'fabric_lot_no' : 'yarn_lot_no'],
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

              <div className="mt-8 space-y-6">
                {SPECIAL_COLUMNS.map((col) => (
                  <div key={col} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {col.replaceAll("_", " ")}
                    </label>
                    <textarea
                      value={(editingRow[col] ?? "") as string}
                      onChange={(e) => setEditingRow({ ...editingRow, [col]: e.target.value })}
                      rows={3}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none"
                      placeholder={`Enter ${col.replaceAll("_", " ")}...`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
