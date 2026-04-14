'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc } from "firebase/firestore";

interface AsociacionInfo { nombre?: string; logoUrl?: string; instagram?: string; facebook?: string; }
interface ClubData { nombre: string; logoUrl?: string; instagram?: string; facebook?: string; }
interface Evento { tipo: string; equipo: string; jugador: string; rut: string; }
interface Partido { local: string; visita: string; golesLocal: number; golesVisita: number; estado: string; serie: string; eventos?: Evento[]; }
interface StatsClub { nombre: string; logoUrl: string; instagram: string; facebook: string; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dg: number; pts: number; amarillas: number; rojas: number; }
interface Goleador { rut: string; nombre: string; equipo: string; goles: number; }

export default function HomeDashboard() {
  const [infoAsociacion, setInfoAsociacion] = useState<AsociacionInfo | null>(null);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [clubesInfo, setClubesInfo] = useState<Record<string, ClubData>>({});
  const [cargando, setCargando] = useState(true);
  const [vistaActiva, setVistaActiva] = useState<"general" | "series" | "goleadores">("general");
  const [serieSeleccionada, setSerieSeleccionada] = useState<string>("");

  useEffect(() => {
    // 1. Escuchar info general de la Asociación (Logo y Redes Sociales principales)
    const unsubAsociacion = onSnapshot(doc(db, "asociaciones", "san_fabian"), (docSnap) => {
      if (docSnap.exists()) {
        setInfoAsociacion(docSnap.data() as AsociacionInfo);
      }
    });

    // 2. Escuchar Clubes para traer logos y redes de CADA club
    const unsubClubes = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const info: Record<string, ClubData> = {};
      snap.docs.forEach(d => {
        const data = d.data() as ClubData;
        info[data.nombre] = data;
      });
      setClubesInfo(info);
    });

    // 3. Escuchar Partidos
    const unsubPartidos = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
      setCargando(false);
    });

    return () => { unsubAsociacion(); unsubClubes(); unsubPartidos(); };
  }, []);

  const seriesDisponibles = useMemo(() => {
    const series = new Set<string>();
    partidos.forEach(p => p.serie && series.add(p.serie));
    return Array.from(series).sort();
  }, [partidos]);

  useEffect(() => {
    if (seriesDisponibles.length > 0 && !serieSeleccionada) setSerieSeleccionada(seriesDisponibles[0]);
  }, [seriesDisponibles]);

  // --- MOTOR DE TABLAS CON LOGOS Y REDES ---
  const procesarTabla = (filtroSerie?: string) => {
    const stats: Record<string, StatsClub> = {};
    
    partidos.forEach(p => {
      if (filtroSerie && p.serie !== filtroSerie) return;

      [p.local, p.visita].forEach(nombre => {
        if (!stats[nombre]) {
          stats[nombre] = { 
            nombre, 
            logoUrl: clubesInfo[nombre]?.logoUrl || "", 
            instagram: clubesInfo[nombre]?.instagram || "",
            facebook: clubesInfo[nombre]?.facebook || "",
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

  // --- MOTOR DE GOLEADORES ---
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
    return Object.values(stats).sort((a, b) => b.goles - a.goles).slice(0, 15);
  }, [partidos]);

  const renderTabla = (datos: StatsClub[]) => (
    <div className="w-full overflow-x-auto pb-2">
      {datos.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-medium">Aún no hay equipos registrados.</div>
      ) : (
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
              <tr key={club.nombre} className={`hover:bg-blue-50/50 transition-colors ${index === 0 ? 'bg-amber-50/10' : 'bg-white'}`}>
                <td className="p-4 font-bold text-slate-400 text-left">{index + 1}</td>
                <td className="p-4 font-bold text-slate-800 text-left sticky left-0 bg-white z-10 flex items-center gap-3">
                  {club.logoUrl ? (
                    <img src={club.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-full bg-slate-50 p-0.5 border shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xs shrink-0 border border-slate-200 shadow-sm">🛡️</div>
                  )}
                  
                  <div className="flex flex-col">
                    <span className="truncate max-w-[150px] md:max-w-none">{club.nombre}</span>
                    <div className="flex gap-2 mt-1">
                      {club.instagram && (
                        <a href={club.instagram} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-md hover:bg-pink-100 transition">
                          📸 IG
                        </a>
                      )}
                      {club.facebook && (
                        <a href={club.facebook} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md hover:bg-blue-100 transition">
                          📘 FB
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 font-black text-lg text-[#1e3a8a]">{club.pts}</td>
                <td className="p-4 text-slate-600">{club.pj}</td>
                <td className={`p-4 font-bold ${club.dg > 0 ? 'text-green-600' : 'text-slate-500'}`}>{club.dg}</td>
                <td className="p-4 text-yellow-700 font-bold bg-yellow-50/30">{club.amarillas}</td>
                <td className="p-4 text-red-700 font-bold bg-red-50/30">{club.rojas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 p-2">
      
      {/* Banner Principal con Logo y Redes de la Asociación */}
      <div className="bg-[#1e3a8a] rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto">
            {/* LOGO DE LA ASOCIACIÓN */}
            {infoAsociacion?.logoUrl ? (
              <img src={infoAsociacion.logoUrl} alt="Logo Asociación" className="w-20 h-20 md:w-32 md:h-32 object-contain bg-white rounded-full p-1.5 md:p-2 shadow-lg shrink-0" />
            ) : (
              <div className="w-20 h-20 md:w-32 md:h-32 bg-white/10 rounded-full flex items-center justify-center text-4xl shadow-lg shrink-0">⚽</div>
            )}

            <div>
              <h2 className="text-blue-300 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-1 md:mb-2">Asociación Oficial</h2>
              <h1 className="text-2xl md:text-5xl font-black tracking-tighter italic">
                {infoAsociacion?.nombre || "FUTBIAN.PRO"}
              </h1>
              
              {/* REDES SOCIALES DE LA ASOCIACIÓN */}
              <div className="flex flex-wrap gap-2 md:gap-3 mt-3 md:mt-4">
                {infoAsociacion?.instagram && (
                  <a href={infoAsociacion.instagram} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-bold backdrop-blur-sm border border-white/10">
                    <span className="text-sm md:text-lg">📸</span> Instagram
                  </a>
                )}
                {infoAsociacion?.facebook && (
                  <a href={infoAsociacion.facebook} target="_blank" rel="noopener noreferrer" className="bg-white/10 hover:bg-white/20 px-3 py-1.5 md:px-4 md:py-2 rounded-xl transition-all flex items-center gap-2 text-[10px] md:text-xs font-bold backdrop-blur-sm border border-white/10">
                    <span className="text-sm md:text-lg">📘</span> Facebook
                  </a>
                )}
                {!infoAsociacion?.instagram && !infoAsociacion?.facebook && (
                  <p className="text-[10px] text-blue-300/50 italic">Redes no configuradas</p>
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:block text-[120px] opacity-20 transform rotate-12 scale-150 translate-x-4">⚽</div>
        </div>
      </div>

      {/* Tabs y Tablas */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {["general", "series", "goleadores"].map((v) => (
          <button 
            key={v}
            onClick={() => setVistaActiva(v as any)}
            className={`shrink-0 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${vistaActiva === v ? "bg-[#1e3a8a] text-white shadow-xl scale-105" : "bg-white text-slate-400 border border-slate-200 hover:bg-slate-50"}`}
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
                    {seriesDisponibles.length === 0 && <option value="">Sin series creadas</option>}
                  </select>
                </div>
                {renderTabla(tablaSerie)}
              </>
            )}

            {vistaActiva === "goleadores" && (
              <div className="w-full overflow-x-auto pb-2">
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
                          <td className="p-4 font-black text-slate-400 text-center text-xl">
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : <span className="text-sm">{idx + 1}</span>}
                          </td>
                          <td className="p-4 font-bold text-slate-800 uppercase flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0">
                              {g.nombre.charAt(0)}
                            </div>
                            <div>
                              {g.nombre} <br/> <span className="text-[10px] text-slate-400 font-normal">{g.rut}</span>
                            </div>
                          </td>
                          <td className="p-4 font-medium text-slate-600 flex items-center gap-2">
                             {/* Mostrar logo del club en la tabla de goleadores también */}
                             {clubesInfo[g.equipo]?.logoUrl && (
                               <img src={clubesInfo[g.equipo].logoUrl} alt="" className="w-5 h-5 rounded-full object-contain" />
                             )}
                             {g.equipo}
                          </td>
                          <td className="p-4 font-black text-xl text-[#1e3a8a] text-center bg-blue-50/30">{g.goles}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}