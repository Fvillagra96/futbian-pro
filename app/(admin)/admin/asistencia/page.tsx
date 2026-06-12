'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

// Funciones de limpieza internacional (RUT y Pasaportes con letras)
const limpiarId = (v: string) => v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const formatearId = (v: string) => {
  const limpio = limpiarId(v);
  if (/[A-J_L-Z]/.test(limpio)) return limpio; // Pasaporte
  if (limpio.length < 7) return limpio;
  let dv = limpio.slice(-1), resto = limpio.slice(0, -1), f = "";
  for (let i = resto.length - 1, j = 1; i >= 0; i--, j++) {
    f = resto.charAt(i) + f;
    if (j % 3 === 0 && i !== 0) f = "." + f;
  }
  return `${f}-${dv}`; // RUT
};

interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; estado: string; }
interface JugadorStats { id: string; rut: string; partidos: Record<string, string>; } // id_partido: serie
interface JugadorPadron { id: string; nombre: string; club: string; }

export default function ModuloAsistenciaYConteo() {
  const { authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [padronJugadores, setPadronJugadores] = useState<JugadorPadron[]>([]);
  const [estadisticas, setEstadisticas] = useState<JugadorStats[]>([]);
  
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState("");
  const [pestanaActiva, setPestanaActiva] = useState<"ingreso" | "conteo">("ingreso");
  
  // Bloques de texto para pegar masivamente
  const [textoLocal, setTextoLocal] = useState("");
  const [textoVisita, setTextoVisita] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [busquedaStats, setBusquedaStats] = useState("");

  useEffect(() => {
    if (authCargando) return;

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc")), (snap) => {
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[]);
    });

    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setPadronJugadores(snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre, club: d.data().club })) as JugadorPadron[]);
    });

    const unsubS = onSnapshot(collection(db, "asociaciones/san_fabian/asistencia_acumulada"), (snap) => {
      setEstadisticas(snap.docs.map(d => ({ id: d.id, rut: d.data().rut, partidos: d.data().partidos || {} })) as JugadorStats[]);
      setCargandoDatos(false);
    });

    return () => { unsubP(); unsubJ(); unsubS(); };
  }, [authCargando]);

  const partidoActivo = partidos.find(p => p.id === partidoSeleccionadoId);

  // Procesador inteligente de texto pegado
  const extraerRuts = (texto: string) => {
    if (!texto.trim()) return [];
    // Separa por saltos de línea, comas o espacios
    return texto.split(/[\n,;\s]+/)
      .map(r => limpiarId(r))
      .filter(r => r.length >= 5); // Evita fragmentos vacíos o basura
  };

  const rutsLocalesDetectados = useMemo(() => extraerRuts(textoLocal), [textoLocal]);
  const rutsVisitasDetectados = useMemo(() => extraerRuts(textoVisita), [textoVisita]);

  const guardarAsistenciaMasiva = async () => {
    if (!partidoActivo) return alert("Selecciona un encuentro primero.");
    if (rutsLocalesDetectados.length === 0 && rutsVisitasDetectados.length === 0) {
      return alert("Ingresa al menos un RUT para guardar.");
    }

    setGuardando(true);
    try {
      const batch = writeBatch(db);

      // Procesamos Jugadores Locales
      rutsLocalesDetectados.forEach(idLimpio => {
        const docRef = doc(db, "asociaciones/san_fabian/asistencia_acumulada", idLimpio);
        batch.set(docRef, {
          rut: formatearId(idLimpio),
          [`partidos.${partidoActivo.id}`]: partidoActivo.serie
        }, { merge: true });
      });

      // Procesamos Jugadores Visitas
      rutsVisitasDetectados.forEach(idLimpio => {
        const docRef = doc(db, "asociaciones/san_fabian/asistencia_acumulada", idLimpio);
        batch.set(docRef, {
          rut: formatearId(idLimpio),
          [`partidos.${partidoActivo.id}`]: partidoActivo.serie
        }, { merge: true });
      });

      // Guardamos también en la nómina del partido por consistencia de la V2.0
      const nominaCombinada = [
        ...rutsLocalesDetectados.map(id => ({
          rut: formatearId(id),
          nombre: padronJugadores.find(j => j.id === id)?.nombre || "NO INSCRITO EN PADRÓN",
          equipo: partidoActivo.local
        })),
        ...rutsVisitasDetectados.map(id => ({
          rut: formatearId(id),
          nombre: padronJugadores.find(j => j.id === id)?.nombre || "NO INSCRITO EN PADRÓN",
          equipo: partidoActivo.visita
        }))
      ];

      batch.update(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), {
        nomina: nominaCombinada,
        estado: "Finalizado" // Cierra el partido automáticamente
      });

      await batch.commit();
      alert(`🎉 Asistencia guardada con éxito. Se actualizaron los contadores de las series.`);
      setTextoLocal(""); setTextoVisita(""); setPartidoSeleccionadoId("");
    } catch (error) {
      alert("Error al inyectar la asistencia.");
    } finally {
      setGuardando(false);
    }
  };

  // Filtro de búsqueda para la tabla de estadísticas acumuladas
  const estadisticasFiltradas = useMemo(() => {
    if (!busquedaStats.trim()) return estadisticas;
    const t = busquedaStats.toLowerCase();
    return estadisticas.filter(est => {
      const datosPadron = padronJugadores.find(j => j.id === est.id);
      return est.rut.toLowerCase().includes(t) || datosPadron?.nombre.toLowerCase().includes(t);
    });
  }, [estadisticas, busquedaStats, padronJugadores]);

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Abriendo registros de asistencia...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      
      {/* PANELES DE NAVEGACIÓN INTERNA */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl w-full md:w-fit gap-2">
        <button onClick={() => setPestanaActiva("ingreso")} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${pestanaActiva === "ingreso" ? "bg-[#1e3a8a] text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>📥 Carga Rápida Asistencia</button>
        <button onClick={() => setPestanaActiva("conteo")} className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${pestanaActiva === "conteo" ? "bg-[#1e3a8a] text-white shadow-md" : "text-slate-500 hover:text-slate-700"}`}>📊 Contadores por Serie</button>
      </div>

      {pestanaActiva === "ingreso" ? (
        /* VISTA 1: INGRESO RÁPIDO PEGANDO TEXTO */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-4"><span className="text-xl">⚽</span> 1. Seleccionar Partido</h3>
              <select value={partidoSeleccionadoId} onChange={e => setPartidoSeleccionadoId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none text-sm text-[#1e3a8a]">
                <option value="">-- Seleccionar Encuentro --</option>
                {partidos.map(p => (
                  <option key={p.id} value={p.id}>F{p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>
                ))}
              </select>

              {partidoActivo && (
                <div className="mt-6 p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Partido Seleccionado</p>
                  <p className="font-black text-slate-800 text-sm uppercase">{partidoActivo.local} vs {partidoActivo.visita}</p>
                  <span className="bg-blue-100 text-blue-800 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest inline-block">Serie: {partidoActivo.serie}</span>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            {!partidoActivo ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl h-[400px] flex flex-col items-center justify-center p-10 text-slate-400">
                <span className="text-5xl mb-4">📝</span>
                <p className="font-bold text-sm text-center">Selecciona un partido a la izquierda para habilitar la carga masiva.</p>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6 animate-in slide-in-from-right-4">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">2. Inyección de Planillas</h3>
                  <p className="text-xs text-slate-500 font-medium">Pega los bloques de RUTs tal cual te los manden. El sistema limpiará las letras, puntos y espacios automáticamente.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* TEXTAREA LOCAL */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest">Nómina de: {partidoActivo.local}</label>
                    <textarea value={textoLocal} onChange={e => setTextoLocal(e.target.value)} placeholder="Pega los RUTs aquí..." className="w-full h-64 p-4 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500 transition shadow-inner resize-none" />
                    <p className="text-[10px] font-bold text-slate-400">⚡ Jugadores detectados: <span className="text-slate-700 font-black">{rutsLocalesDetectados.length}</span></p>
                  </div>

                  {/* TEXTAREA VISITA */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest">Nómina de: {partidoActivo.visita}</label>
                    <textarea value={textoVisita} onChange={e => setTextoVisita(e.target.value)} placeholder="Pega los RUTs aquí..." className="w-full h-64 p-4 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-inner resize-none" />
                    <p className="text-[10px] font-bold text-slate-400">⚡ Jugadores detectados: <span className="text-slate-700 font-black">{rutsVisitasDetectados.length}</span></p>
                  </div>
                </div>

                <button onClick={guardarAsistenciaMasiva} disabled={guardando} className="w-full py-4 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest hover:bg-emerald-700 shadow-lg transition disabled:opacity-50 flex justify-center items-center gap-2">
                  {guardando ? "Procesando Registros..." : "🚀 Cargar Planillas y Cerrar Partido"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA 2: LISTADO DE CONTEOS ACUMULADOS */
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-black text-slate-800 text-xl">Conteo Oficial de Partidos</h3>
              <p className="text-xs text-slate-500 font-medium">Resumen exacto de la cantidad de partidos jugados por cada jugador agrupado por serie.</p>
            </div>
            <input type="text" placeholder="Buscar por Nombre o RUT..." value={busquedaStats} onChange={e => setBusquedaStats(e.target.value)} className="p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-72" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 font-bold">Identificación (ID)</th>
                  <th className="p-4 font-bold">Nombre / Club Padrón</th>
                  <th className="p-4 font-bold text-center">Partidos por Serie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {estadisticasFiltradas.length === 0 ? (
                  <tr><td colSpan={3} className="p-10 text-center font-bold text-slate-400">No hay registros acumulados.</td></tr>
                ) : (
                  estadisticasFiltradas.map(est => {
                    const datosP = padronJugadores.find(j => j.id === est.id);
                    
                    // Contabilizamos las series dinámicamente desde el mapa de partidos
                    const conteoPorSerie: Record<string, number> = {};
                    Object.values(est.partidos).forEach(serieMatch => {
                      conteoPorSerie[serieMatch] = (conteoPorSerie[serieMatch] || 0) + 1;
                    });

                    return (
                      <tr key={est.id} className="hover:bg-slate-50 transition">
                        <td className="p-4 font-mono font-bold text-slate-500">{est.rut}</td>
                        <td className="p-4">
                          {datosP ? (
                            <>
                              <p className="font-black text-slate-800 uppercase">{datosP.nombre}</p>
                              <p className="text-[10px] text-blue-600 font-bold uppercase">{datosP.club}</p>
                            </>
                          ) : (
                            <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">⚠️ Externo / No en Padrón</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap justify-center gap-2">
                            {Object.entries(conteoPorSerie).map(([serieName, total]) => (
                              <span key={serieName} className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm">
                                {serieName}: <span className="text-emerald-600 font-black text-xs ml-0.5">{total}</span>
                              </span>
                            ))}
                            {Object.keys(conteoPorSerie).length === 0 && (
                              <span className="text-slate-400 italic">0 partidos</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}