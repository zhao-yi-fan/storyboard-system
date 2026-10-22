import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AssetMediaSections } from "./AssetMediaSections";

vi.mock("../../components/media/SignedMedia", () => ({
  SignedImage: ({ src, alt, onError, onLoad }: React.ComponentProps<"img">) => (
    <>
      <img src={src} alt={alt} onError={onError} onLoad={onLoad} />
      <button type="button" onClick={() => {}}>
        重试加载
      </button>
    </>
  ),
}));

const props = {
  original: "",
  cover: "",
  generating: false,
  saving: false,
  canGenerate: true,
  onPreview: vi.fn(),
  onUpload: vi.fn(),
  onGenerate: vi.fn(),
  onImport: vi.fn(),
};

describe("asset detail media sections", () => {
  it("uses actions instead of empty image placeholders", () => {
    render(<AssetMediaSections {...props} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传原始素材" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "生成封面" })).toHaveAttribute(
      "data-variant",
      "default",
    );
    expect(screen.getAllByRole("button", { name: "从个人空间选择" })).toHaveLength(1);
  });

  it("keeps preview and replacement actions in the corresponding sections", () => {
    const preview = vi.fn(),
      generate = vi.fn(),
      select = vi.fn();
    render(
      <AssetMediaSections
        {...props}
        original="/original.png"
        cover="/cover.png"
        onPreview={preview}
        onGenerate={generate}
        onImport={select}
      />,
    );
    const original = screen.getByRole("region", { name: "原始素材" });
    expect(within(original).getByRole("button", { name: "替换素材" })).toBeEnabled();
    fireEvent.click(within(original).getByRole("button", { name: "预览原始素材" }));
    expect(preview).toHaveBeenCalledWith("/original.png", "原始素材");
    fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
    expect(generate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "从个人空间选择" }));
    expect(select).toHaveBeenCalledOnce();
  });

  it("retains the previous cover during generation and shows persistent failure", () => {
    render(
      <AssetMediaSections {...props} cover="/cover.png" generating coverError="生成失败，请重试" />,
    );
    expect(screen.getByAltText("AI 封面")).toHaveAttribute("src", "/cover.png");
    expect(screen.getByRole("button", { name: "正在生成" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "从个人空间选择" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("生成失败");
  });

  it("does not treat image failure or loading retry as a generation request", () => {
    const generate = vi.fn();
    render(<AssetMediaSections {...props} cover="/cover.png" onGenerate={generate} />);
    fireEvent.error(screen.getByAltText("AI 封面"));
    expect(screen.queryByRole("button", { name: "预览AI 封面" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新生成" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试加载" }));
    expect(generate).not.toHaveBeenCalled();
    fireEvent.load(screen.getByAltText("AI 封面"));
    expect(screen.getByRole("button", { name: "预览AI 封面" })).toBeInTheDocument();
  });

  it("blocks duplicate uploads and reports failure beside the original asset", async () => {
    let reject!: (error: Error) => void;
    const upload = vi.fn(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    render(<AssetMediaSections {...props} onUpload={upload} />);
    const input = screen.getByLabelText("选择原始素材文件");
    const file = new File(["image"], "image.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("button", { name: "上传中" })).toBeDisabled();
    fireEvent.change(input, { target: { files: [file] } });
    expect(upload).toHaveBeenCalledOnce();
    reject(new Error("上传失败"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("上传失败"));
    expect(screen.getByRole("button", { name: "上传原始素材" })).toBeEnabled();
  });
});
