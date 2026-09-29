import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config";
import DispatchTable from "./DispatchTable";
import DispatchChart from "./DispatchChart";
import DispatchDashboard from "./DispatchDashboard";
import MasterUpdateModal from "./MasterUpdateModal";
import DataUploadModal from "./DataUploadModal";
import { useRolePermissions } from "../../hooks/useRolePermissions";

export default function Dispatch({ user }: { user: any }) {
  const permissions = useRolePermissions(user.role);
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [contentType, setContentType] = useState<"table" | "chart">("table");
  const [divisions, setDivisions] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showMasterModal, setShowMasterModal] = useState<{ show: boolean; type: "yarn-count" | "fabric-count" | "market" | "customer" }>({
    show: false,
    type: "yarn-count",
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ completed: number; total: number; percent: number }>({
    completed: 0,
    total: 0,
    percent: 0,
  });

  const handleSyncMasterData = async () => {
    setSyncing(true);
    setSyncProgress({ completed: 0, total: 0, percent: 0 });
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/sync-master-data`, {
        method: "POST",
      });

      if (!response.body) throw new Error("ReadableStream not supported");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "start") {
              setSyncProgress(prev => ({ ...prev, total: data.total }));
            } else if (data.type === "progress") {
              setSyncProgress({
                completed: data.completed,
                total: data.total,
                percent: data.percent,
              });
            } else if (data.type === "complete") {
              alert(data.message);
              setSyncing(false);
            } else if (data.type === "error") {
              alert("Error: " + data.error);
              setSyncing(false);
            }
          } catch (e) {
            console.error("Failed to parse progress line:", line, e);
          }
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
      alert("An error occurred while syncing data.");
      setSyncing(false);
    }
  };

  /* ===== Shared Filter State ===== */
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  
  // Date range filter for Table (Last 7 days)
  const [tableStartDate, setTableStartDate] = useState<string>(() => {
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);
    return lastWeek.toLocaleDateString('en-CA');
  });
  const [tableEndDate, setTableEndDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA');
  });

  // Date range filter for Chart (Current Year)
  const [chartStartDate, setChartStartDate] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-01-01`;
  });
  const [chartEndDate, setChartEndDate] = useState<string>(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-12-31`;
  });

  const getFilterProps = (isChart: boolean) => ({
    selectedFilters,
    setSelectedFilters,
    startDate: isChart ? chartStartDate : tableStartDate,
    setStartDate: isChart ? setChartStartDate : setTableStartDate,
    endDate: isChart ? chartEndDate : tableEndDate,
    setEndDate: isChart ? setChartEndDate : setTableEndDate,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [divRes, dateRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/unique-values/dispatch_data/division_description`),
          fetch(`${API_BASE_URL}/api/max-date/dispatch_data/billing_date`)
        ]);
        
        const divJson = await divRes.json();
        const dateJson = await dateRes.json();

        if (divJson.success) {
          setDivisions(divJson.data);
        }
        
        if (dateJson.success && dateJson.data) {
          const date = new Date(dateJson.data);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          setLastUpdated(`${day}.${month}.${year}`);
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-red-700">Dispatch Details</h2>
        {lastUpdated && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-bold text-red-700">
              Last updated data on <span className="font-black underline decoration-red-200 underline-offset-2">{lastUpdated}</span>
            </span>
          </div>
        )}
      </div>
      
      {/* Main Tabs (Dashboard, Divisions, Update Data) */}
      <div className="flex space-x-4 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("Dashboard")}
          className={`pb-2 px-4 font-semibold capitalize whitespace-nowrap transition-colors ${
            activeTab === "Dashboard"
              ? "text-red-700 border-b-2 border-red-700"
              : "text-gray-500 hover:text-red-600"
          }`}
        >
          Dashboard
        </button>

        {!loading && divisions.map((division) => (
          <button
            key={division}
            onClick={() => setActiveTab(division)}
            className={`pb-2 px-4 font-semibold capitalize whitespace-nowrap transition-colors ${
              activeTab === division
                ? "text-red-700 border-b-2 border-red-700"
                : "text-gray-500 hover:text-red-600"
            }`}
          >
            {division}
          </button>
        ))}

        {loading && (
          <div className="pb-2 text-gray-400 italic text-sm">Loading divisions...</div>
        )}

        {permissions.canUpload && (
          <button
            onClick={() => setActiveTab("Update Data")}
            className={`pb-2 px-4 font-semibold capitalize whitespace-nowrap transition-colors ${
              activeTab === "Update Data"
                ? "text-red-700 border-b-2 border-red-700"
                : "text-gray-500 hover:text-red-600"
            }`}
          >
            Update Data
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {activeTab === "Dashboard" ? (
          <DispatchDashboard {...getFilterProps(true)} />
        ) : activeTab === "Update Data" ? (
          <div className="min-h-[600px] flex flex-col items-start justify-start p-8 gap-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            {/* Section 1: Update Master Data */}
            <div className="flex flex-col gap-4 w-full">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Update Master Data</h3>
              <div className="flex flex-wrap justify-start gap-4">
                <button
                  onClick={() => setShowMasterModal({ show: true, type: "yarn-count" })}
                  className="px-6 py-2.5 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 transition-all shadow-sm active:scale-95"
                >
                  Update Yarn Count
                </button>
                <button
                  onClick={() => setShowMasterModal({ show: true, type: "fabric-count" })}
                  className="px-6 py-2.5 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 transition-all shadow-sm active:scale-95"
                >
                  Fabric Count
                </button>
                <button
                  onClick={() => setShowMasterModal({ show: true, type: "market" })}
                  className="px-6 py-2.5 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 transition-all shadow-sm active:scale-95"
                >
                  Market
                </button>
                <button
                  onClick={() => setShowMasterModal({ show: true, type: "customer" })}
                  className="px-6 py-2.5 bg-red-700 text-white font-medium rounded-lg hover:bg-red-800 transition-all shadow-sm active:scale-95"
                >
                  Customer Name
                </button>
              </div>
            </div>

            {/* Section 2: Update Dispatch Master Data */}
            <div className="flex flex-col gap-4 w-full">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Update Dispatch Master Data</h3>
              <div className="flex flex-wrap justify-start gap-4">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  Upload
                </button>
                <button
                  onClick={handleSyncMasterData}
                  disabled={syncing}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-sm active:scale-95 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                  )}
                  Update Count/Market/Customer
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Content Sub-tabs (Table/Chart) - Only for Division tabs */}
            <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg self-start">
              <button
                onClick={() => setContentType("table")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  contentType === "table"
                    ? "bg-white text-red-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setContentType("chart")}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  contentType === "chart"
                    ? "bg-white text-red-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Chart
              </button>
            </div>

            {/* Render Division Content */}
            <div className="min-h-[600px]">
              {contentType === "table" ? (
                <DispatchTable user={user} division={activeTab} {...getFilterProps(false)} />
              ) : (
                <DispatchChart division={activeTab} {...getFilterProps(true)} />
              )}
            </div>
          </>
        )}
      </div>

      {!loading && divisions.length === 0 && activeTab !== "Dashboard" && activeTab !== "Update Data" && (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          No divisions found in dispatch data.
        </div>
      )}

      {showMasterModal.show && (
        <MasterUpdateModal
          type={showMasterModal.type}
          onClose={() => setShowMasterModal({ ...showMasterModal, show: false })}
        />
      )}

      {showUploadModal && (
        <DataUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={() => {
            // Optionally refresh divisions or data if needed
            window.location.reload(); 
          }}
        />
      )}

      {syncing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-gray-100 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-blue-600 stroke-current transition-all duration-500 ease-out"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * syncProgress.percent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-blue-700">{syncProgress.percent}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-gray-900">Updating Dispatch Data</h3>
              <p className="text-gray-500 font-medium">
                Processed <span className="text-blue-600 font-bold">{syncProgress.completed}</span> of <span className="font-bold">{syncProgress.total}</span> mappings
              </p>
            </div>

            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                style={{ width: `${syncProgress.percent}%` }}
              ></div>
            </div>

            <p className="text-xs text-gray-400 italic">Please do not close this tab while the update is in progress...</p>
          </div>
        </div>
      )}
    </div>
  );
}
