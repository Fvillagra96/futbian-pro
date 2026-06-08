'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Club { id?: string; nombre: string; series?: string[]; }
interface Partido { id: string; fechaNumero: number; local: string; visita: string; serie: string; cancha: string; dia: string; hora: string; estado: string; }
interface Encuentro { local: string; visita: string; }

export default function ModuloProgramacion() {
  const { cargando: authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  
  const [clubes, setClubes] = useState<Club[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  const [fechaNumero, setFechaNumero] = useState<number>(1);
  const [encuentros, setEncuentros] = useState<Encuentro[]>([
    { local: "", visita: "" }, { local: "", visita: "" },
    { local: "", visita: "" }, { local: "", visita: "" }
  ]);
  
  const [cancha, setCancha] = useState<string>("");
  const [dia, setDia] = useState<string>("");
  const [hora, setHora] = useState<string>("");

  useEffect(() => {
    if (authCargando) return;

    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[];
      setClubes(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
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

  // 🚨 EL NUEVO MOTOR DE SINCRONIZACIÓN MASIVA
  // Si agregaste una serie a un club, este botón revisa los VS existentes en el fixture 
  // y autogenera los partidos de la nueva serie para todas las fechas que falten.
  const sincronizarSeriesModificadas = async () => {
    if (partidos.length === 0) return alert("No hay partidos programados para sincronizar.");
    
    if (!confirm("🔄 ¿Deseas escanear el fixture completo? El sistema detectará si los clubes tienen nuevas series inscritas y creará automáticamente los partidos faltantes en todas las fechas.")) return;
    
    setSincronizando(true);
    try {
      const batch = writeBatch(db);
      let partidosNuevosCreados = 0;
      const seriesDetectadasPorPareja: Record<string, string[]> = {};

      // 1. Identificar qué combinaciones únicas de Local vs Visita existen en cada Fecha del fixture actual
      // Guardaremos una llave única tipo "fecha_local_visita"
      const jornadasExistentes = new Map<string, { fecha: number, local: string, visita: string, cancha: string, dia: string, hora: string }>();

      partidos.forEach(p => {
        const llaveJornada = `${p.fechaNumero}_${p.local}_${p.visita}`;
        if (!jornadasExistentes.has(llaveJornada)) {
          jornadasExistentes.set(llaveJornada, {
            fecha: p.fechaNumero,
            local: p.local,
            visita: p.visita,
            cancha: p.cancha,
            dia: p.dia,
            hora: p.hora
          });
        }
      });

      // 2. Iterar sobre esas jornadas y comprobar si les faltan partidos basados en el padrón de series actual
      jornadasExistentes.forEach((datos, llave) => {
        const clubLocalObj = clubes.find(c => c.nombre === datos.local);
        const clubVisitaObj = clubes.find(c => c.nombre === datos.visita);

        if (!clubLocalObj || !clubVisitaObj) return;

        const seriesLocal = clubLocalObj.series || [];
        const seriesVisita = clubVisitaObj.series || [];
        
        // Sacamos el match de series actualizado (con la nueva serie añadida)
        const seriesEnComunActualizadas = seriesLocal.filter(s => seriesVisita.includes(s));

        seriesEnComunActualizadas.forEach(serie => {
          // Construimos el ID que debería tener
          const idPartidoDeberiaExistir = `${datos.fecha}_${serie}_${datos.local}_${datos.visita}`.replace(/\s+/g, '_').toLowerCase();
          
          // Verificamos si ya existe físicamente en nuestro estado de partidos
          const yaExiste = partidos.some(p => p.id === idPartidoDeberiaExistir);

          if (!yaExiste) {
            // Si no existe, preparamos su creación masiva heredando la cancha, día y hora de la jornada
            const docRef = doc(db, "asociaciones/san_fabian/partidos", idPartidoDeberiaExistir);
            batch.set(docRef, {
              fechaNumero: datos.fecha,
              local: datos.local,
              visita: datos.visita,
              serie: serie,
              cancha: datos.cancha || "Por definir",
              dia: datos.dia || "Por definir",
              hora: datos.hora || "Por definir",
              estado: "Programado",
              golesLocal: 0,
              golesVisita: 0,
              eventos: [],
              nomina: []
            });
            partidosNuevosCreados++;
            if (!seriesDetectadasPorPareja[llave]) seriesDetectadasPorPareja[llave] = [];
            seriesDetectadasPorPareja[llave].push(serie);
          }
        });
      });

      if (partidosNuevosCreados > 0) {
        await batch.commit();
        alert(`✅ Sincronización Exitosa.\nSe detectaron nuevas series en común y se añadieron ${partidosNuevosCreados} partidos nuevos al fixture automáticamente.`);
      } else {
        alert("ℹ️ El fixture ya está perfectamente sincronizado con las series actuales de todos los clubes.");
      }
    } catch (error) {
      console.error(error);
      alert("Hubo un error al sincronizar las series.");
    } finally {
      setSincronizando(false);
    }
  };

  const actualizarEncuentro = (index: number, campo: keyof Encuentro, valor: string) => {
    const nuevosEncuentros = [...encuentros];
    nuevosEncuentros[index][campo] = valor;
    setEncuentros(nuevosEncuentros);
  };

  const programarJornadaMasiva = async (e: React.FormEvent) => {
    e.preventDefault();
    const encuentrosValidos = encuentros.filter(enc => enc.local !== "" && enc.visita !== "");
    if (encuentrosValidos.length === 0) return alert("Debes configurar al menos un enfrentamiento.");

    try {
      const batch = writeBatch(db);
      let creados = 0;

      for (const enc of encuentrosValidos) {
        if (enc.local === enc.visita) return alert(`⚠️ Error: ${enc.local} no puede jugar contra sí mismo.`);
        const clubLocalObj = clubes.find(c => c.nombre === enc.local);
        const clubVisitaObj = clubes.find(c => c.nombre === enc.visita);
        if (!clubLocalObj || !clubVisitaObj) continue;

        const seriesEnComun = (clubLocalObj.series || []).filter(s => (clubVisitaObj.series || []).includes(s));

        seriesEnComun.forEach(serieMatch => {
          const idPartidoFormateado = `${fechaNumero}_${serieMatch}_${enc.local}_${enc.visita}`.replace(/\s+/g, '_').toLowerCase();
          const docRef = doc(db, "asociaciones/san_fabian/partidos", idPartidoFormateado);
          batch.set(docRef, {
            fechaNumero: Number(fechaNumero), local: enc.local, visita: enc.visita, serie: serieMatch,
            cancha: cancha || "Por definir", dia: dia || "Por definir", hora: hora || "Por definir",
            estado: "Programado", golesLocal: 0, golesVisita: 0, eventos: [], nomina: []
          });
          creados++;
        });
      }
      await batch.commit();
      alert(`✅ ¡JORNADA CREADA CON ÉXITO! Se generaron ${creados} partidos.`);
      setEncuentros([{ local: "", visita: "" }, { local: "", visita: "" }, { local: "", visita: "" }, { local: "", visita: "" }]);
    } catch (error) { console.error(error); }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando módulo...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 pb-20">
      <header className="bg-gradient-to-r from-[#1e3a8a] to-blue-800 rounded-3xl p-6 shadow-xl text-white">
        <h1 className="text-3xl font-black tracking-tighter">FIXTURE Y FECHAS</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* PANEL IZQUIERDO */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 sticky top-24 space-y-6">
            <h3 className="font-black text-slate-800 flex items-center gap-3 border-b pb-4">🔧 Panel de Control</h3>
            <form onSubmit={programarJornadaMasiva} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Número de Fecha</label>
                <input type="number" min="1" value={fechaNumero} onChange={e => setFechaNumero(Number(e.target.value))} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-center text-[#1e3a8a] text-3xl outline-none" required />
              </div>

              {encuentros.map((enc, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 p-4 rounded-2xl relative">
                  <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-black px-3 py-1 rounded-br-xl rounded-tl-2xl">Partido {index + 1}</div>
                  <div className="mt-5 space-y-2">
                    <select value={enc.local} onChange={e => actualizarEncuentro(index, "local", e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-[#1e3a8a] outline-none">
                      <option value="">-- Seleccionar Local --</option>
                      {clubes.map(c => <option key={`L-${index}-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                    <div className="text-center text-[9px] font-black text-slate-400">VS</div>
                    <select value={enc.visita} onChange={e => actualizarEncuentro(index, "visita", e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-emerald-700 outline-none">
                      <option value="">-- Seleccionar Visita --</option>
                      {clubes.map(c => <option key={`V-${index}-${c.nombre}`} value={c.nombre}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={dia} onChange={e => setDia(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" />
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" />
                </div>
                <input type="text" placeholder="Recinto (Ej: Estadio Municipal)" value={cancha} onChange={e => setCancha(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" />
              </div>

              <button type="submit" className="w-full py-4 bg-[#1e3a8a] text-white rounded-2xl font-black shadow-lg text-xs uppercase tracking-widest">Generar Jornada Múltiple</button>
            </form>
            
            {/* 🚨 BOTÓN DE ENLACE DE ACCIÓN MASIVA */}
            <div className="pt-4 border-t border-slate-100">
              <button 
                type="button" 
                disabled={sincronizando}
                onClick={sincronizarSeriesModificadas} 
                className={`w-full py-3 ${sincronizando ? 'bg-slate-400' : 'bg-amber-500 hover:bg-amber-600'} text-white rounded-2xl font-black shadow-md text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2`}
              >
                {sincronizando ? "Sincronizando..." : "🔄 Sincronizar Series en Fixture"}
              </button>
              <p className="text-[10px] text-slate-400 mt-2 text-center">Usa este botón si agregaste una nueva serie a algún club para crear los partidos que faltan en las fechas ya programadas.</p>
            </div>
          </div>
        </div>

        {/* PANEL DERECHO */}
        <div className="lg:col-span-8 space-y-6">
          {Object.keys(partidosPorFecha).length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-100 p-20 text-center text-slate-400">No hay partidos programados aún.</div>
          ) : (
            Object.entries(partidosPorFecha).sort(([a], [b]) => Number(b) - Number(a)).map(([numFecha, partidosFecha]) => (
              <div key={numFecha} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-slate-800 text-white p-5 flex justify-between items-center">
                  <h2 className="font-black text-xl uppercase">FECHA {numFecha}</h2>
                  <span className="bg-white/20 px-4 py-1.5 rounded-xl text-xs font-bold">{partidosFecha.length} Partidos</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {partidosFecha.map(p => (
                    <div key={p.id} className="p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-50 transition">
                      <div className="flex flex-col items-center md:items-start w-full md:w-48 shrink-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase">{p.dia}</span>
                        <span className="text-2xl font-black text-[#1e3a8a] my-1">{p.hora || "--:--"}</span>
                        <span className="text-[11px] font-bold text-slate-500 truncate max-w-full">📍 {p.cancha}</span>
                      </div>
                      <div className="flex-1 w-full text-center md:text-left">
                        <div className="flex justify-center items-center mb-2">
                          <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[10px] px-3 py-1 rounded-lg font-black uppercase">SERIE {p.serie}</span>
                        </div>
                        <div className="flex items-center justify-between font-black text-base md:text-lg px-4">
                          <span className="flex-1 text-right truncate text-slate-800">{p.local}</span>
                          <span className="px-5 text-slate-300 font-bold italic text-sm">VS</span>
                          <span className="flex-1 text-left truncate text-slate-800">{p.visita}</span>
                        </div>
                      </div>
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