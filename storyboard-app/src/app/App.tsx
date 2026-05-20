import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { ApiBackendSwitcher } from "./components/api-backend-switcher";

function App() {
  return (
    <div className="dark">
      <ApiBackendSwitcher />
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
