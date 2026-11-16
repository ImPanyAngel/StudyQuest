import { Menu, Notice } from "obsidian";
import type { Action } from "../core/actions";
import type { ObjectiveState } from "../core/state";
import type { QuestStore } from "../store/quest-store";

/** The "Complete?" menu for an open, non-exam objective. */
export function openCompleteMenu(evt: MouseEvent, obj: ObjectiveState, store: QuestStore): void {
  const menu = new Menu();
  menu.addItem((i) => i.setTitle("Complete?").setIsLabel(true));
  menu.addItem((i) => i.setTitle("AI check — arrives in phase 4").setIcon("sparkles").setDisabled(true));

  if (obj.kind === "progress" && obj.steps) {
    obj.steps.forEach((name, step) => {
      menu.addItem((i) => {
        const done = obj.stepsDone[step];
        i.setTitle(done ? name : `Self check: ${name}`).setChecked(done);
        if (done) i.setDisabled(true);
        else i.onClick(() => run(store, { type: "checkStep", obj: obj.id, step }));
      });
    });
  } else {
    menu.addItem((i) =>
      i
        .setTitle("Self check → silver")
        .setIcon("check")
        .onClick(() => run(store, { type: "selfCheck", obj: obj.id })),
    );
  }
  menu.showAtMouseEvent(evt);
}

async function run(store: QuestStore, a: Action) {
  const r = await store.dispatch(a);
  if (!r.ok) new Notice(r.error);
}
