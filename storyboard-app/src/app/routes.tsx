import { createBrowserRouter } from "react-router";
import { GuestOnlyRoute, RequireAuthRoute, RootRedirect } from "./components/RouteGuards";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootRedirect,
  },
  {
    Component: GuestOnlyRoute,
    children: [
      {
        path: "/login",
        async lazy() {
          const module = await import("./pages/Login");
          return { Component: module.default };
        },
      },
    ],
  },
  {
    Component: RequireAuthRoute,
    children: [
      {
        path: "/projects",
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
    ],
  },
]);
