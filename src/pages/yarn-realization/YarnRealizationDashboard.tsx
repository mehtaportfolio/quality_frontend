import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from "recharts";

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

interface YarnRealizationDashboardProps {
  data: YarnRealizationData[];
  selectedPeriod: string;
  formatUnit: (unit: string) => string;
  COLORS: string[];
}

const YarnRealizationDashboard: React.FC<YarnRealizationDashboardProps> = ({ 
  data, 
  selectedPeriod, 
  formatUnit, 
  COLORS 
}) => {
  const [selectedParam, setSelectedParam] = useState<string>("yarn_realization");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [rotatingUnitIndex, setRotatingUnitIndex] = useState(0);
  const [comparisonMode, setComparisonMode] = useState<"unit-wise" | "period-wise">("unit-wise");
  const [selectedUnitForPeriod, setSelectedUnitForPeriod] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (data.length > 0) {
      const filteredForLatest = data.filter(item => item.period?.toLowerCase() === selectedPeriod.toLowerCase());
      if (filteredForLatest.length > 0) {
        const latestEntry = filteredForLatest[0];
        const latestDate = new Date(latestEntry.date);
        setSelectedMonth(latestDate.getMonth());
        setSelectedYear(latestDate.getFullYear());

        const sortedDates = Array.from(new Set(data.map((item: any) => item.date.split('T')[0]))).sort() as string[];
        if (sortedDates.length > 0) {
          setStartDate(sortedDates[Math.max(0, sortedDates.length - 6)]);
          setEndDate(sortedDates[sortedDates.length - 1]);
        }

        const units = Array.from(new Set(data.map((item: any) => item.unit))) as string[];
        if (units.length > 0 && !selectedUnitForPeriod) {
          setSelectedUnitForPeriod(units[0]);
        }
      }
    }
  }, [data, selectedPeriod]);

  useEffect(() => {
    setRotatingUnitIndex(0);
    const filteredForLatest = data.filter(item => item.period?.toLowerCase() === selectedPeriod.toLowerCase());
    const latestDateStr = filteredForLatest[0]?.date;
    const latestMonthDataCount = filteredForLatest.filter(item => item.date === latestDateStr).length;

    if (latestMonthDataCount === 0) return;
    
    const interval = setInterval(() => {
      setRotatingUnitIndex((prev) => (prev + 1) % latestMonthDataCount);
    }, 10000);
    return () => clearInterval(interval);
  }, [data, selectedPeriod]);

  const filteredData = data.filter(item => item.period?.toLowerCase() === selectedPeriod.toLowerCase());
  const latestDateStr = filteredData[0]?.date;
  const latestMonthData = filteredData
    .filter(item => item.date === latestDateStr)
    .sort((a, b) => a.unit.localeCompare(b.unit));
  const latestInfo = latestMonthData[0];

  const units = Array.from(new Set(filteredData.map(item => item.unit))).sort();
  const years = Array.from(new Set(filteredData.map(item => new Date(item.date).getFullYear()))).sort((a, b) => b - a);
  const months = [
    { name: "January", value: 0 },
    { name: "February", value: 1 },
    { name: "March", value: 2 },
    { name: "April", value: 3 },
    { name: "May", value: 4 },
    { name: "June", value: 5 },
    { name: "July", value: 6 },
    { name: "August", value: 7 },
    { name: "September", value: 8 },
    { name: "October", value: 9 },
    { name: "November", value: 10 },
    { name: "December", value: 11 },
  ];

  const getChartData = () => {
    if (comparisonMode === "unit-wise") {
      return filteredData
        .filter(item => {
          const d = new Date(item.date);
          return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        })
        .map(item => ({
          name: item.unit,
          value: item[selectedParam as keyof YarnRealizationData] as number,
          originalName: item.unit
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return filteredData
        .filter(item => {
          const itemDate = item.date.split('T')[0];
          const start = startDate.split('T')[0];
          const end = endDate.split('T')[0];
          
          return item.unit === selectedUnitForPeriod && 
                 itemDate >= start && 
                 itemDate <= end;
        })
        .map(item => {
          const d = new Date(item.date);
          const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }).replace(' ', '-');
          
          return {
            name: label,
            value: item[selectedParam as keyof YarnRealizationData] as number,
            originalName: item.date
          };
        })
        .sort((a, b) => a.originalName.localeCompare(b.originalName));
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-4 mb-8">
        {latestMonthData.map((item) => {
          const unitDisplay = formatUnit(item.unit).replace("U-", "U");
          return (
            <div 
              key={item.id} 
              className="bg-red-600 text-white px-6 py-3 rounded-lg shadow-md flex flex-col items-center justify-center font-bold min-w-[140px] border border-red-700"
            >
              <span className="text-sm uppercase tracking-wider">{unitDisplay}</span>
              <span className="text-2xl">{item.yarn_realization ?? "-"}%</span>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wider">
            Waste Analysis - <span className="text-red-600">{formatUnit(latestMonthData[rotatingUnitIndex]?.unit || "")}</span>
          </h3>
          <div className="flex gap-1.5">
            {latestMonthData.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-500 ${idx === rotatingUnitIndex ? "w-10 bg-red-600 shadow-sm shadow-red-200" : "w-2.5 bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "BR Dropping", key: "br_dropping" },
            { label: "Card Dropping", key: "card_dropping" },
            { label: "Flat Waste", key: "flat_waste" },
            { label: "Waste upto Card", key: "upto_card_waste" },
            { label: "Comber Noil", key: "comber_noil" },
            { label: "Invisible Loss", key: "invisible_loss" },
            { label: "Overall Waste", key: "overall_waste" }
          ].map((card) => {
            const currentData = latestMonthData[rotatingUnitIndex];
            const value = currentData ? currentData[card.key as keyof YarnRealizationData] : null;
            return (
              <div key={card.key} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center transition-all hover:shadow-md hover:border-red-100 group">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-3">{card.label}</p>
                <p className="text-2xl font-black text-gray-800 my-1">{value ?? "-"}%</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-6">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-gray-800 whitespace-nowrap">Comparison Across Units</h3>
            <select
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="unit-wise">Unit-wise</option>
              <option value="period-wise">Period-wise</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Parameter:</span>
              <select
                value={selectedParam}
                onChange={(e) => setSelectedParam(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="yarn_realization">Yarn Realization</option>
                <option value="overall_waste">Overall Waste</option>
                <option value="upto_card_waste">Waste upto Card</option>
                <option value="comber_noil">Comber Noil</option>
                <option value="invisible_loss">Invisible Loss</option>
              </select>
            </div>

            {comparisonMode === "unit-wise" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Month:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {months.map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Year:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Unit:</span>
                  <select
                    value={selectedUnitForPeriod}
                    onChange={(e) => setSelectedUnitForPeriod(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {units.map(u => (
                      <option key={u} value={u}>{formatUnit(u)}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Start:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">End:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickFormatter={(value) => formatUnit(value)} />
              <YAxis domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.2) || 10]} />
              <Tooltip 
                formatter={(value: any, _name: any, props: any) => [`${value}%`, formatUnit(props.payload.name)]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                {getChartData().map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="top" formatter={(v: any) => v !== null ? `${v}%` : ""} style={{ fontWeight: 'bold', fontSize: '12px' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
};

export default YarnRealizationDashboard;
