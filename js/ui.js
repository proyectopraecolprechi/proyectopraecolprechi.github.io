// UI helpers: DOM, iconos, toasts, modales

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

let toastContainer = null;
export function toast(message, { type = "info", action = null, duration = 3500 } = {}) {
  if (!toastContainer) {
    toastContainer = el(`<div class="toast-container"></div>`);
    document.body.appendChild(toastContainer);
  }
  const t = el(`<div class="toast ${type}"><span>${escapeHtml(message)}</span></div>`);
  if (action) {
    const btn = el(`<button class="toast-action">${escapeHtml(action.label)}</button>`);
    btn.onclick = () => { action.onClick(); t.remove(); };
    t.appendChild(btn);
  }
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

export function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function confirmModal({ title, body, confirmText = "Confirmar", danger = false }) {
  return new Promise(resolve => {
    const overlay = el(`
      <div class="modal-overlay">
        <div class="modal">
          <h2>${escapeHtml(title)}</h2>
          <div>${body || ""}</div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-action="cancel">Cancelar</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-action="ok">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `);
    overlay.addEventListener("click", e => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
      const act = e.target.dataset?.action;
      if (act === "cancel") { overlay.remove(); resolve(false); }
      if (act === "ok") { overlay.remove(); resolve(true); }
    });
    document.body.appendChild(overlay);
  });
}

export function formatKg(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kg";
}

export function formatDateTime(d) {
  const date = d instanceof Date ? d : (d?.toDate ? d.toDate() : new Date(d));
  return date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function loading(container) {
  clear(container);
  container.appendChild(el(`<div class="spinner" aria-label="Cargando"></div>`));
}

export function empty(container, message) {
  clear(container);
  container.appendChild(el(`<div class="empty">${escapeHtml(message)}</div>`));
}