import { useState } from "react";
import FabricComplaintTable from "./FabricComplaintTable";
import FabricComplaintChart from "./FabricComplaintChart";

export default function FabricComplaint({ user }: { user: any }) {
  const [activeSubTab, setActiveSubTab] = useState<"table" | "chart">("table");

  /* ===== Shared Filter State ===== */
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

  const filterProps = {
    selectedFilters,
    setSelectedFilters,
    startDate,
    setStartDate,
    endDate,
    setEndDate
  };

  return (
    <div className="p-4">
      {/* Page Header */}
      <h2 className="text-2xl font-bold text-red-600 mb-6">Fabric Complaint</h2>

      {/* Sub Tabs as Cards */}
      <div className="flex gap-4 mb-6">
        {/* Table Card */}
        <div
          onClick={() => setActiveSubTab("table")}
          className={`cursor-pointer border rounded-lg shadow px-4 py-2 transition
            ${
              activeSubTab === "table"
                ? "bg-red-600 border-red-800 shadow-lg text-white"
                : "bg-white border-red-600 hover:bg-red-50 hover:text-red-600"
            }`}
        >
          <h3 className="text-lg font-semibold">Table</h3>
        </div>

        {/* Chart Card */}
        <div
          onClick={() => setActiveSubTab("chart")}
          className={`cursor-pointer border rounded-lg shadow px-4 py-2 transition
            ${
              activeSubTab === "chart"
                ? "bg-red-600 border-red-800 shadow-lg text-white"
                : "bg-white border-red-600 hover:bg-red-50 hover:text-red-600"
            }`}
        >
          <h3 className="text-lg font-semibold">Chart</h3>
        </div>
      </div>

      {/* Content Card */}
      <div className="border rounded-lg shadow p-4 bg-white">
        {activeSubTab === "table" && <FabricComplaintTable user={user} {...filterProps} />}
        {activeSubTab === "chart" && <FabricComplaintChart {...filterProps} />}
      </div>
    </div>
  );
}
