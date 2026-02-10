import { useEffect, useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { API_BASE_URL } from "../../config";
import { useRolePermissions, type Role } from "../../hooks/useRolePermissions";

interface DispatchResult {
  id: string;
  lot_no: string;
  smpl_count: string;
  blend: string;
  customer_short_name: string;
  item_description: string;
  actual_count_net: number;
  cv_percent: number;
  csp: number;
  uster_percent: number;
  thin_places_minus_50: number;
  thick_places_plus_50: number;
  neps_plus_200: number;
  total_ipi: number;
  hairiness: number;
  rkm_g_tex: number;
  elongation_percent: number;
  uster_total_faults_nsl_std_classes: number;
  tm: number;
  sp_draft: number;
  spandex: string;
  created_at: string;
  billing_date: string | null;
}

interface DispatchResultsTableProps {
  user: {
    role: Role;
    full_name: string;
    id: string;
  };
}

const QUALITY_COLUMNS = [
  "actual_count_net",
  "cv_percent",
  "csp",
  "uster_percent",
  "thin_places_minus_50",
  "thick_places_plus_50",
  "neps_plus_200",
  "total_ipi",
  "hairiness",
  "rkm_g_tex",
  "elongation_percent",
  "uster_total_faults_nsl_std_classes",
  "tm"
];

const DEFAULT_DISPATCH_DETAILS_COLUMNS = [
  { label: "Billing Document", key: "billing_document", visible: true },
  { label: "Billing Date", key: "billing_date", visible: true },
  { label: "Item Description", key: "item_description", visible: true },
  { label: "Plant", key: "plant", visible: true },
  { label: "Delivery", key: "delivery", visible: true },
  { label: "Sales Document", key: "sales_document", visible: true },
  { label: "Ship to city", key: "ship_to_city", visible: true },
  { label: "From Box/Roll", key: "from_box_roll", visible: true },
  { label: "To Box/Rolls", key: "to_box_rolls", visible: true },
  { label: "No. of pakage", key: "no_of_package", visible: true },
  { label: "Invoiced Quantity", key: "invoiced_quantity", visible: true },
  { label: "Gross Weight", key: "gross_weight", visible: true },
  { label: "fromdate", key: "fromdate", visible: true },
  { label: "todate", key: "todate", visible: true },
  { label: "customer_short_name", key: "customer_short_name", visible: true },
  { label: "smpl_count", key: "smpl_count", visible: true },
  { label: "blend", key: "blend", visible: true }
];

function ColumnReorderModal({ 
  columns, 
  onClose, 
  onMove,
  onToggleVisibility
}: { 
  columns: any[], 
  onClose: () => void, 
  onMove: (index: number, direction: 'up' | 'down') => void,
  onToggleVisibility: (index: number) => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh] overflow-hidden transform transition-all">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Manage Columns
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-auto bg-gray-50">
          <div className="space-y-2">
            {columns.map((col, idx) => (
              <div key={col.key} className={`flex items-center justify-between bg-white p-3 rounded-xl border ${col.visible ? 'border-gray-200' : 'border-gray-100 opacity-60'} shadow-sm hover:border-red-200 transition-colors`}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleVisibility(idx)}
                    className={`p-1 rounded-md transition-colors ${col.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
                    title={col.visible ? "Hide Column" : "Show Column"}
                  >
                    {col.visible ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    type="button"
                    onClick={() => onMove(idx, 'up')}
                    disabled={idx === 0}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button 
                    type="button"
                    onClick={() => onMove(idx, 'down')}
                    disabled={idx === columns.length - 1}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-20 disabled:hover:bg-transparent"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function DispatchDetailsModal({ onClose }: { onClose: () => void }) {
  const [lotNo, setLotNo] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [columns, setColumns] = useState(DEFAULT_DISPATCH_DETAILS_COLUMNS);
  const [showReorder, setShowReorder] = useState(false);

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newCols = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCols.length) return;
    [newCols[index], newCols[targetIndex]] = [newCols[targetIndex], newCols[index]];
    setColumns(newCols);
  };

  const toggleColumnVisibility = (index: number) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], visible: !newCols[index].visible };
    setColumns(newCols);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lotNo.trim()) return;

    setSearching(true);
    setSearched(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/dispatch-results?lot_no=${lotNo.trim()}`);
      const json = await response.json();
      if (json.success) {
        setResults(json.data);
      }
    } catch (err) {
      console.error("Error fetching dispatch data:", err);
    } finally {
      setSearching(false);
    }
  };

  const exportToExcel = () => {
    if (results.length === 0) return;
    const visibleColumns = columns.filter(col => col.visible);
    const exportData = results.map(row => {
      const obj: any = {};
      visibleColumns.forEach(col => {
        obj[col.label] = row[col.key] ?? "-";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch Details");
    XLSX.writeFile(wb, `Dispatch_Details_${lotNo}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    if (results.length === 0) return;
    const doc = new jsPDF("l", "mm", "a4");
    const visibleColumns = columns.filter(col => col.visible);
    const head = [visibleColumns.map(col => col.label)];
    const body = results.map(row => 
      visibleColumns.map(col => row[col.key] ?? "-")
    );

    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28); // red-700
    doc.setFont("helvetica", "bold");
    doc.text(`Dispatch Details - Lot No: ${lotNo}`, 14, 15);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      head: head,
      body: body,
      startY: 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [185, 28, 28] }, // red-700
    });

    doc.save(`Dispatch_Details_${lotNo}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-all overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <h2 className="text-xl font-bold text-gray-800">Dispatch Details Search</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <input
              type="text"
              placeholder="Enter Lot No..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={lotNo}
              onChange={(e) => setLotNo(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {searching ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Search
            </button>

            {results.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowReorder(!showReorder)}
                  className={`px-4 py-2 ${showReorder ? 'bg-red-600' : 'bg-gray-600'} text-white rounded-xl hover:opacity-90 transition-colors flex items-center gap-2`}
                  title="Manage Columns"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2"
                  title="Export to Excel"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={exportToPDF}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
                  title="Export to PDF"
                >
                  <svg className="h-6 w-6" viewBox="0 0 384 512" fill="currentColor">
                    <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-21.5-3.3-31.5-21-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 9.2 0 14.3-3.6 23.4-13 14.8-15.3 32.5-49 46.5-74.2 24.3-11.1 55.6-21.1 82.2-22.3 22.8 28.5 53.6 57 81.3 57 18.1 0 24-11.2 24.1-18.9 0-14.7-27.4-19.4-80.1-41.5zm190.5-231.5L250.7 20.7c-4.5-4.5-10.6-7-17-7H232v128h128v-1.7c0-6.4-2.5-12.5-7-17zM350.1 393.3c-.1-12.4-11-28.4-53.1-44.5-5.2 2.7-21.8 11.4-21.8 11.4 34.1 21.4 75 43.4 74.9 33.1z"/>
                  </svg>
                </button>
              </>
            )}
          </form>

          {showReorder && (
            <ColumnReorderModal 
              columns={columns} 
              onClose={() => setShowReorder(false)} 
              onMove={moveColumn} 
              onToggleVisibility={toggleColumnVisibility}
            />
          )}

          {searched && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {columns.filter(col => col.visible).map((col) => (
                        <th key={col.key} className="px-4 py-3 text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.length > 0 ? (
                      results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          {columns.filter(col => col.visible).map((col) => (
                            <td key={col.key} className="px-4 py-3 text-xs text-gray-600">
                              {row[col.key] || "-"}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={columns.filter(col => col.visible).length || 1} className="px-4 py-12 text-center text-gray-400 italic">
                          {searching ? "Searching..." : "No results found for this Lot No."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUploadSuccess }: { onClose: () => void, onUploadSuccess: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [updatingMasters, setUpdatingMasters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, skipped: 0, type: 'upload' as 'upload' | 'update' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const CHUNK_SIZE = 500;

  const handleUpdateMasters = async () => {
    setUpdatingMasters(true);
    setError(null);
    setSuccessMsg(null);
    setProgress({ current: 0, total: 0, skipped: 0, type: 'update' });
    
    try {
      // 1. First get the count of items that need updating
      const countRes = await fetch(`${API_BASE_URL}/api/dispatch-results/update-masters-plan`);
      const plan = await countRes.json();
      
      if (!plan.success) throw new Error(plan.error);
      
      const totalToUpdate = plan.updates.length;
      if (totalToUpdate === 0) {
        setSuccessMsg("All records are already up to date.");
        setUpdatingMasters(false);
        return;
      }

      setProgress({ current: 0, total: totalToUpdate, skipped: 0, type: 'update' });

      // 2. Perform updates in chunks from frontend to maintain progress visibility
      const updateBatchSize = 100;
      for (let i = 0; i < totalToUpdate; i += updateBatchSize) {
        const chunk = plan.updates.slice(i, i + updateBatchSize);
        
        const response = await fetch(`${API_BASE_URL}/api/dispatch-results/update-masters-execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: chunk })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);

        setProgress(prev => ({ ...prev, current: Math.min(i + updateBatchSize, totalToUpdate) }));
      }

      setSuccessMsg(`Successfully updated ${totalToUpdate} records.`);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || "Error updating details");
    } finally {
      setUpdatingMasters(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        billing_document: "",
        billing_date: "",
        distribution_channel: "",
        division: "",
        name_of_customer: "",
        customer_name: "",
        item_description: "",
        plant: "",
        lot_no: "",
        delivery: "",
        delivery_item: "",
        sales_document: "",
        sales_document_item: "",
        bill_to_city: "",
        ship_to_city: "",
        ship_to_party: "",
        vehicle_number: "",
        container_number: "",
        sold_to_party: "",
        dest_country_region: "",
        inspection_lot: "",
        actual_count_net: "",
        cv_percent: "",
        csp: "",
        uster_percent: "",
        thin_places_minus_50: "",
        thick_places_plus_50: "",
        neps_plus_200: "",
        total_ipi: "",
        hairiness: "",
        br_force_grams: "",
        rkm_g_tex: "",
        rkm_cv_percent: "",
        elongation_percent: "",
        elongation_cv_percent: "",
        uster_top_9: "",
        uster_top_12: "",
        uster_top_16: "",
        uster_total_faults_nsl_std_classes: "",
        uster_total_fault_t_std_class: "",
        tpi: "",
        tm: "",
        sales_unit: "",
        item: "",
        base_unit_of_measure: "",
        fromdate: "",
        todate: "",
        packing_type: "",
        yarn_waxed_unwaxed: "",
        material_condition: "",
        moisture_content: "",
        sp_draft: "",
        spandex: "",
        splice: "",
        slub_prog: "",
        slub_len: "",
        slub_per_metre: "",
        from_box_roll: "",
        to_box_rolls: "",
        invoiced_quantity: "",
        no_of_package: "",
        tare_weight: "",
        gross_weight: ""
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "dispatch_results_template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);
    setProgress({ current: 0, total: 0, skipped: 0, type: 'upload' });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          setError("The selected file is empty.");
          setUploading(false);
          return;
        }

        const processedData = rawData.map((row: any) => {
          const newRow: any = {};
          for (const key in row) {
            let value = row[key];
            
            // Remove # from all blocks
            if (typeof value === 'string') {
              value = value.replace(/#/g, '');
            }

            // Convert empty strings to null for database
            if (value === "") {
              value = null;
            }

            // Convert date to yyyy-mm-dd
            if (value instanceof Date) {
              value = value.toISOString().split('T')[0];
            } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              // Already in correct format
            } else if (typeof value === 'string' && value.includes('/')) {
              // Try to parse common date formats if they are strings
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                value = date.toISOString().split('T')[0];
              }
            }

            newRow[key] = value;
          }
          return newRow;
        });

        const totalRows = processedData.length;
        setProgress({ current: 0, total: totalRows, skipped: 0, type: 'upload' });

        // Upload in chunks
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          const chunk = processedData.slice(i, i + CHUNK_SIZE);
          
          const response = await fetch(`${API_BASE_URL}/api/dispatch-results/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ results: chunk })
          });

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || `Failed to upload rows ${i + 1} to ${Math.min(i + CHUNK_SIZE, totalRows)}`);
          }

          setProgress(prev => ({ 
            ...prev, 
            current: Math.min(i + CHUNK_SIZE, totalRows),
            skipped: prev.skipped + (result.skipped || 0)
          }));
        }

        onUploadSuccess();
        onClose();
      } catch (err: any) {
        setError(err.message || "Error processing file");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Upload Dispatch Results</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h3 className="text-blue-800 font-semibold mb-2 text-sm">Step 1: Download Template</h3>
            <p className="text-xs text-blue-600 mb-4">Use our Excel template to ensure your data is formatted correctly.</p>
            <button
              onClick={downloadTemplate}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
            </button>
          </div>

          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <h3 className="text-green-800 font-semibold mb-2 text-sm">Step 2: Upload File</h3>
            <p className="text-xs text-green-600 mb-4">Upload the completed Excel file to import data.</p>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`w-full py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              {uploading ? "Uploading..." : "Select & Upload File"}
            </button>

            {uploading && progress.total > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-green-700 font-medium">
                  <span>{progress.current} / {progress.total} rows processed</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
                {progress.skipped > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Skipped {progress.skipped} duplicate rows
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <h3 className="text-amber-800 font-semibold mb-2 text-sm">Step 3: Sync Masters</h3>
            <p className="text-xs text-amber-600 mb-4">Update counts, blends and customer names from master tables.</p>
            <button
              onClick={handleUpdateMasters}
              disabled={updatingMasters || uploading}
              className={`w-full py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-2 text-sm ${(updatingMasters || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {updatingMasters ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {updatingMasters ? "Updating..." : "Update Count/Blend/Customer"}
            </button>

            {updatingMasters && progress.total > 0 && progress.type === 'update' && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-amber-700 font-medium">
                  <span>{progress.current} / {progress.total} rows updated</span>
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div 
                    className="bg-amber-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-600 text-xs rounded-lg">
              {successMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DispatchResultsTable({ user }: DispatchResultsTableProps) {
  const permissions = useRolePermissions(user.role);
  const [data, setData] = useState<DispatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const rowsPerPage = 10;

  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/dispatch-results`);
      const json = await response.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch dispatch results:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredData = useMemo(() => {
    // 1. Filter out rows that are blank across all quality columns
    const nonBlankData = data.filter(row => {
      return QUALITY_COLUMNS.some(col => {
        const val = row[col as keyof DispatchResult];
        return val !== null && val !== undefined && val !== "";
      });
    });

    let result = nonBlankData;

    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const words = term.split(/\s+/);

      result = nonBlankData.filter((row) => {
        const lot = String(row.lot_no || "").toLowerCase();
        const count = String(row.smpl_count || "").toLowerCase();
        const customer = String(row.customer_short_name || "").toLowerCase();

        return words.every(word => {
          // Escape special regex characters and match from the start of words
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = new RegExp(`\\b${escapedWord}`, 'i');
          return pattern.test(lot) || pattern.test(count) || pattern.test(customer);
        });
      });
    }

    // Sort by billing_date latest first, then by created_at
    return result.sort((a, b) => {
      const dateA = a.billing_date ? new Date(a.billing_date).getTime() : 0;
      const dateB = b.billing_date ? new Date(b.billing_date).getTime() : 0;
      
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [data, searchTerm]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const lastUpdatedDate = useMemo(() => {
    if (data.length === 0) return null;
    const dates = data
      .map(row => row.billing_date)
      .filter((date): date is string => date !== null && date !== "")
      .map(date => new Date(date));
    
    if (dates.length === 0) return null;
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const day = String(maxDate.getDate()).padStart(2, '0');
    const month = String(maxDate.getMonth() + 1).padStart(2, '0');
    const year = maxDate.getFullYear();
    return `${day}.${month}.${year}`;
  }, [data]);

  const exportToExcel = () => {
    const exportData = filteredData.map(row => {
      const obj: any = {};
      columns.forEach(col => {
        obj[col.label] = row[col.key as keyof DispatchResult] ?? "-";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dispatch Results");
    XLSX.writeFile(wb, `Dispatch_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    
    // Check if smpl_count and customer_short_name are same across all filtered rows
    const firstRow = filteredData[0];
    const isSameCount = filteredData.length > 0 && filteredData.every(row => row.smpl_count === firstRow.smpl_count);
    const isSameCustomer = filteredData.length > 0 && filteredData.every(row => row.customer_short_name === firstRow.customer_short_name);

    // Determine which columns to include in the table body
    const pdfColumns = columns.filter(col => {
      if (isSameCount && col.key === "smpl_count") return false;
      if (isSameCustomer && col.key === "customer_short_name") return false;
      return true;
    });

    const head = [pdfColumns.map(col => col.label)];
    const body = filteredData.map(row => 
      pdfColumns.map(col => row[col.key as keyof DispatchResult] ?? "-")
    );

    doc.setFontSize(14);
    doc.setTextColor(185, 28, 28); // red-700
    doc.setFont("helvetica", "bold");
    doc.text("Dispatch Results", 14, 15);
    
    // Add header info if columns were removed
    doc.setFontSize(10);
    let headerY = 15;
    if (isSameCustomer) {
      doc.text(`Customer: ${firstRow.customer_short_name || "-"}`, 100, headerY);
    }
    if (isSameCount) {
      doc.text(`Count: ${firstRow.smpl_count || "-"}`, 200, headerY);
    }

    // Reset text color and font for autoTable if needed
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    autoTable(doc, {
      head: head,
      body: body,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [185, 28, 28] }, // red-700
    });

    doc.save(`Dispatch_Results_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const columns = useMemo(() => {
    const baseCols = [
      { label: "Lot No", key: "lot_no" },
      { label: "Count", key: "smpl_count" },
      { label: "Blend", key: "blend" },
      { label: "Customer", key: "customer_short_name" },
      { label: "Act Cnt", key: "actual_count_net" },
      { label: "Cnt Cv%", key: "cv_percent" },
      { label: "CSP", key: "csp" },
      { label: "U%", key: "uster_percent" },
      { label: "-50%", key: "thin_places_minus_50" },
      { label: "+50%", key: "thick_places_plus_50" },
      { label: "+200%", key: "neps_plus_200" },
      { label: "IPI", key: "total_ipi" },
      { label: "H", key: "hairiness" },
      { label: "RKM", key: "rkm_g_tex" },
      { label: "Elong", key: "elongation_percent" },
      { label: "CMT", key: "uster_total_faults_nsl_std_classes" },
      { label: "TM", key: "tm" },
    ];

    // 2. Hide SP Draft and Spandex columns if they are blank for every row
    const hasSpDraft = paginatedData.some(row => row.sp_draft !== null && row.sp_draft !== undefined && (typeof row.sp_draft === "number" || row.sp_draft !== ""));
    const hasSpandex = paginatedData.some(row => row.spandex !== null && row.spandex !== undefined && row.spandex !== "");

    const result = [...baseCols];
    if (hasSpDraft) result.push({ label: "SP Draft", key: "sp_draft" });
    if (hasSpandex) result.push({ label: "Spandex%", key: "spandex" });

    return result;
  }, [paginatedData]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-red-700">Dispatch Results</h2>
        {lastUpdatedDate && (
          <span className="text-sm font-medium text-red-600 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
            last updated data on {lastUpdatedDate}
          </span>
        )}
      </div>

      {/* Search Bar and Add Button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-all shadow-sm"
            placeholder="Search by Lot No, Count (SMPL), or Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {permissions.canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center justify-center px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm h-12"
            title="Upload Dispatch Results"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        <button
          onClick={() => setShowDispatchModal(true)}
          className="flex items-center justify-center px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm h-12"
          title="Dispatch Details"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1h1m8-1h1l4 6v4a1 1 0 01-1 1h-1m-4-11V7a1 1 0 011-1h5" />
          </svg>
        </button>

        <button
          onClick={exportToExcel}
          className="flex items-center justify-center px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors shadow-sm h-12"
          title="Export to Excel"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        <button
          onClick={exportToPDF}
          className="flex items-center justify-center px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors shadow-sm h-12"
          title="Export to PDF"
        >
          <svg className="h-6 w-6" viewBox="0 0 384 512" fill="currentColor">
            <path d="M181.9 256.1c-5-16-4.9-46.9-2-46.9 8.4 0 7.6 36.9 2 46.9zm-1.7 47.2c-7.7 20.2-17.3 43.3-28.4 62.7 18.3-7 39-17.2 62.9-21.9-21.5-3.3-31.5-21-34.5-40.8zM86.1 428.1c0 .8 13.2-5.4 34.9-40.2-6.7 6.3-29.1 24.5-34.9 40.2zM248 160h136v328c0 13.3-10.7 24-24 24H24c-13.3 0-24-10.7-24-24V24C0 10.7 10.7 0 24 0h200v136c0 13.2 10.8 24 24 24zm-8 171.8c-20-12.2-33.3-29-42.7-53.8 4.5-18.5 11.6-46.6 6.2-64.2-4.7-29.4-42.4-26.5-47.8-6.8-5 18.3-.4 44.1 8.1 77-11.6 27.6-28.7 64.6-40.8 85.8-.1 0-.1.1-.2.1-27.1 13.9-73.6 44.5-54.5 68 5.6 6.9 16 10 21.5 10 9.2 0 14.3-3.6 23.4-13 14.8-15.3 32.5-49 46.5-74.2 24.3-11.1 55.6-21.1 82.2-22.3 22.8 28.5 53.6 57 81.3 57 18.1 0 24-11.2 24.1-18.9 0-14.7-27.4-19.4-80.1-41.5zm190.5-231.5L250.7 20.7c-4.5-4.5-10.6-7-17-7H232v128h128v-1.7c0-6.4-2.5-12.5-7-17zM350.1 393.3c-.1-12.4-11-28.4-53.1-44.5-5.2 2.7-21.8 11.4-21.8 11.4 34.1 21.4 75 43.4 74.9 33.1z"/>
          </svg>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedData.length > 0 ? (
                paginatedData.map((row) => {
                  const isSpandex = row.item_description?.toLowerCase().includes("spandex") || 
                                   row.item_description?.toLowerCase().includes("spdx");

                  return (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      {columns.map((col) => {
                        let content = row[col.key as keyof DispatchResult] ?? "-";
                        
                        // Conditional visibility for SP Draft and Spandex%
                        if ((col.key === "sp_draft" || col.key === "spandex") && !isSpandex) {
                          content = "";
                        }

                        return (
                          <td key={col.key} className="px-4 py-3 text-sm text-gray-600">
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 italic">
                    {searchTerm ? "No matching results found." : "No dispatch results found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredData.length > rowsPerPage && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(currentPage - 1) * rowsPerPage + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * rowsPerPage, filteredData.length)}
                </span>{" "}
                of <span className="font-medium">{filteredData.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01.02 1.06L8.832 10l3.978 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${
                        currentPage === pageNum
                          ? "z-10 bg-red-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                          : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.19 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)} 
          onUploadSuccess={fetchData} 
        />
      )}

      {showDispatchModal && (
        <DispatchDetailsModal 
          onClose={() => setShowDispatchModal(false)} 
        />
      )}
    </div>
  );
}
