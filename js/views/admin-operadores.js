import { el, clear, loading, empty, toast, refreshIcons, confirmModal, escapeHtml } from "../ui.js";
import { renderShell } from "./shell.js"; // Importamos el layout del menú lateral
import { db } from "../firebase-config.js";
// Se agregó 'addDoc' a la importación
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

export async function renderAdminOperadores({ mount }) {
  clear(mount);
  
  // Creamos solo el contenido principal
  const body = el(`
    <section>
      <div class="row between" style="margin-bottom: 24px;">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p class="muted">Administra los operadores, credenciales y roles.</p>
        </div>
        
        <!-- Botones de acción -->
        <div class="row" style="gap: 8px;">
          <button class="btn btn-primary" id="btn-agregar">
            <i data-lucide="plus"></i> Agregar
          </button>
          <button class="btn btn-secondary" id="btn-recargar">
            <i data-lucide="refresh-cw"></i> Recargar
          </button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="data" id="tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo (Login)</th>
                <th>Contraseña</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>
  `);

  // Envolvemos el contenido en el layout que ya tiene el sidebar y lo inyectamos
  mount.appendChild(renderShell(body));
  refreshIcons();

  const tbody = mount.querySelector("#tabla-usuarios tbody");
  const btnRecargar = mount.querySelector("#btn-recargar");
  const btnAgregar = mount.querySelector("#btn-agregar");

  async function cargarUsuarios() {
    loading(tbody);
    try {
      const snap = await getDocs(collection(db, "usuarios_sistema"));
      clear(tbody);
      
      if (snap.empty) {
        tbody.appendChild(el(`<tr><td colspan="5" class="empty">No hay usuarios registrados.</td></tr>`));
        return;
      }

      snap.forEach(docSnap => {
        const user = docSnap.data();
        const userId = docSnap.id;
        
        const tr = el(`
          <tr>
            <td><strong>${escapeHtml(user.nombre || "Sin nombre")}</strong></td>
            <td>${escapeHtml(user.email || "")}</td>
            <td><span style="font-family: monospace; color: var(--gris-700); background: var(--gris-100); padding: 2px 6px; border-radius: 4px;">${escapeHtml(user.password || "Sin asignar")}</span></td>
            <td><span class="badge ${user.rol === 'admin' ? 'admin' : 'activo'}">${escapeHtml(user.rol || "operador")}</span></td>
            <td>
              <div class="row" style="gap: 8px;">
                <button class="btn btn-secondary btn-edit" style="padding: 6px 12px; min-height: unset;" title="Editar">
                  <i data-lucide="edit"></i> Editar
                </button>
                <button class="btn btn-danger btn-delete" style="padding: 6px 12px; min-height: unset;" title="Eliminar">
                  <i data-lucide="trash-2"></i> Eliminar
                </button>
              </div>
            </td>
          </tr>
        `);

        tr.querySelector(".btn-edit").onclick = () => abrirModalEdicion(userId, user);
        
        // Lógica para eliminar usuario
        tr.querySelector(".btn-delete").onclick = async () => {
          const seguro = await confirmModal({
            title: "Eliminar Usuario",
            body: `¿Estás seguro de que deseas eliminar permanentemente al usuario <strong>${escapeHtml(user.nombre)}</strong>? Ya no podrá iniciar sesión en el sistema.`,
            danger: true,
            confirmText: "Sí, eliminar"
          });

          if (seguro) {
            try {
              await deleteDoc(doc(db, "usuarios_sistema", userId));
              toast("Usuario eliminado correctamente.", { type: "success" });
              cargarUsuarios(); // Recargar la tabla
            } catch (e) {
              console.error(e);
              toast("Error al eliminar el usuario.", { type: "error" });
            }
          }
        };

        tbody.appendChild(tr);
      });
      refreshIcons();
    } catch (e) {
      console.error(e);
      toast("Error al cargar los usuarios", { type: "error" });
    }
  }

  // Lógica para agregar usuario
  function abrirModalAgregar() {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>Agregar Nuevo Usuario</h2>
          <p class="hint" style="margin-bottom: 16px;">
            Ingresa los datos para registrar un nuevo operador.
          </p>
          
          <div class="field">
            <label>Nombre de Usuario</label>
            <input type="text" id="add-nombre" placeholder="Ej. Juan Pérez">
          </div>
          
          <div class="field">
            <label>Correo Electrónico</label>
            <input type="email" id="add-email" placeholder="correo@ejemplo.com">
          </div>

          <div class="field">
            <label>Contraseña</label>
            <input type="text" id="add-password" placeholder="Mínimo 6 caracteres">
          </div>
          
          <div class="field">
            <label>Rol en el sistema</label>
            <select id="add-rol">
              <option value="operador">Operador (Normal)</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          
          <div class="modal-actions" style="margin-top: 24px;">
            <button class="btn btn-secondary" id="btn-cancel-add">Cancelar</button>
            <button class="btn btn-primary" id="btn-save-add">Guardar Usuario</button>
          </div>
        </div>
      </div>
    `);

    overlay.querySelector("#btn-cancel-add").onclick = () => overlay.remove();
    
    overlay.querySelector("#btn-save-add").onclick = async () => {
      const nuevoNombre = overlay.querySelector("#add-nombre").value.trim();
      const nuevoEmail = overlay.querySelector("#add-email").value.trim().toLowerCase();
      const nuevaPassword = overlay.querySelector("#add-password").value.trim();
      const nuevoRol = overlay.querySelector("#add-rol").value;

      if (!nuevoNombre || !nuevoEmail || !nuevaPassword) {
        toast("Todos los campos (nombre, correo y contraseña) son obligatorios.", { type: "error" });
        return;
      }

      try {
        await addDoc(collection(db, "usuarios_sistema"), {
          nombre: nuevoNombre,
          email: nuevoEmail,
          password: nuevaPassword,
          rol: nuevoRol
        });
        toast("Usuario agregado correctamente.", { type: "success" });
        overlay.remove();
        cargarUsuarios();
      } catch (e) {
        console.error(e);
        toast("Error al agregar el usuario.", { type: "error" });
      }
    };

    document.body.appendChild(overlay);
  }

  function abrirModalEdicion(userId, user) {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>Editar Usuario y Credenciales</h2>
          <p class="hint" style="margin-bottom: 16px;">
            Modifica las credenciales. El inicio de sesión validará exactamente estos datos.
          </p>
          
          <div class="field">
            <label>Nombre de Usuario</label>
            <input type="text" id="edit-nombre" value="${escapeHtml(user.nombre || "")}">
          </div>
          
          <div class="field">
            <label>Correo Electrónico</label>
            <input type="email" id="edit-email" value="${escapeHtml(user.email || "")}">
          </div>

          <div class="field">
            <label>Contraseña</label>
            <input type="text" id="edit-password" value="${escapeHtml(user.password || "")}">
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
      const nuevoEmail = overlay.querySelector("#edit-email").value.trim().toLowerCase();
      const nuevaPassword = overlay.querySelector("#edit-password").value.trim();
      const nuevoRol = overlay.querySelector("#edit-rol").value;

      if (!nuevoNombre || !nuevoEmail || !nuevaPassword) {
        toast("Todos los campos (nombre, correo y contraseña) son obligatorios.", { type: "error" });
        return;
      }

      try {
        await updateDoc(doc(db, "usuarios_sistema", userId), {
          nombre: nuevoNombre,
          email: nuevoEmail,
          password: nuevaPassword,
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
  btnAgregar.onclick = abrirModalAgregar;
  cargarUsuarios();
}