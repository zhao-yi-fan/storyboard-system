import type { AssetRequirement } from "../../api";

export const PREPARATION_KINDS = [
  { value: "character", label: "角色" },
  { value: "scene", label: "场景" },
  { value: "prop", label: "道具" },
] as const;

export function uniqueRequirements(items: AssetRequirement[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.linked_entity_id
      ? `${item.linked_entity_type}:${item.linked_entity_id}`
      : `requirement:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isGenerating(item: AssetRequirement) {
  return (item.generation_status ?? item.status) === "generating";
}

export function missingCandidates(items: AssetRequirement[]) {
  return uniqueRequirements(items).filter(
    (item) =>
      !item.file_url &&
      item.can_generate !== false &&
      !isGenerating(item) &&
      Boolean(item.linked_entity_id),
  );
}

export function preparationSummary(items: AssetRequirement[]) {
  const unique = uniqueRequirements(items);
  return {
    available: unique.filter((item) => Boolean(item.file_url)).length,
    missing: unique.filter((item) => !item.file_url).length,
    generating: unique.filter(isGenerating).length,
    failed: unique.filter((item) => (item.generation_status ?? item.status) === "failed").length,
    blocked: unique.filter((item) => !item.file_url && item.can_generate === false).length,
  };
}
