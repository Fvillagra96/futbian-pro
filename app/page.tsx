'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query } from "firebase/firestore";

interface ClubData { nombre: string; logoUrl?: string; instagram?: string; facebook?: string; }
interface Evento { tipo: string; equipo: string; jugador: string; rut: string; }
interface Partido { local: string; visita: string; golesLocal: number; golesVisita: number; estado: string; serie: string; eventos?: Evento[]; }
interface StatsClub { nombre: string; logoUrl: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; amarillas: number; rojas: number; }
interface Goleador { rut: string; nombre: string; equipo: string; goles: number; }

export default function HomeDashboard() {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [clubesInfo, setClubesInfo] = useState<Record<string, ClubData>>({});
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<"general" | "series" | "goleadores">("general");
  const [serieSeleccionada, setSerieSeleccionada] = useState<string>("");

  useEffect(() => {
    // Escuchar Clubes para traer logos y redes
    const unsubClubes = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const info: Record<string, ClubData> = {};
      snap.docs.forEach(d => {
        const data = d.data() as ClubData;
        info[data.nombre] = data;
      });
      setClubesInfo(info);
    });

    // Escuchar Partidos
    const unsubPartidos = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
      setCargando(false);
    });

    return () => { unsubClubes(); unsubPartidos(); };
  }, []);

  const seriesDisponibles = useMemo(() => {
    const series = new Set<string>();
    partidos.forEach(p => p.serie && series.add(p.serie));
    return Array.from(series).sort();
  }, [partidos]);

  useEffect(() => {
    if (seriesDisponibles.length > 0 && !serieSeleccionada) setSerieSeleccionada(seriesDisponibles[0]);
  }, [seriesDisponibles]);

  // --- MOTOR DE TABLAS CON LOGOS ---
  const procesarTabla = (filtroSerie?: string) => {
    const stats: Record<string, StatsClub> = {};
    
    partidos.forEach(p => {
      if (filtroSerie && p.serie !== filtroSerie) return;

      [p.local, p.visita].forEach(nombre => {
        if (!stats[nombre]) {
          stats[nombre] = { 
            nombre, 
            logoUrl: clubesInfo[nombre]?.logoUrl || "", 
            pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0, amarillas: 0, rojas: 0 
          };
        }
      });

      if (p.estado === "Finalizado") {
        stats[p.local].pj += 1; stats[p.visita].pj += 1;
        stats[p.local].gf += p.golesLocal || 0; stats[p.local].gc += p.golesVisita || 0;
        stats[p.visita].gf += p.golesVisita || 0; stats[p.visita].gc += p.golesLocal || 0;

        if (p.golesLocal > p.golesVisita) {
          stats[p.local].pg += 1; stats[p.local].pts += 3; stats[p.visita].pp += 1;
        } else if (p.golesLocal < p.golesVisita) {
          stats[p.visita].pg += 1; stats[p.visita].pts += 3; stats[p.local].pp += 1;
        } else {
          stats[p.local].pe += 1; stats[p.local].pts += 1; stats[p.visita].pe += 1; stats[p.visita].pts += 1;
        }

        p.eventos?.forEach(ev => {
          if (ev.tipo.includes('Amarilla') && stats[ev.equipo]) stats[ev.equipo].amarillas += 1;
          if (ev.tipo.includes('Roja') && stats[ev.equipo]) stats[ev.equipo].rojas += 1;
        });
      }
    });

    return Object.values(stats).map(c => ({ ...c, dg: c.gf - c.gc })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
  };

  const tablaGeneral = useMemo(() => procesarTabla(), [partidos, clubesInfo]);
  const tablaSerie = useMemo(() => procesarTabla(serieSeleccionada), [partidos, serieSeleccionada, clubesInfo]);

  const renderTabla = (datos: StatsClub[]) => (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[700px] text-center border-collapse whitespace-nowrap">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b">
            <th className="p-4 text-left w-12">Pos</th>
            <th className="p-4 text-left sticky left-0 bg-slate-50 z-10">Club</th>
            <th className="p-4 font-black text-[#1e3a8a]">Pts</th>
            <th className="p-4">PJ</th>
            <th className="p-4">DG</th>
            <th className="p-4 text-yellow-600">🟨</th>
            <th className="p-4 text-red-600">🟥</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {datos.map((club, index) => (
            <tr key={club.nombre} className="hover:bg-blue-50/50 bg-white transition-colors">
              <td className="p-4 font-bold text-slate-400 text-left">{index + 1}</td>
              <td className="p-4 font-bold text-slate-800 text-left sticky left-0 bg-white z-10 flex items-center gap-3">
                {club.logoUrl ? (
                  <img src={club.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-full bg-slate-50 p-0.5 border" />
                ) : (
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs">🛡️</div>
                )}
                <span>{club.nombre}</span>
              </td>
              <td className="p-4 font-black text-lg text-[#1e3a8a]">{club.pts}</td>
              <td className="p-4 text-slate-600">{club.pj}</td>
              <td className={`p-4 font-bold ${club.dg > 0 ? 'text-green-600' : 'text-slate-500'}`}>{club.dg}</td>
              <td className="p-4 text-yellow-700 font-bold">{club.amarillas}</td>
              <td className="p-4 text-red-700 font-bold">{club.rojas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 p-2">
      
      {/* Banner con Redes Sociales */}
      <div className="bg-[#1e3a8a] rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-blue-300 font-black uppercase tracking-[0.2em] text-xs mb-2">Asociación San Fabián</h2>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic">FUTBIAN.PRO</h1>
            <div className="flex gap-4 mt-6">
              <a href="https://instagram.com/tu_cuenta" target="_blank" className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">📸</span> Instagram
              </a>
              <a href="https://facebook.com/tu_cuenta" target="_blank" className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all flex items-center gap-2 text-sm font-bold">
                <span className="text-xl">📘</span> Facebook
              </a>
            </div>
          </div>
          <div className="hidden md:block text-[120px] opacity-20">⚽</div>
        </div>
      </div>

      {/* Tabs y Tablas (Siguen la misma lógica anterior) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {["general", "series", "goleadores"].map((v) => (
          <button 
            key={v}
            onClick={() => setVistaActiva(v as any)}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${vistaActiva === v ? "bg-[#1e3a8a] text-white shadow-xl scale-105" : "bg-white text-slate-400 border border-slate-200"}`}
          >
            {v === 'general' ? '🏆 Tabla General' : v === 'series' ? '📊 Por Series' : '⚽ Goleadores'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[400px]">
        {cargando ? (
          <div className="p-20 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          <>
            {vistaActiva === "general" && renderTabla(tablaGeneral)}
            {vistaActiva === "series" && (
              <>
                <div className="p-4 bg-slate-50 border-b flex items-center gap-4">
                  <span className="text-xs font-black text-slate-400">FILTRAR SERIE:</span>
                  <select value={serieSeleccionada} onChange={e => setSerieSeleccionada(e.target.value)} className="bg-white border rounded-lg p-2 font-bold text-sm outline-none">
                    {seriesDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {renderTabla(tablaSerie)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}