import { el, clear, loading, empty, toast, refreshIcons, confirmModal, escapeHtml } from "../ui.js";
import { db } from "../firebase-config.js";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function renderAdminOperadores({ mount }) {
  // Nota: Si usas una función layout (ej: renderShell), envuélvelo como en tus otras vistas.
  clear(mount);
  mount.appendChild(el(`
    <div class="app-shell has-sidebar">
      <div class="app-main">
        <div class="row between" style="margin-bottom: 24px;">
          <div>
            <h1>Gestión de Usuarios</h1>
            <p class="muted">Administra los operadores y administradores del sistema (Firestore).</p>
          </div>
          <button class="btn btn-primary" id="btn-recargar">
            <i data-lucide="refresh-cw"></i> Recargar
          </button>
        </div>

        <div class="card">
          <div class="table-wrap">
            <table class="data" id="tabla-usuarios">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo (Lectura)</th>
                  <th>Rol</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `));

  const tbody = mount.querySelector("#tabla-usuarios tbody");
  const btnRecargar = mount.querySelector("#btn-recargar");

  async function cargarUsuarios() {
    loading(tbody);
    try {
      const snap = await getDocs(collection(db, "usuarios_sistema"));
      clear(tbody);
      
      if (snap.empty) {
        tbody.appendChild(el(`<tr><td colspan="4" class="empty">No hay usuarios registrados.</td></tr>`));
        return;
      }

      snap.forEach(docSnap => {
        const user = docSnap.data();
        const userId = docSnap.id;
        
        const tr = el(`
          <tr>
            <td><strong>${escapeHtml(user.nombre)}</strong></td>
            <td>${escapeHtml(user.email)}</td>
            <td><span class="badge ${user.rol === 'admin' ? 'admin' : 'activo'}">${escapeHtml(user.rol)}</span></td>
            <td>
              <button class="btn btn-secondary btn-edit" style="padding: 6px 12px; min-height: unset;">
                <i data-lucide="edit"></i> Editar
              </button>
            </td>
          </tr>
        `);

        // Lógica del modal de edición
        tr.querySelector(".btn-edit").onclick = () => abrirModalEdicion(userId, user);
        tbody.appendChild(tr);
      });
      refreshIcons();
    } catch (e) {
      console.error(e);
      toast("Error al cargar los usuarios", { type: "error" });
    }
  }

  function abrirModalEdicion(userId, user) {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>Editar Usuario</h2>
          <p class="hint" style="margin-bottom: 16px; color: var(--rojo);">
            Debes tener cuidado al cambiar el rol de un usuario. Asegúrate de que los operadores tengan el rol correcto para evitar problemas de acceso.
          </p>
          
          <div class="field">
            <label>Nombre de Usuario</label>
            <input type="text" id="edit-nombre" value="${escapeHtml(user.nombre)}">
          </div>
          
          <div class="field">
            <label>Correo Electrónico</label>
            <input type="email" id="edit-email" value="${escapeHtml(user.email)}">
          </div>
          
          <div class="field">
            <label>Rol en el sistema</label>
            <select id="edit-rol">
              <option value="operador" ${user.rol === 'operador' ? 'selected' : ''}>Operador (Normal)</option>
              <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </div>
          
          <div class="modal-actions" style="margin-top: 24px;">
            <button class="btn btn-secondary" id="btn-cancel">Cancelar</button>
            <button class="btn btn-primary" id="btn-save">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `);

    overlay.querySelector("#btn-cancel").onclick = () => overlay.remove();
    
    overlay.querySelector("#btn-save").onclick = async () => {
      const nuevoNombre = overlay.querySelector("#edit-nombre").value.trim();
      const nuevoEmail = overlay.querySelector("#edit-email").value.trim();
      const nuevoRol = overlay.querySelector("#edit-rol").value;

      if (!nuevoNombre || !nuevoEmail) {
        toast("El nombre y correo son obligatorios.", { type: "error" });
        return;
      }

      try {
        await updateDoc(doc(db, "usuarios_sistema", userId), {
          nombre: nuevoNombre,
          email: nuevoEmail,
          rol: nuevoRol
        });
        toast("Usuario actualizado correctamente.", { type: "success" });
        overlay.remove();
        cargarUsuarios();
      } catch (e) {
        console.error(e);
        toast("Error al actualizar el usuario.", { type: "error" });
      }
    };

    document.body.appendChild(overlay);
  }

  btnRecargar.onclick = cargarUsuarios;
  cargarUsuarios();
}