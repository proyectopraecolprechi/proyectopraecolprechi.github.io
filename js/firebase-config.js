// =====================================================================
// CONFIGURACIÓN DE FIREBASE
// =====================================================================
// 1) Crea un proyecto en https://console.firebase.google.com
// 2) Activa Authentication > Email/Password
// 3) Activa Firestore Database (modo producción)
// 4) En "Configuración del proyecto" copia los datos web y pégalos abajo.
// 5) Sube las reglas de /firestore.rules a tu proyecto.
// 6) Crea tu primer usuario admin (ver README.md).
//
// Estos valores son PÚBLICOS (no son secretos). La seguridad real está
// en las reglas de Firestore.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export const firebaseConfig = {
    apiKey: "AIzaSyD4psBJqHgj7QHHYunAIvvzTuYK-250zCk",
    authDomain: "prae1-110cc.firebaseapp.com",
    projectId: "prae1-110cc",
    storageBucket: "prae1-110cc.firebasestorage.app",
    messagingSenderId: "268080179853",
    appId: "1:268080179853:web:6e9673a966b374361010c4",
    measurementId: "G-HDZXRH9L7L"
  };

export const isConfigured = !Object.values(firebaseConfig).some(v => String(v).startsWith("REEMPLAZAR"));

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };