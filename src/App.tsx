import { useState, useEffect } from "react";
import Home from "./pages/Home";
import Complaint from "./pages/complaint/Complaint";
import Dispatch from "./pages/dispatch/Dispatch";
import DispatchResults from "./pages/dispatch-results/DispatchResults";
import Cotton from "./pages/cotton/Cotton";
import CottonMixing from "./pages/cotton/CottonMixing";
import CottonPlanning from "./pages/cotton/CottonPlanning";
import CottonDistribution from "./pages/cotton/CottonDistribution";
import Users from "./pages/Users";
import Login from "./components/Login";
import { API_BASE_URL } from "./config";

function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "home" | "complaint" | "dispatch" | "dispatch-results" | "cotton" | "cotton-mixing" | "cotton-planning" | "cotton-distribution" | "users"
  >("home");
  const [showComplaintTab, setShowComplaintTab] = useState(false);
  const [showDispatchTab, setShowDispatchTab] = useState(false);
  const [showDispatchResultsTab, setShowDispatchResultsTab] = useState(false);
  const [showCottonTab, setShowCottonTab] = useState(false);
  const [showCottonMixingTab, setShowCottonMixingTab] = useState(false);
  const [showCottonPlanningTab, setShowCottonPlanningTab] = useState(false);
  const [showCottonDistributionTab, setShowCottonDistributionTab] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleRestartBackend = async (isAuto = false) => {
    try {
      if (!isAuto) setRestarting(true);
      const res = await fetch(`${API_BASE_URL}/api/restart-service`, { method: "POST" });
      const json = await res.json();
      
      if (json.success) {
        if (!isAuto) alert("Backend restart triggered successfully. The server is restarting...");
        else console.log("Auto-restart triggered");
      } else {
        if (!isAuto) alert(`Failed to restart: ${json.error}`);
      }
    } catch (err) {
      console.error("Restart error:", err);
      if (!isAuto) alert("An error occurred while restarting the backend.");
    } finally {
      if (!isAuto) setRestarting(false);
    }
  };

  useEffect(() => {
    const hasTriggered = sessionStorage.getItem("backend_restart_triggered");
    if (!hasTriggered) {
      handleRestartBackend(true);
      sessionStorage.setItem("backend_restart_triggered", "true");
    }
  }, []);

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="py-4 border-b border-red-200 relative">
        <h1 className="text-center text-3xl font-bold text-red-700">
          Quality Dashboard
        </h1>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800">{user.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Logout"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
          <button
            onClick={() => handleRestartBackend(false)}
            disabled={restarting}
            className={`p-2 rounded-full border border-red-100 transition-all duration-300 ${
              restarting 
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-white text-red-600 hover:bg-red-50 hover:border-red-200 hover:shadow-sm shadow-xs"
            }`}
            title="Restart Backend Service"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className={restarting ? "animate-spin" : ""}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`${
            isSidebarVisible ? "w-56" : "w-16"
          } bg-white shadow-md p-4 flex flex-col transition-all duration-300 ease-in-out z-10`}
        >
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="mb-4 p-2 self-start rounded-lg hover:bg-red-50 text-red-700 transition-colors"
            title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div className={`${isSidebarVisible ? "opacity-100" : "opacity-0 pointer-events-none"} transition-opacity duration-200 space-y-2`}>
            <SidebarButton
              label="Home"
              active={activeTab === "home"}
              onClick={() => {
                setActiveTab("home");
                setShowComplaintTab(false);
                setShowDispatchTab(false);
                setShowDispatchResultsTab(false);
                setShowCottonTab(false);
                setShowCottonMixingTab(false);
                setShowCottonPlanningTab(false);
                setShowCottonDistributionTab(false);
              }}
            />
            {user.role === "Admin" && (
              <SidebarButton
                label="Users"
                active={activeTab === "users"}
                onClick={() => {
                  setActiveTab("users");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showCottonTab && (
              <SidebarButton
                label="Cotton Details"
                active={activeTab === "cotton"}
                onClick={() => {
                  setActiveTab("cotton");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showCottonMixingTab && (
              <SidebarButton
                label="Cotton Mixing"
                active={activeTab === "cotton-mixing"}
                onClick={() => {
                  setActiveTab("cotton-mixing");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showCottonPlanningTab && (
              <SidebarButton
                label="Cotton Planning"
                active={activeTab === "cotton-planning"}
                onClick={() => {
                  setActiveTab("cotton-planning");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showCottonDistributionTab && (
              <SidebarButton
                label="Cotton Distribution"
                active={activeTab === "cotton-distribution"}
                onClick={() => {
                  setActiveTab("cotton-distribution");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showComplaintTab && (
              <SidebarButton
                label="Complaint"
                active={activeTab === "complaint"}
                onClick={() => {
                  setActiveTab("complaint");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showDispatchTab && (
              <SidebarButton
                label="Dispatch"
                active={activeTab === "dispatch"}
                onClick={() => {
                  setActiveTab("dispatch");
                  setIsSidebarVisible(false);
                }}
              />
            )}
            {showDispatchResultsTab && (
              <SidebarButton
                label="Dispatch Results"
                active={activeTab === "dispatch-results"}
                onClick={() => {
                  setActiveTab("dispatch-results");
                  setIsSidebarVisible(false);
                }}
              />
            )}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-6 border-l-4 border-red-600 bg-white overflow-auto">
          {activeTab === "home" && (
            <Home
              user={user}
              onOpenCotton={() => {
                setShowCottonTab(true);
                setActiveTab("cotton");
                setIsSidebarVisible(false);
              }}
              onOpenComplaint={() => {
                setShowComplaintTab(true);
                setActiveTab("complaint");
                setIsSidebarVisible(false);
              }}
              onOpenDispatch={() => {
                setShowDispatchTab(true);
                setActiveTab("dispatch");
                setIsSidebarVisible(false);
              }}
              onOpenResults={() => {
                setShowDispatchResultsTab(true);
                setActiveTab("dispatch-results");
                setIsSidebarVisible(false);
              }}
            />
          )}

          {activeTab === "cotton" && (
            <Cotton
              user={user}
              onOpenMixing={() => {
                setShowCottonMixingTab(true);
                setActiveTab("cotton-mixing");
                setIsSidebarVisible(false);
              }}
              onOpenPlanning={() => {
                setShowCottonPlanningTab(true);
                setActiveTab("cotton-planning");
                setIsSidebarVisible(false);
              }}
              onOpenDistribution={() => {
                setShowCottonDistributionTab(true);
                setActiveTab("cotton-distribution");
                setIsSidebarVisible(false);
              }}
            />
          )}
          {activeTab === "cotton-mixing" && (
            <CottonMixing user={user} onBack={() => setActiveTab("cotton")} />
          )}
          {activeTab === "cotton-planning" && (
            <CottonPlanning user={user} onBack={() => setActiveTab("cotton")} />
          )}
          {activeTab === "cotton-distribution" && (
            <CottonDistribution user={user} onBack={() => setActiveTab("cotton")} />
          )}
          {activeTab === "complaint" && <Complaint user={user} />}
          {activeTab === "dispatch" && <Dispatch user={user} />}
          {activeTab === "dispatch-results" && <DispatchResults user={user} />}
          {activeTab === "users" && <Users user={user} />}
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
