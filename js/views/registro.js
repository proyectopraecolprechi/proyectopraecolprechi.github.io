import { el, $, toast, refreshIcons, escapeHtml, formatKg, formatDateTime, empty } from "../ui.js";
import { getCurrentUser } from "../auth.js";
import { listGrados } from "../services/grados.js";
import { listByGrado, listAll as listAllEstudiantes } from "../services/estudiantes.js";
import { createRegistro, ultimosDelOperador, deleteRegistro } from "../services/registros.js";
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
          <div class="field">
            <label for="estudiante">Estudiante</label>
            <select id="estudiante">
              <option value="">Selecciona un grado primero...</option>
            </select>
          </div>
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
    todosEstudiantesMap: {}
  };

  try {
    const allEst = await listAllEstudiantes();
    state.todosEstudiantesMap = Object.fromEntries(allEst.map(e => [e.id, `${e.apellidos || ""} ${e.nombres || ""}`.trim()]));
  } catch (e) {
    console.warn("No se pudo cargar la lista global de estudiantes.");
  }

  const $grado = $("#grado", body);
  const $externos = $("#externos-fields", body);
  const $estBlock = $("#estudiantes-block", body);
  const $estudiante = $("#estudiante", body);
  const $kilos = $("#kilos", body);
  const $btn = $("#guardar", body);
  const $ultimos = $("#ultimos", body);
  let hideExpiredInterval; 

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
    
    if (!state.gradoSel) { 
      $externos.style.display = "none"; 
      $estBlock.style.display = "none"; 
      recompute(); 
      return; 
    }
    
    if (state.gradoSel.es_virtual) {
      $externos.style.display = "block";
      $estBlock.style.display = "none";
    } else {
      $externos.style.display = "none";
      $estBlock.style.display = "block";
      
      $estudiante.innerHTML = `<option value="">Cargando estudiantes...</option>`;
      $estudiante.disabled = true;
      
      state.estudiantes = await listByGrado(state.gradoSel.id);
      renderEstudiantes();
    }
    recompute();
  });

  function renderEstudiantes() {
    $estudiante.disabled = false;
    
    if (!state.estudiantes.length) { 
      $estudiante.innerHTML = `<option value="">Sin estudiantes en este grado</option>`;
      return; 
    }
    
    $estudiante.innerHTML = `<option value="">Seleccionar estudiante</option>` + 
      state.estudiantes.map(e => `
        <option value="${e.id}">${escapeHtml(e.apellidos || "")} ${escapeHtml(e.nombres || "")}</option>
      `).join("");
  }

  $estudiante.addEventListener("change", () => {
    const id = $estudiante.value;
    state.estudianteSel = state.estudiantes.find(x => x.id === id) || null;
    recompute();
  });

  $kilos.addEventListener("input", recompute);
  body.addEventListener("input", (e) => { if (e.target.id === "donante") recompute(); });

  $btn.addEventListener("click", async () => {
    if ($btn.disabled) return;
    $btn.disabled = true;
    const original = $btn.innerHTML;
    $btn.innerHTML = "Guardando…";
    try {
      const externo = state.gradoSel.es_virtual;
      const estNombre = state.estudianteSel ? `${state.estudianteSel.apellidos || ""} ${state.estudianteSel.nombres || ""}`.trim() : null;

      const reg = await createRegistro({
        id_estudiante: externo ? null : state.estudianteSel.id,
        estudiante_nombre: estNombre,
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
        duration: 8000
      });
      
      if (!externo && state.estudianteSel) {
        state.todosEstudiantesMap[state.estudianteSel.id] = estNombre;
      }

      $kilos.value = "";
      if (externo) { 
        $("#donante", body).value = ""; 
        $("#descripcion", body).value = ""; 
      } else { 
        state.estudianteSel = null; 
        $estudiante.value = ""; 
      }
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

  async function renderUltimos() {
    try {
      const items = await ultimosDelOperador(user.uid, 10);
      if (!items.length) { empty($ultimos, "Aún no has registrado pesajes."); return; }
      
      const now = Date.now();
      
      $ultimos.innerHTML = `<div class="timeline">` + items.map(r => {
        const nombreEstudiante = state.todosEstudiantesMap[r.id_estudiante] || r.estudiante_nombre || r.grado_snapshot;
        const titulo = r.es_externo ? "Externo: " + escapeHtml(r.donante_nombre || "—") : escapeHtml(nombreEstudiante);

        // Convertimos el timestamp de Firebase a milisegundos reales
        const ms = r.fecha_hora?.toMillis ? r.fecha_hora.toMillis() : new Date(r.fecha_hora).getTime();
        const isDeletable = (now - ms) <= 60000; // <= 1 minuto

        return `
        <div class="entry" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div><strong>${titulo} - ${escapeHtml(r.grado_snapshot)}</strong></div>
            <div class="meta">${formatDateTime(r.fecha_hora)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="kg">${formatKg(r.kilos)}</div>
            ${isDeletable ? `<button class="btn btn-ghost btn-danger btn-sm btn-delete-reg" data-id="${r.id}" data-ts="${ms}" style="padding:4px;"><i data-lucide="trash"></i></button>` : ''}
          </div>
        </div>
      `}).join("") + `</div>`;
      
      refreshIcons();
      
      // eliminación de los botones
      $ultimos.querySelectorAll('.btn-delete-reg').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("¿Estás seguro de que quieres eliminar este registro? Los kilos se restarán.")) {
                try {
                    await deleteRegistro(id);
                    toast("Registro eliminado exitosamente.", { type: "info" });
                    renderUltimos();
                } catch(err) {
                    toast("Error al eliminar: " + err.message, { type: "error" });
                }
            }
        });
      });

      // bucle para que el boon eliminar desaparesca a el minuto
      if (hideExpiredInterval) clearInterval(hideExpiredInterval);
      hideExpiredInterval = setInterval(() => {
          if (!document.body.contains($ultimos)) {
              clearInterval(hideExpiredInterval);
              return;
          }
          const currentTime = Date.now();
          $ultimos.querySelectorAll('.btn-delete-reg').forEach(btn => {
              const ts = parseInt(btn.dataset.ts, 10);
              if ((currentTime - ts) > 60000) {
                  btn.remove(); // El botón desaparece
              }
          });
      }, 5000); // tiempo de comprobación cada 5 segundos para no sobrecargar el navegador

    } catch (e) {
      empty($ultimos, "No se pudo cargar el historial.");
    }
  }
  renderUltimos();
}