import { el, $, escapeHtml, formatKg, refreshIcons, loading } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados } from "../services/grados.js";
import { listAll as listEstudiantes } from "../services/estudiantes.js";
import { getGlobal, rankingGrados, topEstudiantes } from "../services/estadisticas.js";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export async function renderAdminReportes({ mount }) {
  const anioActual = new Date().getFullYear();
  const body = el(`
    <section>
      <h1>Reportes</h1>
      <div class="card">
        <div class="row">
          <div class="field" style="margin:0;"><label>Año</label><select id="anio"></select></div>
          <div class="field" style="margin:0;"><label>Mes</label>
            <select id="mes"><option value="">Todo el año</option>${MESES.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("")}</select>
          </div>
          <button id="csv" class="btn btn-secondary" style="margin-left:auto;"><i data-lucide="download"></i> Exportar CSV</button>
        </div>
      </div>
      <div id="stats" class="stat-grid"></div>
      <div class="card"><h2>Ranking de grados</h2><div id="ranking"><div class="spinner"></div></div></div>
      <div class="card"><h2>Top 50 estudiantes</h2><div id="top"><div class="spinner"></div></div></div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();

  const $anio = $("#anio", body);
  const $mes = $("#mes", body);
  for (let y = anioActual; y >= anioActual - 5; y--) $anio.appendChild(el(`<option value="${y}">${y}</option>`));

  const grados = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);
  const estudiantes = await listEstudiantes();
  const estById = Object.fromEntries(estudiantes.map(e => [e.id, e]));

  let lastRanking = [], lastTop = [];

  async function refresh() {
    const anio = Number($anio.value);
    const mes = $mes.value ? Number($mes.value) : null;
    const global = await getGlobal({ anio, mes });
    $("#stats", body).innerHTML = `
      <div class="stat"><div class="label">Total kilos</div><div class="value">${formatKg(global.total_kilos)}</div></div>
      <div class="stat"><div class="label">Registros</div><div class="value">${global.total_registros || 0}</div></div>
      <div class="stat"><div class="label">Grados activos</div><div class="value">${grados.length}</div></div>
      <div class="stat"><div class="label">Estudiantes</div><div class="value">${estudiantes.filter(e=>e.estado==="activo").length}</div></div>
    `;

    loading($("#ranking", body));
    lastRanking = await rankingGrados(grados, { anio, mes });
    $("#ranking", body).innerHTML = `<div class="rank-list">` + lastRanking.map((r,i)=>`
      <div class="rank-item ${i<3?"top-"+(i+1):""}"><div class="pos">${i+1}</div><div class="name">${escapeHtml(r.grado)}</div><div class="kg">${formatKg(r.total_kilos)}</div></div>
    `).join("") + `</div>`;

    loading($("#top", body));
    lastTop = await topEstudiantes({ anio, max: 50 });
    $("#top", body).innerHTML = `<div class="rank-list">` + lastTop.map((r,i)=>{
      const e = estById[r.estudianteId];
      // Si el estudiante fue eliminado, estById no lo encontrará, evitamos imprimir el ID.
      const nombreEst = e ? escapeHtml(`${e.apellidos||""} ${e.nombres||""}`) : "[Estudiante Eliminado]";
      
      return `<div class="rank-item ${i<3?"top-"+(i+1):""}">
        <div class="pos">${i+1}</div>
        <div class="name">
          <a href="#/estudiante/${r.estudianteId}">${nombreEst}</a>
          <div class="small muted">${e?.grado_actual_nombre || ""}</div>
        </div>
        <div class="kg">${formatKg(r.total_kilos)}</div>
      </div>`;
    }).join("") + `</div>`;
  }

  $anio.addEventListener("change", refresh);
  $mes.addEventListener("change", refresh);
  $("#csv", body).addEventListener("click", () => {
    const rows = [["Tipo","Posición","Nombre","Kilos","Registros"]];
    lastRanking.forEach((r,i) => rows.push(["Grado", i+1, r.grado, r.total_kilos, r.total_registros]));
    
    lastTop.forEach((r,i) => {
      const e = estById[r.estudianteId];
      // Misma lógica de prevención para el CSV
      const nombreEst = e ? `${e.apellidos||""} ${e.nombres||""}` : "[Estudiante Eliminado]";
      rows.push(["Estudiante", i+1, nombreEst, r.total_kilos, r.total_registros]);
    });
    
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_prae_${$anio.value}${$mes.value?"_"+$mes.value:""}.csv`;
    a.click();
  });

  refresh();
}