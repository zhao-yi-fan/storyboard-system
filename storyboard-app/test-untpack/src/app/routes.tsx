import { createBrowserRouter } from "react-router";
import ImportScript from "./pages/ImportScript";
import Workspace from "./pages/Workspace";
import AssetLibrary from "./pages/AssetLibrary";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: ImportScript,
  },
  {
    path: "/workspace",
    Component: Workspace,
  },
  {
    path: "/assets",
    Component: AssetLibrary,
  },
]);
