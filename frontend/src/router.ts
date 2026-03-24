import { ROUTE_TITLES } from "./constants";
import type { AppElements } from "./dom";

export function setRoute(pathname: string, elements: AppElements): void {
  elements.routeSections.forEach((section) => {
    const targetId = pathname === "/" ? "route-home" : `route-${pathname.slice(1)}`;
    section.classList.toggle("active", section.id === targetId);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === pathname);
  });

  document.title = ROUTE_TITLES[pathname as keyof typeof ROUTE_TITLES] || ROUTE_TITLES["/"];
}

export function navigate(pathname: string, elements: AppElements): void {
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, "", pathname);
  }
  setRoute(pathname, elements);
}
