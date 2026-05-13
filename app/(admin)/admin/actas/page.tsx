'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; }
interface Evento { id: string; tipo: string; jugador: string; rut: string; equipo: string; minuto: string; }
interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { 
  id: string; fechaNumero: number; local: string; visita: string; serie: string; 
  golesLocal: number; golesVisita: number; estado: string; 
  eventos?: Evento[]; nomina?: JugadorNomina[]; respaldoActa?: string; 
}

export default function TribunalDeDisciplina() {
  const { authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState<string>("");
  
  // Estados para el Buscador y Edición
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<"local" | "visita" | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [jugadorEncontrado, setJugadorEncontrado] = useState<Jugador | null>(null);
  const [pestanaDerecha, setPestanaDerecha] = useState<"eventos" | "nomina">("eventos");

  useEffect(() => {
    if (authCargando) return;

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc")), (snap) => {
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[]);
    });
    
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });
    
    return () => { unsubP(); unsubJ(); };
  }, [authCargando]);

  const partidoActivo = partidos.find(p => p.id === partidoSeleccionadoId);
  const partidosCerrados = partidos.filter(p => p.estado === "Finalizado");

  // 🚨 MOTOR DE CÁLCULO: Sobreescribe los resultados manuales basándose solo en los eventos
  const recalcularMarcador = async (partidoId: string, listaEventos: Evento[]) => {
    if (!partidoActivo) return;
    let golesL = 0;
    let golesV = 0;

    listaEventos.forEach(ev => {
      if (ev.tipo === '⚽ Gol') {
        if (ev.equipo === partidoActivo.local) golesL++; else golesV++;
      } else if (ev.tipo === '⚽❌ Autogol') {
        if (ev.equipo === partidoActivo.local) golesV++; else golesL++;
      }
    });

    await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoId), {
      golesLocal: golesL,
      golesVisita: golesV
    });
  };

  const jugadoresFiltradosBuscador = useMemo(() => {
    if (!partidoActivo || !equipoSeleccionado || !busqueda.trim()) return [];
    
    const clubABuscar = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;
    const termino = busqueda.toLowerCase().trim();

    return jugadores.filter(j => {
      const esDelClub = j.club.trim().toLowerCase() === clubABuscar.trim().toLowerCase();
      const coincide = j.nombre.toLowerCase().includes(termino) || j.rut.toLowerCase().includes(termino);
      const yaEstaEnNomina = partidoActivo.nomina?.some(n => n.rut === j.rut);
      return esDelClub && coincide && !yaEstaEnNomina;
    }).slice(0, 5);
  }, [busqueda, partidoActivo, equipoSeleccionado, jugadores]);

  const seleccionarJugador = (jugador: Jugador) => {
    setJugadorEncontrado(jugador);
    setBusqueda("");
    setMostrarResultados(false);
  };

  const agregarANomina = async () => {
    if (!partidoActivo || !jugadorEncontrado || !equipoSeleccionado) return;
    const clubOficial = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;
    const nuevoJugadorNomina: JugadorNomina = { rut: jugadorEncontrado.rut, nombre: jugadorEncontrado.nombre, equipo: clubOficial };

    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), {
        nomina: arrayUnion(nuevoJugadorNomina)
      });
      setPestanaDerecha("nomina");
    } catch (error) { console.error(error); }
  };

  const registrarEventoForzado = async (tipoEvento: string) => {
    if (!partidoActivo || !jugadorEncontrado || !equipoSeleccionado) return;
    const clubOficial = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;

    const nuevoEvento: Evento = {
      id: Date.now().toString(), tipo: tipoEvento, jugador: jugadorEncontrado.nombre,
      rut: jugadorEncontrado.rut, equipo: clubOficial,
      minuto: "Tribunal" // Marca que fue ingresado por secretaría
    };
    
    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      const rutLimpio = jugadorEncontrado.rut.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const jugadorRef = doc(db, "asociaciones/san_fabian/jugadores", rutLimpio);
      
      // Aplicamos la sanción real en el padrón
      if (tipoEvento === '🟨🟥 Doble Amarilla') await updateDoc(jugadorRef, { partidosSuspendido: 1 });
      else if (tipoEvento === '🟥 Roja Directa') await updateDoc(jugadorRef, { partidosSuspendido: 2 });
      
      // Actualizamos eventos y nómina si no estaba
      const yaRegistrado = partidoActivo.nomina?.some(j => j.rut === jugadorEncontrado.rut);
      await updateDoc(partidoRef, {
        eventos: arrayUnion(nuevoEvento),
        ...( !yaRegistrado && { nomina: arrayUnion({ rut: jugadorEncontrado.rut, nombre: jugadorEncontrado.nombre, equipo: clubOficial }) } )
      });

      // 🚨 LA MAGIA: Recalculamos el marcador oficial para borrar lo manual
      const nuevaListaEventos = [...(partidoActivo.eventos || []), nuevoEvento];
      await recalcularMarcador(partidoActivo.id, nuevaListaEventos);
      
      setJugadorEncontrado(null); setPestanaDerecha("eventos");
    } catch (error) { console.error(error); }
  };

  const eliminarEventoYRecalcular = async (eventoAEliminar: Evento) => {
    if (!partidoActivo) return;
    if (!confirm(`¿Eliminar este evento del acta de ${eventoAEliminar.jugador}?`)) return;

    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { 
        eventos: arrayRemove(eventoAEliminar) 
      });

      // 🚨 LA MAGIA: Recalculamos el marcador sin el evento borrado
      const nuevaListaEventos = (partidoActivo.eventos || []).filter(e => e.id !== eventoAEliminar.id);
      await recalcularMarcador(partidoActivo.id, nuevaListaEventos);

    } catch (error) { console.error(error); }
  };

  const eliminarDeNomina = async (jugadorAEliminar: JugadorNomina) => {
    if (!partidoActivo) return;
    if (!confirm(`¿Quitar a ${jugadorAEliminar.nombre} del acta oficial?`)) return;
    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { nomina: arrayRemove(jugadorAEliminar) });
    } catch (error) { console.error(error); }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Abriendo archivos del Tribunal...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER TRIBUNAL */}
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-red-600">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-red-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Auditoría y Castigos</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">TRIBUNAL DE DISCIPLINA</h1>
          </div>
          <div className="bg-red-600/20 px-6 py-3 rounded-2xl border border-red-500/30 backdrop-blur-sm text-center">
            <span className="text-[10px] font-bold text-red-200 uppercase tracking-widest">Nivel de Acceso</span>
            <p className="text-lg font-black text-white leading-none">Modo Admin</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px] pointer-events-none">⚖️</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Auditar Acta Cerrada</label>
            <select value={partidoSeleccionadoId} onChange={e => { setPartidoSeleccionadoId(e.target.value); setEquipoSeleccionado(null); setJugadorEncontrado(null); setBusqueda(""); }} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none text-sm text-[#1e3a8a]">
              <option value="">-- Seleccionar Acta --</option>
              {partidosCerrados.map(p => (
                <option key={p.id} value={p.id}>F{p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>
              ))}
            </select>
          </div>

          {partidoActivo && (
            <>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Información del Acta</h3>
                <p className="text-[10px] font-bold text-slate-500 mb-4">Respaldo: <span className="font-mono text-slate-800">{partidoActivo.respaldoActa || "Sin firma digital"}</span></p>
                
                <div className="bg-slate-50 rounded-xl border border-slate-200 py-6 flex items-center justify-center gap-6">
                  <span className="text-4xl font-black text-slate-800">{partidoActivo.golesLocal || 0}</span>
                  <span className="text-2xl text-slate-300 font-light">-</span>
                  <span className="text-4xl font-black text-slate-800">{partidoActivo.golesVisita || 0}</span>
                </div>
                <p className="text-[9px] text-center text-slate-400 mt-2 uppercase tracking-widest">Marcador Oficial Calculado</p>
              </div>

              {/* BUSCADOR PARA FORZAR EVENTOS */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Forzar Ingreso para:</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => { setEquipoSeleccionado("local"); setJugadorEncontrado(null); setBusqueda(""); }} className={`p-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${equipoSeleccionado === "local" ? 'bg-[#1e3a8a] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{partidoActivo.local}</button>
                  <button onClick={() => { setEquipoSeleccionado("visita"); setJugadorEncontrado(null); setBusqueda(""); }} className={`p-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${equipoSeleccionado === "visita" ? 'bg-[#1e3a8a] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{partidoActivo.visita}</button>
                </div>

                {equipoSeleccionado && (
                  <div className="space-y-4">
                    <div className="relative">
                      <input type="text" value={busqueda} onChange={e => { setBusqueda(e.target.value); setMostrarResultados(true); setJugadorEncontrado(null); }} onFocus={() => setMostrarResultados(true)} placeholder="Buscar Nombre o RUT..." className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-red-500 transition-all" />
                      
                      {mostrarResultados && busqueda.trim().length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                          {jugadoresFiltradosBuscador.length === 0 ? (
                            <div className="p-4 text-center text-xs font-bold text-slate-400">No hay coincidencias (o ya firmó).</div>
                          ) : (
                            <ul className="divide-y divide-slate-100">
                              {jugadoresFiltradosBuscador.map(j => (
                                <li key={j.id}>
                                  <button onClick={() => seleccionarJugador(j)} className="w-full text-left px-4 py-3 hover:bg-red-50 transition">
                                    <p className="font-black text-slate-800 text-xs uppercase">{j.nombre}</p>
                                    <p className="font-mono text-[10px] text-slate-400 font-bold">{j.rut}</p>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    {jugadorEncontrado && (
                      <div className="bg-red-50/50 p-4 rounded-xl border border-red-200 space-y-4 animate-in zoom-in-95 duration-200">
                        <div>
                          <p className="font-black text-slate-800 text-sm uppercase truncate">{jugadorEncontrado.nombre}</p>
                          <p className="text-[10px] font-bold text-slate-500">{jugadorEncontrado.rut}</p>
                        </div>
                        <button onClick={agregarANomina} className="w-full bg-slate-800 hover:bg-black text-white py-2.5 rounded-lg font-black text-[10px] tracking-widest uppercase transition shadow-sm">📋 Añadir al Acta</button>
                        <div className="flex items-center gap-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[9px] font-black text-red-500 tracking-widest uppercase">Forzar Evento</span><div className="h-px bg-slate-200 flex-1"></div></div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => registrarEventoForzado('⚽ Gol')} className="bg-white border border-slate-200 py-2 rounded-lg font-black text-[10px] hover:border-emerald-500 hover:text-emerald-700 transition shadow-sm">⚽ GOL</button>
                          <button onClick={() => registrarEventoForzado('⚽❌ Autogol')} className="bg-white border border-slate-200 py-2 rounded-lg font-black text-[10px] hover:border-orange-500 hover:text-orange-700 transition shadow-sm text-slate-600">⚽❌ AUTO</button>
                          <button onClick={() => registrarEventoForzado('🟨 Amarilla')} className="bg-white border border-slate-200 py-2 rounded-lg font-black text-[10px] hover:border-yellow-500 transition shadow-sm">🟨 TA</button>
                          <button onClick={() => registrarEventoForzado('🟨🟥 Doble Amarilla')} className="bg-white border border-slate-200 py-2 rounded-lg font-black text-[10px] hover:border-orange-500 transition shadow-sm text-orange-600">🟨🟥 2TA</button>
                          <button onClick={() => registrarEventoForzado('🟥 Roja Directa')} className="col-span-2 bg-white border border-slate-200 py-2 rounded-lg font-black text-[10px] hover:bg-red-500 hover:text-white transition shadow-sm text-red-600">🟥 ROJA DIRECTA</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* COLUMNA DERECHA: REGISTROS OFICIALES */}
        <div className="lg:col-span-8">
          {!partidoActivo ? (
             <div className="bg-white border border-slate-200 rounded-3xl min-h-[500px] flex flex-col items-center justify-center p-10 text-slate-400">
                <span className="text-5xl mb-4 opacity-50">⚖️</span>
                <p className="font-bold text-sm text-center">Selecciona un acta cerrada para auditarla.</p>
             </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
              <div className="flex bg-slate-50 border-b border-slate-200 p-2 gap-2">
                <button onClick={() => setPestanaDerecha("eventos")} className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition ${pestanaDerecha === "eventos" ? "bg-white text-red-600 shadow-sm border border-slate-200" : "text-slate-400 hover:bg-slate-200"}`}>⏱️ Sucesos</button>
                <button onClick={() => setPestanaDerecha("nomina")} className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition ${pestanaDerecha === "nomina" ? "bg-white text-red-600 shadow-sm border border-slate-200" : "text-slate-400 hover:bg-slate-200"}`}>📋 Firmas</button>
              </div>
              
              <div className="p-4 md:p-6 flex-1 overflow-y-auto bg-slate-50/30">
                {pestanaDerecha === "eventos" && (
                  <div className="space-y-3">
                    {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-red-300 transition group">
                        <div className="flex items-center gap-4 min-w-0">
                          <span className="text-2xl md:text-3xl shrink-0 bg-slate-50 w-12 h-12 flex items-center justify-center rounded-xl border border-slate-100">{ev.tipo === '⚽ Gol' ? '⚽' : ev.tipo === '⚽❌ Autogol' ? '⚽❌' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 text-xs md:text-sm uppercase truncate">{ev.jugador} {ev.tipo === '⚽❌ Autogol' && <span className="text-orange-500 lowercase font-medium text-[10px]">(autogol)</span>}</p>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 truncate uppercase tracking-widest">{ev.equipo} • {ev.minuto === "Tribunal" ? <span className="text-red-500 font-black">Por Secretaría</span> : `Minuto ${ev.minuto}`}</p>
                          </div>
                        </div>
                        <button onClick={() => eliminarEventoYRecalcular(ev)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition" title="Anular Evento Oficial">
                          ✖
                        </button>
                      </div>
                    )) : <p className="text-center py-16 text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-2xl">Acta sin sucesos registrados.</p>}
                  </div>
                )}
                
                {pestanaDerecha === "nomina" && (
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] md:text-xs font-black text-[#1e3a8a] uppercase tracking-widest mb-3 border-b-2 border-blue-100 pb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Local: {partidoActivo.local}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.local).map((jugador, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase truncate pr-2">{jugador.nombre}</span>
                            <button onClick={() => eliminarDeNomina(jugador)} className="text-slate-300 hover:text-red-500 transition px-2">✖</button>
                          </div>
                        ))}
                        {(!partidoActivo.nomina || partidoActivo.nomina.filter(j => j.equipo === partidoActivo.local).length === 0) && <p className="text-[10px] italic font-bold text-slate-400 col-span-2">Sin firmas registradas.</p>}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 border-b-2 border-emerald-100 pb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Visita: {partidoActivo.visita}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.visita).map((jugador, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <span className="text-[10px] md:text-xs font-black text-slate-700 uppercase truncate pr-2">{jugador.nombre}</span>
                            <button onClick={() => eliminarDeNomina(jugador)} className="text-slate-300 hover:text-red-500 transition px-2">✖</button>
                          </div>
                        ))}
                        {(!partidoActivo.nomina || partidoActivo.nomina.filter(j => j.equipo === partidoActivo.visita).length === 0) && <p className="text-[10px] italic font-bold text-slate-400 col-span-2">Sin firmas registradas.</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}