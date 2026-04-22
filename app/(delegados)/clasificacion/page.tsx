'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { id: string; estado: string; serie: string; nomina?: JugadorNomina[]; }
interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; clasificacionGracia?: boolean; }
interface Club { nombre: string; }

const SERIES = ["Honor", "Segunda", "Juvenil", "Senior 35", "Senior 40", "Damas"];

export default function ModuloClasificacionLiguilla() {
  const { rol, club: miClub, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  const [configMinimos, setConfigMinimos] = useState<Record<string, number>>({});
  
  const [filtroSerie, setFiltroSerie] = useState("Todas");
  const [filtroClub, setFiltroClub] = useState("");
  const [editandoConfig, setEditandoConfig] = useState(false);

  useEffect(() => {
    if (authCargando) return;
    if (rol === 'delegado' && miClub) setFiltroClub(miClub);

    const unsubAsoc = onSnapshot(doc(db, "asociaciones", "san_fabian"), (docSnap) => {
      if (docSnap.exists()) setConfigMinimos(docSnap.data().minPartidosLiguilla || {});
    });
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
    return () => { unsubAsoc(); unsubC(); unsubP(); unsubJ(); };
  }, [authCargando, rol, miClub]);

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

  const actualizarMinimos = async () => {
    try {
      await setDoc(doc(db, "asociaciones", "san_fabian"), { minPartidosLiguilla: configMinimos }, { merge: true });
      setEditandoConfig(false);
      alert("✅ Mínimos por serie actualizados.");
    } catch (error) { alert("Error al guardar."); }
  };

  const clubPermitido = rol === 'admin' ? filtroClub : miClub;
  const jugadoresFiltrados = jugadores.filter(j => 
    (clubPermitido === "Todos" || j.club === clubPermitido) && 
    (filtroSerie === "Todas" || j.serie === filtroSerie)
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Calculando clasificación...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-2 md:p-4 animate-in fade-in duration-500 pb-20">
      
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-yellow-500">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">Padrón Final Liguilla</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 tracking-widest">Validación oficial de firmas en actas</p>
          </div>
          {rol === 'admin' && (
            <button onClick={() => setEditandoConfig(!editandoConfig)} className="bg-yellow-500 text-slate-900 px-6 py-2 rounded-xl font-black text-xs uppercase shadow-lg hover:bg-yellow-400 transition">
              {editandoConfig ? "Cerrar Ajustes" : "⚙️ Ajustar Mínimos"}
            </button>
          )}
        </div>
      </header>

      {/* 🚨 PANEL DE CONFIGURACIÓN DINÁMICO (SOLO ADMIN) */}
      {rol === 'admin' && editandoConfig && (
        <div className="bg-amber-50 p-6 rounded-3xl border-2 border-amber-200 shadow-inner animate-in slide-in-from-top duration-300">
          <h3 className="font-black text-amber-800 uppercase text-xs mb-4 tracking-widest">Definir Partidos Mínimos por Serie</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            {SERIES.map(serie => (
              <div key={serie} className="bg-white p-3 rounded-xl border border-amber-200 text-center">
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">{serie}</label>
                <input 
                  type="number" min="0" 
                  value={configMinimos[serie] || 0} 
                  onChange={e => setConfigMinimos({...configMinimos, [serie]: Number(e.target.value)})}
                  className="w-full text-center font-black text-xl text-[#1e3a8a] bg-slate-50 rounded outline-none"
                />
              </div>
            ))}
          </div>
          <button onClick={actualizarMinimos} className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl text-xs uppercase tracking-widest hover:bg-emerald-700 transition">Aplicar Cambios a Todas las Series</button>
        </div>
      )}

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Serie:</span>
             <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todas">Todas</option>{SERIES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          {rol === 'admin' && (
            <div className="flex-1 flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Club:</span>
               <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todos">Todos</option>{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                <th className="p-4 font-bold">Jugador / RUT</th>
                <th className="p-4 font-bold text-center">Club / Serie</th>
                <th className="p-4 font-black text-center text-[#1e3a8a]">Partidos</th>
                <th className="p-4 font-black text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jugadoresFiltrados.map(j => {
                const rutLimpio = j.rut.replace(/[^0-9kK]/g, "").toUpperCase();
                const jugados = conteoPartidos[rutLimpio] || 0;
                const minRequerido = configMinimos[j.serie] || 0;
                const habilitado = jugados >= minRequerido || j.clasificacionGracia;

                return (
                  <tr key={j.id} className={`hover:bg-slate-50 transition-colors ${habilitado ? 'bg-emerald-50/20' : 'bg-red-50/10'}`}>
                    <td className="p-4"><p className="font-black text-slate-800 uppercase text-xs md:text-sm">{j.nombre}</p><p className="font-mono text-[10px] text-slate-400 font-bold">{j.rut}</p></td>
                    <td className="p-4 text-center"><p className="font-bold text-slate-700 text-xs">{j.club}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{j.serie}</p></td>
                    <td className="p-4 text-center font-black text-xl text-[#1e3a8a]">{jugados} <span className="text-[10px] font-bold text-slate-300">/ {minRequerido}</span></td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase tracking-widest ${habilitado ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        {habilitado ? '✅ Clasificado' : `❌ Faltan ${minRequerido - jugados}`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}