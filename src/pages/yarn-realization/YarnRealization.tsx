import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config";
import { type Role } from "../../hooks/useRolePermissions";
import YarnRealizationDashboard from "./YarnRealizationDashboard";
import YarnRealizationDetailed from "./YarnRealizationDetailed";
import YarnRealizationComparison from "./YarnRealizationComparison";
import YarnRealizationAddModal from "./YarnRealizationAddModal";

export interface YarnRealizationData {
  id: number;
  date: string;
  unit: string;
  yarn_realization: number | null;
  contaminated_cotton: number | null;
  br_dropping: number | null;
  card_dropping: number | null;
  flat_waste: number | null;
  micro_dust: number | null;
  cotton_seeds: number | null;
  upto_card_waste?: number;
  comber_noil: number | null;
  comber_noil_on_feed: number | null;
  hard_waste: number | null;
  other_waste?: number;
  invisible_loss: number | null;
  overall_waste: number | null;
  period: string | null;
}

interface User {
  role: Role;
  full_name: string;
}

const YarnRealization: React.FC<{ user: User }> = () => {
  const [data, setData] = useState<YarnRealizationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly");
  const [activeTab, setActiveTab] = useState<"dashboard" | "detailed" | "comparison">("dashboard");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const units = Array.from(new Set(data.map(item => item.unit))).sort();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/yarn-realization`);
      const result = await response.json();
      if (result.success) {
        const enrichedData = result.data.map((item: any) => {
          const overall_waste = item.yarn_realization !== null 
            ? Number((100 - Number(item.yarn_realization)).toFixed(2)) 
            : null;

          const upto_card_waste = Number((
            Number(item.contaminated_cotton || 0) + 
            Number(item.br_dropping || 0) + 
            Number(item.card_dropping || 0) + 
            Number(item.flat_waste || 0) + 
            Number(item.micro_dust || 0) + 
            Number(item.cotton_seeds || 0)
          ).toFixed(2));
          
          const other_waste = overall_waste !== null ? Number((
            overall_waste - 
            upto_card_waste - 
            Number(item.comber_noil || 0) - 
            Number(item.hard_waste || 0) - 
            Number(item.invisible_loss || 0)
          ).toFixed(2)) : 0;

          return {
            ...item,
            overall_waste,
            upto_card_waste,
            other_waste
          };
        });
        setData(enrichedData);
      } else {
        setError("Failed to fetch yarn realization data");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  };

  const formatUnit = (unit: string) => {
    if (/^[A-Z][a-z]{2}-\d{2}$/.test(unit)) return unit;
    if (unit === "6 Cotton 3") return "U-6 Cotton";
    if (!isNaN(Number(unit))) return `U-${unit}`;
    return unit.startsWith("U-") ? unit : `U-${unit}`;
  };

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00c49f'];

  if (loading) return <div className="p-8">Loading yarn realization data...</div>;
  if (error) return <div className="p-8 text-red-600 font-medium">{error}</div>;
  if (data.length === 0) return <div className="p-8 text-gray-600 text-center">No yarn realization data available.</div>;

  const latestDateStr = data.filter(item => item.period?.toLowerCase() === selectedPeriod.toLowerCase())[0]?.date;
  const latestInfo = data.find(item => item.date === latestDateStr && item.period?.toLowerCase() === selectedPeriod.toLowerCase());

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-4 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-red-700">Yarn Realization</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
            {["monthly", "fornightly"].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                  ${selectedPeriod === period 
                    ? "bg-red-600 text-white shadow-md" 
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}
              >
                {period === "fornightly" ? "Fortnightly" : "Monthly"}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchData}
            className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition flex items-center gap-2 shadow-sm font-bold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            Refresh Data
          </button>
        </div>
      </div>

      {/* Card-style Tabs & Info Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex gap-4">
          <div
            onClick={() => setActiveTab("dashboard")}
            className={`cursor-pointer border rounded-xl shadow-sm px-6 py-3 transition-all min-w-[150px] text-center
              ${
                activeTab === "dashboard"
                  ? "bg-red-600 border-red-700 shadow-md text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
              }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider">Dashboard</h3>
          </div>

          <div
            onClick={() => setActiveTab("detailed")}
            className={`cursor-pointer border rounded-xl shadow-sm px-6 py-3 transition-all min-w-[150px] text-center
              ${
                activeTab === "detailed"
                  ? "bg-red-600 border-red-700 shadow-md text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
              }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider">Detailed</h3>
          </div>

          <div
            onClick={() => setActiveTab("comparison")}
            className={`cursor-pointer border rounded-xl shadow-sm px-6 py-3 transition-all min-w-[150px] text-center
              ${
                activeTab === "comparison"
                  ? "bg-red-600 border-red-700 shadow-md text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600"
              }`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider">Comparison</h3>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center bg-red-600 text-white p-3 rounded-xl shadow-md hover:bg-red-700 transition-all border border-red-700"
            title="Add New Entry"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        {latestInfo && (
          <p className="text-gray-500 font-medium text-sm">
            Period: <span className="text-gray-800 capitalize font-bold">{latestInfo.period}</span> | 
            Last Updated: <span className="text-gray-800 font-bold">{new Date(latestInfo.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-')}</span>
          </p>
        )}
      </div>

      {activeTab === "dashboard" ? (
        <YarnRealizationDashboard 
          data={data} 
          selectedPeriod={selectedPeriod} 
          formatUnit={formatUnit} 
          COLORS={COLORS} 
        />
      ) : activeTab === "detailed" ? (
        <YarnRealizationDetailed 
          data={data} 
          selectedPeriod={selectedPeriod} 
          formatUnit={formatUnit} 
          onRefresh={fetchData}
        />
      ) : (
        <YarnRealizationComparison
          data={data}
          formatUnit={formatUnit}
        />
      )}

      {isAddModalOpen && (
        <YarnRealizationAddModal
          onClose={() => setIsAddModalOpen(false)}
          onUpdate={fetchData}
          units={units}
          formatUnit={formatUnit}
        />
      )}
    </div>
  );
};

export default YarnRealization;
