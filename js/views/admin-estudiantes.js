import { el, $, escapeHtml, refreshIcons, toast, loading, empty, debounce, confirmModal } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados } from "../services/grados.js";
import { listAll, createEstudiante, updateEstudiante, setEstado, deleteEstudianteFisico } from "../services/estudiantes.js";
import { db } from "../firebase-config.js";
import { collection, query, where, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { deleteRegistro } from "../services/registros.js";

export async function renderAdminEstudiantes({ mount }) {
  const body = el(`
    <section>
      <div class="row between">
        <h1>Estudiantes</h1>
        <button id="nuevo" class="btn btn-primary"><i data-lucide="user-plus"></i> Nuevo estudiante</button>
      </div>

      <div class="card">
        <div class="row" style="gap:12px;">
          <div class="field" style="flex:1; margin:0;">
            <label>Buscar</label>
            <input id="buscar" type="text" placeholder="Nombre, apellido o documento">
          </div>
          <div class="field" style="margin:0;">
            <label>Grado</label>
            <select id="f-grado"><option value="">Todos</option></select>
          </div>
          <div class="field" style="margin:0;">
            <label>Estado</label>
            <select id="f-estado">
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      <div id="tabla"><div class="spinner"></div></div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();

  const grados = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);
  $("#f-grado", body).innerHTML += grados.map(g => `<option value="${g.id}">${escapeHtml(g.nombre)}</option>`).join("");

  let estudiantes = [];
  async function reload() {
    loading($("#tabla", body));
    estudiantes = await listAll();
    apply();
  }

  function apply() {
    const q = $("#buscar", body).value.toLowerCase().trim();
    const fg = $("#f-grado", body).value;
    const fe = $("#f-estado", body).value;
    const filtered = estudiantes.filter(e => {
      if (q && !`${e.nombres||""} ${e.apellidos||""} ${e.documento||""}`.toLowerCase().includes(q)) return false;
      if (fg && e.grado_actual_id !== fg) return false;
      if (fe && e.estado !== fe) return false;
      return true;
    }).sort((a,b)=> (`${a.apellidos||""} ${a.nombres||""}`).localeCompare(`${b.apellidos||""} ${b.nombres||""}`));

    const $t = $("#tabla", body);
    if (!filtered.length) { empty($t, "Sin estudiantes."); return; }
    
    $t.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Apellidos</th><th>Nombres</th><th>Documento</th><th>Grado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(e => `
              <tr>
                <td>${escapeHtml(e.apellidos||"")}</td>
                <td>${escapeHtml(e.nombres||"")}</td>
                <td>${escapeHtml(e.documento||"")}</td>
                <td>${escapeHtml(e.grado_actual_nombre||"")}</td>
                <td><span class="badge ${e.estado}">${escapeHtml(e.estado||"")}</span></td>
                <td class="row">
                  <a class="btn btn-ghost" href="#/estudiante/${e.id}" title="Ver historial"><i data-lucide="history"></i></a>
                  <button class="btn btn-ghost" data-act="edit" data-id="${e.id}" title="Editar"><i data-lucide="pencil"></i></button>
                  <button class="btn btn-ghost" data-act="toggle" data-id="${e.id}">${e.estado==="activo"?"Inactivar":"Activar"}</button>
                  <button class="btn btn-ghost btn-danger" data-act="delete" data-id="${e.id}" title="Eliminar"><i data-lucide="trash"></i></button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    refreshIcons();
    
    $t.querySelectorAll("button[data-act]").forEach(btn => btn.addEventListener("click", async () => {
      const e = estudiantes.find(x => x.id === btn.dataset.id);
      if (!e) return;

      if (btn.dataset.act === "toggle") {
        setEstado(e.id, e.estado === "activo" ? "inactivo" : "activo").then(reload);
      } else if (btn.dataset.act === "edit") {
        openForm(e);
      } else if (btn.dataset.act === "delete") {
        const seguro = await confirmModal({
          title: "Eliminar estudiante",
          body: `¿Eliminar definitivamente a ${escapeHtml(e.nombres)} ${escapeHtml(e.apellidos)} y TODOS sus registros de peso? Esta acción restará sus kilos de las estadísticas globales y no se puede deshacer.`,
          danger: true,
          confirmText: "Sí, eliminar todo"
        });

        if (seguro) {
          try {
            loading($("#tabla", body));
            
            const qDocs = query(collection(db, "registros_reciclaje"), where("id_estudiante", "==", e.id));
            const snap = await getDocs(qDocs);
            
            if (!snap.empty) {
              for (const docSnap of snap.docs) {
                await deleteRegistro(docSnap.id);
              }
            }

            const qDocsAntiguos = query(collection(db, "registros"), where("id_estudiante", "==", e.id));
            const snapAntiguos = await getDocs(qDocsAntiguos);
            if (!snapAntiguos.empty) {
              const batchAntiguos = writeBatch(db);
              snapAntiguos.forEach(docSnap => {
                batchAntiguos.delete(docSnap.ref);
              });
              await batchAntiguos.commit();
            }

            await deleteEstudianteFisico(e.id);
            
            toast("Estudiante y todos sus aportes eliminados.", { type: "success" });
          } catch (err) {
            console.error(err);
            toast("Error al eliminar: " + err.message, { type: "error" });
          } finally {
            reload();
          }
        }
      }
    }));
  }

  $("#buscar", body).addEventListener("input", debounce(apply, 150));
  $("#f-grado", body).addEventListener("change", apply);
  $("#f-estado", body).addEventListener("change", apply);
  $("#nuevo", body).addEventListener("click", () => openForm(null));

  function openForm(est) {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>${est ? "Editar estudiante" : "Nuevo estudiante"}</h2>
          <div class="field-row cols-2">
            <div class="field"><label>Nombres</label><input id="e-nombres" value="${escapeHtml(est?.nombres||"")}"></div>
            <div class="field"><label>Apellidos</label><input id="e-apellidos" value="${escapeHtml(est?.apellidos||"")}"></div>
          </div>
          <div class="field"><label>Documento</label><input id="e-doc" value="${escapeHtml(est?.documento||"")}"></div>
          <div class="field"><label>Grado</label>
            <select id="e-grado">
              ${grados.map(g => `<option value="${g.id}" ${est?.grado_actual_id===g.id?"selected":""}>${escapeHtml(g.nombre)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label>Estado</label>
            <select id="e-estado">
              <option value="activo" ${est?.estado!=="inactivo"?"selected":""}>Activo</option>
              <option value="inactivo" ${est?.estado==="inactivo"?"selected":""}>Inactivo</option>
            </select>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">Cancelar</button>
            <button class="btn btn-primary" data-act="ok">Guardar</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", async e => {
      if (e.target === overlay || e.target.dataset?.act === "cancel") { overlay.remove(); return; }
      if (e.target.dataset?.act === "ok") {
        const nombres = overlay.querySelector("#e-nombres").value.trim();
        const apellidos = overlay.querySelector("#e-apellidos").value.trim();
        const documento = overlay.querySelector("#e-doc").value.trim();
        const gradoId = overlay.querySelector("#e-grado").value;
        const estado = overlay.querySelector("#e-estado").value;
        const grado = grados.find(g => g.id === gradoId);
        if (!nombres || !apellidos || !grado) return toast("Completa los campos.", {type:"error"});
        try {
          const payload = { nombres, apellidos, documento, grado_actual_id: grado.id, grado_actual_nombre: grado.nombre, estado };
          if (est) await updateEstudiante(est.id, payload);
          else await createEstudiante(payload);
          overlay.remove(); toast("Guardado.", {type:"success"}); reload();
        } catch(err){ toast(err.message,{type:"error"}); }
      }
    });
  }

  reload();
}