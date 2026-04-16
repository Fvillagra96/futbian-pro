'use client'
import { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Partido { 
  id: string; 
  fechaNumero: number; 
  local: string; 
  visita: string; 
  serie: string; 
  cancha: string; 
  dia: string; 
  hora: string; 
  estado: string; 
  golesLocal?: number;
  golesVisita?: number;
}

export default function VerFechasClub() {
  const [miClub, setMiClub] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [filtroFecha, setFiltroFecha] = useState<string>("Todas");

  useEffect(() => {
    // 1. Identificar el club del usuario logueado
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) {
          setMiClub(docSnap.data().club);
        }
      }
    });

    // 2. Escuchar la programación en tiempo real
    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc"), orderBy("hora")), (snap) => {
      setPartidos(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[]);
      setCargando(false);
    });

    return () => { unsubAuth(); unsubP(); };
  }, []);

  // Obtener lista de números de fechas disponibles para el filtro
  const numerosDeFechas = useMemo(() => {
    return Array.from(new Set(partidos.map(p => p.fechaNumero))).sort((a, b) => b - a);
  }, [partidos]);

  // Filtrar partidos
  const partidosFiltrados = useMemo(() => {
    return partidos.filter(p => {
      const coincideFecha = filtroFecha === "Todas" || p.fechaNumero === Number(filtroFecha);
      return coincideFecha;
    });
  }, [partidos, filtroFecha]);

  if (cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando programación oficial...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* BANNER INFORMATIVO */}
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight italic">CALENDARIO DE PARTIDOS</h1>
          <p className="text-slate-500 text-sm font-medium">Consulta horarios, recintos y resultados en tiempo real.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-[10px] font-black text-slate-400 uppercase ml-2">Filtrar Fecha:</span>
          <select 
            value={filtroFecha} 
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-4 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Todas">Ver Todo el Fixture</option>
            {numerosDeFechas.map(num => <option key={num} value={num}>Fecha {num}</option>)}
          </select>
        </div>
      </header>

      {/* LISTADO DE PARTIDOS */}
      <div className="space-y-4">
        {partidosFiltrados.length === 0 ? (
          <div className="bg-white p-20 text-center rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">
            No hay partidos programados para esta selección.
          </div>
        ) : (
          partidosFiltrados.map((p) => {
            const esMiPartido = p.local === miClub || p.visita === miClub;
            
            return (
              <div 
                key={p.id} 
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${esMiPartido ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20' : 'border-slate-200 shadow-sm'}`}
              >
                {/* Indicador de "Mi Club" */}
                {esMiPartido && (
                  <div className="bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest py-1 text-center">
                    ⭐ Próximo partido de {miClub}
                  </div>
                )}

                <div className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-6">
                  
                  {/* Fecha y Hora */}
                  <div className="flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 w-full md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">FECHA {p.fechaNumero}</span>
                    <span className="text-xl md:text-2xl font-black text-[#1e3a8a]">{p.hora}</span>
                    <span className="text-[10px] font-bold text-slate-500 md:mt-1">{p.dia}</span>
                  </div>

                  {/* Encuentro */}
                  <div className="flex-1 w-full text-center">
                    <div className="inline-block bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-600 uppercase mb-3 tracking-widest">
                      Serie {p.serie}
                    </div>
                    
                    <div className="flex items-center justify-between gap-4">
                      <div className={`flex-1 text-right font-black text-sm md:text-lg uppercase truncate ${p.local === miClub ? 'text-blue-600' : 'text-slate-800'}`}>
                        {p.local}
                      </div>
                      
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 rounded-xl text-white shadow-inner shrink-0">
                        {p.estado === "Finalizado" ? (
                          <>
                            <span className="text-xl font-black">{p.golesLocal}</span>
                            <span className="text-slate-500 text-xs">-</span>
                            <span className="text-xl font-black">{p.golesVisita}</span>
                          </>
                        ) : (
                          <span className="text-[10px] font-bold tracking-widest uppercase opacity-70">VS</span>
                        )}
                      </div>

                      <div className={`flex-1 text-left font-black text-sm md:text-lg uppercase truncate ${p.visita === miClub ? 'text-blue-600' : 'text-slate-800'}`}>
                        {p.visita}
                      </div>
                    </div>
                  </div>

                  {/* Lugar y Estado */}
                  <div className="w-full md:w-48 shrink-0 flex flex-col items-center md:items-end gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 pl-0 md:pl-6">
                    <div className="flex items-center gap-1.5 text-slate-600 text-sm font-bold">
                      <span className="text-lg">📍</span> {p.cancha}
                    </div>
                    {p.estado === "Programado" && (
                      <span className="bg-amber-50 text-amber-600 text-[10px] px-3 py-1 rounded-full font-black border border-amber-200">
                        PENDIENTE
                      </span>
                    )}
                    {p.estado === "En Juego" && (
                      <span className="bg-orange-500 text-white text-[10px] px-3 py-1 rounded-full font-black animate-pulse">
                        EN VIVO
                      </span>
                    )}
                    {p.estado === "Finalizado" && (
                      <span className="bg-emerald-50 text-emerald-600 text-[10px] px-3 py-1 rounded-full font-black border border-emerald-200">
                        FINALIZADO
                      </span>
                    )}
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}