import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { API_BASE_URL } from "../../config";

type YarnComplaint = Record<string, string | number | boolean | null>;
type FabricComplaint = Record<string, string | number | boolean | null>;

const YARN_TABLE = "yarn_complaints";
const FABRIC_TABLE = "fabric_complaints";

const DROPDOWN_COLUMNS = [
  "status", "customer_name", "bill_to_region", "market", "count", "unit_no",
  "complaint_type", "customer_type", "department", "customer_complaint",
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

export default function IncompleteDataCard({ 
  selectedYear,
  selectedTab = "yarn",
  filters = {}
}: { 
  selectedYear?: string;
  selectedTab?: "yarn" | "fabric";
  filters?: Record<string, string>;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableData, setTableData] = useState<(YarnComplaint | FabricComplaint)[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<YarnComplaint | FabricComplaint | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<Record<string, string[]>>({});
  const [marketMappings, setMarketMappings] = useState<any[]>([]);

  const fetchIncompleteCount = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const url = `${API_BASE_URL}/api/complaint-stats?${params.toString()}`;
      const res = await fetch(url);
      const json = await res.json();

      if (json.success) {
        setCount(selectedTab === "yarn" ? json.data.yarn.incomplete : json.data.fabric.incomplete);
      }
    } catch (err) {
      console.error("Failed to fetch incomplete count", err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedTab, filters]);

  const fetchIncompleteData = async () => {
    setTableLoading(true);
    try {
      const endpoint = selectedTab === "yarn" ? "yarn-complaints" : "fabric-complaints";
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
      const json = await res.json();
      if (json.success) {
        const incomplete = json.data.filter((row: Record<string, string | number | boolean | null | undefined>) => {
          return Object.entries(row).some(([key, value]) => {
            if (["id", "created_at", "action_taken", "remark", "complaint_qty", "analysis_and_outcome", "reply_date", "mfg_date", "mfg_month", "cotton", "complaint_mode", "nature_of_complaint"].includes(key)) return false;
            return value === null || value === "" || value === undefined;
          });
        });
        setTableData(incomplete);
      }
    } catch (err) {
      console.error("Failed to fetch table data", err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchDropdownOptions = useCallback(async () => {
    try {
      const results: Record<string, string[]> = {};
      const tableName = selectedTab === "yarn" ? YARN_TABLE : FABRIC_TABLE;
      
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
  }, [selectedTab]);

  useEffect(() => {
    fetchIncompleteCount();
  }, [fetchIncompleteCount]);

  const handleClick = () => {
    fetchIncompleteData();
    fetchDropdownOptions();
    setShowTableModal(true);
  };

  const handleDelete = async (id: number | string) => {
    if (!window.confirm("Are you sure you want to delete this complaint?")) return;
    
    try {
      const endpoint = selectedTab === "yarn" ? "yarn-complaints" : "fabric-complaints";
      const res = await fetch(`${API_BASE_URL}/api/${endpoint}/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setTableData(prev => prev.filter(r => r.id !== id));
        fetchIncompleteCount();
      } else {
        throw new Error(json.error || "Failed to delete");
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const allColumns = useMemo(() => {
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]).filter(c => c !== "id" && c !== "created_at");
  }, [tableData]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-100 transition-all group overflow-hidden relative">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-150 transition-transform duration-500" />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Incomplete Data</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl font-black text-gray-900">
              {loading ? <div className="h-9 w-12 bg-gray-100 animate-pulse rounded" /> : count}
            </h2>
            <span className="text-xs font-bold text-orange-600 px-2 py-0.5 bg-orange-50 rounded-full">Requires Attention</span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Category</span>
            <span className="text-sm font-black text-gray-700">{selectedTab === "yarn" ? "Yarn" : "Fabric"}</span>
          </div>
          <button 
            onClick={handleClick}
            className="px-3 py-1.5 bg-gray-900 text-white text-[10px] font-black rounded-lg hover:bg-orange-600 transition-colors shadow-sm"
          >
            FIX RECORDS
          </button>
        </div>
      </div>

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[50] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-800">Incomplete Data - {selectedTab === "yarn" ? "Yarn" : "Fabric"}</h3>
              <button onClick={() => setShowTableModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {tableLoading ? (
                <div className="flex justify-center py-20 text-gray-500">Loading incomplete data...</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Query Receive Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Unit</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Customer Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Count</th>
                      {selectedTab === "fabric" && <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Fabric Lot No</th>}
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Yarn Lot No</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Customer Type</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tableData.length > 0 ? (
                      tableData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{row.query_received_date ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.unit_no ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.customer_name ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.count ?? "-"}</td>
                          {selectedTab === "fabric" && <td className="px-4 py-3 text-sm text-gray-700">{row.fabric_lot_no ?? "-"}</td>}
                          <td className="px-4 py-3 text-sm text-gray-700">{row.yarn_lot_no ?? "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{row.customer_type ?? "-"}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => {
                                  setEditingRow({ ...row });
                                  setShowEditModal(true);
                                }}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDelete(row.id as number | string)}
                                className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={selectedTab === "fabric" ? 8 : 7} className="px-4 py-10 text-center text-gray-500 italic">No incomplete data found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
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
                  const endpoint = selectedTab === "yarn" ? "yarn-complaints" : "fabric-complaints";
                  const res = await fetch(`${API_BASE_URL}/api/${endpoint}/${editingRow.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editingRow),
                  });
                  const json = await res.json();
                  if (json.success) {
                    setTableData(prev => prev.map(r => r.id === editingRow.id ? json.data : r));
                    fetchIncompleteCount();
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

                  const requiredFields = selectedTab === "yarn" 
                    ? ["query_received_date", "status", "customer_name", "customer_type"]
                    : ["query_received_date", "status", "customer_name", "customer_type"];

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
                      rows={3}
                      value={(editingRow[col] ?? "") as string}
                      onChange={(e) => setEditingRow({ ...editingRow, [col]: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none"
                      placeholder={`Enter ${col.replaceAll("_", " ")}...`}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
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
