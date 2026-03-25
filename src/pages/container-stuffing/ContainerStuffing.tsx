import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from "../../config";
import SingleSpecs from './SingleSpecs';
import MultiSpecs from './MultiSpecs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ContainerDimensions {
  length: number;
  width: number;
  height: number;
}

interface ConeSpecs {
  weight: number;
  conesPerCarton: number;
  diameter: number;
  height: number;
}

interface Results {
  cartonL: number;
  cartonW: number;
  cartonH: number;
  fitL: number;
  fitW: number;
  fitH: number;
  totalCartons: number;
  totalCones: number;
  totalWeight: number;
  layout: { rows: number; cols: number; layers: number };
  unusedL: number;
  unusedW: number;
  unusedH: number;
  gapStatus?: {
    l: 'ok' | 'low' | 'high';
    w: 'ok' | 'low' | 'high';
    h: 'ok' | 'low' | 'high';
    isIdeal: boolean;
  };
  // Multi-type support
  isMulti?: boolean;
  carton2?: {
    l: number;
    w: number;
    h: number;
    totalCartons: number;
    fitL: number;
    fitW: number;
    fitH: number;
    conesPerCarton?: number;
  };
}

const ContainerStuffing: React.FC<{ user: any }> = ({ user }) => {
  const [stuffingType, setStuffingType] = useState<'single' | 'multi'>('single');
  const [container, setContainer] = useState<ContainerDimensions>({
    length: 12000,
    width: 2350,
    height: 2650,
  });

  const [cone, setCone] = useState<ConeSpecs>({
    weight: 2.1,
    conesPerCarton: 18,
    diameter: 190,
    height: 170,
  });

  const [conesPerCarton2, setConesPerCarton2] = useState<number>(18);

  const [manualCarton, setManualCarton] = useState({
    l: '',
    w: '',
    h: '',
  });

  const [manualCarton2, setManualCarton2] = useState({
    l: '',
    w: '',
    h: '',
  });

  const [results, setResults] = useState<Results[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isSpecsVisible, setIsSpecsVisible] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'container' | 'carton'>('container');
  const [isAnalysing, setIsAnalysing] = useState<boolean>(false);

  // 3D Rotation and Zoom State
  const [rotation, setRotation] = useState({ x: -25, y: -25 });
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      if (!sceneRef.current?.contains(e.target as Node)) return;
      
      // Prevent main page scroll
      e.preventDefault();
      
      // Perform zoom
      setZoom(prev => Math.min(Math.max(prev - e.deltaY * 0.001, 0.5), 3));
    };

    // Use non-passive listener to allow preventDefault
    window.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = e.clientX - lastMousePos.current.x;
      const deltaY = e.clientY - lastMousePos.current.y;
      setRotation(prev => ({
        x: prev.x - deltaY * 0.5,
        y: prev.y + deltaX * 0.5
      }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseUp = () => { isDragging.current = false; };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('wheel', handleWheelEvent);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleAnalyse = async () => {
    setIsAnalysing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/analyse-stuffing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: stuffingType,
          container,
          cone,
          conesPerCarton2: stuffingType === 'multi' ? conesPerCarton2 : null,
          carton1: (manualCarton.l && manualCarton.w && manualCarton.h) ? manualCarton : null,
          carton2: (manualCarton2.l && manualCarton2.w && manualCarton2.h) ? manualCarton2 : null,
        }),
      });
      const data = await response.json();
      console.log("Analysis Result:", data);
      if (data.success) {
        setResults(data.results);
        setSelectedIndex(0);
        setIsSpecsVisible(false);
      } else {
        alert("Analysis failed: " + data.error);
      }
    } catch (err) {
      console.error("Analysis error:", err);
      alert("An error occurred during analysis.");
    } finally {
      setIsAnalysing(false);
    }
  };

  const generatePDF = () => {
    if (results.length === 0) return;
    const header = window.prompt("Enter Header for PDF Report:", "Container Stuffing Report") || "Container Stuffing Report";
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(180, 0, 0);
    doc.text(header, 105, 15, { align: 'center' });

    const tableRows = [
      ["Cone Weight", ...results.map(r => r.isMulti ? `${cone.weight} / ${cone.weight}` : cone.weight.toFixed(2))],
      ["No of cones", ...results.map(r => r.isMulti ? `${cone.conesPerCarton} / ${r.carton2?.conesPerCarton}` : cone.conesPerCarton)],
      ["Carton weight", ...results.map(r => r.isMulti ? `${(cone.weight * cone.conesPerCarton).toFixed(1)} / ${(cone.weight * (r.carton2?.conesPerCarton || 0)).toFixed(1)}` : (cone.weight * cone.conesPerCarton).toFixed(1))],
      ["No of cartons", ...results.map(r => r.isMulti ? `${r.totalCartons} / ${r.carton2?.totalCartons}` : r.totalCartons)],
      ["Stuffing", ...results.map(r => r.totalWeight.toLocaleString())],
      ["", ...results.map(_ => "")], // Empty separator
      ["Carton Size", ...results.map(r => r.isMulti ? `${(r.cartonL * 10).toFixed(0)}X${(r.cartonW * 10).toFixed(0)}X${(r.cartonH * 10).toFixed(0)} / ${((r.carton2?.l || 0) * 10).toFixed(0)}X${((r.carton2?.w || 0) * 10).toFixed(0)}X${((r.carton2?.h || 0) * 10).toFixed(0)}` : `${(r.cartonL * 10).toFixed(0)}X${(r.cartonW * 10).toFixed(0)}X${(r.cartonH * 10).toFixed(0)}`)],
      ["Avg Cone Dia", ...results.map(_ => cone.diameter)],
      ["", ...results.map(_ => "")],
      ["Container", ...results.map(_ => "")],
      ["Length", ...results.map(r => r.isMulti ? `${r.fitL} / ${r.carton2?.fitL}` : r.fitL)],
      ["Width", ...results.map(r => r.isMulti ? `${r.fitW} / ${r.carton2?.fitW}` : r.fitW)],
      ["Height", ...results.map(r => r.isMulti ? `${r.fitH} / ${r.carton2?.fitH}` : r.fitH)],
      ["No of cartons", ...results.map(r => r.isMulti ? `${r.totalCartons} / ${r.carton2?.totalCartons}` : r.totalCartons)],
      ["", ...results.map(_ => "")],
      ["Carton", ...results.map(_ => "")],
      ["Length", ...results.map(r => r.isMulti ? `${r.layout.cols || "-"} / ${r.carton2?.layout?.cols || "-"}` : (r.layout.cols || "-"))],
      ["Width", ...results.map(r => r.isMulti ? `${r.layout.rows || "-"} / ${r.carton2?.layout?.rows || "-"}` : (r.layout.rows || "-"))],
      ["Height", ...results.map(r => r.isMulti ? `${r.layout.layers || "-"} / ${r.carton2?.layout?.layers || "-"}` : (r.layout.layers || "-"))],
      ["No of cartons", ...results.map(r => r.isMulti ? `${cone.conesPerCarton} / ${r.carton2?.conesPerCarton}` : cone.conesPerCarton)],
    ];

    autoTable(doc, {
      head: [["STATUS", ...results.map((_, i) => `Option-${i + 1}`)]],
      body: tableRows,
      startY: 25,
      styles: { cellPadding: 3, fontSize: 10, halign: 'center' },
      headStyles: { fillColor: [180, 0, 0], textColor: [255, 255, 255] },
      columnStyles: { 0: { fontStyle: 'bold', halign: 'left', fillColor: [245, 245, 245] } },
      didParseCell: (data) => {
        // Highlighting for "Stuffing" row
        if (data.row.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          if (data.section === 'body' && data.column.index > 0) {
            data.cell.styles.fillColor = data.column.index === 1 ? [255, 230, 200] : [220, 235, 255];
          }
        }
        // Coloring for "Carton Size" cells
        if (data.row.index === 6 && data.section === 'body') {
           data.cell.styles.fillColor = data.column.index === 1 ? [255, 230, 200] : [220, 235, 255];
        }
        // Section headers
        if ([9, 15].includes(data.row.index)) {
          data.cell.styles.fillColor = [220, 220, 220];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Container_Stuffing_Report_${new Date().getTime()}.pdf`);
  };

  const currentResult = results[selectedIndex];

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 select-none">
      <div className="flex items-center justify-between border-b border-red-100 pb-4">
        <h2 className="text-2xl font-bold text-red-700">Container Stuffing Analysis</h2>
        <div className="flex items-center gap-4">
          {results.length > 0 && (
            <button 
              onClick={generatePDF} 
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition shadow-sm"
              title="Download Report as PDF"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest">PDF</span>
            </button>
          )}
          <button onClick={() => setIsSpecsVisible(!isSpecsVisible)} className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition">
            {isSpecsVisible ? 'Hide Specs' : 'Show Specs'}
            <svg className={`w-5 h-5 transition-transform ${isSpecsVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      </div>

      {isSpecsVisible && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6 animate-in slide-in-from-top duration-300">
          <div className="flex justify-center p-1 bg-gray-50 rounded-xl w-fit mx-auto border border-gray-200">
            <button 
              onClick={() => { setStuffingType('single'); setResults([]); }} 
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${stuffingType === 'single' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Single Type
            </button>
            <button 
              onClick={() => { setStuffingType('multi'); setResults([]); }} 
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${stuffingType === 'multi' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Multi Type
            </button>
          </div>

          {stuffingType === 'single' ? (
            <SingleSpecs 
              container={container} setContainer={setContainer}
              cone={cone} setCone={setCone}
              manualCarton={manualCarton} setManualCarton={setManualCarton}
              handleAnalyse={handleAnalyse} isAnalysing={isAnalysing}
            />
          ) : (
            <MultiSpecs 
              container={container} setContainer={setContainer}
              cone={cone} setCone={setCone}
              conesPerCarton2={conesPerCarton2} setConesPerCarton2={setConesPerCarton2}
              manualCarton={manualCarton} setManualCarton={setManualCarton}
              manualCarton2={manualCarton2} setManualCarton2={setManualCarton2}
              handleAnalyse={handleAnalyse} isAnalysing={isAnalysing}
            />
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {results.map((res, idx) => (
              <button key={idx} onClick={() => setSelectedIndex(idx)} className={`text-left p-6 rounded-2xl border-2 transition-all duration-300 ${selectedIndex === idx ? 'border-red-600 bg-red-50/50 shadow-xl scale-[1.02]' : 'border-gray-100 bg-white hover:border-red-200 shadow-sm'}`}>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase ${idx === 0 ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>Option {idx + 1}</span>
                  {idx === 0 && <span className="text-[10px] text-red-600 font-black animate-pulse">BEST STUFFING</span>}
                  {res.gapStatus && !res.gapStatus.isIdeal && (
                    <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-black tracking-tighter">GAP ALERT</span>
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-3xl font-black text-gray-900">{res.totalWeight.toLocaleString()} <span className="text-sm font-medium text-gray-500">Kg Stuffing</span></h4>
                  <p className="text-sm text-gray-500 font-medium">{res.isMulti ? (res.totalCartons + (res.carton2?.totalCartons || 0)) : res.totalCartons} Total Cartons</p>
                </div>
                {res.isMulti ? (
                  <div className="mt-6 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase text-gray-400">
                      <div><p>Carton 1 ({res.totalCartons})</p><p className="text-gray-900 text-xs">{(res.cartonL * 10).toFixed(0)}x{(res.cartonW * 10).toFixed(0)}x{(res.cartonH * 10).toFixed(0)}</p></div>
                      <div><p>Carton 2 ({res.carton2?.totalCartons})</p><p className="text-gray-900 text-xs">{((res.carton2?.l || 0) * 10).toFixed(0)}x{((res.carton2?.w || 0) * 10).toFixed(0)}x{((res.carton2?.h || 0) * 10).toFixed(0)}</p></div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-4 text-[10px] font-bold uppercase text-gray-400">
                    <div><p>Carton Size</p><p className="text-gray-900 text-xs">{(res.cartonL * 10).toFixed(0)}x{(res.cartonW * 10).toFixed(0)}x{(res.cartonH * 10).toFixed(0)} mm</p></div>
                    <div><p>Configuration</p><p className="text-gray-900 text-xs">{res.fitL}L x {res.fitW}W x {res.fitH}H</p></div>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 space-y-8">
                <h3 className="text-xl font-black text-gray-900 border-b pb-4">Detailed Results</h3>
                <div className="grid grid-cols-2 gap-8">
                  <StatItem label="Total Weight" value={`${currentResult.totalWeight.toLocaleString()} kg`} />
                  <StatItem label="Total Cones" value={currentResult.totalCones.toLocaleString()} />
                  {currentResult.isMulti ? (
                    <>
                      <StatItem label="Carton 1 Type" value={`${currentResult.totalCartons} Boxes (${cone.conesPerCarton} Cones/carton)`} />
                      <StatItem label="C1 Internal Layout" value={currentResult.layout.cols > 0 ? `${currentResult.layout.cols}x${currentResult.layout.rows}x${currentResult.layout.layers}` : "-"} />
                      <StatItem label="Carton 2 Type" value={`${currentResult.carton2?.totalCartons} Boxes (${currentResult.carton2?.conesPerCarton || conesPerCarton2} Cones/carton)`} />
                      <StatItem label="C2 Internal Layout" value={currentResult.carton2?.layout && currentResult.carton2.layout.cols > 0 ? `${currentResult.carton2.layout.cols}x${currentResult.carton2.layout.rows}x${currentResult.carton2.layout.layers}` : "-"} />
                    </>
                  ) : (
                    <StatItem label="Internal Layout" value={currentResult.layout.cols > 0 ? `${currentResult.layout.cols}x${currentResult.layout.rows}x${currentResult.layout.layers} Cones` : '-'} />
                  )}
                  <StatItem label="Safety Gap (L)" value={`${currentResult.unusedL.toFixed(0)} mm`} color={currentResult.gapStatus?.l === 'ok' ? 'text-green-600' : 'text-yellow-600'} />
                  <StatItem label="Safety Gap (W)" value={`${currentResult.unusedW.toFixed(0)} mm`} color={currentResult.gapStatus?.w === 'ok' ? 'text-green-600' : 'text-yellow-600'} />
                  <StatItem label="Safety Gap (H)" value={`${currentResult.unusedH.toFixed(0)} mm`} color={currentResult.gapStatus?.h === 'ok' ? 'text-green-600' : 'text-yellow-600'} />
                </div>
                {currentResult.gapStatus && !currentResult.gapStatus.isIdeal && (
                  <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                    <p className="text-[10px] text-yellow-700 font-bold uppercase tracking-tight">Note: Ideal gap (50-120mm) not maintained in some dimensions.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 bg-gray-900 rounded-3xl shadow-2xl overflow-hidden relative group">
              <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
                <div className="flex bg-gray-800/80 p-1 rounded-xl backdrop-blur-md border border-gray-700">
                  <button onClick={() => setViewMode('container')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'container' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Container View</button>
                  <button onClick={() => setViewMode('carton')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'carton' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Carton View</button>
                </div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-gray-800/80 px-4 py-2 rounded-xl border border-gray-700">Rotate (Drag) | Zoom (Scroll)</div>
              </div>

              <div 
                ref={sceneRef}
                className="w-full h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing perspective-[1200px]" 
                onMouseDown={handleMouseDown}
              >
                <div className="relative transform-style-3d transition-transform duration-100" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${zoom})` }}>
                  {viewMode === 'container' ? (
                    <div className="relative w-80 h-40 border-2 border-red-500/20 bg-red-500/5 transform-style-3d">
                       <div className="absolute inset-0 border-2 border-red-500/10 translate-z-[-100px]" />
                       {currentResult.isMulti ? (
                         <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 transform-style-3d" style={{ transform: 'translateZ(20px)' }}>
                           {/* Carton 1 */}
                           <div className="w-24 h-16 bg-red-600 border-2 border-white rounded-lg shadow-2xl transform-style-3d flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-[8px] font-black text-white uppercase">Size 1 ({cone.conesPerCarton} Cones)</p>
                                <p className="text-[6px] text-red-200">{(currentResult.cartonL * 10).toFixed(0)}x{(currentResult.cartonW * 10).toFixed(0)}x{(currentResult.cartonH * 10).toFixed(0)}</p>
                              </div>
                           </div>
                           {/* Carton 2 */}
                           <div className="w-24 h-16 bg-blue-600 border-2 border-white rounded-lg shadow-2xl transform-style-3d flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-[8px] font-black text-white uppercase">Size 2 ({currentResult.carton2?.conesPerCarton || conesPerCarton2} Cones)</p>
                                <p className="text-[6px] text-blue-100">{((currentResult.carton2?.l || 0) * 10).toFixed(0)}x{((currentResult.carton2?.w || 0) * 10).toFixed(0)}x{((currentResult.carton2?.h || 0) * 10).toFixed(0)}</p>
                              </div>
                           </div>
                         </div>
                       ) : (
                         <div className="absolute left-1/2 top-1/2 w-32 h-20 -translate-x-1/2 -translate-y-1/2 bg-red-600 border-2 border-white rounded-lg shadow-2xl transform-style-3d flex items-center justify-center" style={{ transform: 'translateZ(20px)' }}>
                            <div className="text-center">
                              <p className="text-[10px] font-black text-white uppercase tracking-tighter">Sample Carton</p>
                              <p className="text-[8px] text-red-200">
                                {(currentResult.cartonL * 10).toFixed(0)}x{(currentResult.cartonW * 10).toFixed(0)}x{(currentResult.cartonH * 10).toFixed(0)} mm
                              </p>
                            </div>
                         </div>
                       )}
                       
                       <div className="absolute -right-12 top-1/2 -translate-y-1/2 flex items-center group">
                          <div className="w-8 h-0.5 bg-yellow-400"></div>
                          <div className="w-2 h-2 border-t-2 border-r-2 border-yellow-400 rotate-45 -ml-1"></div>
                          <span className="absolute left-2 -top-4 text-[8px] font-black text-yellow-400 whitespace-nowrap">TO CONTAINER L</span>
                       </div>
                       <div className="absolute left-1/2 -top-12 -translate-x-1/2 flex flex-col items-center group">
                          <div className="w-2 h-2 border-t-2 border-l-2 border-yellow-400 rotate-45 -mb-1"></div>
                          <div className="w-0.5 h-8 bg-yellow-400"></div>
                          <span className="text-[8px] font-black text-yellow-400 whitespace-nowrap mb-1">TO CONTAINER W</span>
                       </div>
                       <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex items-center flex-row-reverse group">
                          <div className="w-8 h-0.5 bg-blue-400"></div>
                          <div className="w-2 h-2 border-t-2 border-l-2 border-blue-400 -rotate-45 -mr-1"></div>
                          <span className="absolute right-2 -bottom-4 text-[8px] font-black text-blue-400 whitespace-nowrap">TO CONTAINER H</span>
                       </div>
                    </div>
                  ) : (
                    <div className="relative w-64 h-64 border-4 border-red-500/40 bg-red-500/5 transform-style-3d rounded-2xl flex items-center justify-center p-8">
                       {currentResult.layout.cols > 0 ? (
                         <>
                           <div className="absolute inset-0 border-2 border-red-500/20 translate-z-[-40px] rounded-2xl" />
                           <div className="grid gap-4 transform-style-3d" style={{ gridTemplateColumns: `repeat(${currentResult.layout.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${currentResult.layout.rows}, minmax(0, 1fr))` }}>
                              {Array.from({ length: Math.min(currentResult.layout.cols * currentResult.layout.rows, 16) }).map((_, i) => (
                                <div key={i} className="relative transform-style-3d">
                                   {Array.from({ length: currentResult.layout.layers }).map((_, layer) => (
                                     <div key={layer} className="w-10 h-10 rounded-full border-2 border-red-400 bg-white shadow-xl flex items-center justify-center transform-style-3d" style={{ transform: `translateZ(${layer * 15}px)`, marginTop: layer === 0 ? 0 : -40 }}>
                                        <div className="w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-[8px] font-black text-red-600">L{layer + 1}</div>
                                     </div>
                                   ))}
                                </div>
                              ))}
                           </div>
                           <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-black text-gray-500 uppercase tracking-widest">{currentResult.layout.rows} Rows</div>
                           <div className="absolute left-1/2 -bottom-8 -translate-x-1/2 text-[10px] font-black text-gray-500 uppercase tracking-widest">{currentResult.layout.cols} Columns</div>
                           <div className="absolute -right-12 top-1/2 -translate-y-1/2 rotate-90 text-[10px] font-black text-red-500 uppercase tracking-widest">{currentResult.layout.layers} Layers</div>
                         </>
                       ) : (
                         <div className="text-white text-center">
                            <p className="text-xl font-black">MANUAL CARTON</p>
                            <p className="text-[10px] text-gray-400 uppercase mt-2">Cone layout not calculated for manual size</p>
                         </div>
                       )}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute bottom-6 left-6 z-20">
                <div className="bg-gray-800/90 p-4 rounded-2xl border border-gray-700 backdrop-blur-sm">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Configuration</p>
                  <p className="text-sm font-black text-white">
                    {viewMode === 'container' 
                       ? currentResult.isMulti 
                         ? `${currentResult.fitL}Lx${currentResult.fitW}Wx${currentResult.fitH}H (Type 1) + ${currentResult.carton2?.fitL}Lx${currentResult.carton2?.fitW}Wx${currentResult.carton2?.fitH}H (Type 2)`
                         : `${currentResult.fitL}L x ${currentResult.fitW}W x ${currentResult.fitH}H (Pattern)` 
                       : currentResult.layout.cols > 0 
                         ? `${currentResult.layout.cols} Cols x ${currentResult.layout.rows} Rows x ${currentResult.layout.layers} Layers` 
                         : 'Custom Carton Size'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatItem = ({ label, value, color = "text-gray-900" }: { label: string, value: string, color?: string }) => (
  <div className="space-y-1">
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
    <p className={`text-lg font-black ${color}`}>{value}</p>
  </div>
);

export default ContainerStuffing;
