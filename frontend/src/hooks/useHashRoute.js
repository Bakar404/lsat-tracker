import { useSyncExternalStore } from "react";

export const ROUTES = { dashboard: "#/", exams: "#/exams" };

function subscribe(onChange) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const getHash = () => window.location.hash;

/** Hash routing keeps every view addressable without server-side route handling. */
export function useHashRoute() {
  return useSyncExternalStore(subscribe, getHash) === ROUTES.exams ? "exams" : "dashboard";
}

export function navigate(route) {
  window.location.hash = ROUTES[route];
}
