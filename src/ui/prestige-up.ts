import { Notice } from "obsidian";
import type { Score } from "../core/derive";
import { tierLabel } from "../core/prestige";
import type { RunState } from "../core/state";
import { renderSprite } from "./parts";
import { singleFlight } from "./single-flight";

/** Full-view takeover shown once per closed run (layout B: character beside the score). */
export function renderPrestigeUp(el: HTMLElement, run: RunState, score: Score, onContinue: () => Promise<void>): void {
  const box = el.createDiv({ cls: "sq-prestige" });
  box.createDiv({ cls: "sq-prestige-title", text: "PRESTIGE UP" });
  box.createDiv({ cls: "sq-prestige-run", text: `${run.name} · complete` });

  const row = box.createDiv({ cls: "sq-prestige-row" });
  renderSprite(row.createDiv({ cls: "sq-prestige-player" }));
  const result = row.createDiv({ cls: "sq-prestige-result" });
  result.createDiv({ cls: "sq-prestige-pct", text: score.pct === null ? "—" : `${score.pct}%` });
  result.createDiv({ cls: "sq-prestige-tier", text: tierLabel(score.tier ?? 0) });

  const buttons = box.createDiv({ cls: "sq-prestige-buttons" });
  const next = buttons.createEl("button", { cls: "mod-cta", text: "Set up next run →" });
  const go = singleFlight(async () => {
    next.disabled = true;
    try {
      await onContinue();
    } catch (e) {
      new Notice(e instanceof Error ? e.message : String(e));
    } finally {
      next.disabled = false;
    }
  });
  next.onClickEvent(() => void go());
  const wardrobe = buttons.createEl("button", { text: "Customise character", attr: { title: "Arrives in phase 6" } });
  wardrobe.disabled = true;
}
