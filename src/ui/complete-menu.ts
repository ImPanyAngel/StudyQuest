import { Menu, Notice, type App } from "obsidian";
import type { Action } from "../core/actions";
import { bumpDeadline, canUndoBump } from "../core/derive";
import { EVIDENCE_KINDS } from "../core/events";
import type { ObjectiveState } from "../core/state";
import type { QuestStore } from "../store/quest-store";
import { EvidencePicker } from "./evidence-picker";

/** The click menu for an open, non-exam objective. */
export function openCompleteMenu(evt: MouseEvent, obj: ObjectiveState, store: QuestStore, app: App): void {
  const menu = new Menu();

  if (obj.kind === "reading") {
    menu.addItem((i) => i.setTitle(obj.title).setIsLabel(true));
    const levels = obj.levels ?? [];
    // Innermost level first: "Next chapter" before "Next course".
    for (let level = levels.length - 1; level >= 0; level--) {
      const inner = levels.slice(level + 1);
      const reset = inner.length ? ` (${inner.join(", ")} back to 0)` : "";
      const title = `Next ${levels[level].toLowerCase()} → ${levels[level]} ${obj.position[level] + 1}${reset}`;
      menu.addItem((i) => i.setTitle(title).setIcon("chevron-right").onClick(() => run(store, { type: "bumpReading", obj: obj.id, level })));
    }
    const now = store.clock();
    if (canUndoBump(obj, now)) {
      const left = Math.max(1, Math.ceil((bumpDeadline(obj)!.getTime() - now.getTime()) / 60_000));
      menu.addItem((i) => i.setTitle(`Undo last bump · ${left} min left`).setIcon("undo").onClick(() => run(store, { type: "undoBump", obj: obj.id })));
    }
    menu.addItem((i) => i.setTitle("Finished → done").setIcon("check").onClick(() => run(store, { type: "selfCheck", obj: obj.id })));
    menu.showAtMouseEvent(evt);
    return;
  }

  if (obj.kind === "progress" && obj.steps) {
    obj.steps.forEach((name, step) => {
      menu.addItem((i) => {
        const done = obj.stepsDone[step];
        i.setTitle(done ? name : `Self check: ${name}`).setChecked(done);
        if (done) i.setDisabled(true);
        else i.onClick(() => run(store, { type: "checkStep", obj: obj.id, step }));
      });
    });
  } else if (EVIDENCE_KINDS.includes(obj.kind)) {
    menu.addItem((i) =>
      i
        .setTitle("Mark Done")
        .setIcon("file-check")
        .onClick(() => new EvidencePicker(app, store, obj).open()),
    );
  }
  menu.showAtMouseEvent(evt);
}

async function run(store: QuestStore, a: Action) {
  const r = await store.dispatch(a);
  if (!r.ok) new Notice(r.error);
}
