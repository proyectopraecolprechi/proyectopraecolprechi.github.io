import { el, $, escapeHtml, refreshIcons, toast, loading, empty, debounce, confirmModal } from "../ui.js";
import { renderShell } from "./shell.js";
import { listGrados } from "../services/grados.js";
import { listAll, createEstudiante, updateEstudiante, setEstado, deleteEstudianteFisico } from "../services/estudiantes.js";
import { db } from "../firebase-config.js";
import { collection, query, where, getDocs, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { deleteRegistro } from "../services/registros.js";

export async function renderAdminEstudiantes({ mount }) {
  const body = el(`
    <section>
      <div class="row between">
        <h1>Estudiantes</h1>
        <div class="row" style="gap: 8px;">
          <input type="file" id="file-excel" accept=".xlsx, .xls" style="display:none;">
          <button id="importar" class="btn btn-secondary"><i data-lucide="upload"></i> Importar Excel</button>
          <button id="nuevo" class="btn btn-primary"><i data-lucide="user-plus"></i> Nuevo estudiante</button>
        </div>
      </div>

      <div class="card">
        <div class="row" style="gap:12px;">
          <div class="field" style="flex:1; margin:0;">
            <label>Buscar</label>
            <input id="buscar" type="text" placeholder="Nombre o apellido">
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

  let estudiantes = [];
  
  async function reload() {
    loading($("#tabla", body));
    estudiantes = await listAll();
    
    // Cargar grados oficiales y detectar grados "fantasma" que tienen los estudiantes
    const gradosDb = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);
    const missing = new Map();
    estudiantes.forEach(e => {
      if (e.grado_actual_id && !gradosDb.find(g => g.id === e.grado_actual_id)) {
        missing.set(e.grado_actual_id, e.grado_actual_nombre || "Desconocido");
      }
    });

    let htmlOptions = `<option value="">Todos</option>` + gradosDb.map(g => `<option value="${g.id}">${escapeHtml(g.nombre)}</option>`).join("");
    missing.forEach((nom, id) => { 
      htmlOptions += `<option value="${id}">${escapeHtml(nom)} (Fantasma)</option>`; 
    });
    
    const currentVal = $("#f-grado", body).value;
    $("#f-grado", body).innerHTML = htmlOptions;
    if (currentVal) $("#f-grado", body).value = currentVal;

    apply();
  }

  function apply() {
    const q = $("#buscar", body).value.toLowerCase().trim();
    const fg = $("#f-grado", body).value;
    const fe = $("#f-estado", body).value;
    const filtered = estudiantes.filter(e => {
      if (q && !`${e.nombres||""} ${e.apellidos||""}`.toLowerCase().includes(q)) return false;
      if (fg && e.grado_actual_id !== fg) return false;
      if (fe && e.estado !== fe) return false;
      return true;
    }).sort((a,b)=> (`${a.apellidos||""} ${a.nombres||""}`).localeCompare(`${b.apellidos||""} ${b.nombres||""}`));

    const $t =$("#tabla", body);
    if (!filtered.length) { empty($t, "Sin estudiantes."); return; }
    
    $t.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Apellidos</th><th>Nombres</th><th>Grado</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${filtered.map(e => `
              <tr>
                <td>${escapeHtml(e.apellidos||"")}</td>
                <td>${escapeHtml(e.nombres||"")}</td>
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
          body: `¿Eliminar a ${escapeHtml(e.nombres)} ${escapeHtml(e.apellidos)} y TODOS sus registros de peso? Esto restará sus aportes globales y no se puede deshacer.`,
          danger: true,
          confirmText: "Sí, eliminar"
        });

        if (seguro) {
          try {
            loading($("#tabla", body));
            const qDocs = query(collection(db, "registros_reciclaje"), where("id_estudiante", "==", e.id));
            const snap = await getDocs(qDocs);
            if (!snap.empty) {
              for (const docSnap of snap.docs) { await deleteRegistro(docSnap.id); }
            }
            const qDocsAntiguos = query(collection(db, "registros"), where("id_estudiante", "==", e.id));
            const snapAntiguos = await getDocs(qDocsAntiguos);
            if (!snapAntiguos.empty) {
              const batchAntiguos = writeBatch(db);
              snapAntiguos.forEach(docSnap => batchAntiguos.delete(docSnap.ref));
              await batchAntiguos.commit();
            }
            await deleteEstudianteFisico(e.id);
            toast("Estudiante y aportes eliminados.", { type: "success" });
          } catch (err) {
            toast("Error al eliminar: " + err.message, { type: "error" });
          } finally { reload(); }
        }
      }
    }));
  }

  $("#buscar", body).addEventListener("input", debounce(apply, 150));
  $("#f-grado", body).addEventListener("change", apply);
  $("#f-estado", body).addEventListener("change", apply);
  $("#nuevo", body).addEventListener("click", () => openForm(null));

  // --- LÓGICA DE IMPORTACIÓN DESDE EXCEL ---
  $("#importar", body).addEventListener("click", () => $("#file-excel", body).click());
  $("#file-excel", body).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      loading($("#tabla", body));
      toast("Procesando archivo, por favor espera...", { type: "info", duration: 5000 });
      
      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const rows = XLSX.utils.sheet_to_json(worksheet);

      let creados = 0;
      let omitidos = 0;
      let duplicados = 0;
      let erroresGrado = new Set();
      let idsImportados = []; 
      
      const gradosDb = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);

      const normalizarGrado = (str) => {
        if (!str) return "";
        return str.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/ig, "").toUpperCase();
      };

      const encontrarGrado = (rawExcel) => {
        const normExcel = normalizarGrado(rawExcel);
        let match = gradosDb.find(g => normalizarGrado(g.nombre) === normExcel);
        if (match) return match;

        let expExcel = normExcel.replace(/^TR/, "TRANSICION").replace(/^JAR/, "JARDIN");
        match = gradosDb.find(g => normalizarGrado(g.nombre) === expExcel);
        if (match) return match;

        match = gradosDb.find(g => {
          let normDB = normalizarGrado(g.nombre);
          let expDB = normDB.replace(/^TR/, "TRANSICION").replace(/^JAR/, "JARDIN");
          return expDB === normExcel;
        });
        
        return match || null;
      };

      // Control anti-duplicados por firma SOLO de Nombre y Apellido (Ignoramos el grado para evitar clones)
      const firmasExistentes = new Set();
      estudiantes.forEach(est => {
        firmasExistentes.add(`${(est.nombres || "").toLowerCase().trim()}-${(est.apellidos || "").toLowerCase().trim()}`);
      });

      const chunkSize = 400;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(row => {
          const ap1 = (row["1ER APELLIDO"] || "").toString().trim();
          const ap2 = (row["2DO APELLIDO"] || "").toString().trim();
          const nom1 = (row["1ER NOMBRE"] || "").toString().trim();
          const nom2 = (row["2DO NOMBRE"] || "").toString().trim();
          
          const apellidos = `${ap1} ${ap2}`.trim();
          const nombres = `${nom1} ${nom2}`.trim();
          if (!nombres || !apellidos) return;
          
          const rawCurso = (row["CURSO"] || row["GRADO"] || "").toString();
          const gradoMatch = encontrarGrado(rawCurso);
          
          if (!gradoMatch) {
            erroresGrado.add(rawCurso);
            omitidos++;
            return;
          }

          // Verificación estricta por Nombre y Apellido
          const firma = `${nombres.toLowerCase()}-${apellidos.toLowerCase()}`;
          if (firmasExistentes.has(firma)) {
            duplicados++;
            return;
          }
          firmasExistentes.add(firma); 
          
          const newDocRef = doc(collection(db, "estudiantes"));
          idsImportados.push(newDocRef.id);
          
          batch.set(newDocRef, {
            nombres,
            apellidos,
            grado_actual_id: gradoMatch.id,
            grado_actual_nombre: gradoMatch.nombre,
            estado: "activo",
            creado_en: new Date().toISOString()
          });
          creados++;
        });
        
        await batch.commit(); 
      }

      const oldBanner = document.getElementById("undo-banner");
      if (oldBanner) oldBanner.remove();

      if (creados > 0) {
        const undoBanner = el(`
          <div id="undo-banner" class="row between" style="background: var(--verde-100); color: var(--verde-800); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--verde-300); gap: 16px; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="flex:1; line-height: 1.4;">
              <strong>¡Importación exitosa!</strong> Se agregaron <strong>${creados}</strong> estudiantes nuevos.<br>
              <small style="opacity: 0.9;">
                ${duplicados > 0 ? `⚠️ ${duplicados} omitidos por estar duplicados. ` : ''}
                ${omitidos > 0 ? `⚠️ ${omitidos} omitidos por grado no encontrado (${Array.from(erroresGrado).join(", ")}).` : ''}
              </small>
            </div>
            <button class="btn btn-danger btn-sm" id="btn-deshacer" style="white-space: nowrap;"><i data-lucide="undo-2"></i> Deshacer importación</button>
          </div>
        `);
        
        const cardContainer = $(".card", body);
        cardContainer.parentNode.insertBefore(undoBanner, cardContainer.nextSibling);
        refreshIcons();

        undoBanner.querySelector("#btn-deshacer").onclick = async () => {
          const seguro = await confirmModal({
            title: "Deshacer importación",
            body: `¿Estás seguro de eliminar permanentemente a los <strong>${creados}</strong> estudiantes que acabas de subir en este Excel?`,
            danger: true,
            confirmText: "Sí, deshacer"
          });

          if (seguro) {
            try {
              loading($("#tabla", body));
              for (let i = 0; i < idsImportados.length; i += 400) {
                const chunk = idsImportados.slice(i, i + 400);
                const deleteBatch = writeBatch(db);
                chunk.forEach(id => {
                  deleteBatch.delete(doc(db, "estudiantes", id));
                });
                await deleteBatch.commit();
              }
              toast("Importación deshecha correctamente.", { type: "success" });
              undoBanner.remove();
              reload();
            } catch (err) {
              toast("Error al deshacer: " + err.message, { type: "error" });
            }
          }
        };
      } else {
         let msg = "No se agregaron estudiantes nuevos.";
         if (duplicados > 0) msg += ` ${duplicados} ya estaban registrados.`;
         if (omitidos > 0) msg += ` ${omitidos} grados no encontrados.`;
         toast(msg, { type: "warning", duration: 8000 });
      }

    } catch (err) {
      console.error(err);
      toast("Error al procesar el Excel: " + err.message, { type: "error" });
    } finally {
      e.target.value = ""; 
      reload();
    }
  });

  async function openForm(est) {
    const gradosDb = (await listGrados({ soloActivos: false })).filter(g => !g.es_virtual);
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>${est ? "Editar estudiante" : "Nuevo estudiante"}</h2>
          <div class="field-row cols-2">
            <div class="field"><label>Nombres</label><input id="e-nombres" value="${escapeHtml(est?.nombres||"")}"></div>
            <div class="field"><label>Apellidos</label><input id="e-apellidos" value="${escapeHtml(est?.apellidos||"")}"></div>
          </div>
          <div class="field"><label>Grado</label>
            <select id="e-grado">
              ${gradosDb.map(g => `<option value="${g.id}" ${est?.grado_actual_id===g.id?"selected":""}>${escapeHtml(g.nombre)}</option>`).join("")}
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
        const gradoId = overlay.querySelector("#e-grado").value;
        const estado = overlay.querySelector("#e-estado").value;
        const grado = gradosDb.find(g => g.id === gradoId);
        if (!nombres || !apellidos || !grado) return toast("Completa los campos.", {type:"error"});
        try {
          const payload = { nombres, apellidos, grado_actual_id: grado.id, grado_actual_nombre: grado.nombre, estado };
          if (est) await updateEstudiante(est.id, payload);
          else await createEstudiante(payload);
          overlay.remove(); toast("Guardado.", {type:"success"}); reload();
        } catch(err){ toast(err.message,{type:"error"}); }
      }
    });
  }

  reload();
}