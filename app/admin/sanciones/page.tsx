'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }

export default function GestionSancionesAdmin() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  
  // Filtros
  const [busqueda, setBusqueda] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "suspendidos">("suspendidos");

  // Estado local para los inputs de edición
  const [sancionesInput, setSancionesInput] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) setRolUsuario(docSnap.data().rol);
      }
    });

    const unsubJ = onSnapshot(query(collection(db, "asociaciones/san_fabian/jugadores")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[];
      setJugadores(data);
      setCargando(false);
    });

    return () => { unsubAuth(); unsubJ(); };
  }, []);

  const aplicarCastigo = async (jugadorId: string, nombre: string) => {
    const nuevasFechas = sancionesInput[jugadorId];
    if (nuevasFechas === undefined) return;

    if (confirm(`¿Actualizar el castigo de ${nombre} a ${nuevasFechas} fechas?`)) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", jugadorId), {
          partidosSuspendido: nuevasFechas
        });
        alert(`Sanción actualizada con éxito.`);
        // Limpiamos el input local para ese jugador
        setSancionesInput(prev => { const next = {...prev}; delete next[jugadorId]; return next; });
      } catch (error) {
        console.error(error);
        alert("Error al actualizar la sanción.");
      }
    }
  };

  const perdonarJugador = async (jugadorId: string, nombre: string) => {
    if (confirm(`¿Estás seguro de levantarle el castigo a ${nombre} por secretaría? Quedará con 0 fechas.`)) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", jugadorId), {
          partidosSuspendido: 0
        });
      } catch (error) { console.error(error); }
    }
  };

  const jugadoresFiltrados = jugadores.filter(j => {
    const cumpleBusqueda = j.nombre.toLowerCase().includes(busqueda.toLowerCase()) || j.rut.includes(busqueda) || j.club.toLowerCase().includes(busqueda.toLowerCase());
    const cumpleEstado = filtroEstado === "todos" ? true : (j.partidosSuspendido && j.partidosSuspendido > 0);
    return cumpleBusqueda && cumpleEstado;
  }).sort((a, b) => (b.partidosSuspendido || 0) - (a.partidosSuspendido || 0) || a.club.localeCompare(b.club));

  if (cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a]">Cargando base de datos disciplinaria...</div>;
  if (rolUsuario !== 'admin') return <div className="p-20 text-center"><h1 className="text-4xl mb-4">🛑</h1><h2 className="text-2xl font-black text-slate-800">Acceso Denegado</h2></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-red-500">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h2 className="text-red-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Gestión Disciplinaria</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">CONTROL DE SANCIONES</h1>
          </div>
          <div className="bg-red-500/20 px-4 py-2 rounded-xl border border-red-500/30 backdrop-blur-sm">
            <p className="text-sm font-bold text-red-100">Modo Admin</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px]">⚖️</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        
        {/* Barra de Controles */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input 
            type="text" 
            placeholder="Buscar por nombre, RUT o club..." 
            value={busqueda} 
            onChange={e => setBusqueda(e.target.value)} 
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500"
          />
          <select 
            value={filtroEstado} 
            onChange={e => setFiltroEstado(e.target.value as any)} 
            className="w-full md:w-64 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 font-black text-slate-600 text-sm outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="suspendidos">⚠️ Ver Solo Castigados</option>
            <option value="todos">📋 Ver Todo el Padrón</option>
          </select>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                <th className="p-4 font-bold">Jugador / RUT</th>
                <th className="p-4 font-bold">Club / Serie</th>
                <th className="p-4 font-black text-center text-red-600">Estado Actual</th>
                <th className="p-4 font-black text-center text-slate-800">Modificar Castigo (Nº Fechas)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jugadoresFiltrados.length === 0 ? (
                <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-400">No se encontraron resultados.</td></tr>
              ) : (
                jugadoresFiltrados.map(j => {
                  const estaSuspendido = j.partidosSuspendido && j.partidosSuspendido > 0;
                  
                  return (
                    <tr key={j.id} className={`hover:bg-slate-50 transition-colors ${estaSuspendido ? 'bg-red-50/10' : ''}`}>
                      <td className="p-4">
                        <p className="font-black text-slate-800 uppercase">{j.nombre}</p>
                        <p className="text-[10px] font-bold text-slate-400">{j.rut}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-[#1e3a8a] text-xs">{j.club}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Serie {j.serie}</p>
                      </td>
                      <td className="p-4 text-center">
                        {estaSuspendido ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-black border border-red-200">
                            ⚠️ SUSPENDIDO ({j.partidosSuspendido})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black border border-emerald-100">
                            ✅ HABILITADO
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number" 
                            min="0"
                            placeholder={j.partidosSuspendido?.toString() || "0"}
                            value={sancionesInput[j.id] !== undefined ? sancionesInput[j.id] : ""}
                            onChange={e => setSancionesInput(prev => ({...prev, [j.id]: parseInt(e.target.value)}))}
                            className="w-20 text-center font-black text-lg border border-slate-300 rounded-lg p-1.5 outline-none focus:border-red-500"
                          />
                          <button 
                            onClick={() => aplicarCastigo(j.id, j.nombre)}
                            disabled={sancionesInput[j.id] === undefined}
                            className="bg-slate-800 disabled:bg-slate-300 text-white font-bold text-[10px] px-3 py-2 rounded-lg hover:bg-black transition shadow-sm"
                          >
                            GUARDAR
                          </button>
                          
                          {estaSuspendido && (
                            <button 
                              onClick={() => perdonarJugador(j.id, j.nombre)}
                              className="text-[10px] font-bold text-red-400 hover:text-red-600 underline ml-2"
                            >
                              Perdonar
                            </button>
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
    </div>
  );
}