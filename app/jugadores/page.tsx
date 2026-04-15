'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDoc, writeBatch, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Papa from "papaparse";

interface Jugador { 
  id: string; 
  nombre: string; 
  rut: string; 
  club: string; 
  serie: string; 
  nacionalidad?: string;
  amarillas: number; 
  rojas: number; 
  estado: string; 
}

export default function ModuloJugadores() {
  const [rol, setRol] = useState<string | null>(null);
  const [miClub, setMiClub] = useState<string>("");
  const [cargando, setCargando] = useState(true);

  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [clubesDisponibles, setClubesDisponibles] = useState<string[]>([]);
  
  // Estados del Formulario
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [club, setClub] = useState("");
  const [serie, setSerie] = useState("Honor");
  const [nacionalidad, setNacionalidad] = useState("Chilena");

  // Filtros de Plantilla
  const [busqueda, setBusqueda] = useState("");
  const [filtroSerie, setFiltroSerie] = useState("Todas");

  // 1. SEGURIDAD Y PERMISOS
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRol(data.rol);
          setMiClub(data.club);
          if (data.rol === 'delegado') setClub(data.club);
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. CARGAR CLUBES Y JUGADORES
  useEffect(() => {
    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const nombres = snap.docs.map(d => d.data().nombre);
      setClubesDisponibles(nombres);
      if (rol === 'admin' && !club) setClub(nombres[0]);
    });

    const unsubJ = onSnapshot(query(collection(db, "asociaciones/san_fabian/jugadores"), orderBy("nombre")), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargando(false);
    });

    return () => { unsubC(); unsubJ(); };
  }, [rol]);

  // 3. OPERACIONES CRUD (AHORA CON RUT COMO ID)
  const guardarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpiamos espacios extra por si acaso
    const rutLimpio = rut.trim();
    const datos = { nombre: nombre.trim(), rut: rutLimpio, club, serie, nacionalidad };
    
    try {
      if (editandoId) {
        // Si estamos editando, actualizamos el documento existente
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", editandoId), datos);
        setEditandoId(null);
      } else {
        // CREACIÓN NUEVA: Usamos setDoc para forzar que el ID sea el RUT
        await setDoc(doc(db, "asociaciones/san_fabian/jugadores", rutLimpio), {
          ...datos, 
          amarillas: 0, 
          rojas: 0, 
          estado: 'Disponible', 
          partidos: 0
        });
      }
      // Limpiamos el formulario
      setNombre(""); setRut(""); setNacionalidad("Chilena");
    } catch (err) { 
      console.error(err); 
      alert("Ocurrió un error al guardar. Verifique su conexión.");
    }
  };

  const eliminarJugador = async (id: string, n: string) => {
    if (window.confirm(`¿Eliminar a ${n}?`)) {
      await deleteDoc(doc(db, "asociaciones/san_fabian/jugadores", id));
    }
  };

  const prepararEdicion = (j: Jugador) => {
    setEditandoId(j.id);
    setNombre(j.nombre);
    setRut(j.rut);
    setClub(j.club);
    setSerie(j.serie);
    setNacionalidad(j.nacionalidad || "Chilena");
    // Hacemos scroll hacia arriba suavemente
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 4. IMPORTACIÓN MASIVA (MEJORADA CON RUT COMO ID)
  const importarCSV = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        results.data.forEach((fila: any) => {
          if (!fila.nombre || !fila.rut) return;
          
          const rutLimpio = fila.rut.trim();
          // Usamos el RUT como ID en la importación masiva también
          const ref = doc(db, "asociaciones/san_fabian/jugadores", rutLimpio);
          
          batch.set(ref, {
            nombre: fila.nombre, 
            rut: rutLimpio, 
            club: rol === 'admin' ? (fila.club || miClub) : miClub,
            serie: fila.serie || 'Honor', 
            nacionalidad: fila.nacionalidad || 'Chilena',
            amarillas: 0, 
            rojas: 0, 
            estado: 'Disponible'
          }, { merge: true }); // Merge true evita borrar datos si el RUT ya existía
        });
        await batch.commit();
        alert("Importación completada con éxito.");
        e.target.value = null; // Resetea el input
      }
    });
  };

  // 5. LÓGICA DE FILTRADO (PLANTILLA)
  const jugadoresFiltrados = jugadores.filter(j => {
    const cumpleClub = rol === 'admin' ? true : j.club === miClub;
    const cumpleSerie = filtroSerie === 'Todas' ? true : j.serie === filtroSerie;
    const cumpleBusqueda = j.nombre.toLowerCase().includes(busqueda.toLowerCase()) || j.rut.includes(busqueda);
    return cumpleClub && cumpleSerie && cumpleBusqueda;
  });

  if (cargando) return <div className="p-20 text-center animate-pulse">Cargando base de datos...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Jugadores</h1>
          <p className="text-slate-500 text-sm font-medium">{rol === 'admin' ? 'Asociación Completa' : `Club: ${miClub}`}</p>
        </div>
        <div className="flex gap-2">
           <label className="bg-[#1e3a8a] hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition shadow-md">
             📊 Importar CSV
             <input type="file" accept=".csv" onChange={importarCSV} className="hidden" />
           </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Formulario (Panel Izquierdo) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h2 className="text-lg font-bold mb-6 text-slate-800 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs">
                {editandoId ? '✏️' : '+'}
              </span>
              {editandoId ? 'Editar Jugador' : 'Inscribir Jugador'}
            </h2>
            <form onSubmit={guardarJugador} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Completo</label>
                <input type="text" placeholder="Ej: Juan Pérez" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">RUT o Pasaporte</label>
                <input type="text" placeholder="Ej: 12.345.678-9" value={rut} onChange={e => setRut(e.target.value)} disabled={!!editandoId} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" required />
                {editandoId && <p className="text-[9px] text-orange-500 mt-1">El RUT/ID no se puede modificar.</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nacionalidad</label>
                  <select value={nacionalidad} onChange={e => setNacionalidad(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-sm">
                    <option value="Chilena">Chilena 🇨🇱</option>
                    <option value="Argentina">Argentina 🇦🇷</option>
                    <option value="Colombiana">Colombiana 🇨🇴</option>
                    <option value="Venezolana">Venezolana 🇻🇪</option>
                    <option value="Haitiana">Haitiana 🇭🇹</option>
                    <option value="Peruana">Peruana 🇵🇪</option>
                    <option value="Otra">Otra 🌍</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Serie</label>
                  <select value={serie} onChange={e => setSerie(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold text-sm">
                    <option value="Honor">Honor</option>
                    <option value="Segunda">Segunda</option>
                    <option value="Senior 35">Senior 35</option>
                    <option value="Senior 40">Senior 40</option>
                    <option value="Damas">Damas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Club Destino</label>
                <select value={club} onChange={e => setClub(e.target.value)} disabled={rol !== 'admin'} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none disabled:opacity-50 font-bold text-sm">
                  {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full py-3.5 bg-[#1e3a8a] text-white rounded-xl font-bold shadow-lg hover:bg-blue-800 transition">
                  {editandoId ? 'Guardar Cambios' : 'Inscribir Jugador'}
                </button>
                {editandoId && (
                  <button type="button" onClick={() => { setEditandoId(null); setNombre(""); setRut(""); setNacionalidad("Chilena"); }} className="w-full mt-2 py-2 text-slate-500 font-bold hover:text-slate-700 text-sm">
                    Cancelar Edición
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Listado / Plantilla (Panel Derecho) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
            <input type="text" placeholder="Buscar por nombre o RUT..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" />
            <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 outline-none">
              <option value="Todas">Todas las Series</option>
              <option value="Honor">Honor</option>
              <option value="Segunda">Segunda</option>
              <option value="Senior 35">Senior 35</option>
              <option value="Senior 40">Senior 40</option>
              <option value="Damas">Damas</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                    <th className="p-4 border-b">Jugador</th>
                    <th className="p-4 border-b">Club / Serie</th>
                    <th className="p-4 border-b text-center">🟨</th>
                    <th className="p-4 border-b text-center">🟥</th>
                    <th className="p-4 border-b text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jugadoresFiltrados.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron jugadores.</td></tr>
                  ) : (
                    jugadoresFiltrados.map(j => (
                      <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800 capitalize flex items-center gap-2">
                            {j.nombre}
                            {j.nacionalidad && j.nacionalidad !== "Chilena" && (
                              <span className="text-[10px] font-normal px-1.5 py-0.5 bg-slate-100 rounded text-slate-500" title={j.nacionalidad}>
                                {j.nacionalidad === 'Argentina' ? '🇦🇷' : j.nacionalidad === 'Venezolana' ? '🇻🇪' : j.nacionalidad === 'Colombiana' ? '🇨🇴' : j.nacionalidad === 'Haitiana' ? '🇭🇹' : j.nacionalidad === 'Peruana' ? '🇵🇪' : '🌍'}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">{j.rut}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-blue-900">{j.club}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-black">{j.serie}</p>
                        </td>
                        <td className="p-4 text-center font-bold text-yellow-600 bg-yellow-50/30">{j.amarillas || 0}</td>
                        <td className="p-4 text-center font-bold text-red-600 bg-red-50/30">{j.rojas || 0}</td>
                        <td className="p-4 text-right space-x-3">
                          <button onClick={() => prepararEdicion(j)} className="text-[#1e3a8a] font-bold hover:underline text-xs">Editar</button>
                          <button onClick={() => eliminarJugador(j.id, j.nombre)} className="text-red-500 font-bold hover:underline text-xs">Borrar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}