'use client'
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUsuario(user);
      if (user && user.email) {
        const docSnap = await getDoc(doc(db, "asociaciones/san_fabian/usuarios_permisos", user.email));
        if (docSnap.exists()) setRol(docSnap.data().rol);
      } else {
        setRol(null);
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  const esRutaPublica = pathname === '/' || pathname === '/login';

  return (
    <html lang="es">
      <head>
        {/* Configuración para PWA e Instalación en Celulares */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Futbian Pro" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* Viewport para evitar zoom accidental en la cancha */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50`}>
        
        {/* NAV BAR PROFESIONAL */}
        <nav className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              <div className="flex items-center gap-6">
                <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2">
                  <span className="bg-white text-[#1e3a8a] px-2 py-0.5 rounded">F</span> FUTBIAN.PRO
                </Link>
                
                {usuario && (
                  <div className="hidden md:flex items-center space-x-1">
                    <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-bold transition">Home</Link>
                    <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-bold transition">Jugadores</Link>
                    
                    <Link href="/gestion/actas" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-md text-sm font-bold transition shadow-sm ml-2">
                      📝 Mesa Turno
                    </Link>

                    {rol === 'admin' && (
                       <>
                         <Link href="/clubes" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-bold transition ml-4">
                           🛡️ Admin Clubes
                         </Link>
                         <Link href="/admin/programacion" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-bold transition ml-2">
                           📅 Fechas
                         </Link>
                       </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {usuario ? (
                  <button onClick={() => signOut(auth)} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded font-bold transition shadow-md">
                    Salir
                  </button>
                ) : (
                  pathname !== '/login' && (
                    <Link href="/login" className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm font-bold transition shadow-md">
                      Acceder
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 w-full mx-auto">
          {cargando ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
            </div>
          ) : (
            !usuario && !esRutaPublica ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white m-8 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-6xl mb-4">🛑</span>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
                <p className="text-slate-500 mb-6 font-medium">Debes ser dirigente autorizado para gestionar esta información.</p>
                <Link href="/login" className="bg-[#1e3a8a] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-blue-900 transition-colors">
                  Iniciar Sesión
                </Link>
              </div>
            ) : (
              <div className={pathname === '/' ? '' : 'p-4 md:p-8'}>
                {children}
              </div>
            )
          )}
        </main>

        {/* FOOTER OFICIAL CON FIRMA */}
        <footer className="bg-white border-t border-slate-200 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">Plataforma Oficial de Gestión Deportiva</p>
            <div className="h-px w-12 bg-slate-200 mx-auto mb-4"></div>
            <p className="text-slate-700 text-sm font-bold italic"># página creada por Fabián Villagra #</p>
            <p className="text-slate-400 text-[10px] mt-4">© {new Date().getFullYear()} Asociación de Fútbol San Fabián. Todos los derechos reservados.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}