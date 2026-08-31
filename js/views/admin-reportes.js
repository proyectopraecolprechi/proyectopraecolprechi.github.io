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
          <button id="btn-excel" class="btn btn-primary" style="margin-left:auto; background: #0F172A; border-color: #0F172A; color: white;">
            <i data-lucide="file-spreadsheet"></i> Exportar a Excel
          </button>
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
  
  $("#btn-excel", body).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const originalHTML = btn.innerHTML;
    // Efecto de carga en el botón
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:8px;border-color:white;border-bottom-color:transparent;"></div> Procesando...`;
    btn.disabled = true;

    try {
      // 1. Cargar la librería ExcelJS dinámicamente si no existe
      if (!window.ExcelJS) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js";
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const wb = new window.ExcelJS.Workbook();
      
      // 2. Definir estilos limpios, oscuros y modernos
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Pizarra oscuro moderno
      const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11, name: 'Calibri' };
      const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Gris/Azul muy claro para intercalar
      const whiteFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Blanco
      const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Función auxiliar para aplicar bordes y estilo a una fila
      const styleRow = (row, isHeader = false, isAlt = false) => {
        row.eachCell(cell => {
          cell.border = borderStyle;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (isHeader) {
            cell.fill = headerFill;
            cell.font = headerFont;
          } else {
            cell.fill = isAlt ? altRowFill : whiteFill;
            cell.font = { size: 11, name: 'Calibri', color: { argb: 'FF334155' } };
          }
        });
        row.height = isHeader ? 25 : 20;
      };

      // --- HOJA 1: RANKING DE GRADOS ---
      const wsGrados = wb.addWorksheet("Ranking Grados");
      wsGrados.columns = [
        { header: "Posición", key: "pos", width: 12 },
        { header: "Nombre del Grado", key: "nombre", width: 30 },
        { header: "Total Kilos", key: "kilos", width: 18 },
        { header: "Cant. Registros", key: "registros", width: 18 }
      ];

      styleRow(wsGrados.getRow(1), true); // Dar estilo a la cabecera

      lastRanking.forEach((r, i) => {
        const row = wsGrados.addRow({
          pos: i + 1,
          nombre: r.grado,
          kilos: parseFloat(r.total_kilos).toFixed(2),
          registros: r.total_registros
        });
        styleRow(row, false, i % 2 !== 0); // Intercalar colores
      });

      // --- HOJA 2: TOP ESTUDIANTES ---
      const wsEstudiantes = wb.addWorksheet("Top Estudiantes");
      wsEstudiantes.columns = [
        { header: "Posición", key: "pos", width: 12 },
        { header: "Nombre del Estudiante", key: "nombre", width: 40 },
        { header: "Grado", key: "grado", width: 20 },
        { header: "Total Kilos", key: "kilos", width: 18 },
        { header: "Cant. Registros", key: "registros", width: 18 }
      ];

      styleRow(wsEstudiantes.getRow(1), true); // Dar estilo a la cabecera

      lastTop.forEach((r, i) => {
        const e = estById[r.estudianteId];
        const nombreEst = e ? `${e.apellidos || ""} ${e.nombres || ""}` : "[Estudiante Eliminado]";
        const gradoEst = e ? (e.grado_actual_nombre || "") : "N/A";
        
        const row = wsEstudiantes.addRow({
          pos: i + 1,
          nombre: nombreEst,
          grado: gradoEst,
          kilos: parseFloat(r.total_kilos).toFixed(2),
          registros: r.total_registros
        });
        styleRow(row, false, i % 2 !== 0); // Intercalar colores
      });

      // 3. Generar archivo XLSX y forzar descarga
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Reporte_Colegio_Presentacion_${$anio.value}${$mes.value ? "_" + $mes.value : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);

    } catch (error) {
      console.error("Error exportando a Excel:", error);
      alert("Error al generar el archivo. Por favor verifica tu conexión a internet e inténtalo de nuevo.");
    } finally {
      // Restaurar el botón a su estado normal
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  });

  refresh();
}