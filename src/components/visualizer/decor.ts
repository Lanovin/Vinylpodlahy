import type { PublicProduct } from "@/lib/public";
import type { LayoutMode, RoomKind } from "@/lib/types";
import type { DecorKind } from "./engine/floorTile";
import type { ViewId } from "./engine/views";

/** Druh kresby pro generátor podlahy — dřevo podle odstínu, kámen podle názvu dekoru. */
export function decorKindFor(p: Pick<PublicProduct, "decor" | "collection" | "decorTone">): DecorKind {
  if (p.decorTone !== "stone") return "wood";
  const n = `${p.decor} ${p.collection}`.toLowerCase();
  if (/mramor|marble/.test(n)) return "marble";
  if (/travertin/.test(n)) return "travertine";
  if (/terr?azz/.test(n)) return "terrazzo";
  if (/břidl|bridl|slate|antracit/.test(n)) return "slate";
  return "concrete";
}

export const isHerringbone = (p: Pick<PublicProduct, "decor" | "collection">) => /rybí kost|herringbone/i.test(`${p.decor} ${p.collection}`);

export const defaultLayoutFor = (p: Pick<PublicProduct, "decor" | "collection">): LayoutMode => (isHerringbone(p) ? "herringbone" : "straight");

/** Místnost z kalkulačky → pohled v modelovém bytě. */
export const VIEW_FOR_ROOM: Record<RoomKind, ViewId> = {
  living: "living", kitchen: "kitchen", bedroom: "bedroom", bathroom: "bathroom", hallway: "hallway", commercial: "living",
};

export const LAYOUT_SLUG: Record<LayoutMode, string> = { straight: "rovne", diagonal: "diagonalne", herringbone: "rybi-kost" };
export const layoutFromSlug = (s: string | undefined | null): LayoutMode | null => (Object.entries(LAYOUT_SLUG).find(([k, v]) => v === s || k === s)?.[0] as LayoutMode | undefined) ?? null;
