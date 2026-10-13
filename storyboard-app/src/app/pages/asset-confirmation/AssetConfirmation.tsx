import { Navigate, useSearchParams } from "react-router";

export default function AssetConfirmation() {
  const [searchParams] = useSearchParams();
  const params = new URLSearchParams(searchParams);
  if (!Number(params.get("project"))) return <Navigate to="/projects" replace />;
  params.set("view", "prepare");
  if (params.has("character")) {
    params.set("entity", `character:${params.get("character")}`);
    params.delete("character");
  }
  return <Navigate to={`/assets?${params}`} replace />;
}
