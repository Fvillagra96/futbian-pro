'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, deleteDoc, addDoc } from "firebase/firestore";
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

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }
interface Club { nombre: string; }

export default function GestionJugadores() {
  const { rol, club: miClub, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [serie, setSerie] = useState("Honor");
  const [clubSeleccionado, setClubSeleccionado] = useState("");
  const [filtroSerie, setFiltroSerie] = useState("Todas");

  useEffect(() => {
    if (authCargando) return;
    
    // Si es delegado, por defecto su club es el que le corresponde
    if (rol === 'delegado' && miClub) setClubSeleccionado(miClub);

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => d.data() as Club).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(data);
      if (rol === 'admin' && data.length > 0 && !clubSeleccionado) setClubSeleccionado(data[0].nombre);
    });

    const unsubJ = onSnapshot(query(collection(db, "asociaciones/san_fabian/jugadores")), (snap) => {
      setJugadores(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[]);
      setCargandoDatos(false);
    });

    return () => { unsubC(); unsubJ(); };
  }, [authCargando, rol, miClub]);

  const registrarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut || !nombre) return alert("RUT y Nombre son obligatorios.");
    const rutLimpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    
    // Validar si el RUT ya existe en TODA la base de datos (incluso en otros clubes)
    const existeEnBD = jugadores.find(j => j.rut.replace(/[^0-9kK]/g, "").toUpperCase() === rutLimpio);
    if (existeEnBD) return alert(`🚨 ALERTA: El RUT ${formatearRut(rutLimpio)} ya está inscrito en el club ${existeEnBD.club}.`);

    try {
      await addDoc(collection(db, "asociaciones/san_fabian/jugadores"), {
        nombre: nombre.toUpperCase(),
        rut: formatearRut(rutLimpio),
        club: clubSeleccionado,
        serie,
        partidosSuspendido: 0
      });
      setNombre(""); setRut("");
      alert("✅ Jugador inscrito con éxito.");
    } catch (error) { alert("Error al inscribir jugador."); }
  };

  const eliminarJugador = async (id: string, nombreJugador: string) => {
    if (confirm(`¿Eliminar definitivamente a ${nombreJugador} del registro?`)) {
      await deleteDoc(doc(db, "asociaciones/san_fabian/jugadores", id));
    }
  };

  const manejarInputRut = (valor: string) => {
    const soloNumerosYK = /^[0-9kK.-]+$/.test(valor);
    if (soloNumerosYK && valor.length > 2) setRut(formatearRut(valor));
    else setRut(valor.toUpperCase());
  };

  // El delegado solo ve a los de su club. El admin ve los del club que seleccione en el form.
  const clubFiltro = rol === 'admin' ? clubSeleccionado : miClub;
  const jugadoresFiltrados = jugadores.filter(j => j.club === clubFiltro && (filtroSerie === "Todas" || j.serie === filtroSerie)).sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando base de datos de jugadores...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Administración de Padrón</h2><h1 className="text-3xl md:text-4xl font-black tracking-tighter">PLANTEL OFICIAL</h1></div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20"><p className="text-[10px] font-bold text-slate-300 uppercase">Viendo Club</p><p className="text-sm font-black text-white">{clubFiltro}</p></div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><span className="bg-blue-100 text-[#1e3a8a] w-8 h-8 rounded-full flex items-center justify-center text-sm">➕</span> Inscribir Jugador</h3>
            <form onSubmit={registrarJugador} className="space-y-4">
              {rol === 'admin' && (
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Inscribir en Club</label><select value={clubSeleccionado} onChange={e => setClubSeleccionado(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none">{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select></div>
              )}
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">RUT o Pasaporte</label><input type="text" value={rut} onChange={e => manejarInputRut(e.target.value)} placeholder="Ej: 12.345.678-9" className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-sm outline-none uppercase" required /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Completo</label><input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none uppercase" required /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Serie Asignada</label><select value={serie} onChange={e => setSerie(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none"><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select></div>
              <button type="submit" className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg hover:bg-blue-800 transition uppercase tracking-widest text-xs mt-4">Guardar Registro</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
             <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Filtrar Padrón:</span>
             <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todas">Todas las Series</option><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select>
          </div>
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-left border-collapse">
                   <thead><tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200"><th className="p-4 font-bold">RUT</th><th className="p-4 font-bold">Nombre Jugador</th><th className="p-4 font-bold text-center">Serie</th><th className="p-4 font-bold text-center">Gestión</th></tr></thead>
                   <tbody className="divide-y divide-slate-100">
                     {jugadoresFiltrados.length === 0 ? <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-400">No hay jugadores inscritos en esta selección.</td></tr> : (
                       jugadoresFiltrados.map(j => (
                         <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                           <td className="p-4 font-mono text-[11px] text-slate-500 font-bold">{j.rut}</td>
                           <td className="p-4 font-black text-slate-800 uppercase text-xs md:text-sm">{j.nombre}</td>
                           <td className="p-4 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{j.serie}</span></td>
                           <td className="p-4 text-center"><button onClick={() => eliminarJugador(j.id, j.nombre)} className="text-slate-300 hover:text-red-500 transition px-2">✖</button></td>
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