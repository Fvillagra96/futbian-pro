'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

interface Evento { tipo: string; equipo: string; jugador: string; }
interface Partido { local: string; visita: string; golesLocal: number; golesVisita: number; estado: string; eventos?: Evento[]; }
interface StatsClub { nombre: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; amarillas: number; rojas: number; }

export default function HomeDashboard() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargando, setCargando] = useState(true);

  // 1. CARGAMOS TODOS LOS PARTIDOS
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
      setCargando(false);
    });
    return () => unsub();
  }, []);

  // 2. MOTOR DE CÁLCULO
  const tablaPosiciones = useMemo(() => {
    const stats: Record<string, StatsClub> = {};

    partidos.forEach(p => {
      if (!stats[p.local]) stats[p.local] = { nombre: p.local, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };
      if (!stats[p.visita]) stats[p.visita] = { nombre: p.visita, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };

      const jugado = p.estado !== "Pendiente" || (p.eventos && p.eventos.length > 0);

      if (jugado) {
        stats[p.local].pj += 1;
        stats[p.visita].pj += 1;

        stats[p.local].gf += p.golesLocal || 0;
        stats[p.local].gc += p.golesVisita || 0;
        stats[p.visita].gf += p.golesVisita || 0;
        stats[p.visita].gc += p.golesLocal || 0;

        if (p.golesLocal > p.golesVisita) {
          stats[p.local].pg += 1; stats[p.local].pts += 3;
          stats[p.visita].pp += 1;
        } else if (p.golesLocal < p.golesVisita) {
          stats[p.visita].pg += 1; stats[p.visita].pts += 3;
          stats[p.local].pp += 1;
        } else {
          stats[p.local].pe += 1; stats[p.local].pts += 1;
          stats[p.visita].pe += 1; stats[p.visita].pts += 1;
        }
      }

      if (p.eventos) {
        p.eventos.forEach(ev => {
          if (ev.tipo.includes('Amarilla') && stats[ev.equipo]) stats[ev.equipo].amarillas += 1;
          if (ev.tipo.includes('Roja') && stats[ev.equipo]) stats[ev.equipo].rojas += 1;
        });
      }
    });

    return Object.values(stats).map(c => ({
      ...c,
      dg: c.gf - c.gc
    })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  }, [partidos]);


  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Banner Superior de Bienvenida */}
      <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xs md:text-sm font-bold text-blue-600 tracking-widest uppercase mb-1 md:mb-2">Temporada Oficial</h2>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight leading-none">Asociación de Fútbol</h1>
          <p className="text-lg md:text-xl text-slate-500 mt-2 font-medium">San Fabián</p>
        </div>
        <div className="absolute right-[-10px] top-[-10px] opacity-10">
          <span className="text-[100px] md:text-[150px] leading-none">⚽</span>
        </div>
      </div>

      {/* Tabla General de Clubes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        
        <div className="px-4 py-4 md:px-6 md:py-5 border-b border-slate-200 bg-[#1e3a8a] text-white flex justify-between items-center">
          <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
            <span>🏆</span> Clasificación General
          </h3>
          <span className="bg-blue-800 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-blue-700">
            En Vivo
          </span>
        </div>
        
        {/* Aviso para celulares de que se puede deslizar */}
        {!cargando && tablaPosiciones.length > 0 && (
          <div className="md:hidden bg-blue-50 px-4 py-2 text-center border-b border-blue-100">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider animate-pulse">
              👈 Desliza la tabla para ver más 👉
            </span>
          </div>
        )}
        
        {/* CONTENEDOR CON SCROLL HORIZONTAL */}
        <div className="w-full overflow-x-auto pb-2">
          {cargando ? (
            <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : tablaPosiciones.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">Aún no hay partidos registrados en la temporada.</div>
          ) : (
            /* min-w-[700px] garantiza que la tabla nunca se aplaste y obligue al celular a usar el scroll horizontal */
            <table className="w-full min-w-[700px] text-center border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] md:text-xs uppercase tracking-wider">
                  <th className="p-3 md:p-4 font-bold text-left w-10 border-b">Pos</th>
                  <th className="p-3 md:p-4 font-bold text-left border-b sticky left-0 bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)] z-10">Club</th>
                  <th className="p-3 md:p-4 font-black text-[#1e3a8a] border-b" title="Puntos">Pts</th>
                  <th className="p-3 md:p-4 font-bold border-b" title="Partidos Jugados">PJ</th>
                  <th className="p-3 md:p-4 font-bold border-b" title="Ganados">PG</th>
                  <th className="p-3 md:p-4 font-bold border-b" title="Empatados">PE</th>
                  <th className="p-3 md:p-4 font-bold border-b" title="Perdidos">PP</th>
                  <th className="p-3 md:p-4 font-bold border-b" title="Diferencia de Goles">DG</th>
                  <th className="p-3 md:p-4 font-bold bg-yellow-50 text-yellow-700 border-b border-yellow-100" title="Tarjetas Amarillas">🟨</th>
                  <th className="p-3 md:p-4 font-bold bg-red-50 text-red-700 border-b border-red-100" title="Tarjetas Rojas">🟥</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                {tablaPosiciones.map((club, index) => (
                  <tr key={club.nombre} className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-amber-50/20' : ''}`}>
                    <td className="p-3 md:p-4 font-bold text-slate-400 text-left">{index + 1}</td>
                    
                    {/* El nombre del club se queda fijo a la izquierda mientras haces scroll */}
                    <td className={`p-3 md:p-4 font-bold text-slate-800 text-left flex items-center gap-2 sticky left-0 z-10 ${index === 0 ? 'bg-[#fef9eb]' : 'bg-white'}`}>
                      {index === 0 && <span title="Puntero" className="text-amber-500 drop-shadow-sm">👑</span>}
                      <span className="truncate max-w-[120px] md:max-w-none">{club.nombre}</span>
                    </td>
                    
                    <td className="p-3 md:p-4 font-black text-base md:text-lg text-white bg-[#1e3a8a] shadow-inner">{club.pts}</td>
                    <td className="p-3 md:p-4 font-medium text-slate-600">{club.pj}</td>
                    <td className="p-3 md:p-4 text-slate-500">{club.pg}</td>
                    <td className="p-3 md:p-4 text-slate-500">{club.pe}</td>
                    <td className="p-3 md:p-4 text-slate-500">{club.pp}</td>
                    <td className={`p-3 md:p-4 font-bold ${club.dg > 0 ? 'text-green-600' : club.dg < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {club.dg > 0 ? `+${club.dg}` : club.dg}
                    </td>
                    <td className="p-3 md:p-4 font-bold text-yellow-700 bg-yellow-50/50">{club.amarillas}</td>
                    <td className="p-3 md:p-4 font-bold text-red-700 bg-red-50/50">{club.rojas}</td>
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