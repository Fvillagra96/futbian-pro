'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; }
interface Evento { rut: string; }
interface JugadorNomina { rut: string; }
interface Partido { estado: string; serie: string; local: string; visita: string; eventos?: Evento[]; nomina?: JugadorNomina[]; }

export default function LiguillaPage() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [filtroClub, setFiltroClub] = useState<string>("");
  const [filtroSerie, setFiltroSerie] = useState<string>("");
  const [cuotaMinima, setCuotaMinima] = useState<number>(5); // Por defecto 5 partidos

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
    });
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargando(false);
    });
    return () => { unsubP(); unsubJ(); };
  }, []);

  // Opciones para los selectores
  const clubesDisponibles = useMemo(() => Array.from(new Set(jugadores.map(j => j.club))).sort(), [jugadores]);
  const seriesDisponibles = useMemo(() => Array.from(new Set(jugadores.map(j => j.serie))).sort(), [jugadores]);

  // MOTOR DE CÁLCULO DE ASISTENCIAS
  const listaLiguilla = useMemo(() => {
    const conteoAsistencias: Record<string, number> = {};

    // 1. Contar presencias en actas
    partidos.forEach(p => {
      if (p.estado === "Finalizado") {
        // Usamos un Set para no contar doble si un jugador está en nómina y además hizo gol
        const rutsPresentes = new Set<string>();
        p.nomina?.forEach(n => rutsPresentes.add(n.rut));
        p.eventos?.forEach(e => rutsPresentes.add(e.rut));

        rutsPresentes.forEach(rut => {
          if (!conteoAsistencias[rut]) conteoAsistencias[rut] = 0;
          // Solo le sumamos el partido si su serie coincide con la del partido 
          // (para evitar que un juvenil que subió a honor sume partidos para la liguilla juvenil)
          conteoAsistencias[rut] += 1; 
        });
      }
    });

    // 2. Cruzar con la lista de jugadores y aplicar filtros
    return jugadores
      .filter(j => (filtroClub ? j.club === filtroClub : true))
      .filter(j => (filtroSerie ? j.serie === filtroSerie : true))
      .map(j => ({
        ...j,
        partidosJugados: conteoAsistencias[j.rut] || 0,
        clasifica: (conteoAsistencias[j.rut] || 0) >= cuotaMinima
      }))
      .sort((a, b) => b.partidosJugados - a.partidosJugados || a.nombre.localeCompare(b.nombre));
  }, [partidos, jugadores, filtroClub, filtroSerie, cuotaMinima]);

  if (cargando) return <div className="p-20 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 p-2 md:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-[#1e3a8a] rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10">
          <h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Control de Elegibilidad</h2>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter">MÓDULO DE LIGUILLA</h1>
          <p className="text-blue-200 mt-2 font-medium text-sm md:text-base max-w-xl">
            Verifica qué jugadores cumplen con la cuota de partidos exigida por reglamento para disputar las fases finales.
          </p>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px]">📋</div>
      </div>

      {/* PANEL DE FILTROS */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Filtrar por Club</label>
          <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none focus:border-blue-500">
            <option value="">Todos los Clubes</option>
            {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Filtrar por Serie</label>
          <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none focus:border-blue-500">
            <option value="">Todas las Series</option>
            {seriesDisponibles.map(s => <option key={s} value={s}>Serie {s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Cuota (Partidos Mínimos)</label>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1 pr-3">
            <button onClick={() => setCuotaMinima(Math.max(1, cuotaMinima - 1))} className="w-10 h-10 bg-white rounded-lg font-black shadow-sm text-red-500 hover:bg-red-50">-</button>
            <input type="number" value={cuotaMinima} readOnly className="flex-1 bg-transparent text-center font-black text-xl text-[#1e3a8a] outline-none" />
            <button onClick={() => setCuotaMinima(cuotaMinima + 1)} className="w-10 h-10 bg-white rounded-lg font-black shadow-sm text-green-500 hover:bg-green-50">+</button>
          </div>
        </div>
      </div>

      {/* TABLA DE JUGADORES */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="font-bold text-slate-600 text-sm">
            {listaLiguilla.length} Jugadores encontrados
          </span>
          <div className="flex gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Habilitados</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Inhabilitados</span>
          </div>
        </div>
        
        <div className="w-full overflow-x-auto pb-2">
          {listaLiguilla.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">Selecciona un club y serie para ver los jugadores.</div>
          ) : (
            <table className="w-full min-w-[700px] text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                  <th className="p-4 font-bold sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Jugador / RUT</th>
                  <th className="p-4 font-bold">Club</th>
                  <th className="p-4 font-bold">Serie</th>
                  <th className="p-4 font-black text-[#1e3a8a] text-center">Partidos (PJ)</th>
                  <th className="p-4 font-bold text-center">Estado Liguilla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {listaLiguilla.map(j => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                      <p className="font-black text-slate-800 text-sm uppercase">{j.nombre}</p>
                      <p className="text-[10px] font-bold text-slate-500">{j.rut}</p>
                    </td>
                    <td className="p-4 font-bold text-slate-600 text-xs">{j.club}</td>
                    <td className="p-4 font-bold text-slate-600 text-xs"><span className="bg-slate-100 px-2 py-1 rounded-md">S. {j.serie}</span></td>
                    <td className="p-4 text-center">
                      <span className={`text-xl font-black ${j.partidosJugados >= cuotaMinima ? 'text-emerald-600' : 'text-red-500'}`}>
                        {j.partidosJugados}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {j.clasifica ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-black border border-emerald-200">
                          ✅ HABILITADO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black border border-red-200">
                          ❌ FALTAN {cuotaMinima - j.partidosJugados} PJ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}