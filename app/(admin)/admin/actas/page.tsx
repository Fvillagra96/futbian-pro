'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayRemove, arrayUnion } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }
interface Evento { id: string; tipo: string; jugador: string; rut: string; equipo: string; minuto: string; }
interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; golesLocal: number; golesVisita: number; estado: string; eventos?: Evento[]; nomina?: JugadorNomina[]; respaldoActa?: string; }

export default function TribunalDisciplina() {
  const { authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [partidosFinalizados, setPartidosFinalizados] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState<string>("");
  const [sancionesInput, setSancionesInput] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authCargando) return;
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero")), (snap) => {
      const filtrados = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      setPartidosFinalizados(filtrados.filter(p => p.estado === "Finalizado"));
    });
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });
    return () => { unsubP(); unsubJ(); };
  }, [authCargando]);

  const partidoActivo = partidosFinalizados.find(p => p.id === partidoSeleccionadoId);

  const eliminarEvento = async (eventoAEliminar: Evento) => {
    if (!partidoActivo) return;
    if (!confirm(`AUDITORÍA: ¿Eliminar este evento de ${eventoAEliminar.jugador}? Esto descontará goles si corresponde.`)) return;
    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      let golesL = partidoActivo.golesLocal || 0; let golesV = partidoActivo.golesVisita || 0;
      if (eventoAEliminar.tipo === '⚽ Gol') { if (eventoAEliminar.equipo === partidoActivo.local) golesL = Math.max(0, golesL - 1); else golesV = Math.max(0, golesV - 1); } 
      else if (eventoAEliminar.tipo === '⚽❌ Autogol') { if (eventoAEliminar.equipo === partidoActivo.local) golesV = Math.max(0, golesV - 1); else golesL = Math.max(0, golesL - 1); }
      await updateDoc(partidoRef, { eventos: arrayRemove(eventoAEliminar), golesLocal: golesL, golesVisita: golesV });
    } catch (error) { console.error("Error al auditar evento", error); }
  };

  const agregarEventoAuditoria = async (rutJugador: string, nombreJugador: string, equipo: string, tipoEvento: string) => {
    if (!partidoActivo) return;
    if (!confirm(`AUDITORÍA: ¿Forzar registro de ${tipoEvento} para ${nombreJugador}?`)) return;
    const nuevoEvento: Evento = { id: Date.now().toString(), tipo: tipoEvento, jugador: nombreJugador, rut: rutJugador, equipo: equipo, minuto: "Admin" };
    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      let golesL = partidoActivo.golesLocal || 0; let golesV = partidoActivo.golesVisita || 0;
      if (tipoEvento === '⚽ Gol') { if (equipo === partidoActivo.local) golesL += 1; else golesV += 1; } 
      else if (tipoEvento === '⚽❌ Autogol') { if (equipo === partidoActivo.local) golesV += 1; else golesL += 1; }
      
      const rutLimpio = rutJugador.replace(/[^0-9kK]/g, "").toUpperCase();
      const jugadorRef = doc(db, "asociaciones/san_fabian/jugadores", rutLimpio);
      if (tipoEvento === '🟨🟥 Doble Amarilla') await updateDoc(jugadorRef, { partidosSuspendido: 1 });
      if (tipoEvento === '🟥 Roja Directa') await updateDoc(jugadorRef, { partidosSuspendido: 2 });

      await updateDoc(partidoRef, { eventos: arrayUnion(nuevoEvento), golesLocal: golesL, golesVisita: golesV });
    } catch (error) { console.error("Error al forzar evento", error); }
  };

  const aplicarSancion = async (rutJugador: string, nombreJugador: string) => {
    const cantidadFechas = sancionesInput[rutJugador] || 0;
    if (!confirm(`¿Confirmar sanción final de ${cantidadFechas} partidos de suspensión para ${nombreJugador}?`)) return;
    try {
      const rutLimpio = rutJugador.replace(/[^0-9kK]/g, "").toUpperCase();
      await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", rutLimpio), { partidosSuspendido: cantidadFechas });
      setSancionesInput(prev => ({...prev, [rutJugador]: 0}));
      alert(`Sanción actualizada.`);
    } catch (error) { console.error(error); }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Abriendo Tribunal...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div><h2 className="text-red-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Auditoría y Castigos</h2><h1 className="text-3xl md:text-4xl font-black tracking-tighter">TRIBUNAL DE DISCIPLINA</h1></div>
          <div className="bg-red-500/20 px-4 py-2 rounded-xl border border-red-500/30"><p className="text-sm font-bold text-red-200">Modo Admin</p></div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px]">⚖️</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-xs font-black text-slate-500 uppercase mb-3">Auditar Acta Cerrada</label>
            <select value={partidoSeleccionadoId} onChange={e => setPartidoSeleccionadoId(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none text-sm">
              <option value="">-- Seleccionar acta --</option>
              {partidosFinalizados.map(p => <option key={p.id} value={p.id}>F {p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>)}
            </select>
          </div>
          {partidoActivo && (
             <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
               <h3 className="text-xs font-black text-blue-600 uppercase mb-4">Información del Acta</h3>
               <p className="text-sm font-bold text-slate-700 mb-2">Respaldo: <span className="font-mono text-[10px] text-slate-500">{partidoActivo.respaldoActa || 'N/A'}</span></p>
               <div className="flex items-center gap-4 text-2xl font-black justify-center my-6 bg-white py-4 rounded-xl shadow-sm"><span className="text-slate-800">{partidoActivo.golesLocal}</span><span className="text-slate-300">-</span><span className="text-slate-800">{partidoActivo.golesVisita}</span></div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
           {partidoActivo ? (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-6 border-b border-slate-100">
                   <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4"><span className="text-xl">⏱️</span> Sucesos (Edición)</h3>
                   <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                      {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev, i) => (
                        <div key={ev.id || i} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group">
                          <div className="flex items-center gap-3"><span className="text-xl">{ev.tipo === '⚽ Gol' ? '⚽' : ev.tipo === '⚽❌ Autogol' ? '⚽❌' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span><div><p className="font-bold text-slate-800 text-xs uppercase">{ev.jugador}</p><p className="text-[10px] font-bold text-blue-600">{ev.equipo}</p></div></div>
                          <button onClick={() => eliminarEvento(ev)} className="px-3 py-1.5 bg-white text-red-500 border border-red-100 hover:bg-red-500 hover:text-white font-bold text-[10px] rounded-lg transition">ELIMINAR ERROR</button>
                        </div>
                      )) : <p className="text-center py-4 text-slate-400 text-sm">Sin incidencias.</p>}
                   </div>
                </div>

                <div className="p-6 bg-slate-50 flex-1">
                   <h3 className="font-black text-slate-800 flex items-center gap-2 mb-4"><span className="text-xl">⚖️</span> Forzar Eventos y Sanciones</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[partidoActivo.local, partidoActivo.visita].map(equipo => (
                        <div key={equipo}>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-200 pb-2 mb-3">{equipo}</h4>
                          <div className="space-y-3">
                            {partidoActivo.nomina?.filter(j => j.equipo === equipo).map((jugador, i) => {
                              const datosBD = jugadores.find(jBD => jBD.rut === jugador.rut);
                              const suspendido = datosBD?.partidosSuspendido ? datosBD.partidosSuspendido > 0 : false;
                              return (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                  <p className="text-[11px] font-bold text-slate-800 uppercase truncate mb-2">{jugador.nombre}</p>
                                  <div className="flex gap-1 mb-3">
                                    <button onClick={() => agregarEventoAuditoria(jugador.rut, jugador.nombre, jugador.equipo, '⚽ Gol')} className="flex-1 bg-slate-100 hover:bg-emerald-100 border border-slate-200 rounded text-[10px] py-1 font-black">⚽</button>
                                    <button onClick={() => agregarEventoAuditoria(jugador.rut, jugador.nombre, jugador.equipo, '🟨 Amarilla')} className="flex-1 bg-slate-100 hover:bg-yellow-100 border border-slate-200 rounded text-[10px] py-1 font-black">🟨</button>
                                    <button onClick={() => agregarEventoAuditoria(jugador.rut, jugador.nombre, jugador.equipo, '🟥 Roja Directa')} className="flex-1 bg-slate-100 hover:bg-red-100 border border-slate-200 rounded text-[10px] py-1 font-black">🟥</button>
                                  </div>
                                  {suspendido ? (
                                    <div className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded text-center border border-red-100">SUSPENDIDO ({datosBD?.partidosSuspendido})</div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <input type="number" min="0" placeholder="Fechas" value={sancionesInput[jugador.rut] || ""} onChange={(e) => setSancionesInput(prev => ({...prev, [jugador.rut]: parseInt(e.target.value) || 0}))} className="w-16 p-1.5 text-xs text-center border border-slate-300 rounded outline-none bg-slate-50" />
                                      <button onClick={() => aplicarSancion(jugador.rut, jugador.nombre)} className="flex-1 bg-slate-800 text-white text-[10px] font-bold rounded hover:bg-black transition">SANCIONAR</button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl min-h-[300px] flex flex-col items-center justify-center p-10 text-slate-400"><span className="text-5xl mb-4">⚖️</span><p className="font-bold text-sm text-center">Selecciona un acta cerrada para auditar.</p></div>
           )}
        </div>
      </div>
    </div>
  );
}