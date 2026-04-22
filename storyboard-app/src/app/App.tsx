import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <div className="dark">
      <RouterProvider router={router} />
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
