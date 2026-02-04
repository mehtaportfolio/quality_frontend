import { useState, useEffect } from "react";
import { API_BASE_URL } from "../../config";

interface MasterUpdateModalProps {
  type: "yarn-count" | "fabric-count" | "market" | "customer";
  onClose: () => void;
}

export default function MasterUpdateModal({ type, onClose }: MasterUpdateModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [blendSuggestions, setBlendSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<number, any>>({});

  const isCount = type === "yarn-count" || type === "fabric-count";
  const title = type === "yarn-count" ? "Update Yarn Count" : type === "fabric-count" ? "Update Fabric Count" : type === "market" ? "Update Market" : "Update Customer";
  const label = isCount ? "Item Description" : type === "market" ? "Ship To City" : "Bill To Customer";
  const fieldToUpdate = isCount ? "smpl_count" : type === "market" ? "market" : "customer_name";
  const displayField = isCount ? "item_description" : type === "market" ? "ship_to_city" : "bill_to_customer";
  const updateType = isCount ? "count" : type; // For the PUT endpoint base

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoints = [
        fetch(`${API_BASE_URL}/api/master/pending-${type}`),
        fetch(`${API_BASE_URL}/api/master/suggestions/${updateType}`)
      ];
      
      if (isCount) {
        endpoints.push(fetch(`${API_BASE_URL}/api/master/suggestions/blend`));
      }

      const responses = await Promise.all(endpoints);
      const pendingJson = await responses[0].json();
      const suggestionsJson = await responses[1].json();

      if (pendingJson.success) setData(pendingJson.data);
      if (suggestionsJson.success) setSuggestions(suggestionsJson.data);
      
      if (isCount && responses[2]) {
        const blendJson = await responses[2].json();
        if (blendJson.success) setBlendSuggestions(blendJson.data);
      }
      
      setPendingChanges({});
    } catch (err) {
      console.error(`Failed to fetch ${type} data:`, err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/master/refresh-${type}`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      }
    } catch (err) {
      console.error(`Failed to refresh ${type}:`, err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBulkUpdate = async () => {
    const entries = Object.entries(pendingChanges).filter(([_, val]) => {
      if (typeof val === 'string') return val.trim() !== "";
      return Object.values(val).some(v => typeof v === 'string' && v.trim() !== "");
    });
    
    if (entries.length === 0) return;

    setSaving(true);
    try {
      const results = await Promise.all(
        entries.map(([id, value]) =>
          fetch(`${API_BASE_URL}/api/master/${updateType}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(isCount ? value : { [fieldToUpdate]: value }),
          }).then(res => res.json())
        )
      );

      const allSuccess = results.every(r => r.success);
      if (allSuccess) {
        const updatedIds = entries.map(([id]) => Number(id));
        setData(prev => prev.filter(item => !updatedIds.includes(item.id)));
        setPendingChanges({});
        
        // Update suggestions with new values
        const newValues: string[] = [];
        entries.forEach(([_, val]) => {
          if (typeof val === 'string') newValues.push(val);
          else Object.values(val).forEach(v => typeof v === 'string' && newValues.push(v));
        });
        setSuggestions(prev => [...new Set([...prev, ...newValues])].sort());
      }
    } catch (err) {
      console.error(`Failed to save changes:`, err);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (id: number, value: string, field?: string) => {
    setPendingChanges(prev => {
      if (isCount && field) {
        return {
          ...prev,
          [id]: { ...(prev[id] || {}), [field]: value }
        };
      }
      return { ...prev, [id]: value };
    });
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-all ${refreshing ? "animate-spin text-red-600" : "text-gray-500"}`}
              title="Refresh List"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 italic">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              Loading data...
            </div>
          ) : data.length > 0 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-4 px-3 mb-2 border-b border-gray-50 pb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider w-8">#</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-1">{label}</span>
                {isCount ? (
                  <>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider w-[140px]">Count</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider w-[140px]">Blend</span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider w-[180px]">New Value</span>
                )}
              </div>
              {data.map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-red-200 transition-all group">
                  <span className="text-xs font-bold text-gray-400 w-8">{index + 1}</span>
                  <span className="text-sm font-medium text-gray-700 truncate flex-1 min-w-0 whitespace-nowrap" title={item[displayField]}>
                    {item[displayField]}
                  </span>
                  
                  {isCount ? (
                    <>
                      <div className="relative w-[140px] flex-shrink-0">
                        <input
                          list={`suggestions-count`}
                          type="text"
                          value={pendingChanges[item.id]?.smpl_count || ""}
                          onChange={(e) => handleInputChange(item.id, e.target.value, "smpl_count")}
                          placeholder="Count..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 transition-all"
                          disabled={saving}
                        />
                        <datalist id={`suggestions-count`}>
                          {suggestions.map((s, idx) => (
                            <option key={idx} value={s} />
                          ))}
                        </datalist>
                      </div>
                      <div className="relative w-[140px] flex-shrink-0">
                        <input
                          list={`suggestions-blend`}
                          type="text"
                          value={pendingChanges[item.id]?.blend || ""}
                          onChange={(e) => handleInputChange(item.id, e.target.value, "blend")}
                          placeholder="Blend..."
                          className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 transition-all"
                          disabled={saving}
                        />
                        <datalist id={`suggestions-blend`}>
                          {blendSuggestions.map((s, idx) => (
                            <option key={idx} value={s} />
                          ))}
                        </datalist>
                      </div>
                    </>
                  ) : (
                    <div className="relative w-[180px] flex-shrink-0">
                      <input
                        list={`suggestions-${type}`}
                        type="text"
                        value={pendingChanges[item.id] || ""}
                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                        placeholder={`Enter ${type}...`}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-red-500 transition-all"
                        disabled={saving}
                      />
                      <datalist id={`suggestions-${type}`}>
                        {suggestions.map((s, idx) => (
                          <option key={idx} value={s} />
                        ))}
                      </datalist>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p className="font-medium text-gray-500">All caught up!</p>
              <p className="text-sm">No pending items found.</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkUpdate}
            disabled={saving || Object.keys(pendingChanges).length === 0}
            className="px-8 py-2 bg-red-700 text-white font-bold rounded-lg hover:bg-red-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-100"
          >
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
