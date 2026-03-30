import { RouterProvider } from "react-router";
import { router } from "./routes";

function App() {
  return (
    <div className="dark">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;