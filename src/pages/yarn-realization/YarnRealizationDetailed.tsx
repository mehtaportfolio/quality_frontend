import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import YarnRealizationEditModal from "./YarnRealizationEditModal";

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

interface YarnRealizationDetailedProps {
  data: YarnRealizationData[];
  selectedPeriod: string;
  formatUnit: (unit: string) => string;
  onRefresh: () => void;
}

const YarnRealizationDetailed: React.FC<YarnRealizationDetailedProps> = ({
  data,
  selectedPeriod,
  formatUnit,
  onRefresh
}) => {
  const filteredData = data.filter(item => item.period?.toLowerCase() === selectedPeriod.toLowerCase());
  const units = Array.from(new Set(filteredData.map(item => item.unit))).sort();
  
  const [activeUnit, setActiveUnit] = useState<string>(units[0] || "");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingRow, setEditingRow] = useState<YarnRealizationData | null>(null);

  useEffect(() => {
    if (data.length > 0) {
      const sortedDates = Array.from(new Set(data.map((item: any) => item.date.split('T')[0]))).sort() as string[];
      if (sortedDates.length > 0) {
        setStartDate(sortedDates[Math.max(0, sortedDates.length - 6)]);
        setEndDate(sortedDates[sortedDates.length - 1]);
      }
    }
  }, [data]);

  const currentUnitData = filteredData.filter(item => {
    const itemDate = item.date.split('T')[0];
    const isWithinRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
    return item.unit === activeUnit && isWithinRange;
  });

  const columns = [
    { label: "Month", key: "date" },
    { label: "Period", key: "period" },
    { label: "Yarn Realization", key: "yarn_realization" },
    { label: "Contaminated Cotton", key: "contaminated_cotton" },
    { label: "BR Dropping", key: "br_dropping" },
    { label: "Card Dropping", key: "card_dropping" },
    { label: "Flat Waste", key: "flat_waste" },
    { label: "Micro Dust", key: "micro_dust" },
    { label: "Cotton Seeds", key: "cotton_seeds" },
    { label: "Upto Card Waste", key: "upto_card_waste" },
    { label: "Comber Noil", key: "comber_noil" },
    { label: "Comber Noil on Feed", key: "comber_noil_on_feed" },
    { label: "Hard Waste", key: "hard_waste" },
    { label: "Other Waste", key: "other_waste" },
    { label: "Invisible Loss", key: "invisible_loss" },
    { label: "Overall Waste", key: "overall_waste" },
  ];

  const handleExportExcel = () => {
    const exportData = currentUnitData.map((row) => {
      const formattedRow: any = {};
      columns.forEach((col) => {
        let value = row[col.key as keyof YarnRealizationData];
        if (col.key === 'date') {
          value = new Date(value as string).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-');
        }
        formattedRow[col.label] = value;
      });
      return formattedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Yarn Realization");
    XLSX.writeFile(workbook, `Yarn_Realization_${formatUnit(activeUnit)}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50/50 px-4 flex flex-col md:flex-row justify-between items-center py-2 gap-4">
        <div className="flex overflow-x-auto no-scrollbar gap-2">
          {units.map((unit) => (
            <button
              key={unit}
              onClick={() => setActiveUnit(unit)}
              className={`px-6 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap
                ${activeUnit === unit
                  ? "bg-red-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-gray-200"
                }`}
            >
              {formatUnit(unit)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="p-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center"
              title="Download Excel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </button>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`p-2.5 rounded-lg transition-all shadow-sm flex items-center justify-center border ${
                isEditMode 
                  ? "bg-red-600 text-white border-red-700" 
                  : "bg-white text-gray-600 border-gray-200 hover:border-red-300 hover:text-red-600"
              }`}
              title={isEditMode ? "Disable Editing" : "Enable Editing"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentUnitData.map((row) => (
              <tr key={row.id} className="hover:bg-red-50/30 transition-colors group">
                {columns.map((col) => {
                  const value = row[col.key as keyof YarnRealizationData];
                  const isPercentage = col.key !== 'date' && col.key !== 'period';
                  return (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        {col.key === 'date' && isEditMode && (
                          <button 
                            onClick={() => setEditingRow(row)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                            title="Edit this row"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                        <span>
                          {col.key === 'date' ? new Date(value as string).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-') : (value ?? "-")}
                          {isPercentage && value !== null && "%"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRow && (
        <YarnRealizationEditModal 
          rowData={editingRow}
          onClose={() => setEditingRow(null)}
          onUpdate={(updatedRow) => {
            onRefresh();
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
};

export default YarnRealizationDetailed;
