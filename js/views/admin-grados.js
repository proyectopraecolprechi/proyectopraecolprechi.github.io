import { el, $, escapeHtml, refreshIcons, toast, confirmModal, loading } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados, createGrado, updateGrado, deleteGrado, seedGradosIfEmpty } from "../services/grados.js";

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
    const $t = $("#tabla", body);
    loading($t);
    const grados = await listGrados({ soloActivos: false });
    if (!grados.length) { $t.innerHTML = `<div class="empty">Sin grados.</div>`; return; }
    $t.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Nombre</th><th>Orden</th><th>Tipo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${grados.map(g => `
              <tr>
                <td>${escapeHtml(g.nombre)}</td>
                <td>${g.orden}</td>
                <td>${g.es_virtual ? "Virtual" : "Real"}</td>
                <td><span class="badge ${g.activo?"activo":"inactivo"}">${g.activo?"Activo":"Inactivo"}</span></td>
                <td>
                  <button class="btn btn-ghost" data-act="toggle" data-id="${g.id}" data-activo="${g.activo}">${g.activo?"Desactivar":"Activar"}</button>
                  <button class="btn btn-ghost" data-act="del" data-id="${g.id}"><i data-lucide="trash-2"></i></button>
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
      if (btn.dataset.act === "toggle") {
        await updateGrado(id, { activo: btn.dataset.activo !== "true" });
        await refresh();
      } else if (btn.dataset.act === "del") {
        const ok = await confirmModal({ title: "Eliminar grado", body: "<p>Esta acción no se puede deshacer. Considera desactivarlo en su lugar.</p>", confirmText: "Eliminar", danger: true });
        if (ok) { try { await deleteGrado(id); toast("Grado eliminado.", {type:"success"}); await refresh(); } catch(e){ toast(e.message,{type:"error"}); } }
      }
    }));
  }

  $("#nuevo", body).addEventListener("click", async () => {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>Nuevo grado</h2>
          <div class="field"><label>Nombre</label><input id="g-nombre" placeholder="Ej: 7C"></div>
          <div class="field"><label>Orden</label><input id="g-orden" type="number" value="100"></div>
          <div class="field"><label><input id="g-virtual" type="checkbox"> Es virtual (aportes externos)</label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">Cancelar</button>
            <button class="btn btn-primary" data-act="ok">Crear</button>
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
        try { await createGrado({ nombre, orden, es_virtual: virtual }); overlay.remove(); toast("Grado creado.", {type:"success"}); await refresh(); }
        catch(err){ toast(err.message,{type:"error"}); }
      }
    });
  });
}