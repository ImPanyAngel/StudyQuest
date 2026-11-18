import { setIcon, setTooltip } from "obsidian";
import type { Badge } from "../core/rewards";
import { BADGE_ICONS, badgeLabel } from "./parts";

/** Badges as icons, full name on hover; permanent ones in gold. The line keeps its height when empty. */
export function renderBadges(parent: HTMLElement, badges: Badge[]): void {
  const line = parent.createDiv({ cls: "sq-badges" });
  for (const b of badges) {
    const icon = line.createSpan({ cls: b.course ? "sq-badge" : "sq-badge is-permanent" });
    setIcon(icon, BADGE_ICONS[b.id]);
    setTooltip(icon, badgeLabel(b));
  }
}
