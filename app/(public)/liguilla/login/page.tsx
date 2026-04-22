'use client'
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginDirigentes() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Si el login es exitoso, lo mandamos al inicio y el Layout hará el resto
      router.push("/"); 
    } catch (err: any) {
      console.error(err);
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-xl w-full max-w-md border border-slate-200 relative overflow-hidden">
        
        {/* Decoración de fondo */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500 rounded-full blur-3xl opacity-10 pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="bg-[#1e3a8a] text-white w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-lg border border-blue-700">F</div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Acceso Dirigentes</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">Ingresa tus credenciales oficiales de la liga.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5 relative z-10">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Correo Electrónico</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="admin@futbian.pro"
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all" 
              required 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contraseña</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all" 
              required 
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold text-center border border-red-200 shadow-sm animate-in zoom-in-95">
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={cargando}
            className="w-full py-4 mt-2 bg-[#1e3a8a] text-white rounded-xl font-black shadow-lg hover:bg-blue-800 transition-all uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {cargando ? (
              <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Verificando...</>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

      </div>
    </div>
  );
}