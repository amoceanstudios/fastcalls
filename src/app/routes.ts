import { lazy, type ComponentType } from "react";

function route(load: () => Promise<{ default: ComponentType }>) {
  let request: ReturnType<typeof load> | undefined;
  const preload = () => {
    request ??= load().catch((error) => {
      request = undefined;
      throw error;
    });
    return request;
  };
  return { Component: lazy(preload), preload };
}

export const screens = {
  vinder: route(() => import("../pages/Vinder")),
  recovery: route(() => import("../pages/StorageRecovery")),
  work: route(() => import("../pages/MyWork")),
  dashboard: route(() => import("../pages/Dashboard")),
  prospects: route(() => import("../pages/Directory")),
  detail: route(() => import("../pages/Detail")),
  calling: route(() => import("../pages/Calling")),
  followups: route(() => import("../pages/Followups")),
  data: route(() => import("../pages/DataCenter")),
  settings: route(() => import("../pages/Settings")),
};

export function preloadRoute(pathname: string) {
  const key = pathname.startsWith("/prospects/")
    ? "detail"
    : pathname === "/"
      ? "dashboard"
      : pathname.slice(1);
  if (key in screens) {
    // A failed speculative request must never block a later real navigation.
    void screens[key as keyof typeof screens].preload().catch(() => {});
  }
}
