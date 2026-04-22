'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

const formatearRut = (valor: string) => {
  let cuerpo = valor.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cuerpo.length < 7) return cuerpo;
  let dv = cuerpo.slice(-1);
  let resto = cuerpo.slice(0, -1);
  let formateado = "";
  for (let i = resto.length - 1, j = 1; i >= 0; i--, j++) {
    formateado = resto.charAt(i) + formateado;
    if (j % 3 === 0 && i !== 0) formateado = "." + formateado;
  }
  return `${formateado}-${dv}`;
};

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; }
interface Evento { id: string; tipo: string; jugador: string; rut: string; equipo: string; minuto: string; }
interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { 
  id: string; fechaNumero: number; local: string; visita: string; serie: string; 
  golesLocal: number; golesVisita: number; estado: string; 
  eventos?: Evento[]; nomina?: JugadorNomina[]; respaldoActa?: string; 
}

export default function PaginaActas() {
  // AQUÍ ESTÁ LA MAGIA DEL NUEVO CONTEXTO DE SEGURIDAD
  const { rol: rolUsuario, club: clubUsuario, cargando: authCargando } = useAuth();
  
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState<string>("");
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<"local" | "visita" | null>(null);
  const [idInput, setIdInput] = useState<string>("");
  const [jugadorEncontrado, setJugadorEncontrado] = useState<Jugador | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string>("");
  const [pestanaDerecha, setPestanaDerecha] = useState<"eventos" | "nomina">("eventos");

  useEffect(() => {
    // Si el Auth aún está cargando, no hacemos consultas a la base de datos
    if (authCargando || !rolUsuario) return;

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero")), (snap) => {
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[]);
    });
    
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });
    
    return () => { unsubP(); unsubJ(); };
  }, [authCargando, rolUsuario]);

  const partidoActivo = partidos.find(p => p.id === partidoSeleccionadoId);
  
  const buscarPorId = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBusqueda(""); setJugadorEncontrado(null);
    if (!partidoActivo || !equipoSeleccionado) return;
    
    const clubABuscar = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;
    const rutBuscadoLimpio = idInput.replace(/[^0-9kK]/g, "").toUpperCase();
    const clubABuscarLimpio = clubABuscar.trim().toLowerCase();
    
    const encontrado = jugadores.find(j => {
      const rutDBLimpio = j.rut.replace(/[^0-9kK]/g, "").toUpperCase();
      const clubDBLimpio = j.club.trim().toLowerCase();
      return rutDBLimpio === rutBuscadoLimpio && clubDBLimpio === clubABuscarLimpio;
    });
    
    if (encontrado) setJugadorEncontrado(encontrado); 
    else setErrorBusqueda(`ID no encontrado en ${clubABuscar}.`); 
  };

  const manejarInputId = (valor: string) => {
    const soloNumerosYK = /^[0-9kK.-]+$/.test(valor);
    if (soloNumerosYK && valor.length > 2) setIdInput(formatearRut(valor)); 
    else setIdInput(valor.toUpperCase()); 
  };

  const agregarANomina = async () => {
    if (!partidoActivo || !jugadorEncontrado || !equipoSeleccionado) return;
    const yaRegistrado = partidoActivo.nomina?.some(j => j.rut === jugadorEncontrado.rut);
    if (yaRegistrado) return alert("El jugador ya está en la nómina del partido.");

    const clubOficial = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;
    const nuevoJugadorNomina: JugadorNomina = { rut: jugadorEncontrado.rut, nombre: jugadorEncontrado.nombre, equipo: clubOficial };

    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), {
        nomina: arrayUnion(nuevoJugadorNomina), estado: "En Juego"
      });
      setPestanaDerecha("nomina");
    } catch (error) { console.error(error); }
  };

  const registrarEvento = async (tipoEvento: string) => {
    if (!partidoActivo || !jugadorEncontrado || !equipoSeleccionado) return;
    const clubOficial = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;

    const nuevoEvento: Evento = {
      id: Date.now().toString(), tipo: tipoEvento, jugador: jugadorEncontrado.nombre,
      rut: jugadorEncontrado.rut, equipo: clubOficial,
      minuto: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    };
    
    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      const rutLimpio = jugadorEncontrado.rut.replace(/[^0-9kK]/g, "").toUpperCase();
      const jugadorRef = doc(db, "asociaciones/san_fabian/jugadores", rutLimpio);
      let golesL = partidoActivo.golesLocal || 0;
      let golesV = partidoActivo.golesVisita || 0;
      
      if (tipoEvento === '⚽ Gol') {
        if (equipoSeleccionado === "local") golesL += 1; else golesV += 1;
      } else if (tipoEvento === '⚽❌ Autogol') {
        if (equipoSeleccionado === "local") golesV += 1; else golesL += 1;
      }

      // SANCIONES AUTOMÁTICAS
      if (tipoEvento === '🟨🟥 Doble Amarilla') {
        await updateDoc(jugadorRef, { partidosSuspendido: 1 });
      } else if (tipoEvento === '🟥 Roja Directa') {
        await updateDoc(jugadorRef, { partidosSuspendido: 2 });
      }
      
      const yaRegistrado = partidoActivo.nomina?.some(j => j.rut === jugadorEncontrado.rut);
      await updateDoc(partidoRef, {
        eventos: arrayUnion(nuevoEvento),
        ...( !yaRegistrado && { nomina: arrayUnion({ rut: jugadorEncontrado.rut, nombre: jugadorEncontrado.nombre, equipo: clubOficial }) } ),
        golesLocal: golesL, golesVisita: golesV, estado: "En Juego"
      });
      
      setJugadorEncontrado(null); setIdInput(""); setPestanaDerecha("eventos");
    } catch (error) { console.error(error); }
  };

  const eliminarEvento = async (eventoAEliminar: Evento) => {
    if (!partidoActivo) return;
    if (!confirm(`¿Eliminar este evento de ${eventoAEliminar.jugador}?`)) return;

    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      let golesL = partidoActivo.golesLocal || 0;
      let golesV = partidoActivo.golesVisita || 0;

      if (eventoAEliminar.tipo === '⚽ Gol') {
        if (eventoAEliminar.equipo === partidoActivo.local) golesL = Math.max(0, golesL - 1); else golesV = Math.max(0, golesV - 1);
      } else if (eventoAEliminar.tipo === '⚽❌ Autogol') {
        if (eventoAEliminar.equipo === partidoActivo.local) golesV = Math.max(0, golesV - 1); else golesL = Math.max(0, golesL - 1);
      }

      await updateDoc(partidoRef, { eventos: arrayRemove(eventoAEliminar), golesLocal: golesL, golesVisita: golesV });
    } catch (error) { console.error(error); }
  };

  const eliminarDeNomina = async (jugadorAEliminar: JugadorNomina) => {
    if (!partidoActivo) return;
    if (!confirm(`¿Quitar a ${jugadorAEliminar.nombre} de la nómina oficial?`)) return;
    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { nomina: arrayRemove(jugadorAEliminar) });
    } catch (error) { console.error(error); }
  };

  const finalizarPartido = async () => {
    if (!partidoActivo) return;
    if (confirm("¿Cerrar acta definitiva? Ya no se podrán agregar más eventos.")) {
      const localClean = partidoActivo.local.replace(/\s+/g, '_');
      const visitaClean = partidoActivo.visita.replace(/\s+/g, '_');
      const fechaHoy = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
      const firmaRespaldo = `F${partidoActivo.fechaNumero}_${localClean}_vs_${visitaClean}_Serie${partidoActivo.serie}_${fechaHoy}`;

      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { estado: "Finalizado", respaldoActa: firmaRespaldo });
      setPartidoSeleccionadoId("");
    }
  };

  const limpiarActa = async () => {
    if (!partidoActivo) return;
    const confirmacion = window.prompt("⚠️ ZONA DE PELIGRO: Vas a borrar todos los datos de este partido. Escribe LIMPIAR a continuación:");
    if (confirmacion === "LIMPIAR") {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { eventos: [], nomina: [], golesLocal: 0, golesVisita: 0, estado: "Programado" });
        alert("🧹 El acta ha sido reiniciada a cero.");
        setJugadorEncontrado(null); setIdInput("");
      } catch (error) { alert("Error al limpiar el acta."); }
    } else if (confirmacion !== null) alert("Cancelado.");
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Abriendo Mesa de Turno...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-2 md:p-4 overflow-x-hidden animate-in fade-in duration-500">
      <header className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-[10px] md:text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Mesa de Turno</h2>
          <h1 className="text-xl md:text-2xl font-black text-slate-800">Llenado de Acta Oficial</h1>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 w-full md:w-auto text-center">
           <p className="text-[10px] font-bold text-slate-400 uppercase">Club a Cargo</p>
           <p className="text-sm font-bold text-slate-700">{clubUsuario || "Directiva General"}</p>
        </div>
      </header>

      {partidoActivo && (
        <div className="bg-slate-900 rounded-3xl p-4 md:p-8 shadow-2xl text-white border-2 md:border-4 border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex-1 text-center min-w-0"><p className="text-[10px] md:text-xl font-black uppercase italic break-words leading-tight">{partidoActivo.local}</p></div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0 bg-black/20 px-3 py-2 rounded-2xl">
              <span className="text-4xl md:text-7xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesLocal || 0}</span>
              <span className="text-xl md:text-4xl text-slate-700 font-light">-</span>
              <span className="text-4xl md:text-7xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesVisita || 0}</span>
            </div>
            <div className="flex-1 text-center min-w-0"><p className="text-[10px] md:text-xl font-black uppercase italic break-words leading-tight">{partidoActivo.visita}</p></div>
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex justify-center items-center text-[150px]">⚽</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="lg:col-span-5 space-y-4 md:space-y-6 order-2 lg:order-1">
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-3">1. Seleccionar Encuentro</label>
            <select value={partidoSeleccionadoId} onChange={e => { setPartidoSeleccionadoId(e.target.value); setEquipoSeleccionado(null); setJugadorEncontrado(null); }} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none text-sm">
              <option value="">-- Seleccionar partido --</option>
              {partidos.filter(p => p.estado !== "Finalizado" && (rolUsuario === 'admin' || p.local === clubUsuario)).map(p => (
                <option key={p.id} value={p.id}>F{p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>
              ))}
            </select>
          </div>

          {partidoActivo && (
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-3">2. Buscar Jugador para:</label>
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
                <button onClick={() => { setEquipoSeleccionado("local"); setJugadorEncontrado(null); }} className={`p-3 rounded-xl font-bold text-[10px] md:text-sm border transition-all ${equipoSeleccionado === "local" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}>LOCAL</button>
                <button onClick={() => { setEquipoSeleccionado("visita"); setJugadorEncontrado(null); }} className={`p-3 rounded-xl font-bold text-[10px] md:text-sm border transition-all ${equipoSeleccionado === "visita" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}>VISITA</button>
              </div>

              {equipoSeleccionado && (
                <div className="space-y-4">
                  <form onSubmit={buscarPorId} className="space-y-2">
                    <div className="relative flex gap-2">
                      <input type="text" value={idInput} onChange={e => manejarInputId(e.target.value)} placeholder="RUT o Pasaporte..." className="flex-1 p-3 md:p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm md:text-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all" required />
                      <button type="submit" className="bg-emerald-600 text-white px-4 rounded-xl font-bold text-sm">OK</button>
                    </div>
                  </form>
                  {errorBusqueda && <p className="text-[10px] md:text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100 italic">⚠️ {errorBusqueda}</p>}

                  {jugadorEncontrado && (
                    <div className="bg-slate-50 p-4 rounded-xl border-2 border-emerald-500 space-y-4 animate-in zoom-in-95 duration-200 shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                      <div className="flex items-center gap-3 pl-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 text-sm md:text-base leading-tight uppercase truncate">{jugadorEncontrado.nombre}</p>
                          <p className="text-[10px] md:text-xs font-bold text-slate-500">{jugadorEncontrado.rut} • <span className="text-[#1e3a8a]">Serie {jugadorEncontrado.serie}</span></p>
                        </div>
                      </div>
                      <button onClick={agregarANomina} className="w-full bg-[#1e3a8a] hover:bg-blue-800 text-white py-3 rounded-xl font-black text-xs transition shadow-sm flex justify-center items-center gap-2">📋 MARCAR PRESENTE EN NÓMINA</button>
                      <div className="flex items-center gap-2"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[10px] font-bold text-slate-400">REGISTRAR EVENTO</span><div className="h-px bg-slate-200 flex-1"></div></div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => registrarEvento('⚽ Gol')} className="bg-white border-2 border-slate-200 py-2.5 rounded-xl font-black text-[10px] hover:border-emerald-500 transition shadow-sm">⚽ GOL</button>
                        <button onClick={() => registrarEvento('⚽❌ Autogol')} className="bg-white border-2 border-slate-200 py-2.5 rounded-xl font-black text-[10px] hover:border-orange-500 transition shadow-sm text-slate-600">⚽❌ AUTO</button>
                        <button onClick={() => registrarEvento('🟨 Amarilla')} className="bg-white border-2 border-slate-200 py-2.5 rounded-xl font-black text-[10px] hover:border-yellow-500 transition shadow-sm">🟨 TA</button>
                        <button onClick={() => registrarEvento('🟨🟥 Doble Amarilla')} className="bg-white border-2 border-slate-200 py-2.5 rounded-xl font-black text-[10px] hover:border-orange-500 transition shadow-sm">🟨🟥 2TA</button>
                        <button onClick={() => registrarEvento('🟥 Roja Directa')} className="col-span-2 bg-white border-2 border-slate-200 py-2.5 rounded-xl font-black text-[10px] hover:border-red-500 transition shadow-sm text-red-600">🟥 ROJA DIRECTA</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="pt-6 mt-6 border-t border-slate-100 space-y-3">
                <button onClick={finalizarPartido} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-lg hover:bg-emerald-700 transition tracking-widest text-xs md:text-sm flex items-center justify-center gap-2">✅ CERRAR ACTA FINAL</button>
                <button onClick={limpiarActa} className="w-full py-3 bg-white border-2 border-red-100 text-red-500 font-bold rounded-2xl shadow-sm hover:bg-red-50 hover:border-red-300 transition text-[10px] md:text-xs flex items-center justify-center gap-2">🧹 LIMPIAR ACTA Y REINICIAR PARTIDO</button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-7 order-3 lg:order-2">
           {partidoActivo ? (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[400px]">
                <div className="flex bg-slate-100 p-1 border-b border-slate-200">
                  <button onClick={() => setPestanaDerecha("eventos")} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition ${pestanaDerecha === "eventos" ? "bg-white text-[#1e3a8a] shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}>⏱️ Sucesos</button>
                  <button onClick={() => setPestanaDerecha("nomina")} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl transition ${pestanaDerecha === "nomina" ? "bg-white text-[#1e3a8a] shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}>📋 Nómina Oficial</button>
                </div>
                <div className="p-2 md:p-4 flex-1 overflow-y-auto bg-slate-50/50">
                  {pestanaDerecha === "eventos" && (
                    <div className="space-y-2">
                      {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev, i) => (
                        <div key={ev.id || i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-blue-200 transition group">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl md:text-2xl shrink-0">{ev.tipo === '⚽ Gol' ? '⚽' : ev.tipo === '⚽❌ Autogol' ? '⚽❌' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-[10px] md:text-xs uppercase truncate">{ev.jugador} {ev.tipo === '⚽❌ Autogol' && <span className="text-orange-500 lowercase font-medium text-[9px]">(autogol)</span>}</p>
                              <p className="text-[8px] md:text-[10px] font-bold text-blue-600 truncate">{ev.equipo} • {ev.minuto}</p>
                            </div>
                          </div>
                          <button onClick={() => eliminarEvento(ev)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Eliminar este evento">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )) : <p className="text-center py-10 text-slate-400 text-sm font-medium">No hay sucesos registrados.</p>}
                    </div>
                  )}
                  {pestanaDerecha === "nomina" && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider mb-2 border-b pb-1">Local: {partidoActivo.local}</h4>
                        <div className="space-y-1">
                          {partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.local).map((jugador, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                              <span className="text-[10px] md:text-xs font-bold text-slate-700">{jugador.nombre}</span>
                              <button onClick={() => eliminarDeNomina(jugador)} className="text-slate-300 hover:text-red-500 transition px-2">✖</button>
                            </div>
                          ))}
                          {(!partidoActivo.nomina || partidoActivo.nomina.filter(j => j.equipo === partidoActivo.local).length === 0) && <p className="text-[10px] italic text-slate-400">Sin jugadores locales.</p>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider mb-2 border-b pb-1">Visita: {partidoActivo.visita}</h4>
                        <div className="space-y-1">
                          {partidoActivo.nomina?.filter(j => j.equipo === partidoActivo.visita).map((jugador, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                              <span className="text-[10px] md:text-xs font-bold text-slate-700">{jugador.nombre}</span>
                              <button onClick={() => eliminarDeNomina(jugador)} className="text-slate-300 hover:text-red-500 transition px-2">✖</button>
                            </div>
                          ))}
                          {(!partidoActivo.nomina || partidoActivo.nomina.filter(j => j.equipo === partidoActivo.visita).length === 0) && <p className="text-[10px] italic text-slate-400">Sin jugadores visita.</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl min-h-[300px] flex flex-col items-center justify-center p-10 text-slate-400 order-1">
                <span className="text-5xl mb-4">📋</span>
                <p className="font-bold text-sm text-center">Selecciona un partido para comenzar.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}