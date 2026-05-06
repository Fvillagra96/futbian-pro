'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Club { nombre: string; }
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; cancha: string; dia: string; hora: string; estado: string; }

export default function ModuloProgramacion() {
  const { cargando: authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [clubes, setClubes] = useState<Club[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  const [fechaNumero, setFechaNumero] = useState<number>(1);
  const [local, setLocal] = useState<string>("");
  const [visita, setVisita] = useState<string>("");
  const [serie, setSerie] = useState<string>("Honor");
  const [cancha, setCancha] = useState<string>("Estadio Municipal");
  const [dia, setDia] = useState<string>("");
  const [hora, setHora] = useState<string>("10:00");

  useEffect(() => {
    if (authCargando) return;

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => d.data() as Club).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(data);
      if (data.length > 1) { setLocal(data[0].nombre); setVisita(data[1].nombre); }
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

  const programarPartido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (local === visita) return alert("El equipo local y visita no pueden ser el mismo.");
    if (!dia) return alert("Debes seleccionar un día para el partido.");
    
    // 🚨 AQUÍ ESTÁ LA MEJORA: Formateamos el ID exacto fecha+serie+local+visita
    const idPartidoFormateado = `${fechaNumero}_${serie}_${local}_${visita}`.replace(/\s+/g, '_').toLowerCase();

    try {
      // Usamos setDoc con el ID formateado para evitar duplicados en la base de datos
      await setDoc(doc(db, "asociaciones/san_fabian/partidos", idPartidoFormateado), {
        fechaNumero: Number(fechaNumero), local, visita, serie, cancha, dia, hora, estado: "Programado", golesLocal: 0, golesVisita: 0, eventos: [], nomina: []
      });
      alert("✅ Partido programado con éxito.");
    } catch (error) { alert("Error al programar el partido."); }
  };

  const eliminarProgramacion = async (id: string, estado: string) => {
    if (estado === "Finalizado") {
      if (!confirm("⚠️ ZONA DE PELIGRO: Este partido ya tiene un acta cerrada. ¿Estás absolutamente seguro de ELIMINARLO por completo del sistema? (Se borrará el fixture también).")) return;
    } else {
      if (!confirm("¿Estás seguro de eliminar este partido de la programación?")) return;
    }
    await deleteDoc(doc(db, "asociaciones/san_fabian/partidos", id));
  };

  const reabrirActa = async (id: string) => {
    if (confirm("🔄 ¿Estás seguro de REABRIR esta acta? Se borrarán todos los goles, tarjetas y la nómina oficial, y el partido volverá a la Mesa de Turno para ingresarlo desde cero.")) {
      try {
        await updateDoc(doc(db, "asociaciones/san_fabian/partidos", id), {
          estado: "Programado",
          golesLocal: 0,
          golesVisita: 0,
          eventos: [],
          nomina: [],
          respaldoActa: ""
        });
        alert("✅ Acta reiniciada con éxito. Ya está disponible nuevamente en la Mesa de Turno.");
      } catch (error) {
        alert("Error al reabrir el acta.");
      }
    }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando módulo...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      <header className="bg-[#1e3a8a] rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
          <div><h2 className="text-blue-300 font-black uppercase tracking-[0.2em] text-xs mb-2">Organización del Campeonato</h2><h1 className="text-3xl md:text-5xl font-black tracking-tighter">FIXTURE Y FECHAS</h1></div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm"><p className="text-sm font-bold text-white">Modo Admin</p></div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px]">📅</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">➕</span>Programar Encuentro</h3>
            <form onSubmit={programarPartido} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nº Fecha</label><input type="number" min="1" value={fechaNumero} onChange={e => setFechaNumero(Number(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-center text-[#1e3a8a] text-xl outline-none" required /></div>
                <div className="flex-[2]"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Serie</label><select value={serie} onChange={e => setSerie(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none"><option value="Honor">Honor</option><option value="Segunda">Segunda</option><option value="Juvenil">Juvenil</option><option value="Senior 35">Senior 35</option><option value="Senior 40">Senior 40</option><option value="Damas">Damas</option></select></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div><label className="block text-[10px] font-black text-blue-600 uppercase mb-1">Equipo Local</label><select value={local} onChange={e => setLocal(e.target.value)} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-sm outline-none">{clubes.map(c => <option key={`L-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}</select></div>
                <div className="text-center font-black text-slate-300 text-xs italic">VS</div>
                <div><label className="block text-[10px] font-black text-emerald-600 uppercase mb-1">Equipo Visita</label><select value={visita} onChange={e => setVisita(e.target.value)} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-sm outline-none">{clubes.map(c => <option key={`V-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Día</label><input type="date" value={dia} onChange={e => setDia(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs outline-none" required /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Hora</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs outline-none" required /></div>
              </div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Recinto Deportivo</label><input type="text" placeholder="Ej: Estadio Municipal" value={cancha} onChange={e => setCancha(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none" required /></div>
              <button type="submit" className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg hover:bg-blue-800 transition uppercase tracking-widest text-xs mt-4">Guardar Programación</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {Object.keys(partidosPorFecha).length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 h-[400px] flex flex-col justify-center items-center text-slate-400"><span className="text-5xl mb-4">🏟️</span><p className="font-bold">No hay partidos programados aún.</p></div>
          ) : (
            Object.entries(partidosPorFecha).sort(([a], [b]) => Number(b) - Number(a)).map(([numFecha, partidosFecha]) => (
              <div key={numFecha} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><h2 className="font-black text-lg tracking-widest uppercase">FECHA {numFecha}</h2><span className="bg-white/20 px-3 py-1 rounded-lg text-xs font-bold">{partidosFecha.length} Partidos</span></div>
                <div className="divide-y divide-slate-100">
                  {partidosFecha.map(p => (
                    <div key={p.id} className="p-4 flex flex-col md:flex-row items-center gap-4 hover:bg-slate-50 transition relative">
                      <div className="flex flex-col items-center md:items-start w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-4"><span className="text-[10px] font-black text-slate-400 uppercase">{p.dia}</span><span className="text-lg font-black text-[#1e3a8a]">{p.hora || "Por definir"}</span><span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-1 truncate max-w-full">📍 {p.cancha}</span></div>
                      <div className="flex-1 w-full"><div className="flex justify-center items-center gap-2 mb-1"><span className="bg-blue-100 text-blue-800 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest">SERIE {p.serie}</span></div><div className="flex items-center justify-between font-black text-sm md:text-base"><span className="flex-1 text-right truncate text-slate-700">{p.local}</span><span className="px-4 text-slate-300 font-light italic">VS</span><span className="flex-1 text-left truncate text-slate-700">{p.visita}</span></div></div>
                      
                      <div className="w-full md:w-32 shrink-0 flex flex-row md:flex-col items-center justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
                        {p.estado === "Programado" && <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-1 rounded font-bold w-full text-center">⏳ Programado</span>}
                        {p.estado === "En Juego" && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-1 rounded font-bold w-full text-center animate-pulse">🔥 En Juego</span>}
                        {p.estado === "Finalizado" && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-1 rounded font-bold w-full text-center">✅ Finalizado</span>}
                        
                        <div className="flex md:flex-col gap-2 mt-2 w-full">
                          <button onClick={() => eliminarProgramacion(p.id, p.estado)} className="text-[10px] bg-red-50 text-red-500 w-full py-1.5 rounded-lg hover:bg-red-500 hover:text-white font-bold transition">Eliminar</button>
                          {p.estado === "Finalizado" && (
                            <button onClick={() => reabrirActa(p.id)} className="text-[10px] bg-amber-50 text-amber-600 w-full py-1.5 rounded-lg hover:bg-amber-500 hover:text-white font-bold transition">Reabrir Acta</button>
                          )}
                        </div>
                      </div>
                      
                      <span className="absolute top-2 left-2 text-[7px] text-slate-300 font-mono hidden md:block">ID: {p.id}</span>
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