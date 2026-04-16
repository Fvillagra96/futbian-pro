'use client'
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, onSnapshot, query, doc, getDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Jugador { id: string; nombre: string; rut: string; club: string; serie: string; partidosSuspendido?: number; }

export default function BoletinSanciones() {
  const [rolUsuario, setRolUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sancionados, setSancionados] = useState<Jugador[]>([]);
  const [filtroClub, setFiltroClub] = useState<string>("Todos");
  const [clubesDisponibles, setClubesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user?.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) setRolUsuario(docSnap.data().rol);
      }
    });

    // Solo traemos a los jugadores que tienen más de 0 partidos de suspensión
    const qSancionados = query(collection(db, "asociaciones/san_fabian/jugadores"), where("partidosSuspendido", ">", 0));
    
    const unsubJ = onSnapshot(qSancionados, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Jugador[];
      // Ordenamos por club y luego por nombre
      data.sort((a, b) => a.club.localeCompare(b.club) || a.nombre.localeCompare(b.nombre));
      setSancionados(data);
      
      // Extraer clubes únicos para el filtro
      const clubes = Array.from(new Set(data.map(j => j.club))).sort();
      setClubesDisponibles(clubes);
      setCargando(false);
    });

    return () => { unsubAuth(); unsubJ(); };
  }, []);

  const sancionadosFiltrados = filtroClub === "Todos" ? sancionados : sancionados.filter(j => j.club === filtroClub);

  if (cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando boletín disciplinario...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      <header className="bg-red-600 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-red-200 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-2">Tribunal de Disciplina</h2>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter">BOLETÍN DE SANCIONES</h1>
            <p className="text-red-100 mt-2 text-xs md:text-sm">Lista oficial de jugadores inhabilitados para la próxima fecha.</p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 backdrop-blur-sm">
            <span className="text-[10px] font-bold text-red-200 uppercase">Suspendidos Totales</span>
            <p className="text-2xl font-black text-white text-center">{sancionados.length}</p>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px] pointer-events-none">⚠️</div>
      </header>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <h3 className="font-black text-slate-800 tracking-tight">JUGADORES CASTIGADOS</h3>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase">Filtrar Club:</span>
            <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="flex-1 md:flex-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-sm outline-none focus:ring-2 focus:ring-red-500">
              <option value="Todos">Ver Todos</option>
              {clubesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {sancionadosFiltrados.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold">
              No hay jugadores suspendidos {filtroClub !== "Todos" ? `en ${filtroClub}` : 'actualmente'}.
            </div>
          ) : (
            <table className="w-full min-w-[500px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 font-bold">Jugador / RUT</th>
                  <th className="p-4 font-bold">Club y Serie</th>
                  <th className="p-4 font-black text-red-600 text-center">Fechas de Castigo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sancionadosFiltrados.map(j => (
                  <tr key={j.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="p-4">
                      <p className="font-black text-slate-800 uppercase">{j.nombre}</p>
                      <p className="text-[10px] font-bold text-slate-400">{j.rut}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-[#1e3a8a] text-sm">{j.club}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Serie {j.serie}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl text-base font-black border border-red-200 shadow-sm">
                        ⚠️ {j.partidosSuspendido} {j.partidosSuspendido === 1 ? 'FECHA' : 'FECHAS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}