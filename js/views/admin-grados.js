import { el, $, escapeHtml, refreshIcons, toast, confirmModal, loading } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados, createGrado, updateGrado, deleteGrado, seedGradosIfEmpty } from "../services/grados.js";
import { listAll } from "../services/estudiantes.js"; // Importamos listAll para ver los estudiantes

export async function renderAdminGrados({ mount }) {
  const body = el(`
    <section>
      <div class="row between"><h1>Grados</h1>
        <button id="nuevo" class="btn btn-primary"><i data-lucide="plus"></i> Nuevo grado</button>
      </div>
      <p class="muted" style="margin: 6px 0 16px;">Grados reales y grados virtuales (ej. Externos).</p>
      <div id="tabla"><div class="spinner"></div></div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();

  await seedGradosIfEmpty();
  await refresh();

  async function refresh() {
    const $t =$("#tabla", body);
    loading($t);
    let grados = await listGrados({ soloActivos: false });
    
    // ordenamiento de los grados por orden de edad y luego por el curso
    grados.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));

    if (!grados.length) { $t.innerHTML = `<div class="empty">Sin grados.</div>`; return; }
    $t.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Nombre</th><th>Orden</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${grados.map(g => `
              <tr>
                <td>${escapeHtml(g.nombre)}</td>
                <td>${g.orden}</td>
                <td>${g.es_virtual ? "Virtual" : "Real"}</td>
                <td><span class="badge ${g.activo?"activo":"inactivo"}">${g.activo?"Activo":"Inactivo"}</span></td>
                <td class="row">
                  <button class="btn btn-ghost" data-act="view" data-id="${g.id}" title="Ver estudiantes"><i data-lucide="users"></i></button>
                  <button class="btn btn-ghost" data-act="edit" data-id="${g.id}" title="Editar grado"><i data-lucide="pencil"></i></button>
                  <button class="btn btn-ghost" data-act="toggle" data-id="${g.id}" data-activo="${g.activo}">${g.activo?"Desactivar":"Activar"}</button>
                  <button class="btn btn-ghost btn-danger" data-act="del" data-id="${g.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    refreshIcons();

    $t.querySelectorAll("button[data-act]").forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const g = grados.find(x => x.id === id);

      if (btn.dataset.act === "toggle") {
        await updateGrado(id, { activo: btn.dataset.activo !== "true" });
        await refresh();
      } else if (btn.dataset.act === "del") {
        const ok = await confirmModal({ title: "Eliminar grado", body: "<p>Esta acción no se puede deshacer. Considera desactivarlo en su lugar.</p>", confirmText: "Eliminar", danger: true });
        if (ok) { try { await deleteGrado(id); toast("Grado eliminado.", {type:"success"}); await refresh(); } catch(e){ toast(e.message,{type:"error"}); } }
      } else if (btn.dataset.act === "edit") {
        abrirModalGrado(g);
      } else if (btn.dataset.act === "view") {
        verEstudiantes(g);
      }
    }));
  }

  $("#nuevo", body).addEventListener("click", () => abrirModalGrado());

  function abrirModalGrado(grado = null) {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>${grado ? "Editar grado" : "Nuevo grado"}</h2>
          <div class="field"><label>Nombre</label><input id="g-nombre" placeholder="Ej: 7C" value="${grado ? escapeHtml(grado.nombre) : ""}"></div>
          <div class="field"><label>Orden</label><input id="g-orden" type="number" value="${grado ? grado.orden : 100}"></div>
          <div class="field"><label><input id="g-virtual" type="checkbox" ${grado && grado.es_virtual ? "checked" : ""}> Es virtual (aportes externos)</label></div>
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
        const nombre = overlay.querySelector("#g-nombre").value.trim();
        const orden = Number(overlay.querySelector("#g-orden").value) || 100;
        const virtual = overlay.querySelector("#g-virtual").checked;
        if (!nombre) return toast("Nombre requerido.", {type:"error"});
        
        try { 
          if (grado) {
            await updateGrado(grado.id, { nombre, orden, es_virtual: virtual });
            toast("Grado actualizado.", {type:"success"});
          } else {
            await createGrado({ nombre, orden, es_virtual: virtual }); 
            toast("Grado creado.", {type:"success"});
          }
          overlay.remove(); 
          await refresh(); 
        }
        catch(err){ toast(err.message,{type:"error"}); }
      }
    });
  }

  async function verEstudiantes(grado) {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal" style="max-width: 600px; width: 90%;">
          <h2>Estudiantes en ${escapeHtml(grado.nombre)}</h2>
          <div id="lista-estudiantes" style="max-height: 400px; overflow-y: auto; margin: 16px 0;"><div class="spinner"></div></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="close">Cerrar</button>
          </div>
        </div>
      </div>
    `);
    document.body.appendChild(overlay);
    
    try {
      const todos = await listAll();
      const filtrados = todos.filter(e => e.grado_actual_id === grado.id && e.estado === "activo")
                             .sort((a,b)=> (`${a.apellidos||""} ${a.nombres||""}`).localeCompare(`${b.apellidos||""} ${b.nombres||""}`));
      
      const $lista = overlay.querySelector("#lista-estudiantes");
      if (!filtrados.length) {
        $lista.innerHTML = `<div class="empty">No hay estudiantes activos en este grado.</div>`;
      } else {
        $lista.innerHTML = `
          <table class="data">
            <thead><tr><th>Apellidos</th><th>Nombres</th></tr></thead>
            <tbody>
              ${filtrados.map(e => `<tr><td>${escapeHtml(e.apellidos)}</td><td>${escapeHtml(e.nombres)}</td></tr>`).join("")}
            </tbody>
          </table>
        `;
      }
    } catch (err) {
      overlay.querySelector("#lista-estudiantes").innerHTML = `<div class="empty" style="color:var(--danger)">Error al cargar estudiantes.</div>`;
    }

    overlay.addEventListener("click", e => {
      if (e.target === overlay || e.target.dataset?.act === "close") overlay.remove();
    });
  }
}