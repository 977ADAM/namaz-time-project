import type { AppElements } from "./dom";
import { getRouteTitle } from "./locales";
import type { AppLanguage } from "./types";

export function setRoute(pathname: string, elements: AppElements, language: AppLanguage = "ru"): void {
  elements.routeSections.forEach((section) => {
    const targetId = pathname === "/" ? "route-home" : `route-${pathname.slice(1)}`;
    section.classList.toggle("active", section.id === targetId);
  });

  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === pathname);
  });

  document.title = getRouteTitle(language, pathname);
}

export function navigate(pathname: string, elements: AppElements, language: AppLanguage = "ru"): void {
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, "", pathname);
  }
  setRoute(pathname, elements, language);
}
