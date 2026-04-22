'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";
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
  
  const [modoIngreso, setModoIngreso] = useState<"manual" | "masivo">("manual");
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [serie, setSerie] = useState("Honor");
  const [clubSeleccionado, setClubSeleccionado] = useState("");
  const [filtroSerie, setFiltroSerie] = useState("Todas");
  
  const [cargandoMasivo, setCargandoMasivo] = useState(false);

  useEffect(() => {
    if (authCargando) return;
    
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

  // --- CARGA MANUAL ---
  const registrarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut || !nombre) return alert("RUT y Nombre son obligatorios.");
    const rutLimpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    
    const existeEnBD = jugadores.find(j => j.rut.replace(/[^0-9kK]/g, "").toUpperCase() === rutLimpio);
    if (existeEnBD) return alert(`🚨 ALERTA: El RUT ${formatearRut(rutLimpio)} ya está inscrito en el club ${existeEnBD.club}.`);

    try {
      await addDoc(collection(db, "asociaciones/san_fabian/jugadores"), {
        nombre: nombre.toUpperCase().trim(),
        rut: formatearRut(rutLimpio),
        club: clubSeleccionado,
        serie,
        partidosSuspendido: 0
      });
      setNombre(""); setRut("");
      alert("✅ Jugador inscrito con éxito.");
    } catch (error) { alert("Error al inscribir jugador."); }
  };

  // --- CARGA MASIVA (CSV) ---
  const descargarPlantillaCSV = () => {
    const contenido = "RUT,NOMBRE_COMPLETO,SERIE\n11111111-1,JUAN PEREZ,Honor\n22222222-2,PEDRO GOMEZ,Juvenil";
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Plantilla_Jugadores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const procesarArchivoCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCargandoMasivo(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lineas = text.split('\n');
        
        let exitosos = 0;
        let ignorados = 0;
        const loteDePromesas = [];

        // Empezamos desde i=1 para saltar la cabecera (RUT,NOMBRE_COMPLETO,SERIE)
        for (let i = 1; i < lineas.length; i++) {
          const linea = lineas[i].trim();
          if (!linea) continue;

          const columnas = linea.split(',');
          if (columnas.length < 3) continue;

          const rutCSV = columnas[0].trim();
          const nombreCSV = columnas[1].toUpperCase().trim();
          const serieCSV = columnas[2].trim();

          const rutLimpio = rutCSV.replace(/[^0-9kK]/g, "").toUpperCase();
          if (rutLimpio.length < 7) { ignorados++; continue; }

          // Verificar duplicado en toda la base
          const existeEnBD = jugadores.find(j => j.rut.replace(/[^0-9kK]/g, "").toUpperCase() === rutLimpio);
          if (existeEnBD) { ignorados++; continue; }

          // Preparamos la inserción
          loteDePromesas.push(
            addDoc(collection(db, "asociaciones/san_fabian/jugadores"), {
              nombre: nombreCSV,
              rut: formatearRut(rutLimpio),
              club: clubSeleccionado,
              serie: serieCSV,
              partidosSuspendido: 0
            })
          );
          exitosos++;
        }

        if (loteDePromesas.length > 0) {
          await Promise.all(loteDePromesas);
          alert(`✅ Carga finalizada.\n\n- ${exitosos} jugadores inscritos.\n- ${ignorados} ignorados (RUT inválido o ya inscrito).`);
        } else {
          alert("No se encontraron jugadores válidos nuevos en el archivo.");
        }
      } catch (error) {
        alert("Ocurrió un error al leer el archivo. Revisa el formato.");
      } finally {
        setCargandoMasivo(false);
        e.target.value = ''; // Limpiamos el input
      }
    };
    reader.readAsText(file);
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

  const clubFiltro = rol === 'admin' ? clubSeleccionado : miClub;
  const jugadoresFiltrados = jugadores.filter(j => j.club === clubFiltro && (filtroSerie === "Todas" || j.serie === filtroSerie)).sort((a, b) => a.nombre.localeCompare(b.nombre));

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando base de datos de jugadores...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-blue-500">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Administración de Padrón</h2><h1 className="text-3xl md:text-5xl font-black tracking-tighter">PLANTEL OFICIAL</h1></div>
          <div className="bg-white/10 px-6 py-3 rounded-xl border border-white/20 text-center"><p className="text-[10px] font-bold text-slate-300 uppercase block mb-1">Viendo Club</p><p className="text-lg font-black text-white leading-none">{clubFiltro}</p></div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px] pointer-events-none">⚽</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-4"><span className="bg-blue-100 text-[#1e3a8a] w-8 h-8 rounded-full flex items-center justify-center text-sm">➕</span> Inscribir Jugadores</h3>
            
            {/* SWITCH MANUAL / MASIVO */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button onClick={() => setModoIngreso("manual")} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition ${modoIngreso === "manual" ? "bg-white text-[#1e3a8a] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Manual</button>
              <button onClick={() => setModoIngreso("masivo")} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition ${modoIngreso === "masivo" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Masivo (CSV)</button>
            </div>

            {rol === 'admin' && (
              <div className="mb-4"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Asignar a Club</label><select value={clubSeleccionado} onChange={e => setClubSeleccionado(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none">{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select></div>
            )}

            {modoIngreso === "manual" ? (
              <form onSubmit={registrarJugador} className="space-y-4 animate-in slide-in-from-left-2 duration-300">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">RUT o Pasaporte</label><input type="text" value={rut} onChange={e => manejarInputRut(e.target.value)} placeholder="Ej: 12.345.678-9" className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-sm outline-none uppercase" required /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Completo</label><input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none uppercase" required /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Serie Asignada</label><select value={serie} onChange={e => setSerie(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none"><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select></div>
                <button type="submit" className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg hover:bg-blue-800 transition uppercase tracking-widest text-xs mt-4">Guardar Registro</button>
              </form>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                  <p className="text-xs text-emerald-800 font-medium mb-3">Sube toda la nómina de tu club de una sola vez usando un archivo CSV (Excel delimitado por comas).</p>
                  <button onClick={descargarPlantillaCSV} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition">📥 Descargar Plantilla</button>
                </div>
                
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition relative">
                  <input type="file" accept=".csv" onChange={procesarArchivoCSV} disabled={cargandoMasivo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                  <div className="pointer-events-none space-y-2">
                    <span className="text-3xl">📄</span>
                    <p className="font-bold text-sm text-[#1e3a8a]">{cargandoMasivo ? "Procesando archivo..." : "Haz clic o arrastra tu archivo CSV aquí"}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Asegúrate de no modificar las cabeceras</p>
                  </div>
                </div>
              </div>
            )}
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
                       jugadoresFiltrados.map((j, i) => (
                         <tr key={j.id} className={`hover:bg-slate-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           <td className="p-4 font-mono text-[11px] text-slate-500 font-bold">{j.rut}</td>
                           <td className="p-4 font-black text-slate-800 uppercase text-xs md:text-sm">{j.nombre}</td>
                           <td className="p-4 text-center"><span className="bg-blue-100 text-[#1e3a8a] px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border border-blue-200 shadow-sm">{j.serie}</span></td>
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