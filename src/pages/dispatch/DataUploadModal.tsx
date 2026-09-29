import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { API_BASE_URL } from "../../config";

interface DataUploadModalProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}

export default function DataUploadModal({ onClose, onUploadSuccess }: DataUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EXCLUDED_COLUMNS = ["id", "created_at", "smpl_count", "market", "customer_name"];

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/table-columns/dispatch_data`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      const columns = json.data.filter((col: string) => !EXCLUDED_COLUMNS.includes(col));
      
      // Create a worksheet with only headers
      const ws = XLSX.utils.aoa_to_sheet([columns]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      
      XLSX.writeFile(wb, "dispatch_upload_template.xlsx");
      setMessage({ text: "Template downloaded successfully", type: "success" });
    } catch (err) {
      console.error(err);
      setMessage({ text: "Failed to download template", type: "error" });
    }
  };

  const formatDate = (val: any): string => {
    if (!val) return "";
    
    // If it's an Excel date number
    if (typeof val === 'number') {
      const date = XLSX.utils.format_cell({ v: val, t: 'd' });
      // format_cell might return a string like "MM/DD/YY" or similar depending on XLSX version/config
      // Better to use XLSX.SSF.parse_date_code if available or just JS Date
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.toISOString().split('T')[0];
    }

    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return String(val);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsUploading(true);
        setMessage({ text: "Processing file...", type: "info" });
        
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          throw new Error("The uploaded file is empty.");
        }

        // Clean and format data
        const formattedData = data.map(row => {
          const newRow = { ...row };
          if (newRow.billing_date) {
            newRow.billing_date = formatDate(newRow.billing_date);
          }
          return newRow;
        });

        // Check for duplicates
        const checkRes = await fetch(`${API_BASE_URL}/api/dispatch-data/check-duplicates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
        });
        const checkJson = await checkRes.json();

        if (!checkJson.success) throw new Error(checkJson.error);

        const { duplicateCount, nonDuplicates } = checkJson;

        if (nonDuplicates.length === 0) {
          setMessage({ text: `All ${duplicateCount} rows are duplicates. Nothing to upload.`, type: "info" });
          setIsUploading(false);
          return;
        }

        // Upload non-duplicates
        const uploadRes = await fetch(`${API_BASE_URL}/api/dispatch-data/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nonDuplicates),
        });
        const uploadJson = await uploadRes.json();

        if (!uploadJson.success) throw new Error(uploadJson.error);

        let msg = `Successfully uploaded ${nonDuplicates.length} rows.`;
        if (duplicateCount > 0) {
          msg += ` ${duplicateCount} duplicate rows found and skipped.`;
        }
        
        setMessage({ text: msg, type: "success" });
        onUploadSuccess();
      } catch (err: any) {
        console.error(err);
        setMessage({ text: err.message || "Failed to upload data", type: "error" });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-800">Upload Dispatch Data</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="p-8 flex flex-col gap-6">
          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium ${
              message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
              message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
              "bg-blue-50 text-blue-700 border border-blue-200"
            }`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-red-700 text-red-700 font-bold rounded-xl hover:bg-red-50 transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              Download Excel Template
            </button>

            <label className={`flex items-center justify-center gap-3 px-6 py-4 font-bold rounded-xl transition-all shadow-sm cursor-pointer ${
              isUploading 
                ? "bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed" 
                : "bg-red-700 text-white border-2 border-red-700 hover:bg-red-800"
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
              {isUploading ? "Uploading..." : "Upload Template"}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
                ref={fileInputRef}
              />
            </label>
          </div>

          <p className="text-xs text-center text-gray-500 italic">
            * Duplicates will be automatically identified and skipped.
            <br />
            * Date formats will be normalized to YYYY-MM-DD.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
