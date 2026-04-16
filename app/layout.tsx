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
  const [club, setClub] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const pathname = usePathname();

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
          setClub(docSnap.data().club);
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
      
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 relative`}>
        
        <div 
          className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none"
          style={{ backgroundImage: "url('/fondo-app.jpg')" }}
        ></div>
        
        <nav className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2 shrink-0">
                <span className="bg-white text-[#1e3a8a] px-2 py-0.5 rounded">F</span> FUTBIAN.PRO
              </Link>
              
              {usuario && (
                <div className="hidden lg:flex items-center space-x-1 overflow-x-auto scrollbar-hide ml-4 flex-1 justify-end pr-4">
                  {/* MENÚ DELEGADO (CLUB) */}
                  {rol === 'delegado' && (
                    <>
                      <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Home</Link>
                      <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Jugadores</Link>
                      <Link href="/fechas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Fechas</Link>
                      <Link href="/gestion/actas" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Mesa Turno</Link>
                      <Link href="/historial" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Registros</Link>
                      <Link href="/liguilla" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Liguilla</Link>
                      <Link href="/sanciones" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Sanciones</Link>
                      <Link href="/multas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Multas</Link>
                    </>
                  )}

                  {/* MENÚ ADMINISTRADOR */}
                  {rol === 'admin' && (
                    <>
                      <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Home</Link>
                      <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Jugadores</Link>
                      <Link href="/admin/programacion" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Fechas</Link>
                      <Link href="/admin/actas" className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Tribunal</Link>
                      <Link href="/liguilla" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Liguilla</Link>
                      <Link href="/admin/sanciones" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Sanciones</Link>
                      <Link href="/admin/reglas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Reglas</Link>
                      <Link href="/admin/multas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Multas</Link>
                    </>
                  )}
                </div>
              )}

              <div className="hidden lg:flex items-center gap-4 shrink-0">
                {usuario ? (
                  <button onClick={() => signOut(auth)} className="text-xs bg-black/20 hover:bg-red-600 px-3 py-1.5 rounded font-bold transition shadow-inner">Salir</button>
                ) : (
                  pathname !== '/login' && <Link href="/login" className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded text-sm font-bold transition shadow-md">Acceder</Link>
                )}
              </div>

              {/* Botón Hamburguesa Celular */}
              <div className="lg:hidden flex items-center">
                <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-2 rounded-md hover:bg-blue-800 focus:outline-none">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {menuAbierto ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* MENÚ CELULAR */}
          {menuAbierto && (
            <div className="lg:hidden bg-[#152b66] px-2 pt-2 pb-4 space-y-1 shadow-inner border-t border-blue-800 h-screen overflow-y-auto pb-32">
              {usuario ? (
                <>
                  <div className="px-3 py-2 mb-2 border-b border-blue-800/50">
                    <p className="text-xs text-blue-300 font-bold uppercase">Sesión iniciada como:</p>
                    <p className="text-sm font-black text-white">{club || 'ADMINISTRADOR'}</p>
                  </div>

                  {rol === 'delegado' && (
                    <>
                      <Link href="/" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏠 Home</Link>
                      <Link href="/jugadores" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚽ Jugadores</Link>
                      <Link href="/fechas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">📅 Fechas</Link>
                      <Link href="/gestion/actas" className="block px-3 py-2 rounded-md text-sm font-bold bg-emerald-600 hover:bg-emerald-500 mt-2 uppercase tracking-wider">📝 Mesa de Turno</Link>
                      <Link href="/historial" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 mt-2 uppercase tracking-wider">📖 Registros</Link>
                      <Link href="/liguilla" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏆 Liguilla</Link>
                      <Link href="/sanciones" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚠️ Sanciones</Link>
                      <Link href="/multas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">💰 Multas</Link>
                    </>
                  )}

                  {rol === 'admin' && (
                    <>
                      <Link href="/" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏠 Home</Link>
                      <Link href="/jugadores" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚽ Jugadores</Link>
                      <Link href="/admin/programacion" className="block px-3 py-2 rounded-md text-sm font-bold bg-blue-700 mt-2 uppercase tracking-wider">📅 Fechas (Fixture)</Link>
                      <Link href="/admin/actas" className="block px-3 py-2 rounded-md text-sm font-bold bg-red-600 mt-2 uppercase tracking-wider">⚖️ Tribunal</Link>
                      <Link href="/liguilla" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 mt-2 uppercase tracking-wider">🏆 Liguilla</Link>
                      <Link href="/admin/sanciones" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚠️ Sanciones</Link>
                      <Link href="/admin/reglas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚙️ Reglas Torneo</Link>
                      <Link href="/admin/multas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">💰 Multas</Link>
                    </>
                  )}
                  <button onClick={() => signOut(auth)} className="w-full text-left mt-6 px-3 py-3 text-sm font-bold text-white bg-red-600/80 hover:bg-red-600 rounded-md uppercase tracking-wider">🚪 Cerrar Sesión</button>
                </>
              ) : (
                pathname !== '/login' && <Link href="/login" className="block text-center mt-2 bg-emerald-600 px-4 py-3 rounded-lg text-base font-bold">Iniciar Sesión</Link>
              )}
            </div>
          )}
        </nav>

        <main className="flex-1 w-full mx-auto overflow-x-hidden relative z-10">
          {cargando ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900"></div>
            </div>
          ) : (
            !usuario && !esRutaPublica ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center bg-white/90 backdrop-blur-sm m-4 md:m-8 rounded-2xl shadow-xl border border-slate-200">
                <span className="text-6xl mb-4">🛑</span>
                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
                <p className="text-sm md:text-base text-slate-500 mb-6 font-medium">Debes ser dirigente autorizado.</p>
                <Link href="/login" className="bg-[#1e3a8a] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-blue-900">Iniciar Sesión</Link>
              </div>
            ) : (
              <div className={pathname === '/' ? '' : 'p-2 md:p-8'}>
                {children}
              </div>
            )
          )}
        </main>
      </body>
    </html>
  );
}