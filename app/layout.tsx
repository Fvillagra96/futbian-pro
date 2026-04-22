'use client'
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

// 1. EL ENRUTADOR HERMÉTICO (El Guardia de Seguridad)
function EnrutadorHermetico({ children }: { children: React.ReactNode }) {
  const { usuario, rol, club, cargando } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Cierra el menú al cambiar de página
  useEffect(() => setMenuAbierto(false), [pathname]);

  // SISTEMA DE SEGURIDAD HERMÉTICO (Protección de Rutas)
  const rolNormalizado = rol?.toLowerCase().trim(); // Convertimos a minúsculas por si acaso en la BD dice "Delegado"

 // Quitamos '/sanciones' de la ruta pública
  const esRutaPublica = pathname === '/' || pathname === '/login' || pathname.startsWith('/liguilla');
  
  // Agregamos '/sanciones' a la ruta de delegados (y nos aseguramos que esté clasificacion)
  const esRutaDelegado = pathname.startsWith('/gestion') || pathname.startsWith('/fechas') || pathname.startsWith('/historial') || pathname.startsWith('/multas') || pathname.startsWith('/jugadores') || pathname.startsWith('/clasificacion') || pathname.startsWith('/sanciones');
  const esRutaAdmin = pathname.startsWith('/admin');

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e3a8a]"></div>
          <p className="font-black text-[#1e3a8a] animate-pulse">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  // Si intenta entrar a una zona privada sin sesión, lo bloqueamos
  if (!usuario && !esRutaPublica) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center border-t-4 border-red-500 max-w-md">
          <span className="text-6xl mb-4 block">🛑</span>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Acceso Restringido</h2>
          <p className="text-slate-500 mb-6 font-medium">Esta área es exclusiva para dirigentes con sesión iniciada.</p>
          <Link href="/login" className="bg-[#1e3a8a] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-blue-900 block">Ir a Iniciar Sesión</Link>
        </div>
      </div>
    );
  }

  // Si no es admin y quiere entrar a zona admin, o si quiere entrar a delegados y no es nada
  if ((esRutaAdmin && rolNormalizado !== 'admin') || (esRutaDelegado && rolNormalizado !== 'admin' && rolNormalizado !== 'delegado')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center border-t-4 border-orange-500 max-w-md">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Sin Permisos</h2>
          <p className="text-slate-500 mb-6 font-medium">Tu cuenta ({rol}) no tiene autorización para ver este módulo.</p>
          <button onClick={() => router.push('/')} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-black block w-full">Volver al Inicio</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[-1] bg-cover bg-center bg-no-repeat opacity-5 pointer-events-none" style={{ backgroundImage: "url('/fondo-app.jpg')" }}></div>
      
      <nav className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            <Link href="/" className="font-black text-xl tracking-tighter flex items-center gap-2 shrink-0">
              <span className="bg-white text-[#1e3a8a] px-2 py-0.5 rounded">F</span> FUTBIAN.PRO
            </Link>
            
            {/* MENÚ ESCRITORIO */}
            <div className="hidden lg:flex items-center space-x-1 ml-4 flex-1 justify-end pr-4">
              {rolNormalizado === 'delegado' && (
                <>
                  <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Inicio</Link>
                  <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Plantel</Link>
                  <Link href="/fechas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Fixture</Link>
                  <Link href="/gestion/actas" className="bg-emerald-600 hover:bg-emerald-500 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Mesa Turno</Link>
                  <Link href="/historial" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Mis Actas</Link>
                  <Link href="/liguilla" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Liguilla</Link>
                  <Link href="/sanciones" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Sancionados</Link>
                  <Link href="/multas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Mi Cartola</Link>
                  <Link href="/clasificacion" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Liguilla (Clasif)</Link>
                </>
              )}

              {rolNormalizado === 'admin' && (
                <>
                  <Link href="/" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Inicio</Link>
                  <Link href="/jugadores" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Padrón</Link>
                  <Link href="/admin/programacion" className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Programar</Link>
                  <Link href="/admin/actas" className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition shadow-sm ml-1">Tribunal</Link>
                  <Link href="/liguilla" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Liguilla</Link>
                  <Link href="/admin/sanciones" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Castigos</Link>
                  <Link href="/admin/multas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Tesorería</Link>
                  <Link href="/admin/reglas" className="hover:bg-blue-800 px-3 py-2 rounded-md text-[11px] font-bold uppercase transition tracking-wider">Ajustes</Link>
                </>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-4 shrink-0 border-l border-blue-800 pl-4">
              {usuario ? (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-blue-300 uppercase leading-none">{rol}</p>
                    <p className="text-xs font-black truncate max-w-[100px]">{club || 'Directiva'}</p>
                  </div>
                  <button onClick={() => signOut(auth)} className="text-[10px] bg-red-500/20 text-red-100 hover:bg-red-500 px-2 py-1.5 rounded font-bold transition">Salir</button>
                </div>
              ) : (
                pathname !== '/login' && <Link href="/login" className="bg-emerald-500 hover:bg-emerald-600 px-4 py-1.5 rounded text-xs font-bold transition">Acceder</Link>
              )}
            </div>

            {/* BOTÓN HAMBURGUESA MÓVIL */}
            <div className="lg:hidden flex items-center">
              <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-2">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {menuAbierto ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* MENÚ MÓVIL */}
        {menuAbierto && (
          <div className="lg:hidden bg-[#152b66] px-2 pt-2 pb-4 space-y-1 h-screen overflow-y-auto pb-32 shadow-inner border-t border-blue-800">
            {usuario ? (
              <>
                <div className="px-3 py-3 mb-2 border-b border-blue-800/50">
                  <p className="text-[10px] text-blue-300 font-bold uppercase">Sesión: {rol}</p>
                  <p className="text-sm font-black text-white">{club || 'Asociación Central'}</p>
                </div>

                {rolNormalizado === 'delegado' && (
                  <>
                    <Link href="/" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏠 Inicio</Link>
                    <Link href="/jugadores" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚽ Plantel</Link>
                    <Link href="/fechas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">📅 Fixture</Link>
                    <Link href="/gestion/actas" className="block px-3 py-2 rounded-md text-sm font-bold bg-emerald-600 hover:bg-emerald-500 mt-2 uppercase tracking-wider">📝 Mesa de Turno</Link>
                    <Link href="/historial" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 mt-2 uppercase tracking-wider">📖 Mis Actas</Link>
                    <Link href="/liguilla" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏆 Liguilla</Link>
                    <Link href="/sanciones" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚠️ Sancionados</Link>
                    <Link href="/multas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">💰 Mi Cartola</Link>
                  </>
                )}

                {rolNormalizado === 'admin' && (
                  <>
                    <Link href="/" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">🏠 Inicio</Link>
                    <Link href="/jugadores" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚽ Padrón General</Link>
                    <Link href="/admin/programacion" className="block px-3 py-2 rounded-md text-sm font-bold bg-blue-700 mt-2 uppercase tracking-wider">📅 Programar</Link>
                    <Link href="/admin/actas" className="block px-3 py-2 rounded-md text-sm font-bold bg-red-600 mt-2 uppercase tracking-wider">⚖️ Tribunal</Link>
                    <Link href="/liguilla" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 mt-2 uppercase tracking-wider">🏆 Liguilla</Link>
                    <Link href="/admin/sanciones" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚠️ Castigos Globales</Link>
                    <Link href="/admin/multas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">💰 Tesorería</Link>
                    <Link href="/admin/reglas" className="block px-3 py-2 rounded-md text-sm font-bold hover:bg-blue-800 uppercase tracking-wider">⚙️ Reglas Torneo</Link>
                  </>
                )}
                
                <button onClick={() => signOut(auth)} className="w-full text-left mt-6 px-3 py-3 text-sm font-bold text-white bg-red-600/80 hover:bg-red-600 rounded-md uppercase tracking-wider">🚪 Cerrar Sesión</button>
              </>
            ) : (
               <Link href="/login" className="block text-center mt-4 bg-emerald-600 px-4 py-3 rounded-lg text-sm font-bold">Iniciar Sesión de Dirigente</Link>
            )}
          </div>
        )}
      </nav>

      <main className="flex-1 w-full mx-auto overflow-x-hidden relative z-10 p-2 md:p-8">
        {children}
      </main>
    </>
  );
}

// 2. EL LAYOUT MAESTRO (Inyecta el AuthProvider y tus Meta Tags Móviles)
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <title>Futbian Pro</title>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a8a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Futbian Pro" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 relative`}>
        {/* Aquí envolvemos todo con el motor de seguridad que creamos antes */}
        <AuthProvider>
          <EnrutadorHermetico>
            {children}
          </EnrutadorHermetico>
        </AuthProvider>
      </body>
    </html>
  );
}