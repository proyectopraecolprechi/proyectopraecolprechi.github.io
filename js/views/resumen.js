import { el, $, escapeHtml, formatKg, refreshIcons, loading } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados } from "../services/grados.js";
import { getEstudiante } from "../services/estudiantes.js";
import { getGlobal, rankingGrados, topEstudiantes } from "../services/estadisticas.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export async function renderResumen({ mount }) {
  const anioActual = new Date().getFullYear();
  const body = el(`
    <section>
      <h1>Resumen</h1>
      <div class="card">
        <div class="row" style="gap:12px;">
          <div class="field" style="flex:1; margin:0;">
            <label for="anio">Año</label>
            <select id="anio"></select>
          </div>
          <div class="field" style="flex:1; margin:0;">
            <label for="mes">Mes</label>
            <select id="mes">
              <option value="">Todo el año</option>
              ${MESES.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      <div id="stats" class="stat-grid"></div>

      <div class="card">
        <h2>Ranking de grados</h2>
        <div id="ranking"><div class="spinner"></div></div>
      </div>

      <div class="card">
        <h2>Top 50 estudiantes</h2>
        <div id="top"><div class="spinner"></div></div>
      </div>
    </section>
  `);

  mount.appendChild(renderShell(body));
  refreshIcons();

  const $anio = $("#anio", body);
  const $mes = $("#mes", body);
  for (let y = anioActual; y >= anioActual - 5; y--) $anio.appendChild(el(`<option value="${y}">${y}</option>`));

  const grados = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);

  async function refresh() {
    const anio = Number($anio.value);
    const mes = $mes.value ? Number($mes.value) : null;

    // Stats
    const $stats = $("#stats", body);
    $stats.innerHTML = `<div class="spinner"></div>`;
    const global = await getGlobal({ anio, mes });
    $stats.innerHTML = `
      <div class="stat"><div class="label">Total kilos</div><div class="value">${formatKg(global.total_kilos)}</div><div class="sub">${mes ? MESES[mes-1]+" "+anio : anio}</div></div>
      <div class="stat"><div class="label">Registros</div><div class="value">${global.total_registros || 0}</div></div>
    `;

    // los tops
    const $rank = $("#ranking", body);
    loading($rank);
    const ranking = await rankingGrados(grados, { anio, mes });
    if (!ranking.some(r => r.total_kilos > 0)) { $rank.innerHTML = `<div class="empty">Sin datos en este periodo.</div>`; }
    else {
      $rank.innerHTML = `<div class="rank-list">` + ranking.map((r, i) => `
        <div class="rank-item ${i<3?"top-"+(i+1):""}">
          <div class="pos">${i+1}</div>
          <div class="name">${escapeHtml(r.grado)}</div>
          <div class="kg">${formatKg(r.total_kilos)}</div>
        </div>
      `).join("") + `</div>`;
    }

    // estudiantes tops
    const $top = $("#top", body);
    loading($top);
    const tops = await topEstudiantes({ anio, max: 50 });
    if (!tops.length) { $top.innerHTML = `<div class="empty">Sin datos.</div>`; }
    else {
      const enriched = await Promise.all(tops.map(async t => {
        try { const est = await getEstudiante(t.estudianteId); return { ...t, est }; }
        catch { return { ...t, est: null }; }
      }));
      $top.innerHTML = `<div class="rank-list">` + enriched.map((r, i) => `
        <div class="rank-item ${i<3?"top-"+(i+1):""}">
          <div class="pos">${i+1}</div>
          <div class="name">
            <a href="#/estudiante/${r.estudianteId}">${r.est ? escapeHtml(`${r.est.apellidos||""} ${r.est.nombres||""}`) : "Estudiante " + r.estudianteId}</a>
            <div class="small muted">${r.est?.grado_actual_nombre || ""}</div>
          </div>
          <div class="kg">${formatKg(r.total_kilos)}</div>
        </div>
      `).join("") + `</div>`;
    }
  }

  $anio.addEventListener("change", refresh);
  $mes.addEventListener("change", refresh);
  refresh();
}