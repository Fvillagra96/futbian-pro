'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }
interface JugadorNomina { rut: string; nombre: string; equipo: string; }
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; estado: string; dia: string; hora: string; nomina?: JugadorNomina[]; }

export default function MesaDeTurno() {
  const { rol, club: miClub, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidoActivoId, setPartidoActivoId] = useState<string>("");
  
  // 🚨 NUEVO: Estados para el buscador inteligente
  const [busqueda, setBusqueda] = useState("");
  const [mostrarResultados, setMostrarResultados] = useState(false);

  useEffect(() => {
    if (authCargando) return;

    // Traemos los partidos que no han finalizado
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      const partidosAbiertos = data.filter(p => p.estado !== "Finalizado");
      setPartidos(partidosAbiertos);
    });

    // Traemos todo el padrón de jugadores
    const unsubJ = onSnapshot(query(collection(db, "asociaciones/san_fabian/jugadores")), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });

    return () => { unsubP(); unsubJ(); };
  }, [authCargando]);

  const partidoActivo = partidos.find(p => p.id === partidoActivoId);
  const nominaActual = partidoActivo?.nomina || [];

  // 🚨 NUEVO: Lógica del Buscador Inteligente
  const jugadoresFiltradosBuscador = useMemo(() => {
    if (!partidoActivo) return [];
    if (!busqueda.trim()) return [];

    const termino = busqueda.toLowerCase().trim();
    const clubPermitido = rol === 'admin' ? (partidoActivo.local) : miClub; // El admin podría editar ambos, pero simplificamos al local por defecto, o el club del delegado

    return jugadores.filter(j => {
      // 1. Que pertenezca al club del delegado (o al club involucrado)
      const esDeMiClub = rol === 'admin' ? (j.club === partidoActivo.local || j.club === partidoActivo.visita) : j.club === miClub;
      // 2. Que pertenezca a la serie del partido
      const esDeLaSerie = j.serie === partidoActivo.serie;
      // 3. Que coincida con el RUT o el Nombre escrito
      const coincideBusqueda = j.nombre.toLowerCase().includes(termino) || j.rut.toLowerCase().includes(termino);
      // 4. Que no esté ya en la nómina
      const noEstaEnNomina = !nominaActual.some(n => n.rut === j.rut);

      return esDeMiClub && esDeLaSerie && coincideBusqueda && noEstaEnNomina;
    }).slice(0, 5); // Mostramos solo los 5 mejores resultados para no saturar la pantalla
  }, [busqueda, partidoActivo, jugadores, nominaActual, miClub, rol]);

  const agregarJugador = async (jugador: Jugador) => {
    if (!partidoActivo) return;

    if (jugador.partidosSuspendido && jugador.partidosSuspendido > 0) {
      return alert(`🛑 BLOQUEADO: ${jugador.nombre} está suspendido por ${jugador.partidosSuspendido} fechas.`);
    }

    try {
      const nuevoIngreso: JugadorNomina = {
        rut: jugador.rut,
        nombre: jugador.nombre,
        equipo: jugador.club
      };

      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), {
        nomina: arrayUnion(nuevoIngreso)
      });

      // Limpiamos el buscador después de agregar
      setBusqueda("");
      setMostrarResultados(false);
    } catch (error) {
      alert("Error al firmar jugador en el acta.");
    }
  };

  const quitarJugador = async (jugadorQuitar: JugadorNomina) => {
    if (!partidoActivo) return;
    if (confirm(`¿Quitar la firma de ${jugadorQuitar.nombre} de este partido?`)) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partidoActivo.id), {
          nomina: arrayRemove(jugadorQuitar)
        });
      } catch (error) {
        alert("Error al quitar jugador.");
      }
    }
  };

  // Filtramos los partidos donde juegue el club del usuario (el admin ve todos)
  const misPartidos = partidos.filter(p => rol === 'admin' || p.local === miClub || p.visita === miClub);

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Abriendo Mesa de Turno...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 md:p-4 animate-in fade-in duration-500 pb-20">
      <header className="bg-emerald-700 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-emerald-400">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-emerald-200 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Gestión de Campo</h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">MESA DE TURNO</h1>
            <p className="text-emerald-100 mt-1 text-xs md:text-sm">Inscripción oficial de nóminas por partido.</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
            <p className="text-[10px] font-bold text-emerald-200 uppercase">Delegado Oficial</p>
            <p className="text-sm font-black text-white">{rol === 'admin' ? 'Administrador' : miClub}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px] pointer-events-none">📝</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: SELECCIÓN DE PARTIDO */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-4">
              <span className="text-xl">⚽</span> Seleccionar Partido
            </h3>
            
            {misPartidos.length === 0 ? (
              <div className="bg-slate-50 p-6 rounded-xl text-center border-2 border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-400">Tu club no tiene partidos activos programados en este momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {misPartidos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPartidoActivoId(p.id); setBusqueda(""); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${partidoActivoId === p.id ? 'bg-[#1e3a8a] text-white border-blue-900 shadow-md' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#1e3a8a] hover:shadow-sm'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${partidoActivoId === p.id ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'}`}>Serie {p.serie}</span>
                      <span className="text-[10px] font-bold opacity-70">Fecha {p.fechaNumero}</span>
                    </div>
                    <div className="font-black text-sm uppercase truncate">{p.local}</div>
                    <div className="text-[10px] italic opacity-70 my-0.5">VS</div>
                    <div className="font-black text-sm uppercase truncate">{p.visita}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: FIRMAS Y NÓMINA */}
        <div className="lg:col-span-8">
          {!partidoActivo ? (
            <div className="bg-white rounded-3xl border border-slate-200 h-full min-h-[400px] flex flex-col justify-center items-center text-slate-400">
              <span className="text-5xl mb-4">👈</span>
              <p className="font-bold">Selecciona un partido para abrir el acta.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* CABECERA DEL ACTA */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                  <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded font-black uppercase tracking-widest">Serie {partidoActivo.serie}</span>
                  <h3 className="text-xl font-black text-slate-800 mt-2 uppercase">{partidoActivo.local} <span className="text-slate-300 mx-2">VS</span> {partidoActivo.visita}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Firmas Registradas</p>
                  <p className="text-3xl font-black text-[#1e3a8a] leading-none">{nominaActual.length}</p>
                </div>
              </div>

              {/* 🚨 EL NUEVO BUSCADOR INTELIGENTE */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative">
                <h3 className="font-black text-slate-800 mb-4 text-sm uppercase tracking-widest flex items-center gap-2"><span className="text-emerald-500">✍️</span> Agregar a la Nómina</h3>
                
                <div className="relative">
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-[#1e3a8a] focus-within:border-[#1e3a8a] transition-all">
                    <span className="text-xl mr-3 opacity-50">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Busca por Nombre o RUT de tu jugador..." 
                      value={busqueda}
                      onChange={(e) => {
                        setBusqueda(e.target.value);
                        setMostrarResultados(true);
                      }}
                      onFocus={() => setMostrarResultados(true)}
                      className="w-full bg-transparent font-bold text-sm outline-none placeholder:font-medium"
                    />
                    {busqueda && (
                      <button onClick={() => setBusqueda("")} className="text-slate-400 hover:text-red-500 font-bold ml-2">✖</button>
                    )}
                  </div>

                  {/* Resultados del Buscador */}
                  {mostrarResultados && busqueda.trim().length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 shadow-xl rounded-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                      {jugadoresFiltradosBuscador.length === 0 ? (
                        <div className="p-4 text-center text-sm font-bold text-slate-400">
                          No se encontró ningún jugador habilitado con "{busqueda}".
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {jugadoresFiltradosBuscador.map(jugador => (
                            <li key={jugador.id}>
                              <button 
                                onClick={() => agregarJugador(jugador)}
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 flex items-center justify-between transition group"
                              >
                                <div>
                                  <p className="font-black text-slate-800 uppercase text-sm group-hover:text-emerald-700">{jugador.nombre}</p>
                                  <p className="font-mono text-[10px] text-slate-400 font-bold">{jugador.rut}</p>
                                </div>
                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition shadow-sm">
                                  Firmar
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* LISTA DE NÓMINA (LOS QUE YA FIRMARON) */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-black text-slate-600 text-xs uppercase tracking-widest">Acta Oficial del Partido</h3>
                </div>
                
                {nominaActual.length === 0 ? (
                  <div className="p-10 text-center font-bold text-slate-400 border-2 border-dashed border-slate-100 m-4 rounded-xl">
                    Aún no hay jugadores firmados en el acta de este partido.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-500 text-[9px] uppercase tracking-widest">
                          <th className="p-3 pl-6 font-bold">RUT</th>
                          <th className="p-3 font-bold">Jugador</th>
                          <th className="p-3 font-bold">Club</th>
                          <th className="p-3 pr-6 font-bold text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {nominaActual.map((n, i) => (
                          <tr key={`${n.rut}-${i}`} className="hover:bg-slate-50 transition">
                            <td className="p-3 pl-6 font-mono text-[11px] text-slate-500 font-bold">{n.rut}</td>
                            <td className="p-3 font-black text-slate-800 uppercase text-xs">{n.nombre}</td>
                            <td className="p-3"><span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{n.equipo}</span></td>
                            <td className="p-3 pr-6 text-right">
                              {/* El delegado solo puede borrar a sus propios jugadores. El admin a todos. */}
                              {(rol === 'admin' || n.equipo === miClub) && (
                                <button onClick={() => quitarJugador(n)} className="text-[10px] text-red-400 hover:text-red-600 font-bold underline">
                                  Borrar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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