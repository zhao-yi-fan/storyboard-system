import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import styles from "./tabs.module.scss";

function Example({ variant }: { variant?: "pill" | "underline" }) {
  return (
    <Tabs variant={variant} defaultValue="character">
      <TabsList aria-label="资产分类">
        <TabsTrigger value="character">角色资产</TabsTrigger>
        <TabsTrigger value="scene">场景资产</TabsTrigger>
        <TabsTrigger value="prop" disabled>
          道具资产
        </TabsTrigger>
      </TabsList>
      <TabsContent value="character">角色列表</TabsContent>
      <TabsContent value="scene">场景列表</TabsContent>
    </Tabs>
  );
}
describe("tabs visual variants", () => {
  it.each(["pill", "underline"] as const)(
    "uses explicit %s styling without changing selection",
    (variant) => {
      render(<Example variant={variant} />);
      const tab = screen.getByRole("tab", { name: "角色资产" });
      expect(tab).toHaveAttribute("data-variant", variant);
      expect(tab.className).toContain(styles[variant]);
      expect(tab).toHaveAttribute("aria-selected", "true");
    },
  );
  it("defaults to pill and preserves keyboard focus and disabled skipping", async () => {
    const user = userEvent.setup();
    render(<Example />);
    const character = screen.getByRole("tab", { name: "角色资产" });
    expect(character).toHaveAttribute("data-variant", "pill");
    await user.tab();
    expect(character).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "场景资产" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "场景资产" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(character).toHaveFocus();
    expect(screen.getByRole("tab", { name: "道具资产" })).toBeDisabled();
  });
});
