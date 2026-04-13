'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Papa from "papaparse";

interface Jugador { 
  id: string; nombre: string; rut: string; club: string; serie: string; 
  amarillas: number; rojas: number; estado: string; 
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

  // 3. OPERACIONES CRUD
  const guardarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    const datos = { nombre, rut, club, serie };
    
    try {
      if (editandoId) {
        await updateDoc(doc(db, "asociaciones/san_fabian/jugadores", editandoId), datos);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "asociaciones/san_fabian/jugadores"), {
          ...datos, amarillas: 0, rojas: 0, estado: 'Disponible', partidos: 0
        });
      }
      setNombre(""); setRut("");
    } catch (err) { console.error(err); }
  };

  const eliminarJugador = async (id: string, n: string) => {
    if (window.confirm(`¿Eliminar a ${n}?`)) await deleteDoc(doc(db, "asociaciones/san_fabian/jugadores", id));
  };

  // 4. IMPORTACIÓN MASIVA
  const importarCSV = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const batch = writeBatch(db);
        results.data.forEach((fila: any) => {
          if (!fila.nombre) return;
          const ref = doc(collection(db, "asociaciones/san_fabian/jugadores"));
          batch.set(ref, {
            nombre: fila.nombre, rut: fila.rut, club: rol === 'admin' ? fila.club : miClub,
            serie: fila.serie || 'Honor', amarillas: 0, rojas: 0, estado: 'Disponible'
          });
        });
        await batch.commit();
        alert("Importación completada");
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
           <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition shadow-md">
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
              <input type="text" placeholder="Nombre completo" value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
              <input type="text" placeholder="RUT (ej: 12.345.678-9)" value={rut} onChange={e => setRut(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" required />
              
              <select value={club} onChange={e => setClub(e.target.value)} disabled={rol !== 'admin'} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none disabled:opacity-50 font-bold">
                {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select value={serie} onChange={e => setSerie(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none font-bold">
                <option value="Honor">Honor</option>
                <option value="Segunda">Segunda</option>
                <option value="Senior 40">Senior 40</option>
                <option value="Damas">Damas</option>
              </select>

              <button type="submit" className="w-full py-3.5 bg-blue-900 text-white rounded-xl font-bold shadow-lg hover:bg-blue-800 transition">
                {editandoId ? 'Actualizar Ficha' : 'Inscribir Jugador'}
              </button>
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
              <option value="Senior 40">Senior 40</option>
              <option value="Damas">Damas</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
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
                {jugadoresFiltrados.map(j => (
                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-800 capitalize">{j.nombre}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{j.rut}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-bold text-blue-900">{j.club}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-black">{j.serie}</p>
                    </td>
                    <td className="p-4 text-center font-bold text-yellow-600">{j.amarillas || 0}</td>
                    <td className="p-4 text-center font-bold text-red-600">{j.rojas || 0}</td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => { setEditandoId(j.id); setNombre(j.nombre); setRut(j.rut); setClub(j.club); setSerie(j.serie); }} className="text-blue-600 font-bold hover:underline">Editar</button>
                      <button onClick={() => eliminarJugador(j.id, j.nombre)} className="text-red-500 font-bold hover:underline">Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}