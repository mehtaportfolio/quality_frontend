// src/pages/complaint/ComplaintDashboard.tsx

import { useState, useEffect } from "react";
import ComplaintStatusCard from "./ComplaintStatusCard";
import IncompleteDataCard from "./IncompleteDataCard";
import ComplaintBarChart from "./ComplaintBarChart";
import ComplaintDistributionCharts from "./ComplaintDistributionCharts";
import { API_BASE_URL } from "../../config";

interface Stats {
  open: number;
  closed: number;
  incomplete: number;
  totalComplaints: number;
  totalCustomers: number;
}

interface ComplaintStatsResponse {
  yarn: Stats;
  fabric: Stats;
}

export default function ComplaintDashboard() {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<"yarn" | "fabric">("yarn");
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [stats, setStats] = useState<ComplaintStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const tableName = selectedTab === "yarn" ? "yarn_complaints" : "fabric_complaints";
        const [marketRes, customerTypeRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/unique-values/${tableName}/market`),
          fetch(`${API_BASE_URL}/api/unique-values/${tableName}/customer_type`)
        ]);
        const marketJson = await marketRes.json();
        const customerTypeJson = await customerTypeRes.json();
        
        if (marketJson.success) setMarkets(marketJson.data);
        if (customerTypeJson.success) setCustomerTypes(customerTypeJson.data);
      } catch (err) {
        console.error("Failed to fetch filter options", err);
      }
    };
    fetchFilterOptions();
  }, [selectedTab]);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/available-years`);
        const json = await res.json();
        
        if (json.success) {
          setAvailableYears(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch available years", err);
      }
    };
    fetchYears();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const url = `${API_BASE_URL}/api/complaint-stats?`;
        const params = new URLSearchParams();
        if (selectedYear) params.append("year", selectedYear);
        if (selectedMarket) params.append("market", selectedMarket);
        if (selectedCustomerType) params.append("customer_type", selectedCustomerType);
        
        const res = await fetch(url + params.toString());
        const json = await res.json();
        if (json.success) {
          setStats(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [selectedYear, selectedMarket, selectedCustomerType]);

  const currentStats = stats ? stats[selectedTab] : null;

  return (
    <div className="min-h-screen bg-gray-50/50 pt-2 pb-4 px-4 md:pt-4 md:pb-8 md:px-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Complaint <span className="text-red-600">Analytics</span>
          </h1>
          <p className="text-gray-500 font-medium text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            Real-time monitoring and reporting dashboard
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            <button
              onClick={() => {
                setSelectedTab("yarn");
                setSelectedMarket("");
                setSelectedCustomerType("");
              }}
              className={`px-6 py-2 text-xs font-black rounded-lg transition-all duration-300 ${
                selectedTab === "yarn" 
                  ? "bg-red-600 text-white shadow-lg shadow-red-200" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-white"
              }`}
            >
              YARN
            </button>
            <button
              onClick={() => {
                setSelectedTab("fabric");
                setSelectedMarket("");
                setSelectedCustomerType("");
              }}
              className={`px-6 py-2 text-xs font-black rounded-lg transition-all duration-300 ${
                selectedTab === "fabric" 
                  ? "bg-red-600 text-white shadow-lg shadow-red-200" 
                  : "text-gray-500 hover:text-gray-900 hover:bg-white"
              }`}
            >
              FABRIC
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Year Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
            <button
              onClick={() => setSelectedYear("")}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                !selectedYear ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              All Time
            </button>
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year === selectedYear ? "" : year)}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                  selectedYear === year ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedMarket}
            onChange={(e) => setSelectedMarket(e.target.value)}
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-red-500 transition-all min-w-[150px]"
          >
            <option value="">All Markets</option>
            {markets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={selectedCustomerType}
            onChange={(e) => setSelectedCustomerType(e.target.value)}
            className="px-4 py-2 text-xs font-bold bg-white border border-gray-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-red-500 transition-all min-w-[150px]"
          >
            <option value="">All Customer Types</option>
            {customerTypes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(selectedMarket || selectedCustomerType || selectedYear) && (
            <button
              onClick={() => {
                setSelectedMarket("");
                setSelectedCustomerType("");
                setSelectedYear(new Date().getFullYear().toString());
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Clear all filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Complaints Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Complaints</p>
              <h2 className="text-3xl font-black text-gray-900">
                {loading ? (
                  <div className="h-9 w-16 bg-gray-100 animate-pulse rounded" />
                ) : (
                  currentStats?.totalComplaints ?? 0
                )}
              </h2>
            </div>
            <div className="text-xs font-bold text-blue-600 flex items-center gap-1">
              Active tracking in progress
            </div>
          </div>
        </div>

        <ComplaintStatusCard 
          selectedYear={selectedYear} 
          selectedTab={selectedTab} 
          filters={{ market: selectedMarket, customer_type: selectedCustomerType }}
        />

        {/* Total Customers Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all group overflow-hidden relative">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Affected Customers</p>
              <h2 className="text-3xl font-black text-gray-900">
                {loading ? (
                  <div className="h-9 w-16 bg-gray-100 animate-pulse rounded" />
                ) : (
                  currentStats?.totalCustomers ?? 0
                )}
              </h2>
            </div>
            <div className="text-xs font-bold text-indigo-600 flex items-center gap-1">
              Unique customer accounts
            </div>
          </div>
        </div>

        <IncompleteDataCard 
          selectedYear={selectedYear} 
          selectedTab={selectedTab} 
          filters={{ market: selectedMarket, customer_type: selectedCustomerType }}
        />
      </div>
      
      {/* Distribution Analysis Section */}
      <ComplaintDistributionCharts 
        selectedYear={selectedYear} 
        selectedTab={selectedTab} 
        filters={{ market: selectedMarket, customer_type: selectedCustomerType }}
      />
      
      {/* Visualizations Section */}
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
              Complaint Trends
            </h3>
          </div>
          <div className="h-[400px] w-full">
            <ComplaintBarChart 
              selectedYear={selectedYear} 
              selectedTab={selectedTab} 
              filters={{ market: selectedMarket, customer_type: selectedCustomerType }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

