import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { type YarnRealizationData } from "./YarnRealization";

interface YarnRealizationComparisonProps {
  data: YarnRealizationData[];
  formatUnit: (unit: string) => string;
}

const PARAMETERS = [
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

const MultiSelect: React.FC<{
  label: string;
  options: { label: string; value: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}> = ({ label, options, selectedValues, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const toggleAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  return (
    <div className="relative inline-block text-left min-w-[150px]" ref={dropdownRef}>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase">{label}:</span>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500 flex justify-between items-center gap-2"
        >
          <span className="truncate max-w-[120px]">
            {selectedValues.length === 0
              ? "None selected"
              : selectedValues.length === options.length
              ? "All selected"
              : `${selectedValues.length} selected`}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 max-h-60 overflow-y-auto">
          <div className="py-1">
            <label className="flex items-center px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 cursor-pointer border-b border-gray-100">
              <input
                type="checkbox"
                className="w-3 h-3 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 mr-2"
                checked={selectedValues.length === options.length && options.length > 0}
                onChange={toggleAll}
              />
              Select All
            </label>
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="w-3 h-3 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 mr-2"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => toggleValue(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const YarnRealizationComparison: React.FC<YarnRealizationComparisonProps> = ({
  data,
  formatUnit,
}) => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(["monthly", "fornightly"]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedParameters, setSelectedParameters] = useState<string[]>(["yarn_realization", "overall_waste"]);
  const [reportType, setReportType] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (data.length > 0) {
      const sortedDates = Array.from(new Set(data.map((item: any) => item.date.split('T')[0]))).sort() as string[];
      if (sortedDates.length > 0 && (!startDate || !endDate)) {
        setStartDate(sortedDates[Math.max(0, sortedDates.length - 2)]);
        setEndDate(sortedDates[sortedDates.length - 1]);
      }

      if (selectedUnits.length === 0) {
        const units = Array.from(new Set(data.map((item) => item.unit))).sort();
        setSelectedUnits(units);
      }
    }
  }, [data]);

  const units = useMemo(() => Array.from(new Set(data.map((item) => item.unit))).sort(), [data]);
  const unitOptions = useMemo(() => units.map(u => ({ label: formatUnit(u), value: u })), [units, formatUnit]);
  const periodOptions = [
    { label: "Monthly", value: "monthly" },
    { label: "Fortnightly", value: "fornightly" },
  ];
  const parameterOptions = PARAMETERS.map(p => ({ label: p.label, value: p.key }));

  const orderedSelectedParameters = useMemo(() => {
    return PARAMETERS
      .filter(p => selectedParameters.includes(p.key))
      .map(p => p.key);
  }, [selectedParameters]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const itemDate = item.date.split('T')[0];
      const isWithinRange = (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
      const isCorrectPeriod = selectedPeriods.includes(item.period?.toLowerCase() || "");
      const isCorrectUnit = selectedUnits.includes(item.unit);
      return isWithinRange && isCorrectPeriod && isCorrectUnit;
    });
  }, [data, startDate, endDate, selectedPeriods, selectedUnits]);

  // Extract unique periods for the headers
  const uniqueDisplayPeriods = useMemo(() => {
    const periods = new Set<string>();
    filteredData.forEach(item => {
      const d = new Date(item.date);
      if (reportType === "monthly") {
        const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-');
        periods.add(label);
      } else {
        periods.add(d.getFullYear().toString());
      }
    });

    const periodArray = Array.from(periods);
    if (reportType === "monthly") {
      return periodArray.sort((a, b) => {
        const [m1, y1] = a.split('-');
        const [m2, y2] = b.split('-');
        const d1 = new Date(Number(`20${y1}`), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m1));
        const d2 = new Date(Number(`20${y2}`), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m2));
        return d1.getTime() - d2.getTime();
      });
    } else {
      return periodArray.sort();
    }
  }, [filteredData, reportType]);

  const tableHeader = useMemo(() => {
    return (
      <thead className="bg-gray-50 border-b border-gray-200">
        <tr>
          <th rowSpan={2} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider border-r border-black sticky left-0 bg-gray-50 z-20">
            Parameter
          </th>
          {selectedUnits.map(unit => (
            <th 
              key={unit} 
              colSpan={uniqueDisplayPeriods.length} 
              className="px-4 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-black"
            >
              {formatUnit(unit)}
            </th>
          ))}
        </tr>
        <tr className="border-b border-black">
          {selectedUnits.map(unit => (
            uniqueDisplayPeriods.map((period, idx) => (
              <th 
                key={`${unit}-${period}`} 
                className={`px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider ${idx === uniqueDisplayPeriods.length - 1 ? "border-r border-black" : "border-r border-gray-100"}`}
              >
                {period}
              </th>
            ))
          ))}
        </tr>
      </thead>
    );
  }, [selectedUnits, uniqueDisplayPeriods, formatUnit]);

  const getRowData = (paramKey: string) => {
    const row: any = { parameter: PARAMETERS.find(p => p.key === paramKey)?.label };
    
    selectedUnits.forEach(unit => {
      uniqueDisplayPeriods.forEach(period => {
        if (reportType === "monthly") {
          const monthItems = filteredData.filter(d => {
            const itemMonth = new Date(d.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-');
            return d.unit === unit && itemMonth === period;
          });

          // Priority logic: Monthly first, then Fortnightly
          const monthlyItem = monthItems.find(d => d.period?.toLowerCase() === "monthly");
          const fornightlyItem = monthItems.find(d => d.period?.toLowerCase() === "fornightly");
          
          const item = monthlyItem || fornightlyItem;
          row[`${unit}-${period}`] = item ? item[paramKey as keyof YarnRealizationData] : null;
        } else {
          // Yearly logic: Average of months that have data in that year
          const yearItems = filteredData.filter(d => {
            const itemYear = new Date(d.date).getFullYear().toString();
            return d.unit === unit && itemYear === period;
          });

          // Group by month to apply the Monthly > Fortnightly priority per month
          const monthsInYear = new Set<string>();
          yearItems.forEach(d => {
            monthsInYear.add(new Date(d.date).getMonth().toString());
          });

          let sum = 0;
          let count = 0;

          monthsInYear.forEach(m => {
            const monthItems = yearItems.filter(d => new Date(d.date).getMonth().toString() === m);
            const monthlyItem = monthItems.find(d => d.period?.toLowerCase() === "monthly");
            const fornightlyItem = monthItems.find(d => d.period?.toLowerCase() === "fornightly");
            
            const item = monthlyItem || fornightlyItem;
            if (item && item[paramKey as keyof YarnRealizationData] !== null) {
              sum += Number(item[paramKey as keyof YarnRealizationData]);
              count++;
            }
          });

          row[`${unit}-${period}`] = count > 0 ? Number((sum / count).toFixed(2)) : null;
        }
      });
    });
    
    return row;
  };

  const handleExportExcel = () => {
    const exportData: any[] = [];
    
    orderedSelectedParameters.forEach(paramKey => {
      const row = getRowData(paramKey);
      const formattedRow: any = { "Parameter": row.parameter };
      
      selectedUnits.forEach(unit => {
        uniqueDisplayPeriods.forEach(period => {
          const colName = `${formatUnit(unit)} (${period})`;
          formattedRow[colName] = row[`${unit}-${period}`] !== null ? `${row[`${unit}-${period}`]}%` : "-";
        });
      });
      exportData.push(formattedRow);
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparison");
    XLSX.writeFile(workbook, `Yarn_Realization_Comparison_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 bg-gray-50/50 border-b border-gray-100 relative z-30 flex justify-between items-end">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <MultiSelect 
            label="Period"
            options={periodOptions}
            selectedValues={selectedPeriods}
            onChange={setSelectedPeriods}
          />

          <MultiSelect 
            label="Units"
            options={unitOptions}
            selectedValues={selectedUnits}
            onChange={setSelectedUnits}
          />

          <MultiSelect 
            label="Parameters"
            options={parameterOptions}
            selectedValues={selectedParameters}
            onChange={setSelectedParameters}
          />

          <div className="flex flex-col gap-1 min-w-[120px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Report Type:</span>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="p-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center justify-center mb-0.5"
          title="Download Comparison Excel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto max-w-full">
        <table className="min-w-full divide-y divide-gray-200 border-collapse">
          {tableHeader}
          <tbody className="bg-white divide-y divide-gray-200">
            {orderedSelectedParameters.map((paramKey) => {
              const row = getRowData(paramKey);
              return (
                <tr key={paramKey} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-700 border-r border-black sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    {row.parameter}
                  </td>
                  {selectedUnits.map(unit => (
                    uniqueDisplayPeriods.map((period, idx) => {
                      const value = row[`${unit}-${period}`];
                      return (
                        <td 
                          key={`${unit}-${period}`} 
                          className={`px-4 py-3 whitespace-nowrap text-center text-xs text-gray-600 ${idx === uniqueDisplayPeriods.length - 1 ? "border-r border-black" : "border-r border-gray-100"}`}
                        >
                          {value !== null ? `${value}%` : "-"}
                        </td>
                      );
                    })
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default YarnRealizationComparison;
