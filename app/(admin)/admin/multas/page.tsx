'use client'
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Multa { id: string; club: string; motivo: string; monto: number; fecha: string; estado: string; }
interface Club { nombre: string; }

export default function TesoreriaAdmin() {
  const { authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [clubes, setClubes] = useState<Club[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  
  const [clubSeleccionado, setClubSeleccionado] = useState<string>("");
  const [motivoPredefinido, setMotivoPredefinido] = useState<string>("Inasistencia a reunión");
  const [motivoPersonalizado, setMotivoPersonalizado] = useState<string>("");
  const [monto, setMonto] = useState<number | "">("");
  const [fecha, setFecha] = useState<string>(new Date().toISOString().split('T')[0]);

  const [filtroClub, setFiltroClub] = useState<string>("Todos");
  const [filtroEstado, setFiltroEstado] = useState<"Todas" | "Pendiente" | "Pagada">("Todas");

  useEffect(() => {
    if (authCargando) return;
    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => d.data() as Club).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(data);
      if (data.length > 0) setClubSeleccionado(data[0].nombre);
    });
    const unsubM = onSnapshot(query(collection(db, "asociaciones/san_fabian/multas"), orderBy("fecha", "desc")), (snap) => {
      setMultas(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Multa[]);
      setCargandoDatos(false);
    });
    return () => { unsubC(); unsubM(); };
  }, [authCargando]);

  const asignarMulta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || monto <= 0) return alert("Ingresa un monto válido.");
    const motivoFinal = motivoPredefinido === "Otro" ? motivoPersonalizado : motivoPredefinido;
    if (!motivoFinal.trim()) return alert("Debes especificar el motivo.");

    if (confirm(`¿Asignar multa de $${monto} a ${clubSeleccionado} por "${motivoFinal}"?`)) {
      try {
        await addDoc(collection(db, "asociaciones/san_fabian/multas"), { club: clubSeleccionado, motivo: motivoFinal, monto: Number(monto), fecha, estado: "Pendiente" });
        setMotivoPersonalizado(""); setMonto("");
        alert("Multa asignada correctamente.");
      } catch (error) { alert("Error al asignar multa."); }
    }
  };

  const alternarEstadoPago = async (id: string, estadoActual: string) => {
    const nuevoEstado = estadoActual === "Pendiente" ? "Pagada" : "Pendiente";
    if (confirm(`¿Marcar esta multa como ${nuevoEstado}?`)) await updateDoc(doc(db, "asociaciones/san_fabian/multas", id), { estado: nuevoEstado });
  };

  const eliminarMulta = async (id: string) => {
    if (confirm("🚨 ATENCIÓN: ¿Borrar esta multa permanentemente?")) await deleteDoc(doc(db, "asociaciones/san_fabian/multas", id));
  };

  const multasFiltradas = multas.filter(m => (filtroClub === "Todos" || m.club === filtroClub) && (filtroEstado === "Todas" || m.estado === filtroEstado));
  const resumenGlobal = useMemo(() => {
    let cobrado = 0, pendiente = 0;
    multas.forEach(m => { if (m.estado === "Pagada") cobrado += m.monto; else pendiente += m.monto; });
    return { cobrado, pendiente };
  }, [multas]);

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando tesorería...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      <header className="bg-emerald-700 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div><h2 className="text-emerald-200 font-black uppercase tracking-[0.2em] text-xs mb-2">Administración Financiera</h2><h1 className="text-3xl md:text-5xl font-black tracking-tighter">TESORERÍA Y MULTAS</h1></div>
          <div className="flex gap-4">
            <div className="bg-white/10 p-3 rounded-xl border border-white/20 backdrop-blur-sm text-center"><span className="text-[9px] font-black text-emerald-200 uppercase tracking-widest block mb-1">Por Cobrar</span><span className="text-xl md:text-2xl font-black text-orange-300">${resumenGlobal.pendiente.toLocaleString('es-CL')}</span></div>
            <div className="bg-white/10 p-3 rounded-xl border border-white/20 backdrop-blur-sm text-center"><span className="text-[9px] font-black text-emerald-200 uppercase tracking-widest block mb-1">Caja (Pagado)</span><span className="text-xl md:text-2xl font-black text-white">${resumenGlobal.cobrado.toLocaleString('es-CL')}</span></div>
          </div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px]">💰</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><span className="bg-emerald-100 text-emerald-700 w-8 h-8 rounded-full flex items-center justify-center text-sm">➕</span>Asignar Nueva Multa</h3>
            <form onSubmit={asignarMulta} className="space-y-4">
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Club Infractor</label><select value={clubSeleccionado} onChange={e => setClubSeleccionado(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none">{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select></div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Motivo</label>
                <select value={motivoPredefinido} onChange={e => setMotivoPredefinido(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none">
                  <option value="Inasistencia a reunión">Inasistencia a reunión</option><option value="No firma de planilla">No firma de planilla</option><option value="Atraso">Atraso</option><option value="Otro">Otro (Especificar...)</option>
                </select>
              </div>
              {motivoPredefinido === "Otro" && <input type="text" placeholder="Escribe el motivo..." value={motivoPersonalizado} onChange={e => setMotivoPersonalizado(e.target.value)} className="w-full p-3 bg-white border border-slate-300 rounded-xl font-bold text-sm outline-none" required />}
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Monto ($)</label><input type="number" min="0" placeholder="5000" value={monto} onChange={e => setMonto(e.target.value ? Number(e.target.value) : "")} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-black text-emerald-700 text-lg outline-none" required /></div>
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Fecha</label><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs outline-none" required /></div>
              </div>
              <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-lg hover:bg-emerald-700 transition uppercase tracking-widest text-xs mt-4">Emitir Multa</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
            <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-sm outline-none"><option value="Todos">Todos los Clubes</option>{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value as any)} className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-bold text-sm outline-none"><option value="Todas">Ver Todas</option><option value="Pendiente">Solo Deudas</option><option value="Pagada">Solo Pagadas</option></select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left border-collapse">
                <thead><tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200"><th className="p-4 font-bold">Fecha / Motivo</th><th className="p-4 font-bold">Club</th><th className="p-4 font-black text-right">Monto</th><th className="p-4 font-black text-center">Estado</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {multasFiltradas.length === 0 ? <tr><td colSpan={4} className="p-10 text-center font-bold text-slate-400">No hay registros.</td></tr> : (
                    multasFiltradas.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4"><p className="text-[10px] font-black text-slate-400">{new Date(m.fecha).toLocaleDateString('es-CL')}</p><p className="font-bold text-slate-800 text-xs uppercase">{m.motivo}</p></td>
                        <td className="p-4 font-black text-[#1e3a8a] text-sm uppercase">{m.club}</td>
                        <td className={`p-4 text-right font-black text-lg ${m.estado === "Pendiente" ? 'text-red-500' : 'text-slate-400 line-through'}`}>${m.monto.toLocaleString('es-CL')}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => alternarEstadoPago(m.id, m.estado)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-sm w-32 ${m.estado === "Pendiente" ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-100 text-emerald-700 hover:bg-red-500 hover:text-white'}`}>{m.estado === "Pendiente" ? 'Deuda' : 'Pagado'}</button>
                            <button onClick={() => eliminarMulta(m.id)} className="text-slate-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 text-xl" title="Borrar">✖</button>
                          </div>
                        </td>
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