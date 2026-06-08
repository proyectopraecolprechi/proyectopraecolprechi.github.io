import { el, $, escapeHtml, refreshIcons } from "../ui.js";
import { renderShell } from "./shell.js";
import { getCurrentUser, logout } from "../auth.js";

export function renderPerfil({ mount }) {
  const u = getCurrentUser();
  const body = el(`
    <section>
      <h1>Perfil</h1>
      <div class="card">
        <p><strong>Nombre:</strong> ${escapeHtml(u?.nombre || "—")}</p>
        <p><strong>Correo:</strong> ${escapeHtml(u?.email || "—")}</p>
        <p><strong>Rol:</strong> <span class="badge ${u?.rol === "admin" ? "admin" : "activo"}">${u?.rol === "admin" ? "Administrador" : "Operador"}</span></p>
        <div class="card-actions">
          <button id="salir" class="btn btn-danger"><i data-lucide="log-out"></i> Cerrar sesión</button>
        </div>
      </div>
    </section>
  `);
  mount.appendChild(renderShell(body));
  refreshIcons();
  $("#salir", body).addEventListener("click", () => logout());
}