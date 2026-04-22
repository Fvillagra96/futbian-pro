'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Evento { id: string; tipo: string; jugador: string; rut: string; equipo: string; minuto: string; }
interface Partido { 
  id: string; fechaNumero: number; local: string; visita: string; serie: string; 
  golesLocal: number; golesVisita: number; estado: string; 
  eventos?: Evento[]; nomina?: JugadorNomina[]; respaldoActa?: string; 
}

export default function HistorialActas() {
  const { rol: rolUsuario, club: clubUsuario, cargando: authCargando } = useAuth();
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState<string>("");

  useEffect(() => {
    if (authCargando) return;
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      setPartidos(data.filter(p => p.estado === "Finalizado"));
      setCargandoDatos(false);
    });
    return () => unsubP();
  }, [authCargando]);

  const partidosVisibles = partidos.filter(p => rolUsuario === 'admin' ? true : (p.local === clubUsuario || p.visita === clubUsuario));
  const partidoActivo = partidosVisibles.find(p => p.id === partidoSeleccionadoId);

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a]">Cargando archivo histórico...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-2 md:p-6 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Archivo Digital</h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">HISTORIAL DE ACTAS</h1>
            <p className="text-slate-400 mt-2 text-xs md:text-sm">Registro inmutable de encuentros finalizados.</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm">
            <p className="text-[10px] font-bold text-slate-300 uppercase">Vista de Acceso</p>
            <p className="text-sm font-black text-white">{rolUsuario === 'admin' ? '🛡️ Admin Global' : `🛡️ ${clubUsuario}`}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] pointer-events-none">📚</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200"><h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">Encuentros Jugados</h3></div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {partidosVisibles.length === 0 ? <p className="text-center p-6 text-slate-400 text-sm font-medium">Aún no hay actas cerradas en el historial.</p> : (
              partidosVisibles.map(p => (
                <button key={p.id} onClick={() => setPartidoSeleccionadoId(p.id)} className={`w-full text-left p-4 rounded-xl border transition-all ${partidoSeleccionadoId === p.id ? 'bg-[#1e3a8a] border-[#1e3a8a] text-white shadow-md' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${partidoSeleccionadoId === p.id ? 'text-blue-200' : 'text-slate-400'}`}>FECHA {p.fechaNumero} • Serie {p.serie}</span>
                    <span className="text-[10px] bg-black/10 px-2 py-0.5 rounded font-mono">{p.respaldoActa ? p.respaldoActa.split('_')[0] : 'OK'}</span>
                  </div>
                  <div className="flex justify-between items-center font-black">
                    <span className="truncate flex-1">{p.local}</span>
                    <span className={`px-2 ${partidoSeleccionadoId === p.id ? 'text-emerald-400' : 'text-[#1e3a8a]'}`}>{p.golesLocal} - {p.golesVisita}</span>
                    <span className="truncate flex-1 text-right">{p.visita}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
           {partidoActivo ? (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="bg-slate-50 p-6 border-b border-slate-200 text-center relative">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Acta Oficial Cerrada</p>
                  <p className="font-mono text-[9px] text-slate-400 mb-4 bg-white inline-block px-2 py-1 rounded border shadow-sm">ID: {partidoActivo.respaldoActa || 'Respaldo Antiguo'}</p>
                  <div className="flex items-center justify-center gap-4 text-2xl md:text-3xl font-black">
                    <span className="text-right flex-1 truncate">{partidoActivo.local}</span>
                    <div className="bg-[#1e3a8a] text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-inner"><span>{partidoActivo.golesLocal}</span><span className="text-blue-300/50">-</span><span>{partidoActivo.golesVisita}</span></div>
                    <span className="text-left flex-1 truncate">{partidoActivo.visita}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-black text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><span className="text-lg">⏱️</span> Registro de Sucesos</h4>
                    <div className="space-y-3">
                      {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-xl shrink-0">{ev.tipo === '⚽ Gol' ? '⚽' : ev.tipo === '⚽❌ Autogol' ? '⚽❌' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs uppercase truncate">{ev.jugador}</p>
                            <p className="text-[10px] font-bold text-blue-600 truncate">{ev.equipo} {ev.minuto !== 'Admin' ? `• Min: ${ev.minuto}` : '• (Por Secretaría)'}</p>
                          </div>
                        </div>
                      )) : <p className="text-slate-400 text-xs italic">No hubo incidencias registradas en este encuentro.</p>}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-black text-slate-800 border-b pb-2 mb-4 flex items-center gap-2"><span className="text-lg">📋</span> Nóminas Oficiales</h4>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Local: {partidoActivo.local}</p>
                        <div className="flex flex-col gap-1">{partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.local).map((jugador, i) => <span key={i} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-100 p-1.5 rounded">{jugador.nombre}</span>)}</div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Visita: {partidoActivo.visita}</p>
                        <div className="flex flex-col gap-1">{partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.visita).map((jugador, i) => <span key={i} className="text-[11px] font-bold text-slate-700 bg-white border border-slate-100 p-1.5 rounded">{jugador.nombre}</span>)}</div>
                      </div>
                    </div>
                  </div>
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl h-[600px] flex flex-col items-center justify-center p-10 text-slate-400">
                <span className="text-5xl mb-4">📖</span>
                <p className="font-bold text-sm text-center">Selecciona un acta de la lista para ver sus detalles.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}