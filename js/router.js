// Hash router simple.
import { getCurrentUser, isAdmin } from "./auth.js";

const routes = [];
let mountEl = null;
let currentCleanup = null;

export function defineRoute(pattern, handler, opts = {}) {
  // pattern: "/registro" o "/estudiante/:id"
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "$");
  routes.push({ pattern, re, keys, handler, opts });
}

export function navigate(path) {
  if (location.hash === "#" + path) handleRoute();
  else location.hash = "#" + path;
}

export function initRouter(el) {
  mountEl = el;
  window.addEventListener("hashchange", handleRoute);
  handleRoute();
}

export async function handleRoute() {
  const user = getCurrentUser();
  let path = location.hash.replace(/^#/, "") || (user ? (isAdmin() ? "/resumen" : "/registro") : "/login");

  // No autenticado: forzar login
  if (!user && path !== "/login") { navigate("/login"); return; }
  // Autenticado en login: redirigir
  if (user && path === "/login") { navigate(isAdmin() ? "/resumen" : "/registro"); return; }

  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      if (r.opts.adminOnly && !isAdmin()) { navigate("/registro"); return; }
      if (currentCleanup) { try { currentCleanup(); } catch {} currentCleanup = null; }
      mountEl.innerHTML = "";
      try {
        const result = await r.handler({ params, mount: mountEl });
        if (typeof result === "function") currentCleanup = result;
      } catch (e) {
        console.error(e);
        mountEl.innerHTML = `<div class="card"><h2>Error</h2><p>${e.message || e}</p></div>`;
      }
      return;
    }
  }
  mountEl.innerHTML = `<div class="empty">Página no encontrada.</div>`;
}

export function currentPath() {
  return location.hash.replace(/^#/, "") || "/";
}