'use client'
import { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Partido { id: string; estado: string; serie: string; local: string; visita: string; golesLocal: number; golesVisita: number; }
interface Estadisticas { club: string; PJ: number; PG: number; PE: number; PP: number; GF: number; GC: number; DG: number; PTS: number; }
interface AsociacionInfo { nombre?: string; logoUrl?: string; auspiciadorNombre?: string; auspiciadorLogo?: string; }
interface Club { id: string; nombre: string; logoUrl?: string; instagram?: string; facebook?: string; }

export default function HomePublico() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  const [infoAsoc, setInfoAsoc] = useState<AsociacionInfo>({});

  // 1. Verificación de Seguridad y Carga de Datos
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) setRolUsuario(docSnap.data().rol);
      } else {
        setRolUsuario(null);
      }
    });

    const unsubAsoc = onSnapshot(doc(db, "asociaciones", "san_fabian"), (docSnap) => {
      if (docSnap.exists()) setInfoAsoc(docSnap.data() as AsociacionInfo);
    });

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      setClubes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]);
    });

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      setPartidos(data.filter(p => p.estado === "Finalizado")); // Solo calculamos con actas cerradas
      setCargando(false);
    });

    return () => { unsubAuth(); unsubAsoc(); unsubC(); unsubP(); };
  }, []);

  // 2. Motor de Cálculo de Estadísticas Automáticas
  const { tablaPorSerie, tablaGeneral } = useMemo(() => {
    const series: Record<string, Record<string, Estadisticas>> = {};
    const general: Record<string, Estadisticas> = {};

    const inicializarStats = (club: string, serie: string) => {
      if (!series[serie]) series[serie] = {};
      if (!series[serie][club]) series[serie][club] = { club, PJ: 0, PG: 0, PE: 0, PP: 0, GF: 0, GC: 0, DG: 0, PTS: 0 };
      if (!general[club]) general[club] = { club, PJ: 0, PG: 0, PE: 0, PP: 0, GF: 0, GC: 0, DG: 0, PTS: 0 };
    };

    const sumarStats = (club: string, serie: string, golesF: number, golesC: number) => {
      let pts = 0; let pg = 0; let pe = 0; let pp = 0;
      if (golesF > golesC) { pts = 3; pg = 1; }
      else if (golesF === golesC) { pts = 1; pe = 1; }
      else { pp = 1; }

      // Suma a la serie
      const s = series[serie][club];
      s.PJ++; s.PG += pg; s.PE += pe; s.PP += pp; s.GF += golesF; s.GC += golesC; s.DG = s.GF - s.GC; s.PTS += pts;

      // Suma a la General
      const g = general[club];
      g.PJ++; g.PG += pg; g.PE += pe; g.PP += pp; g.GF += golesF; g.GC += golesC; g.DG = g.GF - g.GC; g.PTS += pts;
    };

    partidos.forEach(p => {
      inicializarStats(p.local, p.serie);
      inicializarStats(p.visita, p.serie);
      sumarStats(p.local, p.serie, p.golesLocal || 0, p.golesVisita || 0);
      sumarStats(p.visita, p.serie, p.golesVisita || 0, p.golesLocal || 0);
    });

    // Ordenar tablas: Puntos > Diferencia de Goles > Goles a Favor
    const ordenarTabla = (tabla: Record<string, Estadisticas>) => Object.values(tabla).sort((a, b) => b.PTS - a.PTS || b.DG - a.DG || b.GF - a.GF);

    const tablaSeriesOrdenada: Record<string, Estadisticas[]> = {};
    Object.keys(series).forEach(serie => { tablaSeriesOrdenada[serie] = ordenarTabla(series[serie]); });

    return { tablaPorSerie: tablaSeriesOrdenada, tablaGeneral: ordenarTabla(general) };
  }, [partidos]);

  if (cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando estadísticas oficiales...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12">
      
      {/* BANNER PRINCIPAL */}
      <header className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl text-white relative overflow-hidden flex flex-col items-center text-center border-b-4 border-emerald-500">
        <div className="relative z-10 space-y-4">
          {infoAsoc.logoUrl && <img src={infoAsoc.logoUrl} alt="Logo" className="w-24 h-24 mx-auto object-contain bg-white/10 p-2 rounded-full backdrop-blur-sm" />}
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">{infoAsoc.nombre || "Asociación de Fútbol"}</h1>
          <div className="inline-flex flex-col md:flex-row items-center gap-3 bg-white/10 px-6 py-3 rounded-2xl border border-white/20 backdrop-blur-sm mt-4">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Torneo Oficial 2026 Auspiciado por</span>
            <div className="flex items-center gap-2">
              {infoAsoc.auspiciadorLogo && <img src={infoAsoc.auspiciadorLogo} alt="Sponsor" className="h-6 object-contain" />}
              <span className="font-bold text-white uppercase">{infoAsoc.auspiciadorNombre || "Auspiciador"}</span>
            </div>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[200px] pointer-events-none">⚽</div>
      </header>

      {/* 🔴 REGLA 1: TABLA GENERAL RESTRINGIDA SOLO PARA ADMIN Y DELEGADOS */}
      {(rolUsuario === 'admin' || rolUsuario === 'delegado') && tablaGeneral.length > 0 && (
        <section className="bg-white p-4 md:p-8 rounded-3xl shadow-sm border border-emerald-200">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b pb-4 border-slate-100 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-emerald-700 tracking-tight flex items-center gap-2"><span className="text-3xl">🏆</span> TABLA GENERAL DE CLUBES</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Acumulado de todas las series</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-3 py-1 rounded uppercase shadow-sm whitespace-nowrap">Uso Interno Directiva</span>
          </div>
          
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 font-black w-10 text-center">#</th>
                  <th className="p-4 font-bold">Club y Redes</th>
                  <th className="p-4 font-bold text-center">PJ</th>
                  <th className="p-4 font-bold text-center">PG</th>
                  <th className="p-4 font-bold text-center">PE</th>
                  <th className="p-4 font-bold text-center">PP</th>
                  <th className="p-4 font-black text-center text-[#1e3a8a] text-sm">PTS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tablaGeneral.map((stat, i) => {
                  const clubInfo = clubes.find(c => c.nombre === stat.club);
                  return (
                    <tr key={`gen-${stat.club}`} className={`hover:bg-slate-50 transition-colors ${i === 0 ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-4 text-center font-black text-slate-400">{i + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="font-black text-slate-800 uppercase text-sm md:text-base">{stat.club} {i === 0 && '👑'}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {clubInfo?.facebook && (
                              <a href={clubInfo.facebook} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white bg-blue-600 px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700 transition" title="Facebook">FB</a>
                            )}
                            {clubInfo?.instagram && (
                              <a href={clubInfo.instagram} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition" title="Instagram">IG</a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-500">{stat.PJ}</td>
                      <td className="p-4 text-center font-bold text-emerald-600">{stat.PG}</td>
                      <td className="p-4 text-center font-bold text-slate-400">{stat.PE}</td>
                      <td className="p-4 text-center font-bold text-red-400">{stat.PP}</td>
                      <td className="p-4 text-center font-black text-xl text-[#1e3a8a]">{stat.PTS}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 🔴 REGLA 2 Y 3: TABLA POR SERIES (PÚBLICA, UNA POR FILA, CON REDES) */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">POSICIONES POR SERIE</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">Estadísticas deportivas oficiales actualizadas en tiempo real.</p>
        </div>

        {Object.keys(tablaPorSerie).length === 0 ? (
          <div className="bg-white p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold">
            Aún no hay partidos finalizados para calcular las tablas.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-10">
            {Object.entries(tablaPorSerie).sort().map(([serie, stats]) => (
              <div key={serie} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-[#1e3a8a] p-4 md:p-5 text-white">
                  <h3 className="font-black text-xl tracking-widest uppercase">SERIE {serie}</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                        <th className="p-4 font-black text-center w-12">#</th>
                        <th className="p-4 font-bold">Club y Redes</th>
                        <th className="p-4 font-bold text-center" title="Partidos Jugados">PJ</th>
                        <th className="p-4 font-bold text-center" title="Partidos Ganados">PG</th>
                        <th className="p-4 font-bold text-center" title="Partidos Empatados">PE</th>
                        <th className="p-4 font-bold text-center" title="Partidos Perdidos">PP</th>
                        <th className="p-4 font-bold text-center text-slate-400" title="Goles a Favor">GF</th>
                        <th className="p-4 font-bold text-center text-slate-400" title="Goles en Contra">GC</th>
                        <th className="p-4 font-bold text-center" title="Diferencia de Goles">DIF</th>
                        <th className="p-4 font-black text-center text-[#1e3a8a] text-sm">PTS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.map((stat, i) => {
                        const clubInfo = clubes.find(c => c.nombre === stat.club);
                        return (
                          <tr key={`${serie}-${stat.club}`} className={`hover:bg-slate-50 transition-colors ${i < 4 ? 'bg-blue-50/30' : ''}`}>
                            <td className="p-4 text-center font-black text-slate-400">{i + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <span className="font-black text-slate-800 uppercase text-xs md:text-sm">{stat.club}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {clubInfo?.facebook && (
                                    <a href={clubInfo.facebook} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white bg-blue-600 px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-700 transition" title="Facebook">FB</a>
                                  )}
                                  {clubInfo?.instagram && (
                                    <a href={clubInfo.instagram} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 px-1.5 py-0.5 rounded shadow-sm hover:opacity-80 transition" title="Instagram">IG</a>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center font-bold text-slate-600">{stat.PJ}</td>
                            <td className="p-4 text-center font-bold text-emerald-600">{stat.PG}</td>
                            <td className="p-4 text-center font-bold text-slate-400">{stat.PE}</td>
                            <td className="p-4 text-center font-bold text-red-400">{stat.PP}</td>
                            <td className="p-4 text-center font-bold text-slate-400">{stat.GF}</td>
                            <td className="p-4 text-center font-bold text-slate-400">{stat.GC}</td>
                            <td className="p-4 text-center font-bold text-slate-600">{stat.DG > 0 ? `+${stat.DG}` : stat.DG}</td>
                            <td className="p-4 text-center font-black text-xl text-[#1e3a8a]">{stat.PTS}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Clasifican los 4 primeros a la Liguilla</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}