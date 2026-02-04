import { useState } from "react";
import Home from "./pages/Home";
import Complaint from "./pages/complaint/Complaint";
import Dispatch from "./pages/dispatch/Dispatch";
import DispatchResults from "./pages/dispatch-results/DispatchResults";

function App() {
  const [activeTab, setActiveTab] = useState<
    "home" | "complaint" | "dispatch" | "dispatch-results"
  >("home");
  const [showComplaintTab, setShowComplaintTab] = useState(false);
  const [showDispatchTab, setShowDispatchTab] = useState(false);
  const [showDispatchResultsTab, setShowDispatchResultsTab] = useState(false);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="py-4 border-b border-red-200">
        <h1 className="text-center text-3xl font-bold text-red-700">
          Quality Dashboard
        </h1>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-56 bg-white shadow-md p-4 space-y-2">
          <SidebarButton
            label="Home"
            active={activeTab === "home"}
            onClick={() => {
              setActiveTab("home");
              setShowComplaintTab(false);
              setShowDispatchTab(false);
              setShowDispatchResultsTab(false);
            }}
          />
          {showComplaintTab && (
            <SidebarButton
              label="Complaint"
              active={activeTab === "complaint"}
              onClick={() => setActiveTab("complaint")}
            />
          )}
          {showDispatchTab && (
            <SidebarButton
              label="Dispatch"
              active={activeTab === "dispatch"}
              onClick={() => setActiveTab("dispatch")}
            />
          )}
          {showDispatchResultsTab && (
            <SidebarButton
              label="Dispatch Results"
              active={activeTab === "dispatch-results"}
              onClick={() => setActiveTab("dispatch-results")}
            />
          )}
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 border-l-4 border-red-600 bg-white">
          {activeTab === "home" && (
            <Home
              onOpenComplaint={() => {
                setShowComplaintTab(true);
                setActiveTab("complaint");
              }}
              onOpenDispatch={() => {
                setShowDispatchTab(true);
                setActiveTab("dispatch");
              }}
              onOpenResults={() => {
                setShowDispatchResultsTab(true);
                setActiveTab("dispatch-results");
              }}
            />
          )}

          {activeTab === "complaint" && <Complaint />}
          {activeTab === "dispatch" && <Dispatch />}
          {activeTab === "dispatch-results" && <DispatchResults />}
        </main>
      </div>
    </div>
  );
}

export default App;

/* ---------- Components ---------- */

function SidebarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 rounded font-semibold transition
        ${active ? "bg-red-600 text-white" : "text-red-700 hover:bg-red-100"}`}
    >
      {label}
    </button>
  );
}
