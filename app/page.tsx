'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

interface Evento { tipo: string; equipo: string; jugador: string; rut: string; }
interface Partido { local: string; visita: string; golesLocal: number; golesVisita: number; estado: string; serie: string; eventos?: Evento[]; }
interface StatsClub { nombre: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; amarillas: number; rojas: number; }
interface Goleador { rut: string; nombre: string; equipo: string; goles: number; }

export default function HomeDashboard() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargando, setCargando] = useState(true);
  
  // Estados para la navegación del Dashboard
  const [vistaActiva, setVistaActiva] = useState<"general" | "series" | "goleadores">("general");
  const [serieSeleccionada, setSerieSeleccionada] = useState<string>("");

  // 1. CARGAMOS TODOS LOS PARTIDOS
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
      setCargando(false);
    });
    return () => unsub();
  }, []);

  // 2. OBTENER SERIES DISPONIBLES
  const seriesDisponibles = useMemo(() => {
    const series = new Set<string>();
    partidos.forEach(p => p.serie && series.add(p.serie));
    return Array.from(series).sort();
  }, [partidos]);

  // Autoseleccionar la primera serie si no hay ninguna seleccionada
  useEffect(() => {
    if (seriesDisponibles.length > 0 && !serieSeleccionada) {
      setSerieSeleccionada(seriesDisponibles[0]);
    }
  }, [seriesDisponibles, serieSeleccionada]);

  // --- MOTOR 1: TABLA GENERAL (Solo partidos finalizados) ---
  const tablaGeneral = useMemo(() => {
    const stats: Record<string, StatsClub> = {};

    partidos.forEach(p => {
      // Inicializar clubes siempre, para que aparezcan aunque no tengan partidos jugados
      if (!stats[p.local]) stats[p.local] = { nombre: p.local, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };
      if (!stats[p.visita]) stats[p.visita] = { nombre: p.visita, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };

      // CORRECCIÓN CLAVE: Solo procesar si el acta está CERRADA ("Finalizado")
      if (p.estado === "Finalizado") {
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

        if (p.eventos) {
          p.eventos.forEach(ev => {
            if (ev.tipo.includes('Amarilla') && stats[ev.equipo]) stats[ev.equipo].amarillas += 1;
            if (ev.tipo.includes('Roja') && stats[ev.equipo]) stats[ev.equipo].rojas += 1;
          });
        }
      }
    });

    return Object.values(stats).map(c => ({ ...c, dg: c.gf - c.gc })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  }, [partidos]);

  // --- MOTOR 2: TABLA POR SERIE (Solo partidos finalizados de esa serie) ---
  const tablaSerie = useMemo(() => {
    const stats: Record<string, StatsClub> = {};

    partidos.forEach(p => {
      // Queremos mostrar todos los clubes que tengan la serie, así que los inicializamos
      if (p.serie === serieSeleccionada) {
        if (!stats[p.local]) stats[p.local] = { nombre: p.local, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };
        if (!stats[p.visita]) stats[p.visita] = { nombre: p.visita, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 };
      }

      // Procesar solo si es de la serie seleccionada y está Finalizado
      if (p.serie === serieSeleccionada && p.estado === "Finalizado") {
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

        if (p.eventos) {
          p.eventos.forEach(ev => {
            if (ev.tipo.includes('Amarilla') && stats[ev.equipo]) stats[ev.equipo].amarillas += 1;
            if (ev.tipo.includes('Roja') && stats[ev.equipo]) stats[ev.equipo].rojas += 1;
          });
        }
      }
    });

    return Object.values(stats).map(c => ({ ...c, dg: c.gf - c.gc })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  }, [partidos, serieSeleccionada]);

  // --- MOTOR 3: GOLEADORES (Solo partidos finalizados) ---
  const listaGoleadores = useMemo(() => {
    const stats: Record<string, Goleador> = {};

    partidos.forEach(p => {
      if (p.estado === "Finalizado" && p.eventos) {
        p.eventos.forEach(ev => {
          if (ev.tipo === '⚽ Gol') {
            const key = ev.rut;
            if (!stats[key]) {
              stats[key] = { rut: ev.rut, nombre: ev.jugador, equipo: ev.equipo, goles: 0 };
            }
            stats[key].goles += 1;
          }
        });
      }
    });

    return Object.values(stats).sort((a, b) => b.goles - a.goles).slice(0, 15); // Top 15
  }, [partidos]);


  // Función auxiliar para renderizar la tabla de posiciones (reutilizable)
  const renderTablaPosiciones = (datos: StatsClub[]) => (
    <div className="w-full overflow-x-auto pb-2">
      {datos.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-medium">Aún no hay equipos registrados.</div>
      ) : (
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
            {datos.map((club, index) => (
              <tr key={club.nombre} className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-amber-50/20' : 'bg-white'}`}>
                <td className="p-3 md:p-4 font-bold text-slate-400 text-left">{index + 1}</td>
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
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Banner Superior */}
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

      {/* NAVEGACIÓN DEL DASHBOARD (TABS) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => setVistaActiva("general")}
          className={`shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${vistaActiva === "general" ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          🏆 Clasificación General
        </button>
        <button 
          onClick={() => setVistaActiva("series")}
          className={`shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${vistaActiva === "series" ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          📊 Tablas por Serie
        </button>
        <button 
          onClick={() => setVistaActiva("goleadores")}
          className={`shrink-0 px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-sm ${vistaActiva === "goleadores" ? "bg-[#1e3a8a] text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
        >
          ⚽ Top Goleadores
        </button>
      </div>

      {/* CONTENEDOR DE LA VISTA ACTIVA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        
        {cargando ? (
          <div className="p-20 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <>
            {/* VISTA 1: TABLA GENERAL */}
            {vistaActiva === "general" && (
              <>
                <div className="px-4 py-4 md:px-6 md:py-5 border-b border-slate-200 bg-[#1e3a8a] text-white flex justify-between items-center">
                  <h3 className="text-base md:text-lg font-bold flex items-center gap-2"><span>🏆</span> General Clubes</h3>
                  <span className="bg-blue-800 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full border border-blue-700">Oficial</span>
                </div>
                {tablaGeneral.length > 0 && <div className="md:hidden bg-blue-50 px-4 py-2 text-center border-b border-blue-100"><span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider animate-pulse">👈 Desliza la tabla para ver más 👉</span></div>}
                {renderTablaPosiciones(tablaGeneral)}
              </>
            )}

            {/* VISTA 2: TABLA POR SERIES */}
            {vistaActiva === "series" && (
              <>
                <div className="px-4 py-4 md:px-6 md:py-5 border-b border-slate-200 bg-[#1e3a8a] text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <h3 className="text-base md:text-lg font-bold flex items-center gap-2"><span>📊</span> Clasificación por Serie</h3>
                  <select 
                    value={serieSeleccionada} 
                    onChange={(e) => setSerieSeleccionada(e.target.value)}
                    className="bg-blue-900 text-white border border-blue-700 p-2 rounded-lg font-bold outline-none text-sm w-full md:w-auto"
                  >
                    {seriesDisponibles.map(s => <option key={s} value={s}>Serie {s}</option>)}
                    {seriesDisponibles.length === 0 && <option value="">Sin series creadas</option>}
                  </select>
                </div>
                {tablaSerie.length > 0 && <div className="md:hidden bg-blue-50 px-4 py-2 text-center border-b border-blue-100"><span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider animate-pulse">👈 Desliza la tabla para ver más 👉</span></div>}
                {renderTablaPosiciones(tablaSerie)}
              </>
            )}

            {/* VISTA 3: GOLEADORES */}
            {vistaActiva === "goleadores" && (
              <>
                <div className="px-4 py-4 md:px-6 md:py-5 border-b border-slate-200 bg-[#1e3a8a] text-white">
                  <h3 className="text-base md:text-lg font-bold flex items-center gap-2"><span>⚽</span> Top Goleadores de la Temporada</h3>
                </div>
                <div className="w-full overflow-x-auto">
                  {listaGoleadores.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium">Aún no hay goles registrados en actas cerradas.</div>
                  ) : (
                    <table className="w-full min-w-[500px] text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="p-4 font-bold border-b w-12 text-center">Top</th>
                          <th className="p-4 font-bold border-b">Jugador</th>
                          <th className="p-4 font-bold border-b">Club</th>
                          <th className="p-4 font-black text-[#1e3a8a] border-b text-center">Goles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {listaGoleadores.map((g, idx) => (
                          <tr key={g.rut} className="hover:bg-blue-50 transition-colors">
                            <td className="p-4 font-black text-slate-400 text-center">
                              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                            </td>
                            <td className="p-4 font-bold text-slate-800 uppercase">
                              {g.nombre} <br/> <span className="text-[10px] text-slate-400 font-normal">{g.rut}</span>
                            </td>
                            <td className="p-4 font-medium text-slate-600">{g.equipo}</td>
                            <td className="p-4 font-black text-xl text-[#1e3a8a] text-center bg-blue-50/30">{g.goles}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
      
    </div>
  );
}