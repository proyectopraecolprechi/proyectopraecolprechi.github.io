import { db, isConfigured } from "./firebase-config.js";
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

let currentUser = null;
const listeners = new Set();

export function getCurrentUser() { return currentUser; }
export function isAdmin() { return currentUser?.rol === "admin"; }
export function isOperador() { return currentUser?.rol === "operador"; }

export function onUserChange(cb) {
  listeners.add(cb);
  cb(currentUser);
  return () => listeners.delete(cb);
}

function emit() {
  if (currentUser) {
    localStorage.setItem("prae_user", JSON.stringify(currentUser));
  } else {
    localStorage.removeItem("prae_user");
  }
  listeners.forEach(cb => cb(currentUser));
}

export async function login(email, password) {
  if (!isConfigured) throw new Error("Firebase no está configurado. Edita js/firebase-config.js.");
  
  const q = query(collection(db, "usuarios_sistema"), where("email", "==", email.toLowerCase().trim()));
  const snap = await getDocs(q);
  
  if (snap.empty) throw new Error("El usuario no existe.");
  
  let foundUser = null;
  let foundId = null;
  snap.forEach(d => { foundUser = d.data(); foundId = d.id; });
  
  if (foundUser.password !== password) {
    throw new Error("Contraseña incorrecta.");
  }
  
  currentUser = { uid: foundId, ...foundUser };
  emit();
  return currentUser;
}

export async function registrarUsuario(email, password, nombre) {
  const correoLimpio = email.toLowerCase().trim();
  const id = correoLimpio.replace(/[^a-z0-9]/g, '_');
  const ref = doc(db, "usuarios_sistema", id);
  
  const docSnap = await getDoc(ref);
  if (docSnap.exists()) throw new Error("Este correo ya está registrado.");

  const newUser = {
    nombre: nombre || correoLimpio.split("@")[0],
    email: correoLimpio,
    password: password,
    rol: "operador",
    creado_en: serverTimestamp()
  };
  
  await setDoc(ref, newUser);
  currentUser = { uid: id, ...newUser };
  emit();
  return currentUser;
}

export async function logout() {
  currentUser = null;
  emit();
}

export function initAuth() {
  if (!isConfigured) {
    emit();
    return;
  }
  
  const saved = localStorage.getItem("prae_user");
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
    } catch(e) {
      currentUser = null;
    }
  }
  emit();
}