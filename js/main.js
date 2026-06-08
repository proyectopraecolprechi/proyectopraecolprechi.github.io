import { initAuth, onUserChange } from "./auth.js";
import { initRouter, defineRoute, handleRoute } from "./router.js";
import { renderLogin } from "./views/login.js";
import { renderRegistro } from "./views/registro.js";
import { renderResumen } from "./views/resumen.js";
import { renderHistorial } from "./views/historial.js";
import { renderPerfil } from "./views/perfil.js";
import { renderAdminGrados } from "./views/admin-grados.js";
import { renderAdminEstudiantes } from "./views/admin-estudiantes.js";
import { renderAdminReportes } from "./views/admin-reportes.js";
import { renderCierreAnio } from "./views/cierre-anio.js";
import { refreshIcons } from "./ui.js";

function boot() {
  const mount = document.getElementById("prae-root");
  if (!mount) { setTimeout(boot, 50); return; }

  defineRoute("/login", renderLogin);
  defineRoute("/registro", renderRegistro);
  defineRoute("/resumen", renderResumen);
  defineRoute("/perfil", renderPerfil);
  defineRoute("/estudiante/:id", renderHistorial);
  defineRoute("/admin/grados", renderAdminGrados, { adminOnly: true });
  defineRoute("/admin/estudiantes", renderAdminEstudiantes, { adminOnly: true });
  defineRoute("/admin/reportes", renderAdminReportes, { adminOnly: true });
  defineRoute("/admin/cierre", renderCierreAnio, { adminOnly: true });

  initRouter(mount);
  initAuth();
  onUserChange(() => { handleRoute(); refreshIcons(); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}