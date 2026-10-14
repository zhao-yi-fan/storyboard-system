import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { saveAuthSession } from "./auth";
import {
  assetPreparationPath,
  getProjectPosition,
  legacyAssetsPath,
  projectAssetsPath,
  rememberProjectPosition,
  sanitizeProjectPosition,
} from "./projectPosition";

function login(id: number) {
  saveAuthSession({
    id,
    account: `user${id}`,
    display_name: "测试",
    role_label: "用户",
    is_active: true,
  });
}

describe("project position", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });
  it("isolates positions by account and project and keeps a separate workspace bookmark", () => {
    login(1);
    rememberProjectPosition(19, "/workspace?project=19&chapter=2&scene=8");
    rememberProjectPosition(19, "/assets?project=19&view=prepare&chapter=2&entity=character:29");
    expect(getProjectPosition(19)).toContain("view=prepare");
    expect(getProjectPosition(19, true)).toContain("scene=8");
    expect(getProjectPosition(20)).toBe("/workspace?project=20");
    login(2);
    expect(getProjectPosition(19)).toBe("/workspace?project=19");
    login(1);
    expect(getProjectPosition(19)).toContain("entity=character%3A29");
  });
  it("rejects external or cross-project locations and strips unrelated URL parameters", () => {
    expect(sanitizeProjectPosition("//evil.test/assets?project=19", 19)).toBeNull();
    expect(sanitizeProjectPosition("https://evil.test/assets?project=19", 19)).toBeNull();
    expect(sanitizeProjectPosition("/assets?project=20", 19)).toBeNull();
    expect(sanitizeProjectPosition("/assets?project=19&url=secret&Expires=123", 19)).toBe(
      "/projects/19/assets",
    );
  });
  it("normalizes legacy bookmarks and keeps valid business parameters", () => {
    expect(sanitizeProjectPosition("/assets/?project=30&view=all&chapter=20", 30)).toBe(
      "/projects/30/assets?view=all&chapter=20",
    );
    expect(
      sanitizeProjectPosition("/projects/30/assets/?view=prepare&chapter=20&project=19", 30),
    ).toBe("/projects/30/assets?view=prepare&chapter=20");
    expect(sanitizeProjectPosition("/projects/31/assets?view=all", 30)).toBeNull();
    expect(sanitizeProjectPosition("/assets/index.js?project=30", 30)).toBeNull();
    login(1);
    window.localStorage.setItem(
      "storyboard_project_position_v1:1:30",
      "/assets/?project=30&view=all&chapter=20",
    );
    expect(getProjectPosition(30)).toBe("/projects/30/assets?view=all&chapter=20");
  });
  it("uses scoped paths for new links and legacy confirmation links", () => {
    expect(assetPreparationPath(30, 20)).toBe("/projects/30/assets?view=prepare&chapter=20");
    expect(projectAssetsPath(30, new URLSearchParams("project=31&view=all"))).toBe(
      "/projects/30/assets?view=all",
    );
    expect(
      legacyAssetsPath(
        new URLSearchParams("project=30&view=all&chapter=20&character=7&q=test"),
        true,
      ),
    ).toBe("/projects/30/assets?view=prepare&chapter=20&entity=character%3A7&q=test");
    for (const value of ["", "0", "-1", "1.5", "no", "9007199254740992"])
      expect(legacyAssetsPath(new URLSearchParams({ project: value }))).toBe("/projects");
  });
});
