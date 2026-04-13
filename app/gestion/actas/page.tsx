'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// --- Función para formatear RUT Chileno ---
const formatearRut = (valor: string) => {
  // Limpiamos todo lo que no sea número o K
  let cuerpo = valor.replace(/[^0-9kK]/g, "").toUpperCase();
  
  // Si es muy corto o parece pasaporte (no cumple estructura RUT), lo devolvemos limpio
  if (cuerpo.length < 7) return cuerpo;

  // Si tiene estructura de RUT, aplicamos puntos y guion
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
  const [idInput, setIdInput] = useState<string>(""); // Cambiado de rutInput a idInput para incluir pasaportes
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

    // Buscamos comparando el valor ingresado contra el RUT/Pasaporte en la DB
    const encontrado = jugadores.find(j => 
      j.rut.toUpperCase() === idInput.toUpperCase() && 
      j.serie === partidoActivo.serie &&
      j.club === clubABuscar
    );

    if (encontrado) {
      setJugadorEncontrado(encontrado);
    } else {
      setErrorBusqueda(`ID no encontrado en ${clubABuscar}. Verifique si es Chileno (11.111.111-1) o Extranjero (Pasaporte).`);
    }
  };

  const manejarInputId = (valor: string) => {
    // Si el valor parece un RUT (solo números y K), lo formateamos
    // Si contiene otras letras, lo tratamos como Pasaporte (sin formateo)
    const soloNumerosYK = /^[0-9kK.-]+$/.test(valor);
    if (soloNumerosYK && valor.length > 2) {
      setIdInput(formatearRut(valor));
    } else {
      setIdInput(valor.toUpperCase()); // Pasaporte se mantiene igual
    }
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
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* HEADER IGUAL AL ANTERIOR */}
      <header className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">Mesa de Turno</h2>
          <h1 className="text-2xl font-black text-slate-800">Llenado de Acta Oficial</h1>
        </div>
        <div className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
           <p className="text-[10px] font-bold text-slate-400 uppercase">Club a Cargo</p>
           <p className="font-bold text-slate-700">{clubUsuario || "Admin"}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          {/* SELECCIÓN DE PARTIDO */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-3">1. Seleccionar Encuentro</label>
            <select 
              value={partidoSeleccionadoId} 
              onChange={e => { setPartidoSeleccionadoId(e.target.value); setEquipoSeleccionado(null); setJugadorEncontrado(null); }} 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none"
            >
              <option value="">-- Seleccionar partido --</option>
              {partidos.filter(p => p.estado !== "Finalizado" && (rolUsuario === 'admin' || p.local === clubUsuario)).map(p => (
                <option key={p.id} value={p.id}>F{p.fechaNumero} | {p.serie} | {p.local} vs {p.visita}</option>
              ))}
            </select>
          </div>

          {partidoActivo && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-3">2. Registrar para:</label>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => { setEquipoSeleccionado("local"); setJugadorEncontrado(null); }}
                  className={`p-3 rounded-xl font-bold text-sm border transition-all ${equipoSeleccionado === "local" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}
                >
                  LOCAL: {partidoActivo.local}
                </button>
                <button 
                  onClick={() => { setEquipoSeleccionado("visita"); setJugadorEncontrado(null); }}
                  className={`p-3 rounded-xl font-bold text-sm border transition-all ${equipoSeleccionado === "visita" ? 'bg-[#1e3a8a] text-white' : 'bg-slate-50 text-slate-600'}`}
                >
                  VISITA: {partidoActivo.visita}
                </button>
              </div>

              {equipoSeleccionado && (
                <div className="space-y-4">
                  <form onSubmit={buscarPorId} className="space-y-2">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={idInput} 
                        onChange={e => manejarInputId(e.target.value)} 
                        placeholder="RUT o Pasaporte..." 
                        className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                        required
                      />
                      <button type="submit" className="absolute right-2 top-2 bottom-2 bg-emerald-600 text-white px-4 rounded-lg font-bold">Buscar</button>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold px-1">Tip: El sistema detecta automáticamente si es RUT (formatea) o Pasaporte.</p>
                  </form>

                  {errorBusqueda && <p className="text-xs text-red-600 font-bold bg-red-50 p-3 rounded-lg border border-red-100 italic">⚠️ {errorBusqueda}</p>}

                  {jugadorEncontrado && (
                    <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-500 space-y-4 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xl">
                          {jugadorEncontrado.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-base leading-tight uppercase">{jugadorEncontrado.nombre}</p>
                          <p className="text-xs font-bold text-emerald-700">{jugadorEncontrado.rut}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => registrarEvento('⚽ Gol')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black hover:border-emerald-500 transition shadow-sm">⚽ GOL</button>
                        <button onClick={() => registrarEvento('🟨 Amarilla')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black hover:border-yellow-500 transition shadow-sm">🟨 TA</button>
                        <button onClick={() => registrarEvento('🟥 Roja')} className="bg-white border-2 border-slate-200 py-3 rounded-xl font-black hover:border-red-500 transition shadow-sm">🟥 TR</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-8 mt-6 border-t border-slate-100">
                <button onClick={finalizarPartido} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition tracking-widest text-sm">
                  FINALIZAR PARTIDO
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PANEL DERECHO CON MARCADOR (IGUAL AL ANTERIOR) */}
        <div className="lg:col-span-7">
           {partidoActivo ? (
             <div className="space-y-6">
                <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl text-white border-4 border-slate-800 relative overflow-hidden">
                  <div className="flex justify-between items-center relative z-10">
                    <div className="w-1/3">
                      <p className="text-xl font-black uppercase italic">{partidoActivo.local}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-8xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesLocal || 0}</span>
                      <span className="text-4xl text-slate-700 font-light">-</span>
                      <span className="text-8xl font-black text-emerald-400 tabular-nums">{partidoActivo.golesVisita || 0}</span>
                    </div>
                    <div className="w-1/3">
                      <p className="text-xl font-black uppercase italic">{partidoActivo.visita}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">Registro de Minuto a Minuto</div>
                  <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {partidoActivo.eventos?.length ? [...partidoActivo.eventos].reverse().map((ev, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{ev.tipo.includes('Gol') ? '⚽' : ev.tipo.includes('Amarilla') ? '🟨' : '🟥'}</span>
                          <div>
                            <p className="font-bold text-slate-800 text-xs uppercase">{ev.jugador}</p>
                            <p className="text-[9px] font-bold text-blue-600">{ev.equipo} • {ev.rut}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{ev.minuto}</span>
                      </div>
                    )) : <p className="text-center py-10 text-slate-400 text-sm">Sin incidencias.</p>}
                  </div>
                </div>
             </div>
           ) : (
             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl h-full flex flex-col items-center justify-center p-20 text-slate-400">
                <span className="text-6xl mb-4">📋</span>
                <p className="font-bold">Mesa de turno inactiva.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}