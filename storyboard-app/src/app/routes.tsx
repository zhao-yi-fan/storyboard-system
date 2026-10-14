import { createBrowserRouter } from "react-router";

import { GuestOnlyRoute, RequireAuthRoute, RootRedirect } from "./components/RouteGuards";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootRedirect,
    HydrateFallback: () => null,
  },
  {
    Component: GuestOnlyRoute,
    HydrateFallback: () => <p role="status">正在加载…</p>,
    children: [
      {
        path: "/login",
        async lazy() {
          const module = await import("./pages/login/Login");
          return { Component: module.default };
        },
      },
    ],
  },
  {
    Component: RequireAuthRoute,
    HydrateFallback: () => <p role="status">正在加载…</p>,
    children: [
      {
        path: "/projects",
        async lazy() {
          const module = await import("./pages/project-dashboard/ProjectDashboard");
          return { Component: module.default };
        },
      },
      {
        path: "/import",
        async lazy() {
          const module = await import("./pages/import-script/ImportScript");
          return { Component: module.default };
        },
      },
      {
        path: "/workspace",
        async lazy() {
          const module = await import("./pages/workspace/Workspace");
          return { Component: module.default };
        },
      },
      {
        path: "/assets",
        async lazy() {
          const module = await import("./pages/asset-library/LegacyAssetsRedirect");
          return { Component: module.default };
        },
      },
      {
        path: "/projects/:projectId/assets",
        async lazy() {
          const module = await import("./pages/asset-library/AssetLibrary");
          return { Component: module.default };
        },
      },
      {
        path: "/asset-confirmation",
        async lazy() {
          const module = await import("./pages/asset-confirmation/AssetConfirmation");
          return { Component: module.default };
        },
      },
      {
        path: "/personal-assets",
        async lazy() {
          const module = await import("./pages/personal-assets/PersonalAssets");
          return { Component: module.default };
        },
      },
    ],
  },
]);
