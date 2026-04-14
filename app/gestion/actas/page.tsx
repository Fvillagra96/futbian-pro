'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// --- Función para formatear RUT Chileno ---
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
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; golesLocal: number; golesVisita: number; estado: string; eventos?: Evento[]; }

export default function PaginaActas() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [clubUsuario, setClubUsuario] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidoSeleccionadoId, setPartidoSeleccionadoId] = useState<string>("");
  const [equipoSeleccionado, setEquipoSeleccionado] = useState<"local" | "visita" | null>(null);
  const [idInput, setIdInput] = useState<string>("");
  const [jugadorEncontrado, setJugadorEncontrado] = useState<Jugador | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) {
          setRolUsuario(docSnap.data().rol);
          setClubUsuario(docSnap.data().club);
        }
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero")), (snap) => {
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[]);
    });
    const unsubJ = onSnapshot(collection(db, "asociaciones/san_fabian/jugadores"), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
    });
    return () => { unsubP(); unsubJ(); };
  }, []);

  const partidoActivo = partidos.find(p => p.id === partidoSeleccionadoId);
  
  const buscarPorId = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBusqueda("");
    setJugadorEncontrado(null);
    if (!partidoActivo || !equipoSeleccionado) return;
    const clubABuscar = equipoSeleccionado === "local" ? partidoActivo.local : partidoActivo.visita;
    const encontrado = jugadores.find(j => 
      j.rut.toUpperCase() === idInput.toUpperCase() && 
      j.serie === partidoActivo.serie &&
      j.club === clubABuscar
    );
    if (encontrado) { setJugadorEncontrado(encontrado); } 
    else { setErrorBusqueda(`ID no encontrado en ${clubABuscar}.`); }
  };

  const manejarInputId = (valor: string) => {
    const soloNumerosYK = /^[0-9kK.-]+$/.test(valor);
    if (soloNumerosYK && valor.length > 2) { setIdInput(formatearRut(valor)); } 
    else { setIdInput(valor.toUpperCase()); }
  };

  const registrarEvento = async (tipoEvento: string) => {
    if (!partidoActivo || !jugadorEncontrado) return;
    const nuevoEvento: Evento = {
      id: Date.now().toString(),
      tipo: tipoEvento,
      jugador: jugadorEncontrado.nombre,
      rut: jugadorEncontrado.rut,
      equipo: jugadorEncontrado.club,
      minuto: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    };
    try {
      const partidoRef = doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id);
      let golesL = partidoActivo.golesLocal || 0;
      let golesV = partidoActivo.golesVisita || 0;
      if (tipoEvento === '⚽ Gol') {
        if (jugadorEncontrado.club === partidoActivo.local) golesL += 1;
        else golesV += 1;
      }
      await updateDoc(partidoRef, {
        eventos: arrayUnion(nuevoEvento),
        golesLocal: golesL,
        golesVisita: golesV,
        estado: "En Juego"
      });
      setJugadorEncontrado(null);
      setIdInput("");
    } catch (error) { console.error(error); }
  };

  const finalizarPartido = async () => {
    if (!partidoActivo) return;
    if (confirm("¿Cerrar acta definitiva?")) {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), { estado: "Finalizado" });
      setPartidoSeleccionadoId("");
    }
  };

  if (cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a]">Cargando Mesa...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-2 md:p-4 overflow-x-hidden">
      
      {/* HEADER RESPONSIVO */}
      <header className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h2 className="text-[10px] md:text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Mesa de Turno</h2>
          <h1 className="text-xl md:text-2xl font-black text-slate-800">Llenado de Acta Oficial</h1>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 w-full md:w-auto text-center">
           <p className="text-[10px] font-bold text-slate-400 uppercase">Club a Cargo</p>
           <p className="text-sm font-bold text-slate-700">{clubUsuario || "Admin"}</p>
        </div>
      </header>

      {/* MARCADOR GIGANTE (Siempre visible primero en móvil) */}
      {partidoActivo && (
        <div className="bg-slate-900 rounded-3xl p-4 md:p-8 shadow-2xl text-white border-2 md:border-4 border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between gap-2 relative z-10">
            {/* Local */}
            <div className="flex-1 text-center min-w-0">
              <p className="text-[10px] md:text-xl font-black uppercase italic break-words leading-tight">
                {partidoActivo.local}
              </p>
            </div>
            
            {/* Goles */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0 bg-black/20 px-3 py-2 rounded-2xl">
              <span className="text-4xl md:text-7xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesLocal || 0}</span>
              <span className="text-xl md:text-4xl text-slate-700 font-light">-</span>
              <span className="text-4xl md:text-7xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesVisita || 0}</span>
            </div>

            {/* Visita */}
            <div className="flex-1 text-center min-w-0">
              <p className="text-[10px] md:text-xl font-black uppercase italic break-words leading-tight">
                {partidoActivo.visita}
              </p>
            </div>
          </div>
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex justify-center items-center text-[150px]">⚽</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        {/* PANEL IZQUIERDO: CONTROLES */}
        <div className="lg:col-span-5 space-y-4 md:space-y-6 order-2 lg:order-1">
          
          <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-3">1. Seleccionar Encuentro</label>
            <select 
              value={partidoSeleccionadoId} 
              onChange={e => { setPartidoSeleccionadoId(e.target.value); setEquipoSeleccionado(null); setJugadorEncontrado(null); }} 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none text-sm"
            >
              <option value="">-- Seleccionar partido --</option>
              {partidos.filter(p => p.estado !== "Finalizado" && (rolUsuario === 'admin' || p.local === clubUsuario)).map(p => (
                <option key={p.id} value={p.id}>F{p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>
              ))}
            </select>
          </div>

          {partidoActivo && (
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-[10px] md:text-xs font-bold text-slate-500 uppercase mb-3">2. Registrar para:</label>
              
              <div className="grid grid-cols-2 gap-2 md:gap-3 mb-6">
                <button 
                  onClick={() => { setEquipoSeleccionado("local"); setJugadorEncontrado(null); }}
                  className={`p-3 rounded-xl font-bold text-[10px] md:text-sm border transition-all ${equipoSeleccionado === "local" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}
                >
                  LOCAL
                </button>
                <button 
                  onClick={() => { setEquipoSeleccionado("visita"); setJugadorEncontrado(null); }}
                  className={`p-3 rounded-xl font-bold text-[10px] md:text-sm border transition-all ${equipoSeleccionado === "visita" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}
                >
                  VISITA
                </button>
              </div>

              {equipoSeleccionado && (
                <div className="space-y-4">
                  <form onSubmit={buscarPorId} className="space-y-2">
                    <div className="relative flex gap-2">
                      <input 
                        type="text" 
                        value={idInput} 
                        onChange={e => manejarInputId(e.target.value)} 
                        placeholder="RUT o Pasaporte..." 
                        className="flex-1 p-3 md:p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm md:text-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        required
                      />
                      <button type="submit" className="bg-emerald-600 text-white px-4 rounded-xl font-bold text-sm">OK</button>
                    </div>
                  </form>

                  {errorBusqueda && <p className="text-[10px] md:text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100 italic">⚠️ {errorBusqueda}</p>}

                  {jugadorEncontrado && (
                    <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-500 space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-lg md:text-xl">
                          {jugadorEncontrado.nombre.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-800 text-sm md:text-base leading-tight uppercase truncate">{jugadorEncontrado.nombre}</p>
                          <p className="text-[10px] md:text-xs font-bold text-emerald-700">{jugadorEncontrado.rut}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => registrarEvento('⚽ Gol')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black text-[10px] md:text-xs hover:border-emerald-500 transition shadow-sm">⚽ GOL</button>
                        <button onClick={() => registrarEvento('🟨 Amarilla')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black text-[10px] md:text-xs hover:border-yellow-500 transition shadow-sm">🟨 TA</button>
                        <button onClick={() => registrarEvento('🟥 Roja')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black text-[10px] md:text-xs hover:border-red-500 transition shadow-sm">🟥 TR</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button onClick={finalizarPartido} className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition tracking-widest text-xs md:text-sm">
                  CERRAR ACTA FINAL
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PANEL DERECHO: CRONOLOGÍA */}
        <div className="lg:col-span-7 order-3 lg:order-2">
           {partidoActivo ? (
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">Sucesos del Partido</div>
                <div className="p-2 md:p-4 space-y-2 max-h-[500px] overflow-y-auto">
                  {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl md:text-2xl shrink-0">{ev.tipo.includes('Gol') ? '⚽' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-[10px] md:text-xs uppercase truncate">{ev.jugador}</p>
                          <p className="text-[8px] md:text-[10px] font-bold text-blue-600 truncate">{ev.equipo} • {ev.rut}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded shrink-0">{ev.minuto}</span>
                    </div>
                  )) : <p className="text-center py-10 text-slate-400 text-sm">Sin incidencias registradas.</p>}
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl min-h-[300px] flex flex-col items-center justify-center p-10 text-slate-400 order-1">
                <span className="text-5xl mb-4">📋</span>
                <p className="font-bold text-sm text-center">Selecciona un partido para comenzar el acta.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}