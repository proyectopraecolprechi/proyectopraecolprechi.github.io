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
  // FILTRO: Excluir grados que tengan 0 kg
  return results.filter(r => r.total_kilos > 0).sort((a, b) => b.total_kilos - a.total_kilos);
}

export async function topEstudiantes({ anio = null, max = 50 } = {}) {
  const prefix = "estudiante_";
  const suffix = anio ? `_${anio}` : "_total";
  const snap = await getDocs(collection(db, COL));
  const arr = [];
  
  snap.forEach(d => {
    const id = d.id;
    if (!id.startsWith(prefix)) return;
    if (!id.endsWith(suffix)) return;
    
    const data = d.data();
    
    // filtro por si un man tiene 0 kg
    if ((data.total_kilos || 0) <= 0) return;

    const estudianteId = id.slice(prefix.length, id.length - suffix.length);
    arr.push({ estudianteId, total_kilos: data.total_kilos || 0, total_registros: data.total_registros || 0 });
  });
  
  arr.sort((a, b) => b.total_kilos - a.total_kilos);
  return arr.slice(0, max);
}