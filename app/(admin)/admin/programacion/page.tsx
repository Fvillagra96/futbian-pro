'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Club { id?: string; nombre: string; series?: string[]; }
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; cancha: string; dia: string; hora: string; estado: string; }
interface Encuentro { local: string; visita: string; }

export default function ModuloProgramacion() {
  const { cargando: authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [clubes, setClubes] = useState<Club[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  const [fechaNumero, setFechaNumero] = useState<number>(1);
  
  const [encuentros, setEncuentros] = useState<Encuentro[]>([
    { local: "", visita: "" },
    { local: "", visita: "" },
    { local: "", visita: "" },
    { local: "", visita: "" }
  ]);
  
  const [cancha, setCancha] = useState<string>("");
  const [dia, setDia] = useState<string>("");
  const [hora, setHora] = useState<string>("");

  useEffect(() => {
    if (authCargando) return;

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[];
      const ordenados = data.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(ordenados);
      
      if (ordenados.length > 1) { 
        setEncuentros(prev => {
          const nuevos = [...prev];
          nuevos[0] = { local: ordenados[0].nombre, visita: ordenados[1].nombre };
          return nuevos;
        });
      }
    });

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      data.sort((a, b) => b.fechaNumero - a.fechaNumero || (a.hora || "").localeCompare(b.hora || ""));
      setPartidos(data);
      setCargandoDatos(false);
    });

    return () => { unsubC(); unsubP(); };
  }, [authCargando]);

  const partidosPorFecha = useMemo(() => {
    const grupos: Record<number, Partido[]> = {};
    partidos.forEach(p => { if (!grupos[p.fechaNumero]) grupos[p.fechaNumero] = []; grupos[p.fechaNumero].push(p); });
    return grupos;
  }, [partidos]);

  const actualizarEncuentro = (index: number, campo: keyof Encuentro, valor: string) => {
    const nuevosEncuentros = [...encuentros];
    nuevosEncuentros[index][campo] = valor;
    setEncuentros(nuevosEncuentros);
  };

  const programarJornadaMasiva = async (e: React.FormEvent) => {
    e.preventDefault();
    const encuentrosValidos = encuentros.filter(enc => enc.local !== "" && enc.visita !== "");

    if (encuentrosValidos.length === 0) {
      return alert("Debes configurar al menos un enfrentamiento con Local y Visita.");
    }

    try {
      const batch = writeBatch(db);
      let creados = 0;
      let resumen: string[] = [];

      for (const enc of encuentrosValidos) {
        if (enc.local === enc.visita) {
          return alert(`⚠️ Error: El equipo ${enc.local} no puede jugar contra sí mismo.`);
        }

        const clubLocalObj = clubes.find(c => c.nombre === enc.local);
        const clubVisitaObj = clubes.find(c => c.nombre === enc.visita);

        if (!clubLocalObj || !clubVisitaObj) continue;

        const seriesLocal = clubLocalObj.series || [];
        const seriesVisita = clubVisitaObj.series || [];
        const seriesEnComun = seriesLocal.filter(s => seriesVisita.includes(s));

        if (seriesEnComun.length === 0) {
          return alert(`⚠️ IMPOSIBLE PROGRAMAR: ${enc.local} vs ${enc.visita} no tienen ninguna serie en común inscrita.`);
        }

        seriesEnComun.forEach(serieMatch => {
          const idPartidoFormateado = `${fechaNumero}_${serieMatch}_${enc.local}_${enc.visita}`.replace(/\s+/g, '_').toLowerCase();
          const docRef = doc(db, "asociaciones/san_fabian/partidos", idPartidoFormateado);

          batch.set(docRef, {
            fechaNumero: Number(fechaNumero), 
            local: enc.local, 
            visita: enc.visita, 
            serie: serieMatch, 
            cancha: cancha || "Por definir", 
            dia: dia || "Por definir", 
            hora: hora || "Por definir", 
            estado: "Programado", 
            golesLocal: 0, 
            golesVisita: 0, 
            eventos: [], 
            nomina: []
          });
          creados++;
        });

        resumen.push(`- ${enc.local} vs ${enc.visita} (${seriesEnComun.length} partidos)`);
      }

      await batch.commit();
      
      alert(`✅ ¡JORNADA CREADA CON ÉXITO!\n\nSe generaron ${creados} partidos en total para los siguientes enfrentamientos:\n${resumen.join("\n")}`);
      
      setEncuentros([
        { local: "", visita: "" },
        { local: "", visita: "" },
        { local: "", visita: "" },
        { local: "", visita: "" }
      ]);

    } catch (error) { 
      alert("Error al programar la jornada."); 
      console.error(error);
    }
  };

  const eliminarProgramacion = async (id: string, estado: string) => {
    if (estado === "Finalizado") {
      if (!confirm("⚠️ ZONA DE PELIGRO: Este partido ya tiene un acta cerrada. ¿Estás absolutamente seguro de ELIMINARLO por completo?")) return;
    } else {
      if (!confirm("¿Estás seguro de eliminar este partido de la programación?")) return;
    }
    await deleteDoc(doc(db, "asociaciones/san_fabian/partidos", id));
  };

  const reabrirActa = async (id: string) => {
    if (confirm("🔄 ¿Estás seguro de REABRIR esta acta? Se borrarán todos los goles y la nómina oficial, y volverá a la Mesa de Turno.")) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/partidos", id), {
          estado: "Programado",
          golesLocal: 0,
          golesVisita: 0,
          eventos: [],
          nomina: [],
          respaldoActa: ""
        });
        alert("✅ Acta reiniciada con éxito.");
      } catch (error) { alert("Error al reabrir el acta."); }
    }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando módulo...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER DE LA PÁGINA */}
      <header className="bg-gradient-to-r from-[#1e3a8a] to-blue-800 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-blue-300 font-black uppercase tracking-[0.2em] text-xs mb-2">Organización del Campeonato</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">FIXTURE Y FECHAS</h1>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm">
            <p className="text-sm font-bold text-white flex items-center gap-2"><span>🛡️</span> Modo Admin</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] select-none pointer-events-none">📅</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 sticky top-24">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="bg-[#1e3a8a] text-white w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-sm">⚔️</span>
              Programar Jornada
            </h3>
            
            <form onSubmit={programarJornadaMasiva} className="space-y-6">
              
              {/* NÚMERO DE FECHA */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Número de Fecha</label>
                <input type="number" min="1" value={fechaNumero} onChange={e => setFechaNumero(Number(e.target.value))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-[#1e3a8a] text-3xl outline-none focus:ring-2 focus:ring-[#1e3a8a] transition shadow-inner" required />
              </div>

              {/* LISTA DE ENCUENTROS (Sin Scroll) */}
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Enfrentamientos</label>
                
                {encuentros.map((enc, index) => (
                  <div key={index} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm relative transition-all hover:border-[#1e3a8a]/30">
                    {/* Badge del número de partido */}
                    <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-black px-3 py-1 rounded-br-xl rounded-tl-2xl shadow-sm">
                      Partido {index + 1}
                    </div>

                    <div className="mt-5 space-y-2">
                      {/* Select Local */}
                      <select value={enc.local} onChange={e => actualizarEncuentro(index, "local", e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none shadow-sm text-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a] transition-all cursor-pointer">
                        <option value="">-- Seleccionar Local --</option>
                        {clubes.map(c => <option key={`L-${index}-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}
                      </select>

                      {/* Pill VS */}
                      <div className="flex justify-center items-center">
                        <span className="bg-slate-200 text-slate-500 text-[9px] font-black px-3 py-1 rounded-full italic uppercase tracking-widest">
                          VS
                        </span>
                      </div>

                      {/* Select Visita */}
                      <select value={enc.visita} onChange={e => actualizarEncuentro(index, "visita", e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none shadow-sm text-emerald-700 focus:ring-2 focus:ring-emerald-600 transition-all cursor-pointer">
                        <option value="">-- Seleccionar Visita --</option>
                        {clubes.map(c => <option key={`V-${index}-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* INFORMACIÓN GENERAL */}
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Información General (Opcional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={dia} onChange={e => setDia(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-600 focus:ring-2 focus:ring-[#1e3a8a]" title="Día a jugarse" />
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-600 focus:ring-2 focus:ring-[#1e3a8a]" title="Hora de inicio (Aprox)" />
                </div>
                <input type="text" placeholder="Recinto (Ej: Estadio Municipal)" value={cancha} onChange={e => setCancha(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none text-slate-600 focus:ring-2 focus:ring-[#1e3a8a]" />
              </div>

              {/* BOTÓN SUBMIT */}
              <button type="submit" className="w-full py-4 bg-[#1e3a8a] text-white rounded-2xl font-black shadow-lg shadow-blue-900/20 hover:bg-blue-800 hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs mt-4 flex flex-col items-center gap-1 group">
                <span>Generar Jornada Múltiple</span>
                <span className="text-[9px] font-bold text-blue-300 lowercase tracking-normal group-hover:text-blue-200 transition-colors">procesando todos los partidos...</span>
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: LISTADO DE PARTIDOS */}
        <div className="lg:col-span-8 space-y-6">
          {Object.keys(partidosPorFecha).length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm h-[600px] flex flex-col justify-center items-center text-slate-400">
              <span className="text-6xl mb-6 grayscale opacity-50">🏟️</span>
              <p className="font-black text-slate-500 text-lg">No hay partidos programados aún.</p>
              <p className="text-sm mt-2 text-slate-400">Configura la jornada en el panel izquierdo.</p>
            </div>
          ) : (
            Object.entries(partidosPorFecha).sort(([a], [b]) => Number(b) - Number(a)).map(([numFecha, partidosFecha]) => (
              <div key={numFecha} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
                  <h2 className="font-black text-xl tracking-widest uppercase">FECHA {numFecha}</h2>
                  <span className="bg-white/20 px-4 py-1.5 rounded-xl text-xs font-bold backdrop-blur-sm">{partidosFecha.length} Partidos</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {partidosFecha.map(p => (
                    <div key={p.id} className="p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-50 transition relative group">
                      
                      {/* Info Partido */}
                      <div className="flex flex-col items-center md:items-start w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{p.dia}</span>
                        <span className="text-2xl font-black text-[#1e3a8a] my-1">{p.hora || "--:--"}</span>
                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 truncate max-w-full">
                          <span className="text-blue-500">📍</span> {p.cancha}
                        </span>
                      </div>
                      
                      {/* Equipos */}
                      <div className="flex-1 w-full">
                        <div className="flex justify-center items-center mb-3">
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest shadow-sm">
                            SERIE {p.serie}
                          </span>
                        </div>
                        <div className="flex items-center justify-between font-black text-base md:text-lg">
                          <span className="flex-1 text-right truncate text-slate-800">{p.local}</span>
                          <span className="px-5 text-slate-300 font-bold italic text-sm">VS</span>
                          <span className="flex-1 text-left truncate text-slate-800">{p.visita}</span>
                        </div>
                      </div>
                      
                      {/* Acciones & Estado */}
                      <div className="w-full md:w-36 shrink-0 flex flex-row md:flex-col items-center justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                        {p.estado === "Programado" && <span className="bg-slate-100 text-slate-600 text-[10px] px-3 py-1.5 rounded-lg font-bold w-full text-center uppercase tracking-wider">⏳ Programado</span>}
                        {p.estado === "En Juego" && <span className="bg-orange-100 text-orange-600 text-[10px] px-3 py-1.5 rounded-lg font-bold w-full text-center uppercase tracking-wider animate-pulse">🔥 En Juego</span>}
                        {p.estado === "Finalizado" && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-lg font-bold w-full text-center uppercase tracking-wider">✅ Finalizado</span>}
                        
                        <div className="flex md:flex-col gap-2 w-full mt-1">
                          <button onClick={() => eliminarProgramacion(p.id, p.estado)} className="text-[11px] bg-red-50 text-red-500 border border-red-100 w-full py-2 rounded-xl hover:bg-red-500 hover:text-white font-bold transition-all">Eliminar</button>
                          {p.estado === "Finalizado" && (
                            <button onClick={() => reabrirActa(p.id)} className="text-[11px] bg-amber-50 text-amber-600 border border-amber-100 w-full py-2 rounded-xl hover:bg-amber-500 hover:text-white font-bold transition-all">Reabrir Acta</button>
                          )}
                        </div>
                      </div>
                      
                      {/* ID Oculto */}
                      <span className="absolute top-2 left-2 text-[8px] text-slate-300 font-mono hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">ID: {p.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}