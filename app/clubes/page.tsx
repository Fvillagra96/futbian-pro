'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Club { id: string; nombre: string; series: string[]; }

export default function PaginaClubesAdmin() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [cargandoPermisos, setCargandoPermisos] = useState(true);

  const [clubes, setClubes] = useState<Club[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [seriesSeleccionadas, setSeriesSeleccionadas] = useState<string[]>([]);

  const clubesRef = collection(db, "asociaciones/san_fabian/clubes");
  const todasLasSeries = ["Honor", "Segunda", "Senior 35", "Senior 40", "Infantil", "Damas"];

  // 1. VERIFICAR PERMISOS (SOLO ADMIN PUEDE VER ESTO)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) setRolUsuario(docSnap.data().rol);
      }
      setCargandoPermisos(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. CARGAR BASE DE DATOS DE CLUBES EN TIEMPO REAL
  useEffect(() => {
    const q = query(clubesRef, orderBy("nombre"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClubes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Club[]);
    });
    return () => unsubscribe();
  }, []);

  // LÓGICA DE CHECKBOXES PARA LAS SERIES
  const manejarCheckbox = (serie: string) => {
    if (seriesSeleccionadas.includes(serie)) {
      setSeriesSeleccionadas(seriesSeleccionadas.filter(s => s !== serie));
    } else {
      setSeriesSeleccionadas([...seriesSeleccionadas, serie]);
    }
  };

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rolUsuario !== "admin") return alert("Permisos insuficientes.");
    if (seriesSeleccionadas.length === 0) return alert("Debes seleccionar al menos una serie para este club.");

    try {
      if (editandoId) {
        await updateDoc(doc(db, "asociaciones/san_fabian/clubes", editandoId), { nombre, series: seriesSeleccionadas });
        setEditandoId(null);
      } else {
        await addDoc(clubesRef, { nombre, series: seriesSeleccionadas, fechaRegistro: new Date() });
      }
      setNombre(""); setSeriesSeleccionadas([]);
    } catch (error) {
      console.error("Error al guardar club:", error);
    }
  };

  const editarClub = (club: Club) => {
    setEditandoId(club.id); setNombre(club.nombre); setSeriesSeleccionadas(club.series || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarClub = async (id: string, nombreClub: string) => {
    if (rolUsuario !== "admin") return;
    if (window.confirm(`⚠️ ¿Eliminar el club "${nombreClub}"?\nEsto no borrará a sus jugadores de la base de datos, solo la institución.`)) {
      await deleteDoc(doc(db, "asociaciones/san_fabian/clubes", id));
      if (editandoId === id) { setEditandoId(null); setNombre(""); setSeriesSeleccionadas([]); }
    }
  };

  // PANTALLAS DE CARGA Y BLOQUEO
  if (cargandoPermisos) return <div className="flex justify-center items-center h-[50vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a8a]"></div></div>;

  if (rolUsuario !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center animate-in fade-in">
        <span className="text-6xl mb-4">🛑</span>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
        <p className="text-slate-500">El registro estructural de los clubes es competencia exclusiva del Administrador.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <header className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Directorio Oficial</h2>
          <h1 className="text-2xl font-black text-slate-800">Gestión de Clubes y Series</h1>
        </div>
        <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm border border-blue-100 inline-block text-center">
          🛡️ Modo Administrador
        </span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: Formulario */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm text-white shadow-sm ${editandoId ? 'bg-amber-500' : 'bg-[#1e3a8a]'}`}>
                {editandoId ? '✏️' : '1'}
              </span>
              {editandoId ? 'Modificar Club' : 'Registrar Club'}
            </h2>
            
            <form onSubmit={manejarEnvio} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Nombre Oficial</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Los Aromos" className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-slate-800 transition-all" required />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Series Activas (Temporada)</label>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
                  {todasLasSeries.map(serie => (
                    <label key={serie} className={`flex items-center p-2 rounded-lg border cursor-pointer transition-all text-sm select-none ${seriesSeleccionadas.includes(serie) ? 'bg-blue-100 border-blue-400 font-bold text-blue-900 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                      <input type="checkbox" checked={seriesSeleccionadas.includes(serie)} onChange={() => manejarCheckbox(serie)} className="w-4 h-4 text-blue-600 rounded border-gray-300 mr-2" />
                      {serie}
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button type="submit" className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${editandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#1e3a8a] hover:bg-blue-900'}`}>
                  {editandoId ? 'Guardar Cambios' : 'Registrar Institución'}
                </button>
                {editandoId && (
                  <button type="button" onClick={() => { setEditandoId(null); setNombre(""); setSeriesSeleccionadas([]); }} className="w-full mt-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors">
                    Cancelar Edición
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: Tabla Visual */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="bg-slate-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">2</span> 
                Directorio Activo
              </h2>
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full">{clubes.length} Registrados</span>
            </div>
            
            <div className="overflow-x-auto">
              {clubes.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-medium">Aún no hay clubes en la base de datos. Comienza registrando uno a la izquierda.</div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="p-4 border-b border-slate-200 font-bold">Institución</th>
                      <th className="p-4 border-b border-slate-200 font-bold">Series Asociadas</th>
                      <th className="p-4 border-b border-slate-200 font-bold text-right">Administrar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clubes.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg border border-slate-300">
                              {c.nombre.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800">{c.nombre}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {c.series?.map(s => (
                              <span key={s} className="bg-blue-50 border border-blue-100 text-[#1e3a8a] text-xs px-2.5 py-1 rounded-md font-bold uppercase">
                                {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <button onClick={() => editarClub(c)} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold px-3 py-1.5 rounded-lg text-xs transition-colors mr-2 shadow-sm">Editar</button>
                          <button onClick={() => eliminarClub(c.id, c.nombre)} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm">Borrar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}