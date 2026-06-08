import { el, $, toast, refreshIcons, escapeHtml, formatKg, formatDateTime, loading, empty, debounce } from "../ui.js";
import { getCurrentUser } from "../auth.js";
import { listGrados } from "../services/grados.js";
import { listByGrado } from "../services/estudiantes.js";
import { createRegistro, deleteRegistro, ultimosDelOperador } from "../services/registros.js";
import { renderShell } from "./shell.js";

export async function renderRegistro({ mount }) {
  const body = el(`
    <section>
      <h1>Registrar pesaje</h1>
      <p class="muted" style="margin: 4px 0 16px;">Selecciona el grado y el estudiante (o aporte externo) para registrar los kilos.</p>

      <div class="card">
        <div class="field">
          <label for="grado">Grado</label>
          <select id="grado"><option value="">Cargando...</option></select>
        </div>

        <div id="externos-fields" style="display:none;">
          <div class="field">
            <label for="donante">Nombre del donante</label>
            <input id="donante" type="text" placeholder="Ej: Empresa X, Familia Pérez" maxlength="120">
          </div>
          <div class="field">
            <label for="descripcion">Descripción</label>
            <textarea id="descripcion" rows="2" maxlength="280" placeholder="Detalles del aporte"></textarea>
          </div>
        </div>

        <div id="estudiantes-block" style="display:none;">
          <div class="field search-box">
            <label for="buscar">Estudiante</label>
            <i data-lucide="search"></i>
            <input id="buscar" type="text" placeholder="Buscar por nombre o apellido" autocomplete="off">
          </div>
          <div id="estudiantes-list" class="list-pick"></div>
        </div>

        <div class="field">
          <label for="kilos">Kilos</label>
          <input id="kilos" type="number" inputmode="decimal" step="0.01" min="0.01" max="5000" placeholder="0.00">
          <span class="hint">Usa punto para decimales. Ej: 2.30</span>
        </div>

        <button id="guardar" class="btn btn-primary btn-block btn-lg" disabled>
          <i data-lucide="save"></i> Guardar pesaje
        </button>
      </div>

      <h2 style="margin: 24px 0 12px;">Tus últimos registros</h2>
      <div id="ultimos"><div class="spinner"></div></div>
    </section>
  `);

  const shell = renderShell(body);
  mount.appendChild(shell);
  refreshIcons();

  const user = getCurrentUser();
  const state = {
    grados: [],
    gradoSel: null,
    estudiantes: [],
    estudianteSel: null,
    busqueda: "",
  };

  const $grado = $("#grado", body);
  const $externos = $("#externos-fields", body);
  const $estBlock = $("#estudiantes-block", body);
  const $list = $("#estudiantes-list", body);
  const $buscar = $("#buscar", body);
  const $kilos = $("#kilos", body);
  const $btn = $("#guardar", body);

  state.grados = await listGrados({ soloActivos: true });
  $grado.innerHTML = `<option value="">Selecciona un grado…</option>` +
    state.grados.map(g => `<option value="${g.id}">${escapeHtml(g.nombre)}</option>`).join("");

  function recompute() {
    const externo = state.gradoSel?.es_virtual;
    const ok = state.gradoSel && Number($kilos.value) > 0 && (externo ? $("#donante", body).value.trim().length > 0 : !!state.estudianteSel);
    $btn.disabled = !ok;
  }

  $grado.addEventListener("change", async () => {
    const id = $grado.value;
    state.gradoSel = state.grados.find(g => g.id === id) || null;
    state.estudianteSel = null;
    state.estudiantes = [];
    if (!state.gradoSel) { $externos.style.display = "none"; $estBlock.style.display = "none"; recompute(); return; }
    if (state.gradoSel.es_virtual) {
      $externos.style.display = "block";
      $estBlock.style.display = "none";
    } else {
      $externos.style.display = "none";
      $estBlock.style.display = "block";
      loading($list);
      state.estudiantes = await listByGrado(state.gradoSel.id);
      renderEstudiantes();
    }
    recompute();
  });

  function renderEstudiantes() {
    const q = state.busqueda.toLowerCase().trim();
    const filtered = state.estudiantes.filter(e =>
      !q || `${e.nombres} ${e.apellidos}`.toLowerCase().includes(q)
    );
    if (!filtered.length) { empty($list, "Sin estudiantes."); return; }
    $list.innerHTML = filtered.map(e => `
      <button type="button" data-id="${e.id}" class="${state.estudianteSel?.id === e.id ? "selected" : ""}">
        <span>${escapeHtml(e.apellidos || "")} ${escapeHtml(e.nombres || "")}</span>
      </button>
    `).join("");
    $list.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const est = state.estudiantes.find(x => x.id === b.dataset.id);
      state.estudianteSel = est;
      renderEstudiantes();
      recompute();
    }));
  }

  $buscar.addEventListener("input", debounce(() => { state.busqueda = $buscar.value; renderEstudiantes(); }, 150));
  $kilos.addEventListener("input", recompute);
  body.addEventListener("input", (e) => { if (e.target.id === "donante") recompute(); });

  $btn.addEventListener("click", async () => {
    if ($btn.disabled) return;
    $btn.disabled = true;
    const original = $btn.innerHTML;
    $btn.innerHTML = "Guardando…";
    try {
      const externo = state.gradoSel.es_virtual;
      const reg = await createRegistro({
        id_estudiante: externo ? null : state.estudianteSel.id,
        grado_snapshot: externo ? "Externos" : state.gradoSel.nombre,
        kilos: Number($kilos.value),
        id_operador: user.uid,
        operador_nombre: user.nombre || user.email,
        es_externo: externo,
        donante_nombre: externo ? $("#donante", body).value.trim() : null,
        descripcion: externo ? $("#descripcion", body).value.trim() || null : null,
      });
      toast(`Registrado ${formatKg(reg.kilos)}`, {
        type: "success",
        duration: 8000,
        action: { label: "Deshacer", onClick: async () => {
          try { await deleteRegistro(reg.id); toast("Registro eliminado.", { type: "info" }); renderUltimos(); }
          catch (e) { toast("No se pudo deshacer.", { type: "error" }); }
        } },
      });
      // reset
      $kilos.value = "";
      if (externo) { $("#donante", body).value = ""; $("#descripcion", body).value = ""; }
      else { state.estudianteSel = null; renderEstudiantes(); }
      renderUltimos();
    } catch (e) {
      console.error(e);
      toast(e.message || "Error guardando.", { type: "error" });
    } finally {
      $btn.innerHTML = original;
      refreshIcons();
      recompute();
    }
  });

  const $ultimos = $("#ultimos", body);
  async function renderUltimos() {
    try {
      const items = await ultimosDelOperador(user.uid, 10);
      if (!items.length) { empty($ultimos, "Aún no has registrado pesajes."); return; }
      $ultimos.innerHTML = `<div class="timeline">` + items.map(r => `
        <div class="entry">
          <div>
            <div><strong>${r.es_externo ? "Externo: " + escapeHtml(r.donante_nombre || "—") : escapeHtml(r.grado_snapshot)}</strong></div>
            <div class="meta">${formatDateTime(r.fecha_hora)}</div>
          </div>
          <div class="kg">${formatKg(r.kilos)}</div>
        </div>
      `).join("") + `</div>`;
    } catch (e) {
      empty($ultimos, "No se pudo cargar el historial.");
    }
  }
  renderUltimos();
}