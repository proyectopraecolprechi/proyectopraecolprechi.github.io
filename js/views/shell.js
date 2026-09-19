import { el, refreshIcons } from "../ui.js";
import { getCurrentUser, isAdmin, logout } from "../auth.js";
import { currentPath } from "../router.js";

export function renderShell(viewBody) {
  const user = getCurrentUser() || {};
  const path = currentPath() || "";
  const admin = isAdmin();

  const navItemsOp = [
    { to: "/registro", label: "Registrar", icon: "scale" },
    { to: "/resumen", label: "Resumen", icon: "bar-chart-3" },
    { to: "/perfil", label: "Perfil", icon: "user" },
  ];

  const navItemsAdmin = [
    { to: "/resumen", label: "Resumen", icon: "bar-chart-3" },
    { to: "/registro", label: "Registrar pesaje", icon: "scale" },
    { to: "/admin/estudiantes", label: "Estudiantes", icon: "users" },
    { to: "/admin/grados", label: "Grados", icon: "graduation-cap" },
    { to: "/admin/reportes", label: "Reportes", icon: "line-chart" },
    { to: "/admin/cierre", label: "Cierre de año", icon: "calendar-check" },
    { to: "/admin/operadores", label: "Operadores", icon: "users" },
  ];

  const isActive = (to) => path === to || path.startsWith(to + "/");

  const shell = el(`<div class="app-shell ${admin ? "has-sidebar" : ""}"></div>`);

  if (admin) {
    const overlay = el(`<div class="sidebar-overlay"></div>`);
    overlay.addEventListener("click", () => shell.classList.remove("sidebar-open"));
    shell.appendChild(overlay);

    const side = el(`
      <aside class="sidebar">
        <div class="brand"><i data-lucide="leaf"></i> PRAE</div>
        <nav>
          ${navItemsAdmin.map(n => `<a href="#${n.to}" class="${isActive(n.to) ? "active" : ""}"><i data-lucide="${n.icon}"></i>${n.label}</a>`).join("")}
        </nav>
        <a href="#" class="logout" data-action="logout"><i data-lucide="log-out"></i> Cerrar sesión</a>
      </aside>
    `);
    
    side.querySelectorAll('nav a').forEach(a => {
      a.addEventListener('click', () => shell.classList.remove('sidebar-open'));
    });
    
    side.querySelector('[data-action="logout"]')?.addEventListener("click", (e) => { e.preventDefault(); logout(); });
    shell.appendChild(side);
  }

  const main = el(`<div style="flex:1; display:flex; flex-direction:column; min-width:0;"></div>`);

  const top = el(`
    <header class="topbar">
      <div class="brand">
        ${admin ? `<button class="menu-btn" style="margin-right:8px;"><i data-lucide="menu"></i></button>` : ""}
        <i data-lucide="leaf"></i> PRAE Reciclaje
      </div>
      <div class="user">
        <button id="theme-toggle" style="background:transparent; border:none; cursor:pointer; display:flex; align-items:center; padding:6px; border-radius:50%; transition:transform 0.4s ease; margin-right:4px;" title="Cambiar tema"></button>
        <span class="badge ${admin ? "admin" : "activo"}">${admin ? "Admin" : "Operador"}</span>
        <span class="hide-mobile">${user?.nombre || user?.email || ""}</span>
        <button data-action="logout" title="Cerrar sesión"><i data-lucide="log-out"></i></button>
      </div>
    </header>
  `);
  
  // Modo oscuro seguro (protegido contra bloqueos de localStorage)
  try {
    const themeBtn = top.querySelector('#theme-toggle');
    const isDark = localStorage.getItem('theme') === 'dark';
    if (isDark) document.body.classList.add('dark-mode');

    if (themeBtn) {
      const updateThemeIcon = () => {
        const dark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = dark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        themeBtn.style.color = dark ? 'var(--ambar)' : 'var(--gris-700)';
        refreshIcons();
      };
      updateThemeIcon();

      themeBtn.addEventListener('click', () => {
        const nowDark = document.body.classList.toggle('dark-mode');
        try { localStorage.setItem('theme', nowDark ? 'dark' : 'light'); } catch(e){}
        updateThemeIcon();
        themeBtn.style.transform = nowDark ? 'rotate(360deg)' : 'rotate(0deg)';
      });
    }
  } catch (e) {
    console.warn("Modo oscuro desactivado por privacidad del navegador", e);
  }

  if (admin) {
    top.querySelector('.menu-btn')?.addEventListener("click", () => {
      shell.classList.add("sidebar-open");
    });
  }

  top.querySelector('[data-action="logout"]')?.addEventListener("click", () => logout());
  main.appendChild(top);

  const mainEl = el(`<main class="app-main"></main>`);
  if (viewBody) mainEl.appendChild(viewBody);
  main.appendChild(mainEl);

  if (!admin) {
    const nav = el(`
      <nav class="bottom-nav">
        ${navItemsOp.map(n => `<a href="#${n.to}" class="${isActive(n.to) ? "active" : ""}"><i data-lucide="${n.icon}"></i><span>${n.label}</span></a>`).join("")}
      </nav>
    `);
    main.appendChild(nav);
  }

  shell.appendChild(main);
  refreshIcons();
  return shell;
}