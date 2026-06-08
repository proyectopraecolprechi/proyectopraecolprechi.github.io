import { db } from "../firebase-config.js";
import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const COL = "estadisticas";

function periodSuffix(anio, mes) {
  if (!anio) return "total";
  if (!mes) return String(anio);
  return `${anio}_${String(mes).padStart(2, "0")}`;
}

export async function getGlobal({ anio = null, mes = null } = {}) {
  const id = `global_${periodSuffix(anio, mes)}`;
  const s = await getDoc(doc(db, COL, id));
  return s.exists() ? s.data() : { total_kilos: 0, total_registros: 0 };
}

export async function getGradoStat(grado, { anio = null, mes = null } = {}) {
  const id = `grado_${grado}_${periodSuffix(anio, mes)}`;
  const s = await getDoc(doc(db, COL, id));
  return s.exists() ? s.data() : { total_kilos: 0, total_registros: 0 };
}

export async function rankingGrados(grados, { anio = null, mes = null } = {}) {
  const results = await Promise.all(grados.map(async g => {
    const stat = await getGradoStat(g.nombre, { anio, mes });
    return { grado: g.nombre, total_kilos: stat.total_kilos || 0, total_registros: stat.total_registros || 0 };
  }));
  return results.sort((a, b) => b.total_kilos - a.total_kilos);
}

export async function topEstudiantes({ anio = null, max = 50 } = {}) {
  // Lee documentos estudiante_*_(anio|total).
  const prefix = "estudiante_";
  const suffix = anio ? `_${anio}` : "_total";
  // Firestore no soporta wildcard => leemos por rango usando documentId().
  // Estrategia: usamos un campo "kind" futuro o limitamos por orderBy total_kilos.
  // Más simple: leemos todos los docs de estadisticas y filtramos en cliente.
  // Para mantenerlo barato, no debería haber millones de estudiantes.
  const snap = await getDocs(collection(db, COL));
  const arr = [];
  snap.forEach(d => {
    const id = d.id;
    if (!id.startsWith(prefix)) return;
    if (!id.endsWith(suffix)) return;
    const data = d.data();
    const estudianteId = id.slice(prefix.length, id.length - suffix.length);
    arr.push({ estudianteId, total_kilos: data.total_kilos || 0, total_registros: data.total_registros || 0 });
  });
  arr.sort((a, b) => b.total_kilos - a.total_kilos);
  return arr.slice(0, max);
}

