'use client'
import { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; habilitadoLiguillaManual?: boolean; }
interface Evento { rut: string; }
interface JugadorNomina { rut: string; }
interface Partido { estado: string; serie: string; local: string; visita: string; eventos?: Evento[]; nomina?: JugadorNomina[]; }
interface LiguillaConfig { cuotasPorSerie?: Record<string, number>; }

export default function LiguillaPage() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [clubUsuario, setClubUsuario] = useState<string>("");
  const [cargando, setCargando] = useState(true);

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [cuotasConfig, setCuotasConfig] = useState<Record<string, number>>({});

  // Filtros
  const [filtroClub, setFiltroClub] = useState<string>("");
  const [filtroSerie, setFiltroSerie] = useState<string>("");
  const [cuotaTemporal, setCuotaTemporal] = useState<number>(5);

  useEffect(() => {
    // 1. Autenticación y Permisos
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) {
          const datos = docSnap.data();
          setRolUsuario(datos.rol);
          setClubUsuario(datos.club);
          // Si no es admin, fijar y bloquear el filtro de club
          if (datos.rol !== 'admin') {
            setFiltroClub(datos.club);
          }
        }
      }
      setCargando(false);
    });

    // 2. Traer Datos Base
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      setPartidos(snap.docs.map(d => d.data() as Partido));
    });
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
    });
    
    // 3. Traer Configuración de Liguilla (Cuotas por Serie)
    const unsubConfig = onSnapshot(doc(db, "asociaciones/san_fabian/configuracion", "liguilla"), (docSnap) => {
      if (docSnap.exists() && docSnap.data().cuotasPorSerie) {
        setCuotasConfig(docSnap.data().cuotasPorSerie);
      }
    });

    return () => { unsubAuth(); unsubP(); unsubJ(); unsubConfig(); };
  }, []);

  const clubesDisponibles = useMemo(() => Array.from(new Set(jugadores.map(j => j.club))).sort(), [jugadores]);
  const seriesDisponibles = useMemo(() => Array.from(new Set(jugadores.map(j => j.serie))).sort(), [jugadores]);

  // Sincronizar el input de cuota con la base de datos cuando cambian de serie
  useEffect(() => {
    if (filtroSerie) {
      setCuotaTemporal(cuotasConfig[filtroSerie] || 5); // 5 por defecto si no hay nada guardado
    }
  }, [filtroSerie, cuotasConfig]);

  // MOTOR DE CÁLCULO DE ASISTENCIAS Y CLASIFICACIÓN
  const listaLiguilla = useMemo(() => {
    const conteoAsistencias: Record<string, number> = {};

    partidos.forEach(p => {
      if (p.estado === "Finalizado") {
        const rutsPresentes = new Set<string>();
        p.nomina?.forEach(n => rutsPresentes.add(n.rut));
        p.eventos?.forEach(e => rutsPresentes.add(e.rut));

        rutsPresentes.forEach(rut => {
          if (!conteoAsistencias[rut]) conteoAsistencias[rut] = 0;
          conteoAsistencias[rut] += 1; 
        });
      }
    });

    return jugadores
      .filter(j => (filtroClub ? j.club === filtroClub : true))
      .filter(j => (filtroSerie ? j.serie === filtroSerie : true))
      .map(j => {
        const partidosJugados = conteoAsistencias[j.rut] || 0;
        const cuotaRequerida = cuotasConfig[j.serie] || 5; // Lee la cuota de la DB
        
        return {
          ...j,
          partidosJugados,
          cuotaRequerida,
          // Clasifica si cumple los partidos O si un admin lo habilitó manualmente
          clasifica: partidosJugados >= cuotaRequerida || j.habilitadoLiguillaManual === true
        };
      })
      .sort((a, b) => b.partidosJugados - a.partidosJugados || a.nombre.localeCompare(b.nombre));
  }, [partidos, jugadores, filtroClub, filtroSerie, cuotasConfig]);

  // --- ACCIONES DE ADMINISTRADOR ---
  const guardarCuotaEnBD = async () => {
    if (!filtroSerie) return alert("Selecciona una serie primero.");
    try {
      const configRef = doc(db, "asociaciones/san_fabian/configuracion", "liguilla");
      await setDoc(configRef, {
        cuotasPorSerie: { [filtroSerie]: cuotaTemporal }
      }, { merge: true }); // Merge true es clave para no borrar las cuotas de las otras series
      alert(`Cuota de la Serie ${filtroSerie} actualizada a ${cuotaTemporal} partidos.`);
    } catch (error) { console.error(error); }
  };

  const toggleHabilitacionManual = async (jugador: Jugador & { clasifica: boolean }) => {
    if (rolUsuario !== 'admin') return;
    
    const nuevoEstado = !jugador.habilitadoLiguillaManual;
    const accion = nuevoEstado ? "HABILITAR" : "QUITAR HABILITACIÓN MANUAL a";
    
    if (confirm(`¿Estás seguro de ${accion} ${jugador.nombre} por secretaría?`)) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", jugador.id), {
          habilitadoLiguillaManual: nuevoEstado
        });
      } catch (error) { console.error(error); }
    }
  };

  if (cargando) return <div className="p-20 flex justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 md:space-y-8 p-2 md:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-[#1e3a8a] rounded-3xl p-6 md:p-10 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Control de Elegibilidad</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">MÓDULO LIGUILLA</h1>
            <p className="text-blue-200 mt-2 font-medium text-sm md:text-base max-w-xl">
              Verifica qué jugadores cumplen con la cuota de partidos exigida para disputar las fases finales.
            </p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 text-center backdrop-blur-sm">
            <p className="text-[10px] font-bold text-blue-200 uppercase">Rol Actual</p>
            <p className="text-sm font-black text-white uppercase">{rolUsuario === 'admin' ? '🛡️ Admin' : `Delegado ${clubUsuario}`}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] pointer-events-none">📋</div>
      </div>

      {/* PANEL DE FILTROS Y CONFIGURACIÓN */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Filtrar por Club</label>
          <select 
            value={filtroClub} 
            onChange={e => setFiltroClub(e.target.value)} 
            disabled={rolUsuario !== 'admin'} // Se bloquea si no es admin
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Todos los Clubes</option>
            {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Filtrar por Serie</label>
          <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-slate-700 outline-none focus:border-blue-500">
            <option value="">-- Seleccione una serie --</option>
            {seriesDisponibles.map(s => <option key={s} value={s}>Serie {s}</option>)}
          </select>
        </div>

        {/* CONTROLES DE CUOTA (Solo visibles si se selecciona una serie) */}
        {filtroSerie && (
          <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
            <label className="block text-[10px] font-black text-blue-600 uppercase mb-2">Cuota: Serie {filtroSerie}</label>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-lg p-1 flex-1">
                {rolUsuario === 'admin' && (
                  <button onClick={() => setCuotaTemporal(Math.max(1, cuotaTemporal - 1))} className="w-8 h-8 bg-slate-100 rounded text-slate-600 font-black hover:bg-slate-200">-</button>
                )}
                <input type="number" value={cuotaTemporal} readOnly className="w-full bg-transparent text-center font-black text-lg text-[#1e3a8a] outline-none" />
                {rolUsuario === 'admin' && (
                  <button onClick={() => setCuotaTemporal(cuotaTemporal + 1)} className="w-8 h-8 bg-slate-100 rounded text-slate-600 font-black hover:bg-slate-200">+</button>
                )}
              </div>
              
              {/* Botón Guardar solo para Admin */}
              {rolUsuario === 'admin' && cuotaTemporal !== (cuotasConfig[filtroSerie] || 5) && (
                <button onClick={guardarCuotaEnBD} className="bg-blue-600 text-white font-bold text-xs px-4 rounded-lg shadow hover:bg-blue-700 transition">
                  Guardar
                </button>
              )}
            </div>
            {rolUsuario !== 'admin' && <p className="text-[9px] text-blue-400 font-bold mt-2 text-center">Cuota definida por la Asociación</p>}
          </div>
        )}
      </div>

      {/* TABLA DE JUGADORES */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-2">
          <span className="font-bold text-slate-600 text-sm">
            {listaLiguilla.length} Jugadores en lista
          </span>
          <div className="flex flex-wrap gap-3 text-[10px] font-bold bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Cumple Cuota</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Hab. Manual</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Inhabilitado</span>
          </div>
        </div>
        
        <div className="w-full overflow-x-auto pb-2 min-h-[300px]">
          {listaLiguilla.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium">Selecciona un filtro para ver los jugadores.</div>
          ) : (
            <table className="w-full min-w-[800px] text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white text-slate-400 text-[10px] uppercase tracking-widest border-b border-slate-100">
                  <th className="p-4 font-bold sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Jugador / RUT</th>
                  <th className="p-4 font-bold">Club</th>
                  <th className="p-4 font-bold">Serie</th>
                  <th className="p-4 font-black text-[#1e3a8a] text-center">Partidos (PJ)</th>
                  <th className="p-4 font-bold text-center">Estado Liguilla</th>
                  {rolUsuario === 'admin' && <th className="p-4 font-bold text-center bg-amber-50 text-amber-700 rounded-tl-lg">Acción Admin</th>}
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
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-black ${j.partidosJugados >= j.cuotaRequerida ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {j.partidosJugados} <span className="text-xs text-slate-400 font-medium">/ {j.cuotaRequerida}</span>
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {j.clasifica ? (
                        j.habilitadoLiguillaManual ? (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black border border-amber-200">
                            🛡️ POR SECRETARÍA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-200">
                            ✅ HABILITADO
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-200">
                          ❌ FALTAN {j.cuotaRequerida - j.partidosJugados} PJ
                        </span>
                      )}
                    </td>

                    {/* COLUMNA EXCLUSIVA PARA ADMIN: FORZAR HABILITACIÓN */}
                    {rolUsuario === 'admin' && (
                      <td className="p-4 text-center bg-amber-50/30">
                        <button 
                          onClick={() => toggleHabilitacionManual(j)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all shadow-sm
                            ${j.habilitadoLiguillaManual 
                              ? 'bg-slate-200 text-slate-600 hover:bg-red-500 hover:text-white' 
                              : 'bg-amber-400 text-amber-900 hover:bg-amber-500'}`}
                        >
                          {j.habilitadoLiguillaManual ? 'REVOCAR GRACIA' : 'HABILITAR POR GRACIA'}
                        </button>
                      </td>
                    )}
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