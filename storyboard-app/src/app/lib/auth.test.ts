import { describe, expect, it } from "vitest";

import { buildLoginUrl, getRedirectTarget } from "./auth";

describe("getRedirectTarget", () => {
  it("returns the from query for same-origin paths", () => {
    expect(getRedirectTarget("?from=%2Fworkspace%3Fproject%3D19")).toBe(
      "/workspace?project=19",
    );
  });

  it("falls back for missing or empty targets", () => {
    expect(getRedirectTarget("")).toBe("/projects");
    expect(getRedirectTarget("?from=")).toBe("/projects");
    expect(getRedirectTarget("?other=1")).toBe("/projects");
  });

  it("rejects open redirects and protocol-relative urls", () => {
    expect(getRedirectTarget("?from=https://evil.com/x")).toBe("/projects");
    expect(getRedirectTarget("?from=//evil.com/x")).toBe("/projects");
    expect(getRedirectTarget("?from=javascript:alert(1)")).toBe("/projects");
  });

  it("supports a custom fallback", () => {
    expect(getRedirectTarget("", "/login")).toBe("/login");
  });
});

describe("buildLoginUrl", () => {
  it("builds a plain login url without target", () => {
    expect(buildLoginUrl()).toBe("/login");
    expect(buildLoginUrl("")).toBe("/login");
  });

  it("encodes the return target", () => {
    expect(buildLoginUrl("/workspace?project=19")).toBe("/login?from=%2Fworkspace%3Fproject%3D19");
  });
});
