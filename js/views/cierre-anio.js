import { el, $, escapeHtml, refreshIcons, toast, confirmModal, loading } from "../ui.js";
import { renderShell } from "./shell.js";
import { getCurrentUser } from "../auth.js";
import { listGrados } from "../services/grados.js";
import { buildPropuesta, aplicarCierre } from "../services/cierre.js";

export async function renderCierreAnio({ mount }) {
  const body = el(`
    <section>
      <h1>Cierre e inicio de año</h1>
      <p class="muted" style="margin: 6px 0 16px;">Revisa la promoción propuesta y ajusta los casos especiales antes de aplicar.</p>
      <div class="card">
        <div class="row">
          <div class="field" style="margin:0;"><label>Año a cerrar</label>
            <input id="anio" type="number" value="${new Date().getFullYear()}" min="2020" max="2100">
          </div>
          <button id="cargar" class="btn btn-secondary"><i data-lucide="refresh-cw"></i> Cargar propuesta</button>
        </div>
      </div>
      <div id="contenido"></div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();

  const grados = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);

  $("#cargar", body)?.addEventListener("click", cargar);
  cargar();

  async function cargar() {
    const $c =$("#contenido", body);
    loading($c);
    let propuestaBase = await buildPropuesta() || [];

    let decisiones = propuestaBase.map(d => {
      const gradoActual = grados.find(g => g.id === d?.estudiante?.grado_actual_id);
      let orden = gradoActual ? gradoActual.orden : 9999;
      
      const nom = (d?.estudiante?.grado_actual_nombre || "").toLowerCase();
      if (nom.includes("jardin") || nom.includes("jardín")) {
        orden = Math.min(orden, -20);
      } else if (nom.includes("transicion") || nom.includes("transición") || nom.match(/^tr/)) {
        orden = Math.min(orden, -10);
      }

      return {
        estudianteId: d?.estudiante?.id,
        estudiante: d?.estudiante || {},
        action: d?.action === "promover_manual" ? "manual" : d?.action,
        nuevo_grado_id: d?.nuevo_grado_id,
        nuevo_grado_nombre: d?.nuevo_grado_nombre,
        orden_actual: orden
      };
    });

    decisiones.sort((a, b) => {
      if (a.orden_actual !== b.orden_actual) {
        return a.orden_actual - b.orden_actual;
      }
      
      const gradoA = (a.estudiante.grado_actual_nombre || "").toLowerCase();
      const gradoB = (b.estudiante.grado_actual_nombre || "").toLowerCase();
      if (gradoA !== gradoB) {
        return gradoA.localeCompare(gradoB);
      }

      const nombreA = `${a.estudiante.apellidos||""} ${a.estudiante.nombres||""}`.toLowerCase();
      const nombreB = `${b.estudiante.apellidos||""} ${b.estudiante.nombres||""}`.toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    if (!decisiones.length) { $c.innerHTML = `<div class="empty">No hay estudiantes activos.</div>`; return; }

    function render() {
      $c.innerHTML = `
        <div class="card">
          <div class="row between" style="margin-bottom:8px;">
            <strong>${decisiones.length} estudiantes</strong>
            <div class="row">
              <button class="btn btn-ghost" data-bulk="promover"><i data-lucide="arrow-up-circle"></i> Promover todos</button>
              <button class="btn btn-primary" id="aplicar"><i data-lucide="check"></i> Aplicar cierre</button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Estudiante</th><th>Grado actual</th><th>Acción</th><th>Nuevo grado</th></tr></thead>
              <tbody>
              ${decisiones.map((d, i) => `
                <tr>
                  <td>${escapeHtml(d?.estudiante?.apellidos || "")} ${escapeHtml(d?.estudiante?.nombres || "")}</td>
                  <td>${escapeHtml(d?.estudiante?.grado_actual_nombre||"")}</td>
                  <td>
                    <select data-i="${i}" data-field="action">
                      <option value="promover" ${d.action==="promover"?"selected":""}>Promover</option>
                      <option value="repetir" ${d.action==="repetir"?"selected":""}>Repetir</option>
                      <option value="retirar" ${d.action==="retirar"?"selected":""}>Retirar</option>
                      <option value="egresar" ${d.action==="egresar"?"selected":""}>Egresar</option>
                    </select>
                  </td>
                  <td>
                    <select data-i="${i}" data-field="grado" ${["promover","manual"].includes(d.action)?"":"disabled"}>
                      <option value="">—</option>
                      ${grados.map(g => `<option value="${g.id}" ${d.nuevo_grado_id===g.id?"selected":""}>${escapeHtml(g.nombre)}</option>`).join("")}
                    </select>
                  </td>
                </tr>
              `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      refreshIcons();

      $c.querySelectorAll("select[data-field]").forEach(sel => sel.addEventListener("change", () => {
        const i = Number(sel.dataset.i);
        if (sel.dataset.field === "action") {
          decisiones[i].action = sel.value;
        } else if (sel.dataset.field === "grado") {
          const g = grados.find(x => x.id === sel.value);
          decisiones[i].nuevo_grado_id = g?.id || null;
          decisiones[i].nuevo_grado_nombre = g?.nombre || null;
        }
        render();
      }));

      $c.querySelector('[data-bulk="promover"]')?.addEventListener("click", () => {
        decisiones = decisiones.map(d => ({ ...d, action: d.action === "egresar" ? "egresar" : "promover" }));
        render();
      });

      $c.querySelector("#aplicar")?.addEventListener("click", async () => {
        const invalid = decisiones.find(d => d.action === "promover" && !d.nuevo_grado_id);
        if (invalid) { toast(`Falta asignar grado a ${invalid.estudiante.nombres}`, {type:"error"}); return; }
        const ok = await confirmModal({ title: "Aplicar cierre de año", body: `<p>Se procesarán <strong>${decisiones.length}</strong> estudiantes. Esta acción modifica los grados actuales. ¿Continuar?</p>`, confirmText: "Aplicar" });
        if (!ok) return;
        try {
          const user = getCurrentUser() || { uid: "desconocido" };
          const res = await aplicarCierre({
            anio: Number($("#anio", body).value),
            decisiones: decisiones.map(d => ({ estudianteId: d.estudianteId, action: d.action, nuevo_grado_id: d.nuevo_grado_id, nuevo_grado_nombre: d.nuevo_grado_nombre })),
            ejecutado_por: user.uid,
          });
          toast(`Listo: ${res.promovidos} promovidos, ${res.repetidos} repiten, ${res.retirados} retirados, ${res.egresados} egresados.`, {type:"success", duration:6000});
        } catch (e) {
          toast(e.message || "Error aplicando cierre.", {type:"error"});
        }
      });
    }
    render();
  }
}