import { useState, useEffect } from "react";
import YarnComplaint from "./YarnComplaint";
import FabricComplaint from "./FabricComplaint";
import ComplaintDashboard from "./ComplaintDashboard";
import { API_BASE_URL } from "../../config";

export default function Complaint() {
  const [subTab, setSubTab] = useState<"dashboard" | "yarn" | "fabric">(
    "dashboard"
  );
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const fetchLastUpdated = async () => {
      try {
        const [yarnRes, fabricRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/max-date/yarn_complaints/created_at`),
          fetch(`${API_BASE_URL}/api/max-date/fabric_complaints/created_at`)
        ]);
        const yarnJson = await yarnRes.json();
        const fabricJson = await fabricRes.json();

        let latestDate: Date | null = null;
        if (yarnJson.success && yarnJson.data) {
          latestDate = new Date(yarnJson.data);
        }
        if (fabricJson.success && fabricJson.data) {
          const fabricDate = new Date(fabricJson.data);
          if (!latestDate || fabricDate > latestDate) {
            latestDate = fabricDate;
          }
        }

        if (latestDate) {
          const day = String(latestDate.getDate()).padStart(2, '0');
          const month = String(latestDate.getMonth() + 1).padStart(2, '0');
          const year = latestDate.getFullYear();
          setLastUpdated(`${day}.${month}.${year}`);
        }
      } catch (err) {
        console.error("Failed to fetch last updated date", err);
      }
    };
    fetchLastUpdated();
  }, []);

  return (
    <div>
      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b mb-4">
        <div className="flex space-x-4">
          {["dashboard", "yarn", "fabric"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as "dashboard" | "yarn" | "fabric")}
              className={`pb-2 font-semibold capitalize ${
                subTab === tab
                  ? "text-red-700 border-b-2 border-red-700"
                  : "text-gray-500 hover:text-red-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {lastUpdated && (
          <div className="text-sm font-bold text-red-600 pb-2">
            Last updated data on {lastUpdated}
          </div>
        )}
      </div>

      {/* Sub Tab Content */}
      {subTab === "yarn" && <YarnComplaint />}
      {subTab === "fabric" && <FabricComplaint />}
      {subTab === "dashboard" && <ComplaintDashboard />}
    </div>
  );
}
