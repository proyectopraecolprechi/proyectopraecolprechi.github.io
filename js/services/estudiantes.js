import { db } from "../firebase-config.js";
import {
  collection, query, where, orderBy, getDocs, doc, getDoc,
  addDoc, updateDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const COL = "estudiantes";

export async function listByGrado(gradoId, { soloActivos = true } = {}) {
  let q;
  if (soloActivos) {
    q = query(collection(db, COL), where("grado_actual_id", "==", gradoId), where("estado", "==", "activo"));
  } else {
    q = query(collection(db, COL), where("grado_actual_id", "==", gradoId));
  }
  const snap = await getDocs(q);
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  out.sort((a, b) => (`${a.apellidos} ${a.nombres}`).localeCompare(`${b.apellidos} ${b.nombres}`));
  return out;
}

export async function listAll() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getEstudiante(id) {
  const s = await getDoc(doc(db, COL, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function createEstudiante(data) {
  return await addDoc(collection(db, COL), { ...data, estado: data.estado || "activo", creado_en: serverTimestamp() });
}

export async function updateEstudiante(id, patch) {
  await updateDoc(doc(db, COL, id), patch);
}

export async function setEstado(id, estado) {
  await updateDoc(doc(db, COL, id), { estado });
}




import {
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";



// ... (Tus funciones existentes: listByGrado, listAll, getEstudiante, createEstudiante, updateDoc)

/**
 * Elimina definitivamente un documento de estudiante de la colección en Firestore
 * @param {string} id - UID del documento del estudiante
 */
export async function deleteEstudianteFisico(id) {
  await deleteDoc(doc(db, COL, id));
}