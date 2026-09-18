import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest does not expose globals by default, so RTL's auto-cleanup never
// kicks in. Unmount explicitly to keep renders isolated between tests.
afterEach(() => {
  cleanup();
});
