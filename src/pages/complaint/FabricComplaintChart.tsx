import { useEffect, useState, useMemo, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
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

type FabricComplaint = Record<string, string | number | boolean | null>;

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

const formatValue = (val: number, calcMode: string) => {
  if (calcMode === "per100mt") {
    if (val === 0) return "0";
    if (val < 0.001) return val.toFixed(6);
    if (val < 0.01) return val.toFixed(5);
    if (val < 1) return val.toFixed(4);
    return val.toFixed(2);
  }
  return val.toString();
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const TABLE_NAME = "fabric_complaints";
const ALL_COLUMNS = [
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

type ChartType = "unit" | "market" | "nature" | "month" | "year" | "customer" | "status" | "complaint_mode" | "department" | "complaint_type" | "customer_type";

interface ChartConfig {
  id: ChartType;
  title: string;
  dataKey: string;
}

const DEFAULT_CHART_ORDER: ChartConfig[] = [
  { id: "unit", title: "Complaints by Unit No", dataKey: "unit" },
  { id: "market", title: "Complaints by Market", dataKey: "market" },
  { id: "month", title: "Complaints by Month", dataKey: "month" },
  { id: "year", title: "Complaints by Year", dataKey: "year" },
  { id: "nature", title: "Nature of Complaint", dataKey: "nature" },
  { id: "customer", title: "Complaints by Customer", dataKey: "customer" },
];

const DEFAULT_PIE_CHART_ORDER: ChartConfig[] = [
  { id: "status", title: "Complaints by Status", dataKey: "status" },
  { id: "complaint_mode", title: "Complaints by Mode", dataKey: "complaint_mode" },
  { id: "complaint_type", title: "Complaints by Type", dataKey: "complaint_type" },
  { id: "customer_type", title: "Complaints by Customer Type", dataKey: "customer_type" },
  { id: "department", title: "Complaints by Department", dataKey: "department" },
];

interface DispatchStats {
  unit: Record<string, number>;
  market: Record<string, number>;
  customer: Record<string, number>;
  month: Record<string, number>;
  year: Record<string, number>;
  total: number;
  [key: string]: any;
}

const WrappedTick = (props: any) => {
  const { x, y, payload } = props;
  const value = payload.value;
  const maxLength = 10;

  if (value.length <= maxLength) {
    return (
      <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="#4b5563" fontWeight={600}>
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
    <text x={x} y={y + 8} textAnchor="middle" fontSize={9} fill="#4b5563" fontWeight={600}>
      {lines.slice(0, 3).map((line, index) => (
        <tspan x={x} dy={index === 0 ? 0 : 10} key={index}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

interface FabricComplaintChartProps {
  selectedFilters: Record<string, string[]>;
  setSelectedFilters: Dispatch<SetStateAction<Record<string, string[]>>>;
  startDate: string;
  setStartDate: Dispatch<SetStateAction<string>>;
  endDate: string;
  setEndDate: Dispatch<SetStateAction<string>>;
}

export default function FabricComplaintChart({
  selectedFilters,
  setSelectedFilters,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: FabricComplaintChartProps) {
  const [data, setData] = useState<FabricComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<"column" | "pie">("column");
  const [calcMode, setCalcMode] = useState<"count" | "percent" | "per100mt">("count");
  const [dispatchStats, setDispatchStats] = useState<DispatchStats | null>(null);

  // Chart Interactivity: Bar/Pie click filter state
  const [activeBarFilters, setActiveBarFilters] = useState<Partial<Record<ChartType, string | null>>>({
    unit: null, market: null, nature: null, month: null, year: null, customer: null,
    status: null, complaint_mode: null, department: null, complaint_type: null, customer_type: null
  });

  // Global filters (dropdowns)
  const [selectedYear, setSelectedYear] = useState<string>("");

  // Filter UI State
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterValuesRef = useRef<HTMLDivElement>(null);

  // Reorder state
  const [columnChartOrder, setColumnChartOrder] = useState<ChartConfig[]>(DEFAULT_CHART_ORDER);
  const [pieChartOrder, setPieChartOrder] = useState<ChartConfig[]>(DEFAULT_PIE_CHART_ORDER);
  const chartOrder = useMemo(() => activeTab === "column" ? columnChartOrder : pieChartOrder, [activeTab, columnChartOrder, pieChartOrder]);
  
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  // Track active section for navigation
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
  
  // Single Complaints/Customers Modal state
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleNatures, setSingleNatures] = useState<string[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [singleCustomers, setSingleCustomers] = useState<string[]>([]);
  const [showDoubleModal, setShowDoubleModal] = useState(false);
  const [doubleCustomers, setDoubleCustomers] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      Object.entries(selectedFilters).forEach(([col, values]) => {
        if (values.length > 0) {
          params.append(col, values.join(","));
        }
      });

      const res = await fetch(`${API_BASE_URL}/api/fabric-complaints?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Failed to fetch data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [selectedFilters]);

  const loadDispatchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("division", "Fabric");
      
      Object.entries(selectedFilters).forEach(([col, values]) => {
        if (values.length > 0) {
          params.append(col, values.join(","));
        }
      });
      
      if (selectedYear) {
        params.append("startDate", `${selectedYear}-01-01`);
        params.append("endDate", `${selectedYear}-12-31`);
      }

      const res = await fetch(`${API_BASE_URL}/api/dispatch-stats?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDispatchStats(json.stats);
      }
    } catch (err) {
      console.error("Failed to load dispatch stats", err);
    }
  }, [selectedFilters, selectedYear]);

  useEffect(() => {
    loadData();
    if (calcMode === "per100mt") {
      loadDispatchStats();
    }
  }, [loadData, loadDispatchStats, calcMode]);

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
      if (item.query_received_date) {
        const date = new Date(item.query_received_date as any);
        if (!isNaN(date.getTime())) y.add(date.getFullYear().toString());
      }
    });
    return Array.from(y).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const handleBarClick = (type: ChartType, value: string) => {
    if (type === "nature" && value === "Single Complaints" && chartData?.meta) {
      setSingleNatures(chartData.meta.singleNatures);
      setShowSingleModal(true);
      return;
    }

    if (type === "customer" && value === "Single Customers" && chartData?.meta) {
      setSingleCustomers(chartData.meta.singleCustomers);
      setShowCustomerModal(true);
      return;
    }

    if (type === "customer" && value === "Double Customers" && chartData?.meta) {
      setDoubleCustomers(chartData.meta.doubleCustomers);
      setShowDoubleModal(true);
      return;
    }

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
      let fetchTable = TABLE_NAME;
      if (col === "market") fetchTable = "market_master";
      else if (col === "customer_name") fetchTable = "customer_master";

      const res = await fetch(`${API_BASE_URL}/api/unique-values/${fetchTable}/${col}`);
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

  const clearFilter = (col: string) => {
    setSelectedFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[col];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setActiveBarFilters({
      unit: null, market: null, nature: null, month: null, year: null, customer: null,
      status: null, complaint_mode: null, department: null, complaint_type: null, customer_type: null
    });
    setSelectedFilters({});
    setSelectedYear("");
  };

  const filteredData = useMemo(() => {
    // 1. First pass: Identify natures and customers with only 1 (or 2) complaints
    // based on common filters (Year, Unit, Market, Month, Year interactivity)
    const naturesWithCounts: Record<string, number> = {};
    const customersWithCounts: Record<string, number> = {};
    
    data.forEach(item => {
      // Year filter (buttons)
      if (selectedYear && item.query_received_date) {
        const date = new Date(item.query_received_date as any);
        if (date.getFullYear().toString() !== selectedYear) return;
      } else if (selectedYear) return;

      // Dropdown filters (OR within column, AND between columns)
      for (const [col, values] of Object.entries(selectedFilters)) {
        if (values.length > 0 && !values.includes(String(item[col] || "Unknown"))) return;
      }

      // Unit/Market interactivity filters
      if (activeBarFilters.unit && String(item.unit_no || "Unknown") !== activeBarFilters.unit) return;
      if (activeBarFilters.market && String(item.market || "Unknown") !== activeBarFilters.market) return;
      
      // Pie chart categories interactivity filters
      if (activeBarFilters.status && String(item.status || "Unknown") !== activeBarFilters.status) return;
      if (activeBarFilters.complaint_mode && String(item.complaint_mode || "Unknown") !== activeBarFilters.complaint_mode) return;
      if (activeBarFilters.department && String(item.department || "Unknown") !== activeBarFilters.department) return;
      if (activeBarFilters.complaint_type && String(item.complaint_type || "Unknown") !== activeBarFilters.complaint_type) return;
      if (activeBarFilters.customer_type && String(item.customer_type || "Unknown") !== activeBarFilters.customer_type) return;

      // Month/Year interactivity filters
      if (item.query_received_date && (activeBarFilters.month || activeBarFilters.year)) {
        const date = new Date(item.query_received_date as any);
        if (!isNaN(date.getTime())) {
          if (activeBarFilters.year && date.getFullYear().toString() !== activeBarFilters.year) return;
          if (activeBarFilters.month && MONTH_NAMES[date.getMonth()] !== activeBarFilters.month) return;
        } else if (activeBarFilters.month || activeBarFilters.year) return;
      } else if (activeBarFilters.month || activeBarFilters.year) return;

      const nat = String(item.nature_of_complaint || "Unknown");
      const cust = String(item.customer_name || "Unknown");
      naturesWithCounts[nat] = (naturesWithCounts[nat] || 0) + 1;
      customersWithCounts[cust] = (customersWithCounts[cust] || 0) + 1;
    });

    // 2. Second pass: Filter the data for the whole dashboard
    return data.filter(item => {
      // Global Year Filter (Buttons)
      if (selectedYear && item.query_received_date) {
        const date = new Date(item.query_received_date as any);
        if (date.getFullYear().toString() !== selectedYear) return false;
      } else if (selectedYear) return false;

      // Dropdown filters
      for (const [col, values] of Object.entries(selectedFilters)) {
        if (values.length > 0 && !values.includes(String(item[col] || "Unknown"))) return false;
      }

      // Chart Interactivity Filters (Bar Clicks)
      if (activeBarFilters.unit && String(item.unit_no || "Unknown") !== activeBarFilters.unit) return false;
      if (activeBarFilters.market && String(item.market || "Unknown") !== activeBarFilters.market) return false;

      // Pie chart categories interactivity filters
      if (activeBarFilters.status && String(item.status || "Unknown") !== activeBarFilters.status) return false;
      if (activeBarFilters.complaint_mode && String(item.complaint_mode || "Unknown") !== activeBarFilters.complaint_mode) return false;
      if (activeBarFilters.department && String(item.department || "Unknown") !== activeBarFilters.department) return false;
      if (activeBarFilters.complaint_type && String(item.complaint_type || "Unknown") !== activeBarFilters.complaint_type) return false;
      if (activeBarFilters.customer_type && String(item.customer_type || "Unknown") !== activeBarFilters.customer_type) return false;
      
      if (activeBarFilters.nature) {
        const itemNature = String(item.nature_of_complaint || "Unknown");
        if (activeBarFilters.nature === "Single Complaints") {
          if (naturesWithCounts[itemNature] !== 1) return false;
        } else {
          if (itemNature !== activeBarFilters.nature) return false;
        }
      }

      if (activeBarFilters.customer) {
        const itemCust = String(item.customer_name || "Unknown");
        if (activeBarFilters.customer === "Single Customers") {
          if (customersWithCounts[itemCust] !== 1) return false;
        } else if (activeBarFilters.customer === "Double Customers") {
          if (customersWithCounts[itemCust] !== 2) return false;
        } else {
          if (itemCust !== activeBarFilters.customer) return false;
        }
      }
      
      if (item.query_received_date && (activeBarFilters.month || activeBarFilters.year)) {
        const date = new Date(item.query_received_date as any);
        if (!isNaN(date.getTime())) {
          if (activeBarFilters.year && date.getFullYear().toString() !== activeBarFilters.year) return false;
          if (activeBarFilters.month && MONTH_NAMES[date.getMonth()] !== activeBarFilters.month) return false;
        } else if (activeBarFilters.month || activeBarFilters.year) return false;
      } else if (activeBarFilters.month || activeBarFilters.year) return false;

      return true;
    });
  }, [data, activeBarFilters, selectedYear, selectedFilters]);

  const summaryStats = useMemo(() => {
    const totalComplaints = filteredData.length;
    const uniqueCustomers = new Set(filteredData.map(item => String(item.customer_name || "Unknown"))).size;
    
    let openComplaints = 0;
    let closedComplaints = 0;
    let exportComplaints = 0;
    let domesticComplaints = 0;

    filteredData.forEach(item => {
      const status = String(item.status || "").toLowerCase();
      if (status === "open") openComplaints++;
      else if (status === "closed" || status === "close") closedComplaints++;

      const custType = String(item.customer_type || "").toLowerCase();
      if (custType.includes("export")) exportComplaints++;
      else if (custType.includes("domestic")) domesticComplaints++;
    });

    return {
      totalComplaints,
      uniqueCustomers,
      openComplaints,
      closedComplaints,
      exportComplaints,
      domesticComplaints
    };
  }, [filteredData]);

  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const aggregate = (items: FabricComplaint[]) => {
      const unitData: Record<string, number> = {};
      const marketData: Record<string, number> = {};
      const natureData: Record<string, number> = {};
      const customerData: Record<string, number> = {};
      const monthData: Record<string, number> = {};
      const yearData: Record<string, number> = {};

      const statusData: Record<string, number> = {};
      const modeData: Record<string, number> = {};
      const deptData: Record<string, number> = {};
      const typeData: Record<string, number> = {};
      const custTypeData: Record<string, number> = {};

      items.forEach((item) => {
        const unit = String(item.unit_no || "Unknown");
        unitData[unit] = (unitData[unit] || 0) + 1;

        const market = String(item.market || "Unknown");
        marketData[market] = (marketData[market] || 0) + 1;

        const nature = String(item.nature_of_complaint || "Unknown");
        natureData[nature] = (natureData[nature] || 0) + 1;

        const customer = String(item.customer_name || "Unknown");
        customerData[customer] = (customerData[customer] || 0) + 1;

        const status = String(item.status || "Unknown");
        statusData[status] = (statusData[status] || 0) + 1;

        const mode = String(item.complaint_mode || "Unknown");
        modeData[mode] = (modeData[mode] || 0) + 1;

        const dept = String(item.department || "Unknown");
        deptData[dept] = (deptData[dept] || 0) + 1;

        const type = String(item.complaint_type || "Unknown");
        typeData[type] = (typeData[type] || 0) + 1;

        const custType = String(item.customer_type || "Unknown");
        custTypeData[custType] = (custTypeData[custType] || 0) + 1;

        if (item.query_received_date) {
          const date = new Date(item.query_received_date as any);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear().toString();
            const month = MONTH_NAMES[date.getMonth()];
            monthData[month] = (monthData[month] || 0) + 1;
            yearData[year] = (yearData[year] || 0) + 1;
          }
        }
      });

      const format = (obj: Record<string, number>, keyName: string) =>
        Object.entries(obj).map(([name, count]) => ({ [keyName]: name as any, count }));

      const natureList = format(natureData, "nature");
      let finalNatureData: any[];
      let singleNaturesList: string[] = [];

      if (activeBarFilters.nature === "Single Complaints") {
        finalNatureData = natureList.sort((a, b) => b.count - a.count);
      } else {
        const aboveOne = natureList.filter(n => n.count > 1);
        const onlyOne = natureList.filter(n => n.count === 1);
        singleNaturesList = onlyOne.map(n => String((n as any).nature)).sort((a: any, b: any) => a.localeCompare(b));
        finalNatureData = [...aboveOne].sort((a, b) => b.count - a.count);
        if (onlyOne.length > 0) {
          finalNatureData.push({
            nature: "Single Complaints",
            count: onlyOne.length,
            isGrouped: true
          });
        }
      }

      const customerList = format(customerData, "customer");
      let finalCustomerData: any[];
      let singleCustomersList: string[] = [];
      let doubleCustomersList: string[] = [];

      if (activeBarFilters.customer === "Single Customers") {
        finalCustomerData = customerList.sort((a, b) => b.count - a.count);
      } else if (activeBarFilters.customer === "Double Customers") {
        finalCustomerData = customerList.sort((a, b) => b.count - a.count);
      } else {
        const aboveTwo = customerList.filter(c => c.count > 2);
        const onlyTwo = customerList.filter(c => c.count === 2);
        const onlyOne = customerList.filter(c => c.count === 1);
        
        singleCustomersList = onlyOne.map(c => String((c as any).customer)).sort((a: any, b: any) => a.localeCompare(b));
        doubleCustomersList = onlyTwo.map(c => String((c as any).customer)).sort((a: any, b: any) => a.localeCompare(b));

        finalCustomerData = [...aboveTwo].sort((a, b) => b.count - a.count);
        
        if (onlyTwo.length > 0) {
          finalCustomerData.push({
            customer: "Double Customers",
            count: onlyTwo.length,
            isGrouped: true
          });
        }
        
        if (onlyOne.length > 0) {
          finalCustomerData.push({
            customer: "Single Customers",
            count: onlyOne.length,
            isGrouped: true
          });
        }
      }

      const sortedMonthData = MONTH_NAMES
        .filter(m => monthData[m] !== undefined)
        .map(m => ({ month: m, count: monthData[m] }));

      return {
        unit: format(unitData, "unit").sort((a, b) => b.count - a.count),
        market: format(marketData, "market").sort((a, b) => b.count - a.count),
        nature: finalNatureData,
        customer: finalCustomerData,
        month: sortedMonthData,
        year: format(yearData, "year").sort((a: any, b: any) => a.year.localeCompare(b.year)),
        
        status: format(statusData, "status"),
        complaint_mode: format(modeData, "complaint_mode"),
        department: format(deptData, "department"),
        complaint_type: format(typeData, "complaint_type"),
        customer_type: format(custTypeData, "customer_type"),

        meta: {
          singleNatures: singleNaturesList,
          singleCustomers: singleCustomersList,
          doubleCustomers: doubleCustomersList
        }
      };
    };

    return aggregate(filteredData);
  }, [data, filteredData, activeBarFilters]);

  const moveChart = (index: number, direction: 'up' | 'down') => {
    const isColumn = activeTab === "column";
    const currentOrder = isColumn ? columnChartOrder : pieChartOrder;
    const setOrder = isColumn ? setColumnChartOrder : setPieChartOrder;
    
    const newOrder = [...currentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setOrder(newOrder);
    }
  };

  const scrollToChart = (id: string) => {
    const element = document.getElementById(`chart-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) return <div className="text-center p-10 font-medium text-gray-500">Loading chart data...</div>;
  if (error) return <div className="text-red-600 p-10 bg-red-50 rounded-lg border border-red-100 m-4">Error: {error}</div>;
  if (!chartData) return <div className="text-center p-10">No data available for charts</div>;

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

  const hasAnyFilter = Object.values(activeBarFilters).some(v => v !== null) || Object.keys(selectedFilters).length > 0 || !!selectedYear;

  const ChartCard = ({ title, data, dataKey, type, calcMode, dispatchStats }: { title: string, data: { [key: string]: string | number | boolean | null, count: number }[], dataKey: string, type: ChartType, calcMode: string, dispatchStats: DispatchStats | null }) => {
    const isHorizontal = (type === "nature" || type === "customer") && calcMode !== "per100mt";
    const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);
    
    const chartDataWithValues = useMemo(() => {
      if (calcMode !== "per100mt" || !dispatchStats) return data;
      const statsKey = type === "unit" ? "unit" : (type as keyof DispatchStats);
      const statsForType = (dispatchStats[statsKey as keyof DispatchStats] as Record<string, number>) || null;
      const totalBilled = dispatchStats.total || 0;
      
      let processed = data.map(item => {
        const key = String(item[dataKey]);
        const billedQty = statsForType ? (statsForType[key] || 0) : totalBilled;
        const value = billedQty > 0 ? (Number(item.count) / billedQty) * 100 : 0;
        return { ...item, per100mt: value };
      });

      if (type === "nature" || type === "customer" || type === "market" || type === "unit") {
        processed = processed
          .sort((a, b) => (b.per100mt as number) - (a.per100mt as number));
        
        if (type === "nature" || type === "customer") {
          processed = processed.slice(0, 10);
        }
      }
      return processed;
    }, [data, dispatchStats, type, dataKey, calcMode]);

    const activeDataKey = calcMode === "per100mt" ? "per100mt" : "count";
    const yAxisLabel = calcMode === "per100mt" ? "Complaints per 100 MT" : "Total Complaints";

    return (
    <div id={`card-${type}`} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${activeBarFilters[type] ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}`}>
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center gap-2">
          {activeBarFilters[type] && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 animate-in fade-in zoom-in-95">
              Selected: {activeBarFilters[type]}
              <button onClick={() => setActiveBarFilters(prev => ({ ...prev, [type]: null }))} className="hover:text-red-900 ml-1">×</button>
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadChart(`card-${type}`, title);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
            title="Download Chart"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
        </div>
      </div>
      <div className={isHorizontal ? "h-[800px]" : ((type === "nature" || type === "customer") ? "h-96" : "h-64")}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <BarChart 
            data={chartDataWithValues} 
            layout={isHorizontal ? "vertical" : "horizontal"}
            margin={{ top: 20, right: 30, left: isHorizontal ? 180 : 0, bottom: (!isHorizontal && (type === "nature" || type === "customer")) ? 60 : 20 }}
            onClick={(state) => {
              if (state && state.activeLabel) {
                handleBarClick(type, String(state.activeLabel));
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#f3f4f6" />
            {isHorizontal ? (
              <>
                <XAxis type="number" fontSize={11} tick={{ fill: '#4b5563' }} axisLine={{ stroke: '#e5e7eb' }} tickFormatter={(val) => calcMode === "per100mt" ? formatValue(val, "per100mt") : val} />
                <YAxis type="category" dataKey={dataKey} fontSize={11} tick={{ fill: '#4b5563' }} axisLine={{ stroke: '#e5e7eb' }} width={180} />
              </>
            ) : (
              <>
                <XAxis 
                  dataKey={dataKey} 
                  fontSize={11} 
                  tick={(type === "nature" || type === "customer" || type === "market") ? <WrappedTick /> : { fill: '#4b5563' }} 
                  axisLine={{ stroke: '#e5e7eb' }} 
                  interval={0}
                />
                <YAxis fontSize={11} tick={{ fill: '#4b5563' }} axisLine={{ stroke: '#e5e7eb' }} tickFormatter={(val) => calcMode === "per100mt" ? formatValue(val, "per100mt") : val} />
              </>
            )}
            <Tooltip 
              cursor={{ fill: '#f9fafb' }} 
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
              formatter={(value: any) => {
                if (calcMode === "percent" && total > 0) {
                  return [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Total Complaints"];
                }
                if (calcMode === "per100mt") {
                  return [formatValue(value, "per100mt"), "Complaints per 100 MT"];
                }
                return [value, "Total Complaints"];
              }}
            />
            <Bar dataKey={activeDataKey} name={yAxisLabel} radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} className="cursor-pointer">
              {chartDataWithValues.map((entry: any, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={activeBarFilters[type] === entry[dataKey] ? '#dc2626' : COLORS[index % COLORS.length]} 
                  fillOpacity={activeBarFilters[type] && activeBarFilters[type] !== entry[dataKey] ? 0.3 : 1}
                />
              ))}
              <LabelList 
                dataKey={activeDataKey} 
                position={isHorizontal ? "right" : "top"} 
                fontSize={12} 
                fill="#4b5563" 
                offset={8} 
                formatter={(value: any) => {
                  if (calcMode === "percent" && total > 0) {
                    return `${((value / total) * 100).toFixed(1)}%`;
                  }
                  if (calcMode === "per100mt") {
                    return formatValue(value, "per100mt");
                  }
                  return value;
                }}
              />
              {(type === "nature" || type === "customer") && (
                <LabelList 
                  dataKey={type} 
                  position="center" 
                  content={(props: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                    const { x, y, width, height, value } = props;
                    if (value === "Single Complaints" || value === "Single Customers" || value === "Double Customers") {
                      return (
                        <text 
                          x={x + width / 2} 
                          y={y + height / 2} 
                          fill="#fff" 
                          textAnchor="middle" 
                          dominantBaseline="middle"
                          fontSize={10}
                          fontWeight="bold"
                        >
                          Click for more details
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );};

  const PieChartCard = ({ title, data, dataKey, type }: { title: string, data: { [key: string]: string | number | boolean | null, count: number }[], dataKey: string, type: ChartType }) => {
    const total = useMemo(() => data.reduce((sum, item) => sum + item.count, 0), [data]);
    
    return (
      <div id={`card-${type}`} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${activeBarFilters[type] ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <div className="flex items-center gap-2">
            {activeBarFilters[type] && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                Selected: {activeBarFilters[type]}
                <button onClick={() => setActiveBarFilters(prev => ({ ...prev, [type]: null }))} className="hover:text-red-900 ml-1">×</button>
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadChart(`card-${type}`, title);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
              title="Download Chart"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            </button>
          </div>
        </div>
        <div className="h-[450px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey={dataKey}
                cx="50%"
                cy="45%"
                outerRadius={120}
                label={({ name, value, percent }) => {
                  if (calcMode === "percent") {
                    return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
                  }
                  return `${name} (${value})`;
                }}
                onClick={(state) => {
                  if (state && state.name) {
                    setActiveBarFilters(prev => ({
                      ...prev,
                      [type]: prev[type] === String(state.name) ? null : String(state.name)
                    }));
                  }
                }}
              >
                {data.map((entry: any, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={activeBarFilters[type] === entry[dataKey] ? '#dc2626' : COLORS[index % COLORS.length]} 
                    fillOpacity={activeBarFilters[type] && activeBarFilters[type] !== entry[dataKey] ? 0.3 : 1}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => {
                  if (calcMode === "percent" && total > 0) {
                    return [`${value} (${((value / total) * 100).toFixed(1)}%)`, "Total Complaints"];
                  }
                  return [value, "Total Complaints"];
                }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="p-2 space-y-4">
      {/* Toolbar consistent with FabricComplaintTable.tsx */}
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
                setShowFilterDropdown((v) => !v);
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
                  {ALL_COLUMNS.map((col) => (
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

            {/* Unique Values Dropdown (triggered after selecting column) */}
            {activeFilterCol && (
              <div ref={filterValuesRef} className="absolute top-10 left-60 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl p-2 w-64 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 mb-2">
                  <span className="text-xs font-bold uppercase text-red-600 truncate mr-2">{activeFilterCol.replaceAll("_", " ")}</span>
                  <button onClick={() => setActiveFilterCol(null)} className="text-gray-400 hover:text-gray-600">×</button>
                </div>
                
                <div className="px-2 mb-2">
                  <input
                    type="text"
                    placeholder="Search values..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto px-1 custom-scrollbar">
                  {loadingOptions ? (
                    <div className="py-10 text-center">
                      <div className="inline-block w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] text-gray-400 mt-2">Fetching values...</p>
                    </div>
                  ) : filterOptions.length > 0 ? (
                    filterOptions
                      .filter(opt => opt.toLowerCase().includes(filterSearch.toLowerCase()))
                      .map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 rounded cursor-pointer transition-colors group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFilters[activeFilterCol]?.includes(opt) || false}
                          onChange={() => toggleFilterValue(opt)}
                          className="w-3.5 h-3.5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                        />
                        <span className="text-xs text-gray-600 group-hover:text-red-700 truncate">{opt || "(Empty)"}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-center py-4 text-xs text-gray-400 italic">No values found</p>
                  )}
                </div>
                
                {selectedFilters[activeFilterCol] && (
                  <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                    <button
                      onClick={() => clearFilter(activeFilterCol)}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 px-2 py-1"
                    >
                      CLEAR FILTER
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Year Buttons */}
          <div className="flex items-center gap-2 border-l border-gray-200 ml-2 pl-4">
            <span className="text-xs font-bold uppercase text-gray-400 mr-1">Receive Year:</span>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-inner">
              <button
                onClick={() => setSelectedYear("")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!selectedYear ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ALL
              </button>
              {years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year === selectedYear ? "" : year)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedYear === year ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Value Display Toggle */}
          <div className="flex items-center gap-2 ml-auto pl-4 border-l border-gray-200">
            <span className="text-xs font-bold uppercase text-gray-400 mr-1">Display:</span>
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shadow-inner">
              <button
                onClick={() => setCalcMode("count")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${calcMode === "count" ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Count (#)
              </button>
              <button
                onClick={() => setCalcMode("percent")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${calcMode === "percent" ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Percent (%)
              </button>
              <button
                onClick={() => setCalcMode("per100mt")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${calcMode === "per100mt" ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                title="Complaints per 100 Metric Tons dispatched"
              >
                Complaints per 100 MT
              </button>
            </div>
          </div>

          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="text-sm font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors px-3 py-1.5 hover:bg-red-50 rounded-md"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              Reset ({filteredData.length} records)
            </button>
          )}
        </div>

        {/* Active Selected Filters Chips */}
        {Object.keys(selectedFilters).length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
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
          </div>
        )}
      </div>

      {/* Sub-tabs for Column and Pie Charts */}
      <div className="flex gap-4 border-b border-gray-200 px-2">
        <button
          onClick={() => setActiveTab("column")}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === "column" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Column Charts
        </button>
        <button
          onClick={() => setActiveTab("pie")}
          className={`px-4 py-2 text-sm font-bold transition-all border-b-2 ${activeTab === "pie" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Pie Charts
        </button>
      </div>

      {/* Navigation Buttons */}
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
              {chart.id === 'unit' ? 'Unitwise' : 
               chart.id === 'market' ? 'Market wise' : 
               chart.id === 'month' ? 'Receive Month' : 
               chart.id === 'year' ? 'Receive Year' : 
               chart.id === 'nature' ? 'Nature of Complaint' : 
               chart.id === 'customer' ? 'Customer Wise' : 
               chart.id.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-2 mb-2">
        {/* Total Complaints */}
        <div className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col items-center justify-center text-center group hover:border-red-400 transition-all">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Complaints</span>
          <span className="text-3xl font-black text-red-600 group-hover:scale-110 transition-transform">{summaryStats.totalComplaints}</span>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col items-center justify-center text-center group hover:border-blue-400 transition-all">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Customers</span>
          <span className="text-3xl font-black text-blue-600 group-hover:scale-110 transition-transform">{summaryStats.uniqueCustomers}</span>
        </div>

        {/* Complaints by Status */}
        <div className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col gap-2 group hover:border-green-400 transition-all">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider text-center">Complaints by Status</span>
          <div className="flex justify-around items-center h-full">
            <div 
              onClick={() => setActiveBarFilters(prev => ({ ...prev, status: prev.status === 'Open' ? null : 'Open' }))}
              className={`flex flex-col items-center cursor-pointer transition-all ${activeBarFilters.status === 'Open' ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
            >
              <span className={`text-xl font-bold ${activeBarFilters.status === 'Open' ? 'text-red-700' : 'text-red-600'}`}>{summaryStats.openComplaints}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Open</span>
            </div>
            <div className="w-px h-8 bg-gray-100"></div>
            <div 
              onClick={() => setActiveBarFilters(prev => ({ ...prev, status: (prev.status === 'Close' || prev.status === 'Closed') ? null : 'Close' }))}
              className={`flex flex-col items-center cursor-pointer transition-all ${(activeBarFilters.status === 'Close' || activeBarFilters.status === 'Closed') ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
            >
              <span className={`text-xl font-bold ${(activeBarFilters.status === 'Close' || activeBarFilters.status === 'Closed') ? 'text-green-700' : 'text-green-600'}`}>{summaryStats.closedComplaints}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Closed</span>
            </div>
          </div>
        </div>

        {/* Complaints by Customer Type */}
        <div className="bg-white p-4 rounded-xl border border-black shadow-sm flex flex-col gap-2 group hover:border-purple-400 transition-all">
          <span className="text-gray-500 text-xs font-bold uppercase tracking-wider text-center">Customer Type</span>
          <div className="flex justify-around items-center h-full">
            <div 
              onClick={() => setActiveBarFilters(prev => ({ ...prev, customer_type: prev.customer_type === 'Export' ? null : 'Export' }))}
              className={`flex flex-col items-center cursor-pointer transition-all ${activeBarFilters.customer_type === 'Export' ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
            >
              <span className={`text-xl font-bold ${activeBarFilters.customer_type === 'Export' ? 'text-purple-600' : 'text-purple-500'}`}>{summaryStats.exportComplaints}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Export</span>
            </div>
            <div className="w-px h-8 bg-gray-100"></div>
            <div 
              onClick={() => setActiveBarFilters(prev => ({ ...prev, customer_type: prev.customer_type === 'Domestic' ? null : 'Domestic' }))}
              className={`flex flex-col items-center cursor-pointer transition-all ${activeBarFilters.customer_type === 'Domestic' ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
            >
              <span className={`text-xl font-bold ${activeBarFilters.customer_type === 'Domestic' ? 'text-orange-600' : 'text-orange-500'}`}>{summaryStats.domesticComplaints}</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Domestic</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chartOrder.map((config) => (
          <div 
            key={config.id} 
            id={`chart-${config.id}`}
            className={`scroll-mt-20 ${(config.id === "nature" || config.id === "customer" || config.id === "department") ? "md:col-span-2" : ""}`}
          >
            {activeTab === "column" ? (
              <ChartCard 
                title={config.title} 
                data={chartData[config.id as keyof typeof chartData] as { [key: string]: string | number | boolean | null, count: number }[]} 
                dataKey={config.dataKey}
                type={config.id}
                calcMode={calcMode}
                dispatchStats={dispatchStats}
              />
            ) : (
              <PieChartCard
                title={config.title} 
                data={chartData[config.id as keyof typeof chartData] as { [key: string]: string | number | boolean | null, count: number }[]} 
                dataKey={config.dataKey}
                type={config.id}
              />
            )}
          </div>
        ))}
      </div>

      {/* Reorder Modal */}
      {showReorderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-red-600 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold">Adjust Chart Order</h3>
              <button onClick={() => setShowReorderModal(false)} className="hover:bg-red-700 p-1 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              {chartOrder.map((chart, idx) => (
                <div key={chart.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg group hover:border-red-200 transition-colors">
                  <span className="font-medium text-gray-700">{chart.title}</span>
                  <div className="flex gap-1">
                    <button 
                      disabled={idx === 0}
                      onClick={() => moveChart(idx, 'up')}
                      className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:border-gray-200 transition-all shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                    </button>
                    <button 
                      disabled={idx === chartOrder.length - 1}
                      onClick={() => moveChart(idx, 'down')}
                      className="p-1.5 rounded bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 disabled:opacity-30 disabled:hover:text-gray-600 disabled:hover:border-gray-200 transition-all shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button 
                onClick={() => setShowReorderModal(false)}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-md active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Complaints Modal */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-red-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Nature Categories with 1 Complaint</h3>
                <p className="text-red-100 text-xs mt-0.5">Showing individual categories from the "Single Complaints" group</p>
              </div>
              <button onClick={() => setShowSingleModal(false)} className="hover:bg-red-700 p-1.5 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-2">
                  {singleNatures.map((nature, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg transition-all"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{nature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
              <button 
                onClick={() => setShowSingleModal(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-all"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setActiveBarFilters(prev => ({ ...prev, nature: "Single Complaints" }));
                  setShowSingleModal(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Customers Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Customers with 1 Complaint</h3>
                <p className="text-blue-100 text-xs mt-0.5">Showing individual customers from the "Single Customers" group</p>
              </div>
              <button onClick={() => setShowCustomerModal(false)} className="hover:bg-blue-700 p-1.5 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-2">
                  {singleCustomers.map((customer, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg transition-all"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{customer}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
              <button 
                onClick={() => setShowCustomerModal(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-all"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setActiveBarFilters(prev => ({ ...prev, customer: "Single Customers" }));
                  setShowCustomerModal(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double Customers Modal */}
      {showDoubleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-purple-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">Customers with 2 Complaints</h3>
                <p className="text-purple-100 text-xs mt-0.5">Showing individual customers from the "Double Customers" group</p>
              </div>
              <button onClick={() => setShowDoubleModal(false)} className="hover:bg-purple-700 p-1.5 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-6">
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 gap-2">
                  {doubleCustomers.map((customer, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg transition-all"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{customer}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-between items-center">
              <button 
                onClick={() => setShowDoubleModal(false)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium transition-all"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setActiveBarFilters(prev => ({ ...prev, customer: "Double Customers" }));
                  setShowDoubleModal(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
