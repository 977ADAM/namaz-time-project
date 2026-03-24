import { ROUTE_TITLES } from "./constants.js";

export function setRoute(pathname, elements) {
  elements.routeSections.forEach((section) => {
    const targetId = pathname === "/" ? "route-home" : `route-${pathname.slice(1)}`;
    section.classList.toggle("active", section.id === targetId);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === pathname);
  });

  document.title = ROUTE_TITLES[pathname] || ROUTE_TITLES["/"];
}

export function navigate(pathname, elements) {
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, "", pathname);
  }
  setRoute(pathname, elements);
}
