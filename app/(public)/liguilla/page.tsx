'use client'
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

// Estructura de nuestra Liguilla de 4 equipos
interface DatosLiguilla {
  semi1_local: string; semi1_visita: string; semi1_res: string;
  semi2_local: string; semi2_visita: string; semi2_res: string;
  final_local: string; final_visita: string; final_res: string;
  campeon: string;
}

const liguillaVacia: DatosLiguilla = {
  semi1_local: "", semi1_visita: "", semi1_res: "",
  semi2_local: "", semi2_visita: "", semi2_res: "",
  final_local: "", final_visita: "", final_res: "",
  campeon: ""
};

export default function LiguillaTorneo() {
  const { rol, authCargando } = useAuth() as any;
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [serieActiva, setSerieActiva] = useState("Honor");
  const [datos, setDatos] = useState<DatosLiguilla>(liguillaVacia);
  const [guardando, setGuardando] = useState(false);

  // Escuchar en tiempo real los datos de la liguilla según la serie seleccionada
  useEffect(() => {
    if (authCargando) return;
    setCargandoDatos(true);
    
    // El documento en Firebase se llamará "liguilla_Honor", "liguilla_Juvenil", etc.
    const docRef = doc(db, "asociaciones/san_fabian/liguillas", `liguilla_${serieActiva}`);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDatos(docSnap.data() as DatosLiguilla);
      } else {
        setDatos(liguillaVacia);
      }
      setCargandoDatos(false);
    });

    return () => unsub();
  }, [serieActiva, authCargando]);

  // Función exclusiva para el Administrador
  const guardarLiguilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rol !== 'admin') return;
    setGuardando(true);
    try {
      const docRef = doc(db, "asociaciones/san_fabian/liguillas", `liguilla_${serieActiva}`);
      await setDoc(docRef, datos);
      alert(`✅ Liguilla Serie ${serieActiva} actualizada con éxito.`);
    } catch (error) {
      alert("Error al guardar la liguilla.");
    }
    setGuardando(false);
  };

  const handleInput = (campo: keyof DatosLiguilla, valor: string) => {
    setDatos(prev => ({ ...prev, [campo]: valor }));
  };

  if (authCargando || cargandoDatos) return <div className="p-20 text-center font-bold text-[#1e3a8a] animate-pulse">Cargando llaves del torneo...</div>;

  const esAdmin = rol === 'admin';

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 animate-in fade-in duration-500 pb-12">
      
      {/* HEADER LIGUILLA */}
      <header className="bg-slate-900 rounded-3xl p-8 md:p-12 shadow-xl text-white relative overflow-hidden text-center border-b-4 border-[#1e3a8a]">
        <div className="relative z-10">
          <h2 className="text-blue-400 font-black uppercase tracking-[0.2em] text-xs mb-2">Fase Final</h2>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter">LIGUILLA POR EL TÍTULO</h1>
          <p className="text-slate-400 mt-4 text-sm md:text-base max-w-2xl mx-auto">Sigue el camino a la copa de los 4 mejores equipos clasificados en la fase regular.</p>
        </div>
        <div className="absolute right-[-20px] top-[-40px] opacity-10 text-[200px] pointer-events-none">🏆</div>
      </header>

      {/* SELECTOR DE SERIE */}
      <div className="flex justify-center">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 inline-flex items-center gap-4">
          <span className="font-black text-slate-400 uppercase text-xs">Viendo Serie:</span>
          <select 
            value={serieActiva} 
            onChange={(e) => setSerieActiva(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-6 py-3 font-black text-[#1e3a8a] text-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="Honor">Honor</option>
            <option value="Segunda">Segunda</option>
            <option value="Juvenil">Juvenil</option>  {/* CORREGIDO AQUÍ */}
            <option value="Senior 35">Senior 35</option>
            <option value="Senior 40">Senior 40</option>
            <option value="Damas">Damas</option>
          </select>
        </div>
      </div>

      {/* RENDERIZADO DEL BRACKET (CUADRO) */}
      <div className="bg-white p-6 md:p-12 rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
        <form onSubmit={guardarLiguilla} className="min-w-[800px] relative">
          
          <div className="flex justify-between items-center w-full relative z-10">
            
            {/* COLUMNA 1: SEMIFINALES */}
            <div className="w-1/3 space-y-16">
              {/* Semi 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative">
                <div className="absolute -right-8 top-1/2 w-8 h-px bg-slate-300"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Semifinal 1</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="1º Clasificado" value={datos.semi1_local} onChange={e => handleInput('semi1_local', e.target.value)} readOnly={!esAdmin} className={`flex-1 font-bold text-sm outline-none rounded p-1 ${esAdmin ? 'bg-white border focus:border-blue-500' : 'bg-transparent border-none'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="4º Clasificado" value={datos.semi1_visita} onChange={e => handleInput('semi1_visita', e.target.value)} readOnly={!esAdmin} className={`flex-1 font-bold text-sm outline-none rounded p-1 ${esAdmin ? 'bg-white border focus:border-blue-500' : 'bg-transparent border-none'}`} />
                  </div>
                </div>
                {esAdmin ? (
                  <input type="text" placeholder="Res: Ej: 2-1" value={datos.semi1_res} onChange={e => handleInput('semi1_res', e.target.value)} className="w-full mt-2 text-center text-xs font-bold text-blue-600 bg-blue-50 rounded p-1 outline-none" />
                ) : (
                  datos.semi1_res && <div className="mt-2 text-center text-[10px] font-black text-white bg-[#1e3a8a] rounded py-1">{datos.semi1_res}</div>
                )}
              </div>

              {/* Semi 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative">
                <div className="absolute -right-8 top-1/2 w-8 h-px bg-slate-300"></div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Semifinal 2</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="2º Clasificado" value={datos.semi2_local} onChange={e => handleInput('semi2_local', e.target.value)} readOnly={!esAdmin} className={`flex-1 font-bold text-sm outline-none rounded p-1 ${esAdmin ? 'bg-white border focus:border-blue-500' : 'bg-transparent border-none'}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="3º Clasificado" value={datos.semi2_visita} onChange={e => handleInput('semi2_visita', e.target.value)} readOnly={!esAdmin} className={`flex-1 font-bold text-sm outline-none rounded p-1 ${esAdmin ? 'bg-white border focus:border-blue-500' : 'bg-transparent border-none'}`} />
                  </div>
                </div>
                {esAdmin ? (
                  <input type="text" placeholder="Res: Ej: 0-0 (Penales)" value={datos.semi2_res} onChange={e => handleInput('semi2_res', e.target.value)} className="w-full mt-2 text-center text-xs font-bold text-blue-600 bg-blue-50 rounded p-1 outline-none" />
                ) : (
                  datos.semi2_res && <div className="mt-2 text-center text-[10px] font-black text-white bg-[#1e3a8a] rounded py-1">{datos.semi2_res}</div>
                )}
              </div>
            </div>

            {/* COLUMNA 2: FINAL */}
            <div className="w-1/3 flex justify-center relative">
              {/* Líneas conectoras SVG */}
              <svg className="absolute -left-1/2 top-1/2 -translate-y-1/2 w-full h-[220px] -z-10 pointer-events-none" style={{ left: '-50%' }}>
                <path d="M 0,20 L 50,20 L 50,200 L 0,200" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                <path d="M 50,110 L 100,110" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                <path d="M 300,110 L 350,110" fill="none" stroke="#cbd5e1" strokeWidth="2" />
              </svg>

              <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl w-full max-w-[250px] relative z-20">
                <h4 className="text-xs font-black text-yellow-400 uppercase mb-4 text-center tracking-widest flex justify-center items-center gap-2">⭐ GRAN FINAL ⭐</h4>
                <div className="space-y-4">
                  <input type="text" placeholder="Ganador Semi 1" value={datos.final_local} onChange={e => handleInput('final_local', e.target.value)} readOnly={!esAdmin} className={`w-full font-black text-center text-lg outline-none rounded p-2 ${esAdmin ? 'bg-white text-slate-800' : 'bg-transparent text-white border-none placeholder-slate-500'}`} />
                  <div className="text-center font-black text-slate-500 text-xs">VS</div>
                  <input type="text" placeholder="Ganador Semi 2" value={datos.final_visita} onChange={e => handleInput('final_visita', e.target.value)} readOnly={!esAdmin} className={`w-full font-black text-center text-lg outline-none rounded p-2 ${esAdmin ? 'bg-white text-slate-800' : 'bg-transparent text-white border-none placeholder-slate-500'}`} />
                </div>
                {esAdmin ? (
                  <input type="text" placeholder="Resultado Final" value={datos.final_res} onChange={e => handleInput('final_res', e.target.value)} className="w-full mt-4 text-center text-xs font-bold text-slate-800 bg-yellow-100 rounded p-2 outline-none" />
                ) : (
                  datos.final_res && <div className="mt-4 text-center text-xs font-black text-slate-800 bg-yellow-400 rounded py-2">{datos.final_res}</div>
                )}
              </div>
            </div>

            {/* COLUMNA 3: CAMPEÓN */}
            <div className="w-1/3 flex justify-end">
              <div className="bg-yellow-400 border-4 border-yellow-200 rounded-3xl p-6 shadow-xl w-full max-w-[250px] text-center transform hover:scale-105 transition-transform duration-300">
                <div className="text-6xl mb-2 animate-bounce">🏆</div>
                <h4 className="text-[10px] font-black text-yellow-700 uppercase mb-2 tracking-widest">CAMPEÓN {serieActiva}</h4>
                <input 
                  type="text" 
                  placeholder="CLUB CAMPEÓN" 
                  value={datos.campeon} 
                  onChange={e => handleInput('campeon', e.target.value)} 
                  readOnly={!esAdmin} 
                  className={`w-full font-black text-center text-xl md:text-2xl uppercase outline-none rounded p-2 ${esAdmin ? 'bg-white text-slate-800 shadow-inner' : 'bg-transparent text-slate-900 border-none placeholder-yellow-600/50'}`} 
                />
              </div>
            </div>

          </div>

          {/* BOTÓN GUARDAR (SOLO ADMIN) */}
          {esAdmin && (
            <div className="mt-12 flex justify-center border-t border-slate-100 pt-8">
              <button type="submit" disabled={guardando} className="bg-[#1e3a8a] text-white px-12 py-4 rounded-xl font-black shadow-lg hover:bg-blue-800 transition uppercase tracking-widest text-sm disabled:opacity-50">
                {guardando ? "Guardando Cuadro..." : `Guardar Liguilla ${serieActiva}`}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}