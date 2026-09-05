import { db } from "../firebase-config.js";
import {
  collection, query, orderBy, where, getDocs, doc, getDoc,
  addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const COL = "grados";

export async function listGrados({ soloActivos = true } = {}) {
  const q = soloActivos
    ? query(collection(db, COL), where("activo", "==", true), orderBy("orden"))
    : query(collection(db, COL), orderBy("orden"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getGrado(id) {
  const s = await getDoc(doc(db, COL, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function createGrado({ nombre, orden = 0, es_virtual = false }) {
  return await addDoc(collection(db, COL), { nombre, orden, es_virtual, activo: true, creado_en: serverTimestamp() });
}

export async function updateGrado(id, patch) {
  await updateDoc(doc(db, COL, id), patch);
}

export async function deleteGrado(id) {
  await deleteDoc(doc(db, COL, id));
}

export async function seedGradosIfEmpty() {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) return false;
  
  const secciones = ["A", "B", "C", "D"];
  let orden = 1;
  const writes = [];

  for (const s of secciones) {
    writes.push(addDoc(collection(db, COL), { nombre: `Transición ${s}`, orden: orden++, es_virtual: false, activo: true, creado_en: serverTimestamp() }));
  }

  for (let i = 1; i <= 11; i++) {
    for (const s of secciones) {
      writes.push(addDoc(collection(db, COL), { nombre: `${i}${s}`, orden: orden++, es_virtual: false, activo: true, creado_en: serverTimestamp() }));
    }
  }

  writes.push(addDoc(collection(db, COL), { nombre: "Externos", orden: 999, es_virtual: true, activo: true, creado_en: serverTimestamp() }));
  
  await Promise.all(writes);
  return true;
}