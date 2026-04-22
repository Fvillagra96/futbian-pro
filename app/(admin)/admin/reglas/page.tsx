'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface AsociacionInfo { nombre?: string; logoUrl?: string; instagram?: string; facebook?: string; auspiciadorNombre?: string; auspiciadorLogo?: string; }
interface Club { id: string; nombre: string; logoUrl?: string; instagram?: string; facebook?: string; }

export default function PanelControlMaestro() {
  const { authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  
  const [infoAsoc, setInfoAsoc] = useState<AsociacionInfo>({});
  const [guardandoAsoc, setGuardandoAsoc] = useState(false);
  const [clubes, setClubes] = useState<Club[]>([]);
  const [editandoClubId, setEditandoClubId] = useState<string | null>(null);
  const [clubForm, setClubForm] = useState({ nombre: "", logoUrl: "", instagram: "", facebook: "" });

  useEffect(() => {
    if (authCargando) return;
    const unsubAsoc = onSnapshot(doc(db, "asociaciones", "san_fabian"), (docSnap) => {
      if (docSnap.exists()) setInfoAsoc(docSnap.data() as AsociacionInfo);
    });
    const unsubClubes = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[];
      setClubes(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setCargandoDatos(false);
    });
    return () => { unsubAsoc(); unsubClubes(); };
  }, [authCargando]);

  const guardarInfoAsociacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoAsoc(true);
    try {
      await setDoc(doc(db, "asociaciones", "san_fabian"), infoAsoc, { merge: true });
      alert("✅ Datos actualizados con éxito.");
    } catch (error) { alert("Error al guardar."); }
    setGuardandoAsoc(false);
  };

  const guardarClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubForm.nombre.trim()) return;
    try {
      if (editandoClubId) {
        await updateDoc(doc(db, "asociaciones/san_fabian/clubes", editandoClubId), clubForm);
        setEditandoClubId(null);
      } else {
        if (clubes.some(c => c.nombre.toLowerCase() === clubForm.nombre.toLowerCase())) return alert("Ya existe.");
        await addDoc(collection(db, "asociaciones/san_fabian/clubes"), clubForm);
      }
      setClubForm({ nombre: "", logoUrl: "", instagram: "", facebook: "" });
    } catch (error) { console.error(error); }
  };

  const prepararEdicionClub = (club: Club) => {
    setEditandoClubId(club.id);
    setClubForm({ nombre: club.nombre, logoUrl: club.logoUrl || "", instagram: club.instagram || "", facebook: club.facebook || "" });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eliminarClub = async (id: string, nombre: string) => {
    if (confirm(`🚨 PELIGRO: ¿Estás seguro de eliminar el club "${nombre}"?`)) await deleteDoc(doc(db, "asociaciones/san_fabian/clubes", id));
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando Panel Maestro...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden border-b-4 border-emerald-500">
        <div className="relative z-10 flex justify-between items-center">
          <div><h2 className="text-emerald-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Configuración Root</h2><h1 className="text-3xl md:text-5xl font-black tracking-tighter">REGLAS Y ESTRUCTURA</h1></div>
          <div className="bg-emerald-500/20 px-4 py-2 rounded-xl border border-emerald-500/30"><p className="text-sm font-bold text-emerald-100">Super Admin</p></div>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[150px]">⚙️</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4"><span className="text-2xl">🏆</span> Datos Liga y Auspiciador</h3>
          <form onSubmit={guardarInfoAsociacion} className="space-y-4">
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nombre Oficial</label><input type="text" value={infoAsoc.nombre || ""} onChange={e => setInfoAsoc({...infoAsoc, nombre: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-sm outline-none" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">URL Logo Asociación</label><input type="url" value={infoAsoc.logoUrl || ""} onChange={e => setInfoAsoc({...infoAsoc, logoUrl: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm outline-none" /></div>
            </div>
            <div className="space-y-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div><label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Auspiciador Principal</label><input type="text" value={infoAsoc.auspiciadorNombre || ""} onChange={e => setInfoAsoc({...infoAsoc, auspiciadorNombre: e.target.value})} className="w-full p-2.5 bg-white border border-emerald-200 rounded-lg font-bold text-sm outline-none" /></div>
              <div><label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">URL Logo Auspiciador</label><input type="url" value={infoAsoc.auspiciadorLogo || ""} onChange={e => setInfoAsoc({...infoAsoc, auspiciadorLogo: e.target.value})} className="w-full p-2.5 bg-white border border-emerald-200 rounded-lg text-sm outline-none" /></div>
            </div>
            <button type="submit" disabled={guardandoAsoc} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black shadow-lg hover:bg-black transition uppercase tracking-widest text-xs disabled:opacity-50">{guardandoAsoc ? "Guardando..." : "Actualizar Globales"}</button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[700px]">
          <h3 className="font-black text-slate-800 mb-6 flex items-center justify-between border-b pb-4 shrink-0"><span className="flex items-center gap-2"><span className="text-2xl">🛡️</span> Padrón de Clubes</span><span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-1 rounded-lg font-black">{clubes.length} Inscritos</span></h3>
          <form onSubmit={guardarClub} className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{editandoClubId ? "✏️ Editando Ficha de Club" : "➕ Inscribir Nuevo Club"}</h4>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre Oficial" value={clubForm.nombre} onChange={e => setClubForm({...clubForm, nombre: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-bold text-sm outline-none" required disabled={!!editandoClubId} />
              <input type="url" placeholder="Link Escudo" value={clubForm.logoUrl} onChange={e => setClubForm({...clubForm, logoUrl: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs outline-none" />
              <div className="flex gap-2">
                <input type="url" placeholder="Facebook URL" value={clubForm.facebook} onChange={e => setClubForm({...clubForm, facebook: e.target.value})} className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none" />
                <input type="url" placeholder="Instagram URL" value={clubForm.instagram} onChange={e => setClubForm({...clubForm, instagram: e.target.value})} className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#1e3a8a] text-white py-2 rounded-lg font-bold text-xs hover:bg-blue-800 transition shadow-sm">{editandoClubId ? "Guardar Cambios" : "Agregar Club"}</button>
                {editandoClubId && <button type="button" onClick={() => { setEditandoClubId(null); setClubForm({nombre: "", logoUrl: "", instagram: "", facebook: ""}); }} className="px-4 bg-slate-200 text-slate-600 font-bold text-xs rounded-lg">Cancelar</button>}
              </div>
            </div>
          </form>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {clubes.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition group">
                <div className="flex items-center gap-3">
                  {c.logoUrl ? <img src={c.logoUrl} alt="Logo" className="w-10 h-10 object-contain bg-slate-50 p-1 rounded-full border border-slate-200" /> : <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-xs border border-slate-200">🛡️</div>}
                  <div><p className="font-black text-slate-800 text-sm uppercase">{c.nombre}</p></div>
                </div>
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => prepararEdicionClub(c)} className="p-2 bg-blue-50 text-blue-600 rounded-lg transition text-xs">✏️</button>
                  <button onClick={() => eliminarClub(c.id, c.nombre)} className="p-2 bg-red-50 text-red-500 rounded-lg transition text-xs">✖</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}