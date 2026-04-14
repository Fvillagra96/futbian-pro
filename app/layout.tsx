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
  const [menuAbierto, setMenuAbierto] = useState(false); // ESTADO PARA EL MENÚ MÓVIL
  const pathname = usePathname();

  // Cerramos el menú móvil automáticamente si cambiamos de página
  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUsuario(user);
        const emailLimpio = user.email.toLowerCase().trim();
        const docRef = doc(db, "asociaciones/san_fabian/usuarios_permisos", emailLimpio);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRol(docSnap.data().rol);
        } else {
          setRol(null);
        }
      } else {
        setUsuario(null);
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Futbian Pro" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50`}>
        
        {/* NAV BAR PROFESIONAL Y RESPONSIVO */}
        <nav className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* LOGO */}
              <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2">
                <span className="bg-white text-[#1e3a8a] px-2 py-0.5 rounded">F</span> FUTBIAN.PRO
              </Link>
              
              {/* MENÚ DE ESCRITORIO (Se oculta en móviles) */}
              {usuario && (
                <div className="hidden md:flex items-center space-x-1">
                  <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-bold transition">Home</Link>
                  <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-sm font-bold transition">Jugadores</Link>
                  <Link href="/gestion/actas" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-md text-sm font-bold transition shadow-sm ml-2">📝 Mesa Turno</Link>
                  {rol === 'admin' && (
                     <>
                       <Link href="/clubes" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-bold transition ml-4">🛡️ Admin Clubes</Link>
                       <Link href="/admin/programacion" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-sm font-bold transition ml-2">📅 Fechas</Link>
                     </>
                  )}
                </div>
              )}

              {/* BOTONES DE SESIÓN DE ESCRITORIO */}
              <div className="hidden md:flex items-center gap-4">
                {usuario ? (
                  <button onClick={() => signOut(auth)} className="text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded font-bold transition shadow-md">Salir</button>
                ) : (
                  pathname !== '/login' && <Link href="/login" className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm font-bold transition shadow-md">Acceder</Link>
                )}
              </div>

              {/* BOTÓN HAMBURGUESA PARA MÓVILES */}
              <div className="md:hidden flex items-center">
                <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-2 rounded-md hover:bg-blue-800 focus:outline-none">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {menuAbierto ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* MENÚ DESPLEGABLE PARA MÓVILES */}
          {menuAbierto && (
            <div className="md:hidden bg-[#152b66] px-2 pt-2 pb-4 space-y-1 shadow-inner border-t border-blue-800">
              {usuario ? (
                <>
                  <Link href="/" className="block px-3 py-2 rounded-md text-base font-bold hover:bg-blue-800">🏠 Home</Link>
                  <Link href="/jugadores" className="block px-3 py-2 rounded-md text-base font-bold hover:bg-blue-800">⚽ Jugadores</Link>
                  <Link href="/gestion/actas" className="block px-3 py-2 rounded-md text-base font-bold bg-emerald-600 hover:bg-emerald-500 mt-2">📝 Mesa de Turno</Link>
                  
                  {rol === 'admin' && (
                    <div className="mt-4 pt-4 border-t border-blue-800">
                      <p className="px-3 text-[10px] text-blue-300 font-bold uppercase mb-1">Administración</p>
                      <Link href="/clubes" className="block px-3 py-2 rounded-md text-base font-bold hover:bg-blue-700">🛡️ Clubes</Link>
                      <Link href="/admin/programacion" className="block px-3 py-2 rounded-md text-base font-bold hover:bg-blue-700">📅 Fechas</Link>
                    </div>
                  )}
                  <button onClick={() => signOut(auth)} className="w-full text-left mt-4 px-3 py-2 text-base font-bold text-red-400 hover:bg-red-900/50 rounded-md">🚪 Cerrar Sesión</button>
                </>
              ) : (
                pathname !== '/login' && <Link href="/login" className="block text-center mt-2 bg-emerald-600 px-4 py-3 rounded-lg text-base font-bold">Iniciar Sesión</Link>
              )}
            </div>
          )}
        </nav>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 w-full mx-auto overflow-x-hidden">
          {cargando ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
            </div>
          ) : (
            !usuario && !esRutaPublica ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white m-4 md:m-8 rounded-2xl shadow-sm border border-slate-200">
                <span className="text-6xl mb-4">🛑</span>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
                <p className="text-sm md:text-base text-slate-500 mb-6 font-medium">Debes ser dirigente autorizado.</p>
                <Link href="/login" className="bg-[#1e3a8a] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-blue-900">Iniciar Sesión</Link>
              </div>
            ) : (
              <div className={pathname === '/' ? '' : 'p-3 md:p-8'}>
                {children}
              </div>
            )
          )}
        </main>

        <footer className="bg-white border-t border-slate-200 py-8 mt-12">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-2">Plataforma Oficial de Gestión Deportiva</p>
            <div className="h-px w-12 bg-slate-200 mx-auto mb-4"></div>
            <p className="text-slate-700 text-sm font-bold italic"># página creada por Fabián Villagra #</p>
            <p className="text-slate-400 text-[10px] mt-4">© {new Date().getFullYear()} Asociación de Fútbol San Fabián.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}