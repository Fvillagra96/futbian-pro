'use client'
import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";

interface Partido { 
  id: string; fechaNumero: number; local: string; visita: string; 
  serie: string; estado: string; golesLocal: number; golesVisita: number; 
}

export default function IngresoResultadosManual() {
  const { rol, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [procesandoExcel, setProcesandoExcel] = useState(false);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  // 🚨 NUEVO: Estados para los filtros
  const [filtroFecha, setFiltroFecha] = useState<string>("Todas");
  const [filtroSerie, setFiltroSerie] = useState<string>("Todas");
  
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [edicionGoles, setEdicionGoles] = useState<Record<string, { local: number, visita: number }>>({});

  useEffect(() => {
    if (authCargando) return;

    const unsubP = onSnapshot(query(collection(db, "asociaciones/san_fabian/partidos"), orderBy("fechaNumero", "desc")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Partido[];
      setPartidos(data);
      
      const golesIniciales: Record<string, { local: number, visita: number }> = {};
      data.forEach(p => {
        if (!edicionGoles[p.id]) {
          golesIniciales[p.id] = { local: p.golesLocal || 0, visita: p.golesVisita || 0 };
        }
      });
      setEdicionGoles(prev => ({ ...golesIniciales, ...prev }));
      
      setCargandoDatos(false);
    });

    return () => unsubP();
  }, [authCargando]);

  // 🚨 NUEVO: Extraemos fechas y series únicas para llenar los selectores
  const numerosDeFechas = useMemo(() => Array.from(new Set(partidos.map(p => p.fechaNumero))).sort((a, b) => b - a), [partidos]);
  const seriesDisponibles = useMemo(() => Array.from(new Set(partidos.map(p => p.serie))).sort(), [partidos]);
  
  // 🚨 NUEVO: Lógica de doble filtrado (Fecha + Serie)
  const partidosFiltrados = useMemo(() => {
    return partidos.filter(p => {
      const coincideFecha = filtroFecha === "Todas" || p.fechaNumero === Number(filtroFecha);
      const coincideSerie = filtroSerie === "Todas" || p.serie === filtroSerie;
      return coincideFecha && coincideSerie;
    });
  }, [partidos, filtroFecha, filtroSerie]);

  const manejarCambioGol = (id: string, equipo: 'local' | 'visita', valor: string) => {
    const numero = parseInt(valor) || 0;
    setEdicionGoles(prev => ({
      ...prev,
      [id]: { ...prev[id], [equipo]: Math.max(0, numero) } 
    }));
  };

  const guardarResultadoForzado = async (partido: Partido) => {
    const nuevosGoles = edicionGoles[partido.id];
    if (!nuevosGoles) return;

    setGuardandoId(partido.id);
    try {
      await updateDoc(doc(db, "asociaciones/san_fabian/partidos", partido.id), {
        golesLocal: nuevosGoles.local,
        golesVisita: nuevosGoles.visita,
        estado: "Finalizado"
      });
      alert(`✅ Resultado guardado: ${partido.local} ${nuevosGoles.local} - ${nuevosGoles.visita} ${partido.visita}`);
    } catch (error) {
      alert("Error al guardar el resultado.");
    } finally {
      setGuardandoId(null);
    }
  };

  const procesarExcelMasivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesandoExcel(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      const normalizar = (str: any) => String(str || "").trim().toLowerCase();
      
      const batch = writeBatch(db);
      let encontrados = 0;
      let actualizados = 0;

      jsonData.forEach(row => {
        const fecha = row['Fecha'];
        const local = row['Club L'];
        const visita = row['Club v'];
        const serie = row['Serie'];
        const golesL = row['Goles L'];
        const golesV = row['Goles V'];

        if (fecha === undefined || !local || !visita || !serie || golesL === undefined || golesV === undefined) return;

        const partidoBd = partidos.find(p => 
          Number(p.fechaNumero) === Number(fecha) &&
          normalizar(p.local) === normalizar(local) &&
          normalizar(p.visita) === normalizar(visita) &&
          normalizar(p.serie) === normalizar(serie)
        );

        if (partidoBd) {
          encontrados++;
          if (partidoBd.golesLocal !== Number(golesL) || partidoBd.golesVisita !== Number(golesV) || partidoBd.estado !== "Finalizado") {
            const ref = doc(db, "asociaciones/san_fabian/partidos", partidoBd.id);
            batch.update(ref, {
              golesLocal: Number(golesL),
              golesVisita: Number(golesV),
              estado: "Finalizado"
            });
            actualizados++;
          }
        }
      });

      if (actualizados > 0) {
        await batch.commit();
        alert(`✅ Carga masiva exitosa.\nSe escanearon ${jsonData.length} filas.\nSe emparejaron ${encontrados} partidos.\nSe actualizaron los marcadores de ${actualizados} partidos.`);
      } else {
        alert(`ℹ️ El Excel se procesó correctamente, pero no se encontraron nuevos resultados que actualizar.`);
      }
    } catch (error) {
      console.error(error);
      alert("Error al procesar el archivo Excel.");
    } finally {
      setProcesandoExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando panel de resultados...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 animate-in fade-in duration-500 pb-20">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-emerald-500">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Auditoría y Planillaje</h2>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter">RESULTADOS</h1>
            <p className="text-slate-400 mt-2 text-xs md:text-sm">Ingreso manual rápido y actualización masiva por Excel.</p>
          </div>
          <div className="bg-emerald-500/10 px-6 py-4 rounded-2xl border border-emerald-500/20 backdrop-blur-sm text-center">
            <span className="text-[10px] font-bold text-emerald-300 uppercase block mb-1">Partidos Finalizados</span>
            <p className="text-4xl font-black text-white leading-none">{partidos.filter(p => p.estado === "Finalizado").length}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px] pointer-events-none">🔢</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        
        {/* 🚨 ZONA DE FILTROS ACTUALIZADA */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Filtro Fecha */}
            <div className="flex items-center justify-between md:justify-start gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2 shrink-0">Fecha:</span>
              <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-40 text-slate-700">
                <option value="Todas">Todas</option>
                {numerosDeFechas.map(num => <option key={num} value={num}>Fecha {num}</option>)}
              </select>
            </div>

            {/* Filtro Serie */}
            <div className="flex items-center justify-between md:justify-start gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase ml-2 shrink-0">Serie:</span>
              <select value={filtroSerie} onChange={(e) => setFiltroSerie(e.target.value)} className="bg-white border border-slate-300 rounded-lg px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-40 text-slate-700">
                <option value="Todas">Todas</option>
                {seriesDisponibles.map(serie => <option key={serie} value={serie}>{serie}</option>)}
              </select>
            </div>
          </div>

          {/* Botón de Carga Masiva (Excel) */}
          <div className="w-full md:w-auto">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={procesarExcelMasivo} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={procesandoExcel}
              className={`w-full md:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2 ${
                procesandoExcel ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5'
              }`}
            >
              {procesandoExcel ? '⏳ Procesando Archivo...' : '📊 Subir Resultados (Excel)'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {partidosFiltrados.length === 0 ? (
            <div className="p-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold">
              No hay partidos para mostrar con los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 font-bold">Fecha / Serie</th>
                  <th className="p-4 font-black text-right w-1/3 text-slate-700">Equipo Local</th>
                  <th className="p-4 font-black text-center text-emerald-600 bg-emerald-50">Marcador Manual</th>
                  <th className="p-4 font-black text-left w-1/3 text-slate-700">Equipo Visita</th>
                  <th className="p-4 font-bold text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partidosFiltrados.map(p => {
                  const golesEdit = edicionGoles[p.id] || { local: 0, visita: 0 };
                  const cambioPendiente = golesEdit.local !== p.golesLocal || golesEdit.visita !== p.golesVisita || p.estado !== "Finalizado";

                  return (
                    <tr key={p.id} className={`transition-colors ${p.estado === "Finalizado" ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                      <td className="p-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase block">Fecha {p.fechaNumero}</span>
                        <span className="bg-blue-100 text-blue-800 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest inline-block mt-1">{p.serie}</span>
                      </td>
                      
                      <td className="p-4 text-right font-black uppercase text-sm md:text-base text-slate-800 truncate">
                        {p.local}
                      </td>
                      
                      <td className="p-4 bg-emerald-50/30">
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="number" 
                            min="0"
                            value={golesEdit.local} 
                            onChange={(e) => manejarCambioGol(p.id, 'local', e.target.value)}
                            className="w-14 md:w-16 p-2 text-center text-xl font-black rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none bg-white text-[#1e3a8a]"
                          />
                          <span className="text-slate-300 font-black">-</span>
                          <input 
                            type="number" 
                            min="0"
                            value={golesEdit.visita} 
                            onChange={(e) => manejarCambioGol(p.id, 'visita', e.target.value)}
                            className="w-14 md:w-16 p-2 text-center text-xl font-black rounded-lg border-2 border-slate-200 focus:border-emerald-500 outline-none bg-white text-[#1e3a8a]"
                          />
                        </div>
                      </td>
                      
                      <td className="p-4 text-left font-black uppercase text-sm md:text-base text-slate-800 truncate">
                        {p.visita}
                      </td>

                      <td className="p-4 text-center">
                        <button 
                          onClick={() => guardarResultadoForzado(p)}
                          disabled={!cambioPendiente || guardandoId === p.id}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                            guardandoId === p.id ? 'bg-slate-200 text-slate-500' :
                            cambioPendiente ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                        >
                          {guardandoId === p.id ? '⏳' : cambioPendiente ? '💾 Guardar' : '✅ Cerrado'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}