'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

// Definimos interfaces locales para el motor de cálculo
interface Evento { tipo: string; equipo: string; jugador: string; }
interface Partido { local: string; visita: string; golesLocal: number; golesVisita: number; estado: string; eventos?: Evento[]; }
interface StatsClub { nombre: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; amarillas: number; rojas: number; }

export default function HomeDashboard() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargando, setCargando] = useState(true);

  // 1. CARGAMOS TODOS LOS PARTIDOS EN TIEMPO REAL
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
      setCargando(false);
    });
    return () => unsub();
  }, []);

  // 2. MOTOR DE CÁLCULO (Transforma los partidos en una Tabla de Posiciones)
  const tablaPosiciones = useMemo(() => {
    const stats: Record<string, StatsClub> = {};

    partidos.forEach(p => {
      // Inicializar clubes si no existen en nuestra lista temporal
      if (!stats[p.local]) stats[p.local] = { nombre: p.local, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };
      if (!stats[p.visita]) stats[p.visita] = { nombre: p.visita, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };

      // Solo contar partidos que ya tienen eventos o están finalizados
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

      // Sumar Tarjetas desde el Acta (Eventos)
      if (p.eventos) {
        p.eventos.forEach(ev => {
          if (ev.tipo.includes('Amarilla') && stats[ev.equipo]) stats[ev.equipo].amarillas += 1;
          if (ev.tipo.includes('Roja') && stats[ev.equipo]) stats[ev.equipo].rojas += 1;
        });
      }
    });

    // Calcular Diferencia de Goles y Ordenar (1° Puntos, 2° Dif Goles, 3° Goles a favor)
    return Object.values(stats).map(c => ({
      ...c,
      dg: c.gf - c.gc
    })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  }, [partidos]);


  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-8">
      
      {/* Banner Superior de Bienvenida */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-bold text-blue-600 tracking-widest uppercase mb-2">Temporada Oficial</h2>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">Asociación de Fútbol</h1>
          <p className="text-xl text-slate-500 mt-2 font-medium">San Fabián</p>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10">
          <span className="text-[150px] leading-none">⚽</span>
        </div>
      </div>

      {/* Tabla General de Clubes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        
        <div className="px-6 py-5 border-b border-slate-200 bg-[#1e3a8a] text-white flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <span>🏆</span> Clasificación General por Clubes
          </h3>
          <span className="bg-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-700">
            En Vivo
          </span>
        </div>
        
        <div className="overflow-x-auto">
          {cargando ? (
            <div className="p-12 flex justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
          ) : tablaPosiciones.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">Aún no hay partidos registrados en la temporada.</div>
          ) : (
            <table className="w-full text-center border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold text-left w-12 border-b">Pos</th>
                  <th className="p-4 font-bold text-left border-b">Club</th>
                  <th className="p-4 font-black text-[#1e3a8a] border-b" title="Puntos">Pts</th>
                  <th className="p-4 font-bold border-b" title="Partidos Jugados">PJ</th>
                  <th className="p-4 font-bold hidden sm:table-cell border-b" title="Ganados">PG</th>
                  <th className="p-4 font-bold hidden sm:table-cell border-b" title="Empatados">PE</th>
                  <th className="p-4 font-bold hidden sm:table-cell border-b" title="Perdidos">PP</th>
                  <th className="p-4 font-bold border-b" title="Diferencia de Goles">DG</th>
                  <th className="p-4 font-bold bg-yellow-50 text-yellow-700 border-b border-yellow-100" title="Tarjetas Amarillas">🟨</th>
                  <th className="p-4 font-bold bg-red-50 text-red-700 border-b border-red-100" title="Tarjetas Rojas">🟥</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tablaPosiciones.map((club, index) => (
                  <tr key={club.nombre} className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-amber-50/20' : ''}`}>
                    <td className="p-4 font-bold text-slate-400 text-left">{index + 1}</td>
                    <td className="p-4 font-bold text-slate-800 text-left flex items-center gap-2">
                      {index === 0 && <span title="Puntero" className="text-amber-500 drop-shadow-sm">👑</span>}
                      {club.nombre}
                    </td>
                    <td className="p-4 font-black text-lg text-white bg-[#1e3a8a] shadow-inner">{club.pts}</td>
                    <td className="p-4 font-medium text-slate-600">{club.pj}</td>
                    <td className="p-4 text-slate-500 hidden sm:table-cell">{club.pg}</td>
                    <td className="p-4 text-slate-500 hidden sm:table-cell">{club.pe}</td>
                    <td className="p-4 text-slate-500 hidden sm:table-cell">{club.pp}</td>
                    <td className={`p-4 font-bold ${club.dg > 0 ? 'text-green-600' : club.dg < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                      {club.dg > 0 ? `+${club.dg}` : club.dg}
                    </td>
                    <td className="p-4 font-bold text-yellow-700 bg-yellow-50/50">{club.amarillas}</td>
                    <td className="p-4 font-bold text-red-700 bg-red-50/50">{club.rojas}</td>
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