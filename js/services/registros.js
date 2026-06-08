import { db } from "../firebase-config.js";
import {
  collection, doc, addDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
  writeBatch, increment,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const COL = "registros_reciclaje";
const STATS = "estadisticas";

function statDocs({ grado, estudianteId, fecha }) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const ids = [
    `global_${a}`,
    `global_${a}_${m}`,
    `global_total`,
    `grado_${grado}_${a}`,
    `grado_${grado}_${a}_${m}`,
    `grado_${grado}_total`,
  ];
  if (estudianteId) {
    ids.push(`estudiante_${estudianteId}_${a}`);
    ids.push(`estudiante_${estudianteId}_total`);
  }
  return ids;
}

export async function createRegistro({
  id_estudiante, grado_snapshot, kilos, id_operador, operador_nombre,
  es_externo = false, donante_nombre = null, descripcion = null,
}) {
  const fecha = new Date();
  const kg = Number(kilos);
  if (!grado_snapshot) throw new Error("Grado requerido.");
  if (!Number.isFinite(kg) || kg <= 0) throw new Error("Kilos inválidos.");
  if (kg > 5000) throw new Error("Valor de kilos demasiado alto.");

  const payload = {
    id_estudiante: id_estudiante || null,
    grado_snapshot,
    kilos: Math.round(kg * 100) / 100,
    fecha_hora: Timestamp.fromDate(fecha),
    id_operador,
    operador_nombre: operador_nombre || null,
    es_externo: !!es_externo,
    donante_nombre: donante_nombre || null,
    descripcion: descripcion || null,
  };

  // 1) Crear registro
  const ref = await addDoc(collection(db, COL), payload);

  // 2) Incrementos en agregados
  const batch = writeBatch(db);
  const ids = statDocs({ grado: grado_snapshot, estudianteId: payload.id_estudiante, fecha });
  ids.forEach(id => {
    batch.set(doc(db, STATS, id), {
      total_kilos: increment(payload.kilos),
      total_registros: increment(1),
      actualizado_en: serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();

  return { id: ref.id, ...payload };
}

export async function deleteRegistro(id) {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const r = snap.data();
  const fecha = r.fecha_hora?.toDate?.() || new Date();

  await deleteDoc(ref);

  const batch = writeBatch(db);
  const ids = statDocs({ grado: r.grado_snapshot, estudianteId: r.id_estudiante, fecha });
  ids.forEach(id => {
    batch.set(doc(db, STATS, id), {
      total_kilos: increment(-r.kilos),
      total_registros: increment(-1),
      actualizado_en: serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

export async function historialEstudiante(estudianteId, max = 200) {
  const q = query(
    collection(db, COL),
    where("id_estudiante", "==", estudianteId),
    orderBy("fecha_hora", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function ultimosDelOperador(operadorId, max = 20) {
  const q = query(
    collection(db, COL),
    where("id_operador", "==", operadorId),
    orderBy("fecha_hora", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}