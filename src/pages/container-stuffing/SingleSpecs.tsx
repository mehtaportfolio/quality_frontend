import React from 'react';

interface SingleSpecsProps {
  container: { length: number; width: number; height: number };
  setContainer: (c: any) => void;
  cone: { weight: number; conesPerCarton: number; diameter: number; height: number };
  setCone: (c: any) => void;
  manualCarton: { l: string; w: string; h: string };
  setManualCarton: (c: any) => void;
  handleAnalyse: () => void;
  isAnalysing: boolean;
}

const SingleSpecs: React.FC<SingleSpecsProps> = ({
  container, setContainer, cone, setCone, manualCarton, setManualCarton, handleAnalyse, isAnalysing
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top duration-300">
      <div className="space-y-3">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Container (mm)</label>
        <div className="flex gap-2">
          <input type="number" value={container.length} onChange={(e) => setContainer({ ...container, length: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="L" />
          <input type="number" value={container.width} onChange={(e) => setContainer({ ...container, width: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="W" />
          <input type="number" value={container.height} onChange={(e) => setContainer({ ...container, height: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="H" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cone Wt (kg)</label>
            <input type="number" value={cone.weight} onChange={(e) => setCone({ ...cone, weight: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="Kg" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">No of Cones</label>
            <input type="number" value={cone.conesPerCarton} onChange={(e) => setCone({ ...cone, conesPerCarton: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="Count" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cone Dia (mm)</label>
            <input type="number" value={cone.diameter} onChange={(e) => setCone({ ...cone, diameter: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="Dia" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cone Length (mm)</label>
            <input type="number" value={cone.height} onChange={(e) => setCone({ ...cone, height: Number(e.target.value) })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="Length" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manual Carton (mm) <span className="text-[8px] normal-case opacity-60">(Optional)</span></label>
        <div className="flex gap-2">
          <input type="number" value={manualCarton.l} onChange={(e) => setManualCarton({ ...manualCarton, l: e.target.value })} className="w-full p-2.5 bg-red-50/30 border border-red-100 rounded-xl text-sm outline-none" placeholder="L" />
          <input type="number" value={manualCarton.w} onChange={(e) => setManualCarton({ ...manualCarton, w: e.target.value })} className="w-full p-2.5 bg-red-50/30 border border-red-100 rounded-xl text-sm outline-none" placeholder="W" />
          <input type="number" value={manualCarton.h} onChange={(e) => setManualCarton({ ...manualCarton, h: e.target.value })} className="w-full p-2.5 bg-red-50/30 border border-red-100 rounded-xl text-sm outline-none" placeholder="H" />
        </div>
      </div>
      <div className="md:col-span-4 flex justify-end">
        <button 
          onClick={handleAnalyse} 
          disabled={isAnalysing}
          className={`px-8 py-3 bg-red-600 text-white font-bold rounded-xl transition shadow-lg shadow-red-200 ${isAnalysing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'}`}
        >
          {isAnalysing ? 'Analysing...' : 'Analyse Stuffing'}
        </button>
      </div>
    </div>
  );
};

export default SingleSpecs;
