import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Image, Loader2 } from "lucide-react";
import { assetWorkspaceApi, type PersonalAsset } from "../api";
import { Button } from "../components/ui/button";

const FILTERS = [
  { value: "", label: "全部" },
  { value: "character", label: "角色" },
  { value: "scene", label: "场景" },
  { value: "prop", label: "道具" },
] as const;

export default function PersonalAssets() {
  const navigate = useNavigate();
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<PersonalAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    assetWorkspaceApi
      .getPersonalAssets(kind || undefined)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [kind]);

  return (
    <div className="min-h-screen bg-[#090b0b] text-gray-100">
      <header className="flex h-16 items-center gap-3 px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-semibold">个人空间</h1>
          <p className="text-xs text-gray-600">跨项目复用已确认资产</p>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="mb-8 flex gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setKind(filter.value)}
              className={`rounded-full px-4 py-2 text-sm ${kind === filter.value ? "bg-teal-400 text-[#07110f]" : "bg-white/5 text-gray-400 hover:bg-white/10"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-teal-300" />
          </div>
        ) : items.length ? (
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl bg-white/[0.045]">
                <div className="aspect-square bg-[#101313]">
                  {item.file_url || item.preview_url ? (
                    <img
                      src={item.file_url || item.preview_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-700">
                      <Image className="h-9 w-9" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-teal-300">
                    {FILTERS.find((filter) => filter.value === item.kind)?.label}
                  </div>
                  <h2 className="mt-1 truncate font-medium">{item.name}</h2>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">
                    {item.description || "来自已确认项目资产"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex h-72 flex-col items-center justify-center rounded-3xl bg-white/[0.025] text-gray-600">
            <Image className="mb-3 h-10 w-10" />
            <p>还没有可复用资产</p>
            <p className="mt-1 text-xs">在项目资产确认页点击“保存复用”</p>
          </div>
        )}
      </main>
    </div>
  );
}
