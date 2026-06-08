import { auth, db, isConfigured } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

let currentUser = null;        // { uid, email, nombre, rol }
const listeners = new Set();

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.rol === "admin"; }
export function isOperador() { return currentUser?.rol === "operador"; }

export function onUserChange(cb) {
  listeners.add(cb);
  cb(currentUser);
  return () => listeners.delete(cb);
}

function emit() { listeners.forEach(cb => cb(currentUser)); }

export async function login(email, password) {
  if (!isConfigured) throw new Error("Firebase no está configurado. Edita js/firebase-config.js.");
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  if (auth) await signOut(auth);
}

export function initAuth() {
  if (!isConfigured) {
    // Sin configurar: dejamos currentUser en null y la app mostrará el aviso.
    emit();
    return;
  }
  onAuthStateChanged(auth, async (user) => {
    if (!user) { 
      currentUser = null; 
      emit(); 
      return; 
    }
    try {
      const ref = doc(db, "usuarios_sistema", user.uid);
      const snap = await getDoc(ref);
      let profile;
      
      if (snap.exists()) {
        profile = snap.data();
      } else {
        // Esperamos a que se cree el documento ANTES de emitir
        profile = { nombre: user.email.split("@")[0], email: user.email, rol: "operador", creado_en: serverTimestamp() };
        await setDoc(ref, profile);
      }
      
      currentUser = { uid: user.uid, email: user.email, ...profile };
      // Solo emitimos al enrutador cuando ya sabemos con certeza el rol
      emit(); 
      
    } catch (e) {
      console.error("Error cargando perfil:", e);
      currentUser = { uid: user.uid, email: user.email, nombre: user.email, rol: "operador" };
      emit();
    }
  });
}