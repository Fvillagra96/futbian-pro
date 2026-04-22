'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Multa { id: string; club: string; motivo: string; monto: number; fecha: string; estado: string; }

export default function EstadoDeCuentaClub() {
  const { club: miClub, cargando: authCargando } = useAuth();
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [multas, setMultas] = useState<Multa[]>([]);

  useEffect(() => {
    if (authCargando) return;
    const unsubM = onSnapshot(query(collection(db, "asociaciones/san_fabian/multas"), orderBy("fecha", "desc")), (snap) => {
      setMultas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Multa[]);
      setCargandoDatos(false);
    });
    return () => unsubM();
  }, [authCargando]);

  const misMultas = multas.filter(m => m.club === miClub);
  const deudaTotal = useMemo(() => misMultas.filter(m => m.estado === "Pendiente").reduce((total, m) => total + m.monto, 0), [misMultas]);

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando estado de cuenta...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Tesorería de la Asociación</h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">ESTADO DE CUENTA</h1>
            <p className="text-slate-400 mt-2 text-xs md:text-sm">Historial de multas de: {miClub}</p>
          </div>
          <div className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm min-w-[200px] text-center shadow-inner">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-1">Deuda Actual</span>
            <span className={`text-3xl md:text-4xl font-black ${deudaTotal > 0 ? 'text-red-400' : 'text-emerald-400'}`}>${deudaTotal.toLocaleString('es-CL')}</span>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] pointer-events-none">💰</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-black text-slate-800 tracking-tight mb-6 flex items-center gap-2 border-b pb-4"><span className="text-xl">🧾</span> Historial de Movimientos</h3>
        <div className="space-y-3">
          {misMultas.length === 0 ? (
            <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold">El club no registra multas en esta temporada. ¡Excelente conducta!</div>
          ) : (
            misMultas.map(m => (
              <div key={m.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase bg-white px-2 py-0.5 rounded shadow-sm border">{new Date(m.fecha).toLocaleDateString('es-CL')}</span>
                    {m.estado === "Pendiente" ? <span className="text-[9px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Deuda Activa</span> : <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-widest">Pagado</span>}
                  </div>
                  <p className="font-bold text-slate-800 text-sm md:text-base uppercase">{m.motivo}</p>
                </div>
                <div className="text-right w-full md:w-auto flex justify-between md:block items-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase md:hidden">Monto:</span>
                  <span className={`text-xl md:text-2xl font-black ${m.estado === "Pendiente" ? 'text-red-500' : 'text-slate-400 line-through decoration-slate-300'}`}>${m.monto.toLocaleString('es-CL')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}