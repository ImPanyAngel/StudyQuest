import { Notice } from "obsidian";
import { defaultLook } from "../core/character";
import { localDateOf } from "../core/dates";
import { runEnded } from "../core/derive";
import type { QuestStore } from "../store/quest-store";
import { looksRows, row, starterRows, type Draft } from "./look-editor";
import type { Navigate, Route } from "./parts";
import { renderCharacter } from "./sprite";

/** Page-local state that survives re-renders. */
export interface CharacterUi {
  draft?: Draft;
  sub?: "wardrobe" | "shop" | "looks";
}

/** Making a run's character: body, looks and a free starter outfit. */
export function renderCreation(el: HTMLElement, store: QuestStore, route: Extract<Route, { tab: "creation" }>, nav: Navigate, ui: CharacterUi, rerender: () => void): void {
  el.createDiv({ cls: "sq-back", text: "← Home" }).onClickEvent(() => nav({ tab: "home" }));
  const run = store.state.runs.get(route.run);
  if (!run) {
    el.createDiv({ cls: "sq-muted", text: "This run no longer exists." });
    return;
  }
  if (run.character) {
    nav({ tab: "character", run: run.id });
    return;
  }
  if (run.closed || runEnded(run, localDateOf(store.clock()))) {
    el.createDiv({ cls: "sq-muted", text: `${run.name} has ${run.closed ? "closed" : "ended"}, so it can't get a character any more.` });
    return;
  }
  if (ui.draft?.run !== run.id) ui.draft = { run: run.id, body: "male", look: defaultLook("male") };
  const draft = ui.draft;

  el.createEl("h3", { cls: "sq-page-title", text: `New character · ${run.name}` });
  const page = el.createDiv({ cls: "sq-char-page" });
  renderCharacter(page.createDiv({ cls: "sq-char-stage" }), draft, () => true, 3);
  const form = page.createDiv({ cls: "sq-char-form" });

  const bodyRow = row(form, "Body");
  for (const b of ["male", "female"] as const) {
    const btn = bodyRow.createEl("button", { cls: b === draft.body ? "sq-chip is-on" : "sq-chip", text: b === "male" ? "Male" : "Female" });
    btn.onClickEvent(() => {
      if (b === draft.body) return;
      ui.draft = { run: run.id, body: b, look: defaultLook(b) };
      rerender();
    });
  }
  bodyRow.createSpan({ cls: "sq-hint", text: "fixed once you're done" });

  looksRows(form, draft, rerender);
  form.createEl("h4", { cls: "sq-section", text: "Starter outfit · free" });
  starterRows(form, draft, rerender);

  const done = form.createEl("button", { cls: "mod-cta sq-done", text: "Done" });
  done.onClickEvent(async () => {
    done.disabled = true;
    const r = await store.dispatch({ type: "createCharacter", run: run.id, body: draft.body, look: draft.look });
    done.disabled = false;
    if (!r.ok) return void new Notice(r.error);
    ui.draft = undefined;
    nav({ tab: "character", run: run.id });
  });
}
