'use client'
import { useState, useEffect } from "react";
import { db, firebaseConfig } from "@/lib/firebase"; // Asegúrate de exportar firebaseConfig en tu lib/firebase.ts
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

interface Usuario { id: string; rol: string; club: string; }
interface Club { nombre: string; }

export default function GestionUsuarios() {
  const { authCargando } = useAuth() as any;
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  const [cargando, setCargando] = useState(true);

  // Formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rolNuevo, setRolNuevo] = useState("delegado");
  const [clubNuevo, setClubNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (authCargando) return;
    const unsubU = onSnapshot(collection(db, "asociaciones/san_fabian/usuarios_permisos"), (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Usuario[]);
    });
    const unsubC = onSnapshot(collection(db, "asociaciones/san_fabian/clubes"), (snap) => {
      const data = snap.docs.map(d => d.data() as Club).sort((a, b) => a.nombre.localeCompare(b.nombre));
      setClubes(data);
      if (data.length > 0) setClubNuevo(data[0].nombre);
      setCargando(false);
    });
    return () => { unsubU(); unsubC(); };
  }, [authCargando]);

  const crearUsuarioMaestro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return alert("La clave debe tener al menos 6 caracteres.");
    setCreando(true);

    try {
      // 1. Inicializar app secundaria para no desloguear al admin actual
      const secondaryApp = getApps().length > 1 ? getApp("Secondary") : initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Crear en Firebase Auth
      await createUserWithEmailAndPassword(secondaryAuth, email.toLowerCase().trim(), password);

      // 3. Crear documento de permisos en Firestore
      await setDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", email.toLowerCase().trim()), {
        rol: rolNuevo,
        club: rolNuevo === 'admin' ? "" : clubNuevo
      });

      alert("✅ Usuario creado y habilitado correctamente.");
      setEmail(""); setPassword("");
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.code === 'auth/email-already-in-use' ? "El correo ya existe." : error.message));
    }
    setCreando(false);
  };

  const eliminarAcceso = async (id: string) => {
    if (confirm(`¿Quitar permisos de acceso a ${id}? (Esto no borra la cuenta de Auth, solo el permiso)`)) {
      await deleteDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", id));
    }
  };

  if (authCargando || cargando) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando base de usuarios...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 animate-in fade-in duration-500">
      <header className="bg-slate-900 rounded-3xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Seguridad y Accesos</h2>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter">GESTIÓN DE USUARIOS</h1>
        </div>
        <div className="absolute right-[-20px] top-[-20px] opacity-10 text-[150px]">🔑</div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 sticky top-24">
            <h3 className="font-black text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">➕ Registrar Nuevo Dirigente</h3>
            <form onSubmit={crearUsuarioMaestro} className="space-y-4">
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Correo Electrónico</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none" placeholder="ejemplo@correo.com" required /></div>
              <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Clave de Acceso</label><input type="text" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none" placeholder="Mínimo 6 caracteres" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Rol</label><select value={rolNuevo} onChange={e => setRolNuevo(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs outline-none"><option value="delegado">Delegado</option><option value="admin">Administrador</option></select></div>
                {rolNuevo === 'delegado' && (
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Asignar Club</label><select value={clubNuevo} onChange={e => setClubNuevo(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-[9px] outline-none">{clubes.map(c => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}</select></div>
                )}
              </div>
              <button type="submit" disabled={creando} className="w-full py-4 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg hover:bg-blue-800 transition uppercase tracking-widest text-xs mt-4 disabled:opacity-50">
                {creando ? "Procesando..." : "Crear Cuenta de Dirigente"}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200"><th className="p-4 font-bold">Email de Usuario</th><th className="p-4 font-bold">Rol</th><th className="p-4 font-bold">Club Asignado</th><th className="p-4 font-bold text-center">Acción</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {usuarios.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-800 text-xs md:text-sm">{u.id}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.rol === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{u.rol}</span></td>
                    <td className="p-4 font-black text-slate-500 text-[10px] uppercase">{u.club || '—'}</td>
                    <td className="p-4 text-center"><button onClick={() => eliminarAcceso(u.id)} className="text-slate-300 hover:text-red-500 transition">✖</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}