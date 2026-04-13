// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <-- ¡Nuevo módulo para fotos!

const firebaseConfig = {
  apiKey: "AIzaSyA-Lv5Gy37JPDm5rwZR1KX89OXdOBvPZgo",
  authDomain: "futbian.firebaseapp.com",
  projectId: "futbian",
  storageBucket: "futbian.firebasestorage.app",
  messagingSenderId: "367933987767",
  appId: "1:367933987767:web:f544fa4f438bfe9a7fa632",
  measurementId: "G-DM5D6KH2JW"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <-- Lo exportamos para usarlo en las actas