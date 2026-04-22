'use client'
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  usuario: User | null;
  rol: 'admin' | 'delegado' | null;
  club: string | null;
  cargando: boolean;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  rol: null,
  club: null,
  cargando: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [rol, setRol] = useState<'admin' | 'delegado' | null>(null);
  const [club, setClub] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        setUsuario(user);
        try {
          const emailLimpio = user.email.toLowerCase().trim();
          const docRef = doc(db, "asociaciones/san_fabian/usuarios_permisos", emailLimpio);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setRol(docSnap.data().rol);
            setClub(docSnap.data().club || null);
          } else {
            setRol(null);
            setClub(null);
          }
        } catch (error) {
          console.error("Error obteniendo permisos:", error);
          setRol(null);
        }
      } else {
        setUsuario(null);
        setRol(null);
        setClub(null);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, rol, club, cargando }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);