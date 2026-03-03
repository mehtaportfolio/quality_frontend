import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../config";
import { type YarnRealizationData } from "./YarnRealization";

interface YarnRealizationAddModalProps {
  onClose: () => void;
  onUpdate: () => void;
  units: string[];
  formatUnit: (unit: string) => string;
}

const YarnRealizationAddModal: React.FC<YarnRealizationAddModalProps> = ({ onClose, onUpdate, units, formatUnit }) => {
  const [formData, setFormData] = useState<Partial<YarnRealizationData>>({
    date: new Date().toISOString().split('T')[0],
    unit: units[0] || "",
    period: "monthly",
    yarn_realization: null,
    contaminated_cotton: null,
    br_dropping: null,
    card_dropping: null,
    flat_waste: null,
    micro_dust: null,
    cotton_seeds: null,
    comber_noil: null,
    comber_noil_on_feed: null,
    hard_waste: null,
    invisible_loss: null,
    overall_waste: null,
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newVal = type === "number" ? (value === "" ? null : parseFloat(value)) : value;

    setFormData(prev => {
      const updated = { ...prev, [name]: newVal };
      if (name === "yarn_realization") {
        updated.overall_waste = newVal !== null ? Number((100 - Number(newVal)).toFixed(2)) : null;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const { overall_waste, ...dataToSend } = formData;
      const response = await fetch(`${API_BASE_URL}/api/yarn-realization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        setError(result.error || "Failed to add record");
      }
    } catch (err) {
      console.error("Add error:", err);
      setError("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError("");

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      if (jsonData.length === 0) {
        throw new Error("Excel file is empty");
      }

      // Map Excel data to our format
      const mappedData = jsonData.map(row => ({
        date: row.Date || row.date,
        unit: String(row.Unit || row.unit),
        period: String(row.Period || row.period || "monthly").toLowerCase(),
        yarn_realization: row["Yarn Realization"] || row.yarn_realization || null,
        contaminated_cotton: row["Contaminated Cotton"] || row.contaminated_cotton || null,
        br_dropping: row["BR Dropping"] || row.br_dropping || null,
        card_dropping: row["Card Dropping"] || row.card_dropping || null,
        flat_waste: row["Flat Waste"] || row.flat_waste || null,
        micro_dust: row["Micro Dust"] || row.micro_dust || null,
        cotton_seeds: row["Cotton Seeds"] || row.cotton_seeds || null,
        comber_noil: row["Comber Noil"] || row.comber_noil || null,
        comber_noil_on_feed: row["Comber Noil on Feed"] || row.comber_noil_on_feed || null,
        hard_waste: row["Hard Waste"] || row.hard_waste || null,
        invisible_loss: row["Invisible Loss"] || row.invisible_loss || null,
      }));

      const response = await fetch(`${API_BASE_URL}/api/yarn-realization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappedData),
      });

      const result = await response.json();
      if (result.success) {
        onUpdate();
        onClose();
      } else {
        setError(result.error || "Failed to upload bulk records");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "An error occurred during file upload");
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "Date", "Unit", "Period", "Yarn Realization", "Contaminated Cotton", 
      "BR Dropping", "Card Dropping", "Flat Waste", "Micro Dust", 
      "Cotton Seeds", "Comber Noil", "Comber Noil on Feed", 
      "Hard Waste", "Invisible Loss"
    ];
    
    const instructions = [
      ["Instructions:"],
      ["1. Date: Enter in YYYY-MM-DD format (e.g., 2024-03-01)"],
      ["2. Unit: Enter unit name exactly (e.g., 1, 2, 6 Cotton, etc.)"],
      ["3. Period: Use 'monthly' or 'fornightly'"],
      ["4. Values: Enter as numbers (percentages)"],
      [],
      headers
    ];

    const sampleRow = ["2024-03-01", "1", "monthly", "92.5", "0.2", "0.5", "1.2", "0.8", "0.1", "0.1", "18.5", "16.2", "0.3", "0.5"];
    instructions.push(sampleRow);

    const ws = XLSX.utils.aoa_to_sheet(instructions);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Yarn_Realization_Template.xlsx");
  };

  const fields = [
    { label: "Yarn Realization (%)", name: "yarn_realization", type: "number" },
    { label: "Contaminated Cotton (%)", name: "contaminated_cotton", type: "number" },
    { label: "BR Dropping (%)", name: "br_dropping", type: "number" },
    { label: "Card Dropping (%)", name: "card_dropping", type: "number" },
    { label: "Flat Waste (%)", name: "flat_waste", type: "number" },
    { label: "Micro Dust (%)", name: "micro_dust", type: "number" },
    { label: "Cotton Seeds (%)", name: "cotton_seeds", type: "number" },
    { label: "Comber Noil (%)", name: "comber_noil", type: "number" },
    { label: "Comber Noil on Feed (%)", name: "comber_noil_on_feed", type: "number" },
    { label: "Hard Waste (%)", name: "hard_waste", type: "number" },
    { label: "Invisible Loss (%)", name: "invisible_loss", type: "number" },
    { label: "Overall Waste (%)", name: "overall_waste", type: "number", readOnly: true },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex flex-col">
            <h3 className="text-xl font-bold text-gray-900">Add Yarn Realization</h3>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Single Entry or Bulk Upload</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={downloadTemplate}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all border border-green-100"
              title="Download Excel Template"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-blue-100"
              title="Bulk Upload Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              accept=".xlsx, .xls" 
              className="hidden" 
            />
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm font-medium">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium"
              >
                {units.map(u => (
                  <option key={u} value={u}>{formatUnit(u)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Period</label>
              <select
                name="period"
                value={formData.period || "monthly"}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium text-capitalize"
              >
                <option value="monthly">Monthly</option>
                <option value="fornightly">Fortnightly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(field => (
              <div key={field.name} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{field.label}</label>
                <input
                  type={field.type}
                  step="0.01"
                  name={field.name}
                  value={formData[field.name as keyof YarnRealizationData] ?? ""}
                  onChange={handleChange}
                  readOnly={(field as any).readOnly}
                  className={`w-full px-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium 
                    ${(field as any).readOnly ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-gray-50 text-gray-700"}`}
                  placeholder={`0.00`}
                />
              </div>
            ))}
          </div>
        </form>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2 bg-red-700 text-white font-bold rounded-lg hover:bg-red-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-red-100"
          >
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            {saving ? "Saving..." : "Add Entry"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default YarnRealizationAddModal;
