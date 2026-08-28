import { el, $, escapeHtml, formatKg, formatDateTime, refreshIcons, loading, empty, confirmModal, toast } from "../ui.js";
import { renderShell } from "./shell.js";
import { getEstudiante } from "../services/estudiantes.js";
// Se importa desde registro.js (en singular)
import { historialEstudiante, deleteRegistro } from "../services/registros.js";

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
    <h1 style="margin-top:8px;">${escapeHtml(est.apellidos || "")} ${escapeHtml(est.nombres || "")}</h1>
    <p class="muted">${escapeHtml(est.grado_actual_nombre || "—")} · <span class="badge ${est.estado}">${escapeHtml(est.estado || "")}</span></p>
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
        <div class="entry" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div><strong>${escapeHtml(r.grado_snapshot)}</strong></div>
            <div class="meta">${formatDateTime(r.fecha_hora)} · Operador: ${escapeHtml(r.operador_nombre || r.id_operador || "—")}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="kg">${formatKg(r.kilos)}</div>
            <button class="btn-icon btn-danger btn-eliminar-registro" data-id="${r.id}" data-kilos="${r.kilos}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
  refreshIcons();

  // Lógica para interceptar los clics de eliminación en el historial
  $lista.querySelectorAll('.btn-eliminar-registro').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const kilos = parseFloat(btn.dataset.kilos);
      
      const seguro = await confirmModal({
        title: "Eliminar registro",
        body: `¿Estás seguro de eliminar este registro de ${kilos} kg? Esto restará la cantidad de todas las estadísticas globales y del grado.`,
        danger: true,
        confirmText: "Sí, eliminar"
      });

      if (seguro) {
        try {
          await deleteRegistro(id);
          toast("Registro eliminado y estadísticas actualizadas", { type: "success" });
          // Recarga de forma reactiva la misma vista para actualizar el listado y el total acumulado
          renderHistorial({ mount, params });
        } catch (err) {
          toast("Error al eliminar: " + err.message, { type: "error" });
        }
      }
    };
  });
}