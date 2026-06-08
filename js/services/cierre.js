import { db } from "../firebase-config.js";
import {
  collection, doc, getDocs, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { listGrados } from "./grados.js";
import { listAll as listEstudiantes } from "./estudiantes.js";

// Propuesta automática: 6A→7A, 11B→egresado
export async function buildPropuesta() {
  const grados = await listGrados({ soloActivos: true });
  const reales = grados.filter(g => !g.es_virtual);
  const byName = Object.fromEntries(reales.map(g => [g.nombre, g]));

  const estudiantes = (await listEstudiantes()).filter(e => e.estado === "activo");

  return estudiantes.map(est => {
    const nombre = est.grado_actual_nombre || "";
    const m = nombre.match(/^(\d+)([A-Z]?)$/);
    let propuesta = { action: "promover", nuevo_grado_id: null, nuevo_grado_nombre: null };
    if (m) {
      const nivel = parseInt(m[1], 10);
      const seccion = m[2] || "";
      if (nivel >= 11) {
        propuesta = { action: "egresar", nuevo_grado_id: null, nuevo_grado_nombre: null };
      } else {
        const next = `${nivel + 1}${seccion}`;
        const g = byName[next];
        if (g) propuesta = { action: "promover", nuevo_grado_id: g.id, nuevo_grado_nombre: g.nombre };
        else propuesta = { action: "promover_manual", nuevo_grado_id: null, nuevo_grado_nombre: null };
      }
    } else {
      propuesta = { action: "manual", nuevo_grado_id: null, nuevo_grado_nombre: null };
    }
    return { estudiante: est, ...propuesta };
  });
}

// Aplica los cambios. `decisiones` es array de { estudianteId, action, nuevo_grado_id, nuevo_grado_nombre }
export async function aplicarCierre({ anio, decisiones, ejecutado_por }) {
  const batch = writeBatch(db);
  let promovidos = 0, repetidos = 0, retirados = 0, egresados = 0;

  for (const d of decisiones) {
    const ref = doc(db, "estudiantes", d.estudianteId);
    if (d.action === "promover" && d.nuevo_grado_id && d.nuevo_grado_nombre) {
      batch.update(ref, { grado_actual_id: d.nuevo_grado_id, grado_actual_nombre: d.nuevo_grado_nombre });
      promovidos++;
    } else if (d.action === "repetir") {
      repetidos++; // sin cambios
    } else if (d.action === "retirar") {
      batch.update(ref, { estado: "inactivo" });
      retirados++;
    } else if (d.action === "egresar") {
      batch.update(ref, { estado: "inactivo", grado_actual_nombre: "Egresado" });
      egresados++;
    }
  }

  batch.set(doc(db, "cierres_anio", String(anio)), {
    anio: Number(anio),
    ejecutado_por,
    ejecutado_en: serverTimestamp(),
    resumen: { promovidos, repetidos, retirados, egresados, total: decisiones.length },
  });

  await batch.commit();
  return { promovidos, repetidos, retirados, egresados, total: decisiones.length };
}