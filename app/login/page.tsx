'use client'
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PaginaLogin() {
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, correo, clave);
      // Si el login es exitoso, lo enviamos al Home/Dashboard
      router.push("/");
    } catch (err: any) {
      console.error("Error de login:", err);
      setError("Credenciales incorrectas. Verifica tu correo y clave.");
      setCargando(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 animate-in fade-in zoom-in duration-500">
      
      {/* Contenedor de la Tarjeta */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Cabecera del Login */}
        <div className="bg-[#1e3a8a] px-8 py-10 text-center relative overflow-hidden">
          {/* Enlaces Discretos */}
          <div className="absolute top-4 left-0 w-full flex justify-center gap-4 text-xs text-blue-300 font-medium">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <span>|</span>
            <a href="#" className="hover:text-white transition">Redes Sociales</a>
          </div>

          <div className="mt-6 relative z-10">
            <span className="text-5xl block mb-4 drop-shadow-md">⚽</span>
            <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
              Asociación de Fútbol<br />San Fabián
            </h1>
          </div>
          
          {/* Brillo de fondo */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
        </div>

        {/* Formulario */}
        <div className="p-8">
          
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-lg text-sm text-red-700 font-medium flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={manejarLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Correo Electrónico</label>
              <input 
                type="email" 
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="ejemplo@club.com"
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-slate-800 font-medium"
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Clave de Acceso</label>
              <input 
                type="password" 
                value={clave} 
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-slate-800 font-medium"
                required 
              />
            </div>

            {/* Botonera */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button 
                type="submit" 
                disabled={cargando}
                className={`w-full py-3.5 rounded-xl font-bold text-white transition-all shadow-md 
                  ${cargando ? 'bg-slate-400 cursor-not-allowed' : 'bg-[#1e3a8a] hover:bg-blue-900 hover:shadow-lg'}`}
              >
                {cargando ? 'Cargando...' : 'Iniciar Sesión'}
              </button>
              
              <Link 
                href="/"
                className="w-full py-3.5 rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 transition-all text-center flex items-center justify-center shadow-sm"
              >
                Atrás
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}