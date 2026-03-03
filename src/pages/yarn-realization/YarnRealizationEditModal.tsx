import React, { useState } from "react";
import { API_BASE_URL } from "../../config";

interface YarnRealizationData {
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

interface YarnRealizationEditModalProps {
  rowData: YarnRealizationData;
  onClose: () => void;
  onUpdate: (updatedRow: YarnRealizationData) => void;
}

const YarnRealizationEditModal: React.FC<YarnRealizationEditModalProps> = ({ rowData, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<YarnRealizationData>({ ...rowData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Prepare data (remove calculated fields if any)
    const { id, upto_card_waste, other_waste, overall_waste, ...updatePayload } = formData as any;

    try {
      const response = await fetch(`${API_BASE_URL}/api/yarn-realization/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();
      if (result.success) {
        onUpdate(result.data);
        onClose();
      } else {
        setError(result.error || "Failed to update record");
      }
    } catch (err) {
      console.error("Update error:", err);
      setError("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  const editableFields = [
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
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            Edit Yarn Realization - {rowData.unit} ({new Date(rowData.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-')})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm font-medium">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editableFields.map(field => (
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
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default YarnRealizationEditModal;
