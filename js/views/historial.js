import { el, $, escapeHtml, formatKg, formatDateTime, refreshIcons, loading, empty } from "../ui.js";
import { renderShell } from "./shell.js";
import { getEstudiante } from "../services/estudiantes.js";
import { historialEstudiante } from "../services/registros.js";

export async function renderHistorial({ mount, params }) {
  const body = el(`
    <section>
      <a href="#/resumen" class="muted" style="font-size:.85rem;">← Volver</a>
      <div id="header"></div>
      <h2 style="margin: 20px 0 12px;">Historial de aportes</h2>
      <div id="lista"><div class="spinner"></div></div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();

  const est = await getEstudiante(params.id);
  const $h = $("#header", body);
  if (!est) { $h.innerHTML = `<h1>Estudiante no encontrado</h1>`; return; }
  $h.innerHTML = `
    <h1 style="margin-top:8px;">${escapeHtml(est.apellidos||"")} ${escapeHtml(est.nombres||"")}</h1>
    <p class="muted">${escapeHtml(est.grado_actual_nombre||"—")} · <span class="badge ${est.estado}">${escapeHtml(est.estado||"")}</span></p>
  `;

  const $lista = $("#lista", body);
  loading($lista);
  const items = await historialEstudiante(est.id, 500);
  if (!items.length) { empty($lista, "Sin registros."); return; }

  const total = items.reduce((a, r) => a + (r.kilos || 0), 0);
  $lista.innerHTML = `
    <div class="stat" style="margin-bottom:12px;">
      <div class="label">Total acumulado</div>
      <div class="value">${formatKg(total)}</div>
      <div class="sub">${items.length} registros</div>
    </div>
    <div class="timeline">
      ${items.map(r => `
        <div class="entry">
          <div>
            <div><strong>${escapeHtml(r.grado_snapshot)}</strong></div>
            <div class="meta">${formatDateTime(r.fecha_hora)} · Operador: ${escapeHtml(r.operador_nombre || r.id_operador || "—")}</div>
          </div>
          <div class="kg">${formatKg(r.kilos)}</div>
        </div>
      `).join("")}
    </div>
  `;
}