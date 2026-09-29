// src/pages/complaint/ComplaintDistributionCharts.tsx

import { useEffect, useState, useMemo } from "react";
import { API_BASE_URL } from "../../config";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";

interface Complaint {
  status?: string | null;
  market?: string | null;
  bill_to_region?: string | null;
  query_received_date?: string | null;
  customer_type?: string | null;
  nature_of_complaint?: string | null;
}

interface Props {
  selectedYear: string;
  selectedTab: "yarn" | "fabric";
  filters?: Record<string, string>;
}

const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function ComplaintDistributionCharts({ selectedYear, selectedTab, filters = {} }: Props) {
  const [data, setData] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch distribution data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedYear, selectedTab, filters]);

  const customerTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const type = item.customer_type || "Unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const marketData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const market = item.market || "Unknown";
      counts[market] = (counts[market] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data]);

  const regionData = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((item) => {
      const region = item.bill_to_region || "Unknown";
      counts[region] = (counts[region] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Customer Type Distribution - Column */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-wider">
          <span className="w-1.5 h-4 bg-red-600 rounded-full"></span>
          Customer Type Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={customerTypeData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const value = payload.value;
                  const maxLength = 10;
                  
                  if (value.length <= maxLength) {
                    return (
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={700}>
                        {value}
                      </text>
                    );
                  }

                  const words = value.split(/\s+/);
                  const lines: string[] = [];
                  let currentLine = "";

                  words.forEach((word: string) => {
                    if (currentLine && (currentLine + word).length > maxLength) {
                      lines.push(currentLine.trim());
                      currentLine = word + " ";
                    } else {
                      currentLine += word + " ";
                    }
                  });
                  if (currentLine) lines.push(currentLine.trim());

                  return (
                    <text x={x} y={y + 8} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={700}>
                      {lines.slice(0, 3).map((line, index) => (
                        <tspan x={x} dy={index === 0 ? 0 : 10} key={index}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                }}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30}>
                {customerTypeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 700 }} offset={5} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Markets - Column */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-wider">
          <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
          Top 5 Markets
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marketData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                interval={0}
                tick={(props: any) => {
                  const { x, y, payload } = props;
                  const value = payload.value;
                  const maxLength = 10;
                  
                  if (value.length <= maxLength) {
                    return (
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={700}>
                        {value}
                      </text>
                    );
                  }

                  const words = value.split(/\s+/);
                  const lines: string[] = [];
                  let currentLine = "";

                  words.forEach((word: string) => {
                    if (currentLine && (currentLine + word).length > maxLength) {
                      lines.push(currentLine.trim());
                      currentLine = word + " ";
                    } else {
                      currentLine += word + " ";
                    }
                  });
                  if (currentLine) lines.push(currentLine.trim());

                  return (
                    <text x={x} y={y + 8} textAnchor="middle" fontSize={9} fill="#6b7280" fontWeight={700}>
                      {lines.slice(0, 3).map((line, index) => (
                        <tspan x={x} dy={index === 0 ? 0 : 10} key={index}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  );
                }}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30}>
                {marketData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="top" style={{ fill: '#374151', fontSize: 10, fontWeight: 700 }} offset={5} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Regional Distribution - Column */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
        <h3 className="text-sm font-black text-gray-900 mb-6 flex items-center gap-2 uppercase tracking-wider">
          <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
          Regional Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={regionData} layout="vertical" margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }}
                width={70}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                {regionData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                ))}
                <LabelList dataKey="value" position="right" style={{ fill: '#374151', fontSize: 10, fontWeight: 700 }} offset={5} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
