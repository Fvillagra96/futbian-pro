'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, deleteDoc, setDoc, writeBatch } from "firebase/firestore";
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

// Interfaces para el Prelistado Masivo
interface PreJugadorValido { idTemp: string; rutLimpio: string; rutFormat: string; nombre: string; serie: string; }
interface PreJugadorDuplicado { rutLimpio: string; rutFormat: string; nombreCsv: string; nombreDb: string; clubActual: string; serieCsv: string; }

export default function GestionJugadores() {
  const { rol, club: miClub, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  
  const [modoIngreso, setModoIngreso] = useState<"manual" | "masivo" | "previa">("manual");
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [serie, setSerie] = useState("Honor");
  const [clubSeleccionado, setClubSeleccionado] = useState("");
  const [filtroSerie, setFiltroSerie] = useState("Todas");
  
  // Estados de la Vista Previa Masiva
  const [cargandoMasivo, setCargandoMasivo] = useState(false);
  const [preValidos, setPreValidos] = useState<PreJugadorValido[]>([]);
  const [preDuplicados, setPreDuplicados] = useState<PreJugadorDuplicado[]>([]);

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

  // --- CARGA MANUAL (AHORA CON RUT COMO ID) ---
  const registrarJugador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rut || !nombre) return alert("RUT y Nombre son obligatorios.");
    const rutLimpio = rut.replace(/[^0-9kK]/g, "").toUpperCase();
    
    const existeEnBD = jugadores.find(j => j.id === rutLimpio);
    if (existeEnBD) return alert(`🚨 ALERTA: El RUT ${formatearRut(rutLimpio)} ya está inscrito en el club ${existeEnBD.club}.`);

    try {
      // 🚨 MEJORA ARQUITECTURA: Guardamos usando setDoc y el rutLimpio como ID del documento
      await setDoc(doc(db, "asociaciones/san_fabian/jugadores", rutLimpio), {
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

  // --- PROCESAMIENTO CSV (VISTA PREVIA) ---
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
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lineas = text.split('\n');
        
        const validosTemp: PreJugadorValido[] = [];
        const duplicadosTemp: PreJugadorDuplicado[] = [];

        for (let i = 1; i < lineas.length; i++) {
          const linea = lineas[i].trim();
          if (!linea) continue;

          const columnas = linea.split(',');
          if (columnas.length < 3) continue;

          const rutCSV = columnas[0].trim();
          const nombreCSV = columnas[1].toUpperCase().trim();
          const serieCSV = columnas[2].trim();

          const rutLimpio = rutCSV.replace(/[^0-9kK]/g, "").toUpperCase();
          if (rutLimpio.length < 7) continue;

          // Verificamos si ya existe por el ID
          const existeEnBD = jugadores.find(j => j.id === rutLimpio);
          
          if (existeEnBD) {
            duplicadosTemp.push({
              rutLimpio, rutFormat: formatearRut(rutLimpio), nombreCsv: nombreCSV, 
              nombreDb: existeEnBD.nombre, clubActual: existeEnBD.club, serieCsv: serieCSV
            });
          } else {
            validosTemp.push({
              idTemp: Math.random().toString(), rutLimpio, rutFormat: formatearRut(rutLimpio), 
              nombre: nombreCSV, serie: serieCSV
            });
          }
        }

        setPreValidos(validosTemp);
        setPreDuplicados(duplicadosTemp);
        setModoIngreso("previa");
      } catch (error) {
        alert("Ocurrió un error al leer el archivo. Revisa el formato.");
      } finally {
        setCargandoMasivo(false);
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  // --- ACCIONES DE LA VISTA PREVIA ---
  const actualizarPreValido = (idTemp: string, campo: string, valor: string) => {
    setPreValidos(prev => prev.map(p => p.idTemp === idTemp ? { ...p, [campo]: valor } : p));
  };
  const quitarPreValido = (idTemp: string) => {
    setPreValidos(prev => prev.filter(p => p.idTemp !== idTemp));
  };

  const guardarPrelistadoBD = async () => {
    if (preValidos.length === 0) return alert("No hay jugadores válidos para guardar.");
    setCargandoMasivo(true);
    try {
      const batch = writeBatch(db);
      preValidos.forEach(j => {
        const docRef = doc(db, "asociaciones/san_fabian/jugadores", j.rutLimpio);
        batch.set(docRef, { nombre: j.nombre.toUpperCase().trim(), rut: j.rutFormat, club: clubSeleccionado, serie: j.serie, partidosSuspendido: 0 });
      });
      await batch.commit();
      alert(`✅ ¡Éxito! ${preValidos.length} jugadores fueron guardados en la base de datos.`);
      setPreValidos([]);
      if (preDuplicados.length === 0) setModoIngreso("masivo");
    } catch (error) { alert("Error al guardar el lote de jugadores."); }
    setCargandoMasivo(false);
  };

  const forzarTraspasoDuplicado = async (dup: PreJugadorDuplicado) => {
    if (confirm(`¿Forzar el traspaso de ${dup.nombreDb} desde ${dup.clubActual} a tu club (${clubSeleccionado})?`)) {
      try {
        await setDoc(doc(db, "asociaciones/san_fabian/jugadores", dup.rutLimpio), {
          club: clubSeleccionado,
          serie: dup.serieCsv // Le actualizamos la serie a la nueva
        }, { merge: true }); // Merge actualiza sin borrar sus suspensiones
        
        // Lo sacamos de la lista de conflictos
        setPreDuplicados(prev => prev.filter(p => p.rutLimpio !== dup.rutLimpio));
        alert("🔄 Jugador traspasado con éxito.");
        if (preValidos.length === 0 && preDuplicados.length <= 1) setModoIngreso("masivo");
      } catch (error) { alert("Error al realizar el traspaso."); }
    }
  };

  // --- ELIMINACIONES GLOBALES ---
  const eliminarJugador = async (id: string, nombreJugador: string) => {
    if (confirm(`¿Eliminar definitivamente a ${nombreJugador} del registro?`)) await deleteDoc(doc(db, "asociaciones/san_fabian/jugadores", id));
  };

  const vaciarClub = async () => {
    if (rol !== 'admin') return;
    const jugadoresAEliminar = jugadores.filter(j => j.club === clubFiltro && (filtroSerie === "Todas" || j.serie === filtroSerie));
    if (jugadoresAEliminar.length === 0) return alert("No hay jugadores inscritos en esta selección.");

    const confirmacion = window.prompt(`⚠️ ZONA DE PELIGRO: Vas a eliminar a ${jugadoresAEliminar.length} jugadores. Escribe VACIAR para confirmar:`);
    if (confirmacion === "VACIAR") {
      setCargandoMasivo(true);
      try {
        const batch = writeBatch(db);
        jugadoresAEliminar.forEach(j => batch.delete(doc(db, "asociaciones/san_fabian/jugadores", j.id)));
        await batch.commit();
        alert(`🧹 Padrón vaciado con éxito.`);
      } catch (error) { alert("Error al intentar vaciar el padrón."); } finally { setCargandoMasivo(false); }
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

      {/* 🚨 ZONA DE VISTA PREVIA MASIVA (TOMA EL CONTROL DE LA PANTALLA SI ESTÁ ACTIVA) */}
      {modoIngreso === "previa" ? (
        <div className="bg-white p-6 md:p-10 rounded-3xl shadow-2xl border-4 border-[#1e3a8a] space-y-8 animate-in slide-in-from-bottom-8">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-2xl font-black text-[#1e3a8a]">Mesa de Trabajo: Revisión de CSV</h2>
              <p className="text-sm font-bold text-slate-500">Revisa y corrige los datos antes de inyectarlos a la base de datos oficial.</p>
            </div>
            <button onClick={() => { setModoIngreso("masivo"); setPreValidos([]); setPreDuplicados([]); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs transition">Cancelar Subida</button>
          </div>

          {/* TABLA 1: JUGADORES VÁLIDOS (EDITABLES) */}
          <div className="space-y-4">
            <h3 className="font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2"><span className="bg-emerald-100 p-2 rounded-lg">✅</span> Jugadores Nuevos Listos ({preValidos.length})</h3>
            {preValidos.length === 0 ? <p className="text-slate-400 italic text-sm">No se encontraron jugadores nuevos válidos en el archivo.</p> : (
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 sticky top-0 shadow-sm z-10"><tr className="text-[10px] text-slate-500 uppercase tracking-widest"><th className="p-3">RUT</th><th className="p-3">Nombre</th><th className="p-3">Serie Asignada</th><th className="p-3 text-center">Acción</th></tr></thead>
                    <tbody className="divide-y divide-slate-200">
                      {preValidos.map(j => (
                        <tr key={j.idTemp} className="hover:bg-white transition">
                          <td className="p-2"><input type="text" value={j.rutFormat} readOnly className="w-full bg-transparent font-mono text-xs text-slate-500 outline-none" /></td>
                          <td className="p-2"><input type="text" value={j.nombre} onChange={e => actualizarPreValido(j.idTemp, 'nombre', e.target.value)} className="w-full p-2 border border-slate-200 rounded font-bold text-xs uppercase focus:border-emerald-500 outline-none" /></td>
                          <td className="p-2"><select value={j.serie} onChange={e => actualizarPreValido(j.idTemp, 'serie', e.target.value)} className="w-full p-2 border border-slate-200 rounded font-bold text-xs outline-none"><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select></td>
                          <td className="p-2 text-center"><button onClick={() => quitarPreValido(j.idTemp)} className="text-slate-400 hover:text-red-500 p-2">✖</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preValidos.length > 0 && (
                  <div className="p-4 bg-white border-t border-slate-200">
                    <button onClick={guardarPrelistadoBD} disabled={cargandoMasivo} className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition disabled:opacity-50">
                      {cargandoMasivo ? "Guardando en BD..." : "💾 Guardar Nuevos Jugadores en la Base de Datos"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TABLA 2: CONFLICTOS Y DUPLICADOS */}
          {preDuplicados.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-dashed border-slate-200">
              <h3 className="font-black text-orange-600 uppercase tracking-widest flex items-center gap-2"><span className="bg-orange-100 p-2 rounded-lg">⚠️</span> Conflictos Detectados ({preDuplicados.length})</h3>
              <p className="text-xs font-bold text-slate-500">Estos RUTs ya existen en la base de datos. Puedes ignorarlos o forzar su traspaso a tu club.</p>
              
              <div className="bg-white rounded-xl border-2 border-orange-200 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-orange-50 sticky top-0 shadow-sm z-10"><tr className="text-[10px] text-orange-800 uppercase tracking-widest"><th className="p-3">Jugador / RUT</th><th className="p-3">Estado Actual</th><th className="p-3 text-right">Resolución</th></tr></thead>
                    <tbody className="divide-y divide-orange-100">
                      {preDuplicados.map(dup => (
                        <tr key={dup.rutLimpio} className="hover:bg-orange-50/50 transition">
                          <td className="p-3"><p className="font-black text-slate-800 text-xs uppercase">{dup.nombreDb}</p><p className="font-mono text-[10px] text-slate-500">{dup.rutFormat}</p></td>
                          <td className="p-3"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-black uppercase">Inscrito en {dup.clubActual}</span></td>
                          <td className="p-3 text-right">
                            {dup.clubActual === clubSeleccionado ? (
                              <span className="text-[10px] font-bold text-emerald-600">Ya está en tu club</span>
                            ) : (
                              <button onClick={() => forzarTraspasoDuplicado(dup)} className="bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition shadow-sm">
                                🔄 Forzar Traspaso
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 🚨 LA INTERFAZ NORMAL SI NO ESTAMOS EN VISTA PREVIA */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
              <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2 border-b pb-4"><span className="bg-blue-100 text-[#1e3a8a] w-8 h-8 rounded-full flex items-center justify-center text-sm">➕</span> Inscribir Jugadores</h3>
              
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button onClick={() => setModoIngreso("manual")} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition ${modoIngreso === "manual" ? "bg-white text-[#1e3a8a] shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Manual</button>
                <button onClick={() => setModoIngreso("masivo")} className={`flex-1 py-2 text-[10px] md:text-xs font-black uppercase tracking-widest rounded-lg transition ${modoIngreso === "masivo" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"}`}>Masivo (CSV)</button>
              </div>

              {rol === 'admin' && (
                <div className="mb-4"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Trabajar con Club:</label><select value={clubSeleccionado} onChange={e => setClubSeleccionado(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none text-[#1e3a8a]">{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select></div>
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
                    <p className="text-xs text-emerald-800 font-medium mb-3">Sube toda la nómina y revisa los datos antes de guardarlos.</p>
                    <button onClick={descargarPlantillaCSV} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition">📥 Descargar Plantilla CSV</button>
                  </div>
                  
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition relative">
                    <input type="file" accept=".csv" onChange={procesarArchivoCSV} disabled={cargandoMasivo} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                    <div className="pointer-events-none space-y-2">
                      <span className="text-3xl">📄</span>
                      <p className="font-bold text-sm text-[#1e3a8a]">{cargandoMasivo ? "Procesando..." : "Subir Archivo CSV"}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Se abrirá el editor de prelistado</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full md:w-auto">
                 <span className="text-[10px] font-black text-slate-400 uppercase shrink-0">Filtrar Padrón:</span>
                 <select value={filtroSerie} onChange={e => setFiltroSerie(e.target.value)} className="w-full md:w-auto bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-sm outline-none"><option value="Todas">Todas las Series</option><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select>
              </div>
              
              {rol === 'admin' && (
                <button onClick={vaciarClub} disabled={cargandoMasivo} className="w-full md:w-auto bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition disabled:opacity-50">
                  {cargandoMasivo ? 'Procesando...' : '🗑️ Vaciar Selección'}
                </button>
              )}
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
      )}
    </div>
  );
}