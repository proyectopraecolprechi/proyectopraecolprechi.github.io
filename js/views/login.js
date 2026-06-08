import { el, $, toast, refreshIcons } from "../ui.js";
import { login } from "../auth.js";
import { isConfigured } from "../firebase-config.js";

export function renderLogin({ mount }) {
  const view = el(`
    <div class="login-screen">
      <div class="login-card">
        <div class="brand"><i data-lucide="leaf"></i> PRAE Reciclaje</div>
        <p class="subtitle">Inicia sesión para registrar el pesaje del colegio.</p>
        ${!isConfigured ? `
          <div class="card" style="background: oklch(0.95 0.07 75); color: var(--gris-900); margin-bottom: 16px;">
            <strong>Firebase no está configurado.</strong>
            <p class="muted" style="margin-top:6px; font-size:.85rem;">
              Edita <code>public/js/firebase-config.js</code> con tus credenciales y recarga.
              Lee <code>README.md</code> para los pasos completos.
            </p>
          </div>
        ` : ""}
        <form id="login-form">
          <div class="field">
            <label for="email">Correo</label>
            <input id="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="password">Contraseña</label>
            <input id="password" type="password" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" ${isConfigured ? "" : "disabled"}>
            Entrar
          </button>
        </form>
      </div>
    </div>
  `);
  mount.appendChild(view);
  refreshIcons();

  $("#login-form", view).addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#email", view).value.trim();
    const password = $("#password", view).value;
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Entrando...";
    try {
      await login(email, password);
      // onAuthStateChanged dispara render
    } catch (err) {
      toast(err?.code === "auth/invalid-credential" ? "Credenciales inválidas." : (err.message || "Error al iniciar sesión."), { type: "error" });
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
}