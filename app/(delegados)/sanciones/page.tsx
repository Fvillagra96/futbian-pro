'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }

export default function BoletinSancionesProtegido() {
  const { club: miClub, authCargando } = useAuth() as any;
  const [cargando, setCargando] = useState(true);
  const [sancionados, setSancionados] = useState<Jugador[]>([]);
  const [filtroClub, setFiltroClub] = useState<string>("Todos");
  const [clubesDisponibles, setClubesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    if (authCargando) return;

    // Solo traemos a los jugadores que tienen castigos vigentes (> 0)
    const qSancionados = query(collection(db, "asociaciones/san_fabian/jugadores"), where("partidosSuspendido", ">", 0));
    
    const unsubJ = onSnapshot(qSancionados, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[];
      // Ordenamos para que los del club del usuario salgan primero, y luego alfabéticamente
      data.sort((a, b) => {
        if (a.club === miClub && b.club !== miClub) return -1;
        if (a.club !== miClub && b.club === miClub) return 1;
        return a.club.localeCompare(b.club) || a.nombre.localeCompare(b.nombre);
      });
      setSancionados(data);
      const clubes = Array.from(new Set(data.map(j => j.club))).sort();
      setClubesDisponibles(clubes);
      setCargando(false);
    });

    return () => unsubJ();
  }, [authCargando, miClub]);

  const sancionadosFiltrados = filtroClub === "Todos" ? sancionados : sancionados.filter(j => j.club === filtroClub);

  if (authCargando || cargando) return <div className="p-20 text-center font-bold text-red-500 animate-pulse">Abriendo archivos del Tribunal...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <header className="bg-slate-900 border-b-4 border-red-600 rounded-3xl p-8 md:p-12 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-red-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Tribunal de Disciplina (Uso Interno)</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">BOLETÍN SANCIONES</h1>
            <p className="text-slate-400 mt-2 text-xs md:text-sm">Lista oficial de jugadores inhabilitados para jugar.</p>
          </div>
          <div className="bg-red-500/10 px-6 py-4 rounded-2xl border border-red-500/20 backdrop-blur-sm text-center">
            <span className="text-[10px] font-bold text-red-300 uppercase block mb-1">Inhabilitados Globales</span>
            <p className="text-4xl font-black text-white leading-none">{sancionados.length}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[200px] pointer-events-none">⚠️</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 border-b pb-4 border-slate-100">
          <h3 className="font-black text-slate-800 tracking-tight text-xl flex items-center gap-2"><span className="text-2xl">📋</span> JUGADORES CASTIGADOS</h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase">Filtrar:</span>
            <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500">
              <option value="Todos">Ver Todos</option>
              {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {sancionadosFiltrados.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">
              No hay jugadores suspendidos {filtroClub !== "Todos" ? `en ${filtroClub}` : 'actualmente'}.
            </div>
          ) : (
            <table className="w-full min-w-[600px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 font-bold">Jugador / RUT</th>
                  <th className="p-4 font-bold text-center">Club y Serie</th>
                  <th className="p-4 font-black text-red-600 text-center">Castigo Vigente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sancionadosFiltrados.map(j => {
                  const esMiJugador = j.club === miClub;
                  return (
                    <tr key={j.id} className={`transition-colors ${esMiJugador ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {esMiJugador && <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase">TU CLUB</span>}
                          <p className="font-black text-slate-800 uppercase text-sm md:text-base">{j.nombre}</p>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">{j.rut}</p>
                      </td>
                      <td className="p-4 text-center">
                        <p className={`font-bold text-sm uppercase ${esMiJugador ? 'text-red-600' : 'text-[#1e3a8a]'}`}>{j.club}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 inline-block px-2 py-0.5 rounded mt-1">Serie {j.serie}</p>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl text-sm font-black border border-red-200 shadow-sm">
                          ⚠️ {j.partidosSuspendido} {j.partidosSuspendido === 1 ? 'FECHA' : 'FECHAS'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}