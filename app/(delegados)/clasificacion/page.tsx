'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { id: string; estado: string; serie: string; nomina?: JugadorNomina[]; }
interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; clasificacionGracia?: boolean; }
interface Club { nombre: string; }

// REGLA DEL TORNEO: Cantidad mínima de partidos para jugar liguilla
const MIN_PARTIDOS_LIGUILLA = 3;

export default function ModuloClasificacionLiguilla() {
  const { rol, club: miClub, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  
  const [filtroSerie, setFiltroSerie] = useState("Todas");
  const [filtroClub, setFiltroClub] = useState("");

  useEffect(() => {
    if (authCargando) return;
    if (rol === 'delegado' && miClub) setFiltroClub(miClub);

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => d.data() as Club).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(data);
      if (rol === 'admin' && data.length > 0 && !filtroClub) setFiltroClub("Todos");
    });

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      setPartidos(data.filter(p => p.estado === "Finalizado"));
    });

    const unsubJ = onSnapshot(query(collection(db, "asociaciones/san_fabian/jugadores")), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });

    return () => { unsubC(); unsubP(); unsubJ(); };
  }, [authCargando, rol, miClub]);

  // Motor de conteo de partidos jugados
  const conteoPartidos = useMemo(() => {
    const conteo: Record<string, number> = {};
    partidos.forEach(p => {
      p.nomina?.forEach(jug => {
        const rutLimpio = jug.rut.replace(/[^0-9kK]/g, "").toUpperCase();
        if (!conteo[rutLimpio]) conteo[rutLimpio] = 0;
        conteo[rutLimpio]++;
      });
    });
    return conteo;
  }, [partidos]);

  const otorgarGracia = async (jugadorId: string, nombre: string, estadoActual: boolean) => {
    if (rol !== 'admin') return;
    const accion = estadoActual ? "quitarle" : "otorgarle";
    if (confirm(`¿Estás seguro de ${accion} la Clasificación de Gracia a ${nombre}?`)) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", jugadorId), { clasificacionGracia: !estadoActual });
      } catch (error) { alert("Error al modificar la gracia."); }
    }
  };

  const clubPermitido = rol === 'admin' ? filtroClub : miClub;
  const jugadoresFiltrados = jugadores.filter(j => 
    (clubPermitido === "Todos" || j.club === clubPermitido) && 
    (filtroSerie === "Todas" || j.serie === filtroSerie)
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Calculando estadísticas de clasificación...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-yellow-500">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-yellow-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Control de Padrón Final</h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">CLASIFICACIÓN LIGUILLA</h1>
            <p className="text-slate-400 mt-2 text-xs md:text-sm">Mínimo requerido: <span className="text-white font-bold">{MIN_PARTIDOS_LIGUILLA} partidos firmados</span> en actas oficiales.</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
            <p className="text-[10px] font-bold text-slate-300 uppercase">Vista de Acceso</p>
            <p className="text-sm font-black text-white">{rol === 'admin' ? '🛡️ Admin Global' : `🛡️ ${clubPermitido}`}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] pointer-events-none">⭐</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Serie:</span>
             <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todas">Todas</option><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select>
          </div>
          {rol === 'admin' && (
            <div className="flex-1 flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Club:</span>
               <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todos">Todos</option>{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                <th className="p-4 font-bold">Jugador / RUT</th>
                <th className="p-4 font-bold text-center">Club / Serie</th>
                <th className="p-4 font-black text-center text-[#1e3a8a]">Partidos Firmados</th>
                <th className="p-4 font-black text-center">Estado Liguilla</th>
                {rol === 'admin' && <th className="p-4 font-black text-center text-orange-500">Otorgar Gracia</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jugadoresFiltrados.length === 0 ? <tr><td colSpan={5} className="p-10 text-center font-bold text-slate-400">No se encontraron jugadores.</td></tr> : (
                jugadoresFiltrados.map(j => {
                  const rutLimpio = j.rut.replace(/[^0-9kK]/g, "").toUpperCase();
                  const jugados = conteoPartidos[rutLimpio] || 0;
                  const clasificaPorMerito = jugados >= MIN_PARTIDOS_LIGUILLA;
                  const estaClasificado = clasificaPorMerito || j.clasificacionGracia;

                  return (
                    <tr key={j.id} className={`hover:bg-slate-50 transition-colors ${estaClasificado ? 'bg-emerald-50/20' : 'bg-red-50/10'}`}>
                      <td className="p-4">
                        <p className="font-black text-slate-800 uppercase text-xs md:text-sm">{j.nombre}</p>
                        <p className="font-mono text-[10px] text-slate-400 font-bold">{j.rut}</p>
                      </td>
                      <td className="p-4 text-center">
                        <p className="font-bold text-slate-700 text-xs">{j.club}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Serie {j.serie}</p>
                      </td>
                      <td className="p-4 text-center font-black text-xl text-[#1e3a8a]">{jugados}</td>
                      <td className="p-4 text-center">
                        {estaClasificado ? (
                          <span className="inline-flex flex-col items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-[10px] font-black border border-emerald-200 uppercase tracking-widest shadow-sm">
                            ✅ Habilitado
                            {j.clasificacionGracia && <span className="text-[8px] bg-emerald-700 text-white px-1.5 rounded-full">Por Secretaría</span>}
                          </span>
                        ) : (
                          <span className="inline-flex flex-col items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black border border-red-200 uppercase tracking-widest shadow-sm">
                            ❌ Inhabilitado
                            <span className="text-[8px] bg-red-600 text-white px-1.5 rounded-full">Faltan {MIN_PARTIDOS_LIGUILLA - jugados} partidos</span>
                          </span>
                        )}
                      </td>
                      {rol === 'admin' && (
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => otorgarGracia(j.id, j.nombre, j.clasificacionGracia || false)}
                            className={`px-3 py-1.5 rounded text-[10px] font-bold transition shadow-sm ${j.clasificacionGracia ? 'bg-slate-800 text-white hover:bg-black' : 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-500 hover:text-white'}`}
                          >
                            {j.clasificacionGracia ? "Quitar Gracia" : "🏆 Dar Gracia"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}