'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, writeBatch, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Club { id: string; nombre: string; series: string[]; }
interface Partido { id: string; fechaNumero: string; local: string; visita: string; serie: string; cancha: string; fechaCalendario: string; estado: string; }

export default function PaginaProgramacion() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const [clubes, setClubes] = useState<Club[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  // Estados del Creador de Fechas
  const [fechaNumero, setFechaNumero] = useState("1"); // Ej: Fecha 1, Fecha 2
  const [local, setLocal] = useState("");
  const [visita, setVisita] = useState("");
  const [cancha, setCancha] = useState("Estadio Municipal");
  const [fechaCalendario, setFechaCalendario] = useState("");
  
  // Lógica inteligente de series
  const [seriesEnComun, setSeriesEnComun] = useState<string[]>([]);
  const [seriesSeleccionadas, setSeriesSeleccionadas] = useState<string[]>([]);

  // 1. SEGURIDAD (Solo Admin)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists() && docSnap.data().rol === 'admin') {
          setRolUsuario('admin');
        }
      }
      setCargando(false);
    });
    return () => unsub();
  }, []);

  // 2. CARGAR DATOS
  useEffect(() => {
    if (rolUsuario !== 'admin') return;

    const unsubClubes = onSnapshot(query(collection(db, "asociaciones/san_fabian/clubes"), orderBy("nombre")), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Club[];
      setClubes(data);
      if (data.length >= 2) { setLocal(data[0].nombre); setVisita(data[1].nombre); }
    });

    const unsubPartidos = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero")), (snap) => {
      setPartidos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Partido[]);
    });

    return () => { unsubClubes(); unsubPartidos(); };
  }, [rolUsuario]);

  // 3. MOTOR DE INTERSECCIÓN DE SERIES
  useEffect(() => {
    const clubL = clubes.find(c => c.nombre === local);
    const clubV = clubes.find(c => c.nombre === visita);

    if (clubL?.series && clubV?.series) {
      const interseccion = clubL.series.filter(s => clubV.series.includes(s));
      setSeriesEnComun(interseccion);
      setSeriesSeleccionadas(interseccion); // Seleccionar todas por defecto
    } else {
      setSeriesEnComun([]); setSeriesSeleccionadas([]);
    }
  }, [local, visita, clubes]);

  // MANEJO DEL FORMULARIO
  const manejarCheckbox = (serie: string) => {
    if (seriesSeleccionadas.includes(serie)) setSeriesSeleccionadas(seriesSeleccionadas.filter(s => s !== serie));
    else setSeriesSeleccionadas([...seriesSeleccionadas, serie]);
  };

  const generarFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local === visita) return alert("El equipo local no puede jugar contra sí mismo.");
    if (seriesSeleccionadas.length === 0) return alert("Debes seleccionar al menos una serie para jugar.");
    if (!fechaCalendario) return alert("Selecciona el día del encuentro.");

    if (!window.confirm(`¿Crear ${seriesSeleccionadas.length} partidos oficiales entre ${local} y ${visita}?`)) return;

    try {
      const batch = writeBatch(db);
      seriesSeleccionadas.forEach(serie => {
        const nuevaRef = doc(collection(db, "asociaciones/san_fabian/partidos"));
        batch.set(nuevaRef, { 
          fechaNumero: parseInt(fechaNumero), 
          local, visita, serie, cancha, fechaCalendario,
          golesLocal: 0, golesVisita: 0, estado: "Pendiente" 
        });
      });
      await batch.commit();
    } catch (err) { console.error(err); }
  };

  const eliminarPartido = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este partido programado?")) {
      await deleteDoc(doc(db, "asociaciones/san_fabian/partidos", id));
    }
  };

  const formatearFecha = (fechaOriginal: string) => {
    if (!fechaOriginal) return 'S/F';
    return fechaOriginal.split('-').reverse().join('-');
  };

  // PANTALLAS DE BLOQUEO
  if (cargando) return <div className="p-20 text-center animate-pulse text-blue-900 font-bold">Cargando sistema de programación...</div>;
  if (rolUsuario !== "admin") return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
      <span className="text-6xl mb-4">🛑</span><h2 className="text-2xl font-bold text-slate-800">Acceso Restringido</h2>
      <p className="text-slate-500">Solo el Administrador puede programar el fixture oficial.</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <header className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Panel de Competición</h2>
          <h1 className="text-2xl font-black text-slate-800">Programación de Fechas (Fixture)</h1>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: Generador Masivo */}
        <div className="xl:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
              <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm shadow-sm">1</span>
              Generar Encuentro
            </h2>

            <form onSubmit={generarFixture} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Jornada</label>
                  <select value={fechaNumero} onChange={e => setFechaNumero(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500">
                    {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => <option key={n} value={n}>Fecha {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Cancha</label>
                  <input type="text" value={cancha} onChange={e => setCancha(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500" required />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Club Local</label>
                  <select value={local} onChange={e => setLocal(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none">
                    {clubes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="text-center text-slate-400 font-black text-xs tracking-widest">VS</div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Club Visita</label>
                  <select value={visita} onChange={e => setVisita(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 outline-none">
                    {clubes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* SERIES INTELIGENTES */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Series Habilitadas (En Común)</label>
                {seriesEnComun.length === 0 ? (
                  <p className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">⚠️ Estos clubes no tienen series en común.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {seriesEnComun.map(serie => (
                      <label key={serie} className={`flex items-center p-2 rounded-lg border cursor-pointer text-sm transition-all ${seriesSeleccionadas.includes(serie) ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={seriesSeleccionadas.includes(serie)} onChange={() => manejarCheckbox(serie)} className="mr-2" /> {serie}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Día del Partido</label>
                <input type="date" value={fechaCalendario} onChange={e => setFechaCalendario(e.target.value)} required className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-medium outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <button type="submit" disabled={seriesEnComun.length === 0} className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md ${seriesEnComun.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                Programar {seriesSeleccionadas.length} Partidos
              </button>
            </form>
          </div>
        </div>

        {/* PANEL DERECHO: Fixture Creado */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <span className="bg-slate-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-sm">2</span> Fixture Oficial
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">{partidos.length} Programados</span>
            </div>
            
            <div className="overflow-x-auto">
              {partidos.length === 0 ? (
                 <div className="p-12 text-center text-slate-500 font-medium">Aún no hay fechas programadas.</div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4 border-b">Jornada/Día</th>
                      <th className="p-4 border-b">Serie/Cancha</th>
                      <th className="p-4 border-b text-right">Local</th>
                      <th className="p-4 border-b text-center">VS</th>
                      <th className="p-4 border-b">Visita</th>
                      <th className="p-4 border-b text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {partidos.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">Fecha {p.fechaNumero}</p>
                          <p className="text-xs text-slate-500">{formatearFecha(p.fechaCalendario)}</p>
                        </td>
                        <td className="p-4">
                          <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-bold uppercase text-[10px]">{p.serie}</span>
                          <p className="text-[11px] text-slate-400 mt-1">{p.cancha}</p>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">{p.local}</td>
                        <td className="p-4 text-center font-black text-slate-300">VS</td>
                        <td className="p-4 font-bold text-slate-800">{p.visita}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => eliminarPartido(p.id)} className="bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors shadow-sm">
                            Borrar
                          </button>
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