import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/",
    async lazy() {
      const module = await import("./pages/ProjectDashboard");
      return { Component: module.default };
    },
  },
  {
    path: "/import",
    async lazy() {
      const module = await import("./pages/ImportScript");
      return { Component: module.default };
    },
  },
  {
    path: "/workspace",
    async lazy() {
      const module = await import("./pages/Workspace");
      return { Component: module.default };
    },
  },
  {
    path: "/assets",
    async lazy() {
      const module = await import("./pages/AssetLibrary");
      return { Component: module.default };
    },
  },
]);
