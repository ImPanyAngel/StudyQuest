import { checkEvidence, checkNote, checkNotebook } from "../../src/core/file-checks";

type Cell = { type?: "code" | "markdown"; source?: string | string[] };
const nb = (...cells: Cell[]): string =>
  JSON.stringify({
    cells: cells.map((c) => ({ cell_type: c.type ?? "code", ...(c.source === undefined ? {} : { source: c.source }) })),
    nbformat: 4,
  });
/** A cell as Jupyter saves it: a list of lines, each but the last ending in "\n". */
const lines = (...ls: string[]): string[] => ls.map((l, i) => (i < ls.length - 1 ? `${l}\n` : l));
const md: Cell = { type: "markdown", source: ["# Part 1\n", "Explain the layer."] };

const banner = (body: string) =>
  lines(
    "    def forward(self, x):",
    "        ##########################",
    "        #   TODO: Implement this function   #",
    "        ##########################",
    "",
    `        ${body}`,
    "",
    "        ##########################",
    "        #        END OF YOUR CODE        #",
    "        ##########################",
    "",
    "        return y",
  );
const stub = (marker: string, after: string): Cell => ({ source: lines(`# ${marker}`, after) });

describe("notebooks", () => {
  test("a banner TODO still followed by pass is refused, numbered across all cells", () => {
    expect(checkNotebook(nb(md, { source: banner("pass") }))).toBe("Cell 2: the TODO is still `pass`.");
  });

  test("the same banner with real code is accepted", () => {
    expect(checkNotebook(nb(md, { source: banner("self.weight = torch.zeros(n)") }))).toBeNull();
  });

  test("..., None and a pass with a trailing comment are placeholders", () => {
    expect(checkNotebook(nb(stub("TODO", "...")))).toBe("Cell 1: the TODO is still `...`.");
    expect(checkNotebook(nb(stub("TODO", "None")))).toBe("Cell 1: the TODO is still `None`.");
    expect(checkNotebook(nb(stub("TODO", "    pass  # replace this")))).toBe("Cell 1: the TODO is still `pass`.");
  });

  test("a TODO with nothing under it is refused", () => {
    expect(checkNotebook(nb({ source: lines("x = 1", "# TODO: finish", "", "# more notes") }))).toBe(
      "Cell 1: the TODO has no code under it.",
    );
  });

  test("YOUR CODE HERE followed by raise NotImplementedError() is refused", () => {
    const cell = { source: lines("def f(x):", "    # YOUR CODE HERE", "    raise NotImplementedError()") };
    expect(checkNotebook(nb(cell))).toBe("Cell 1: the TODO is still `raise NotImplementedError()`.");
  });

  test("a lone raise NotImplementedError in an abstract method is accepted", () => {
    const cell = { source: lines("class Layer:", "    def forward(self, x):", "        raise NotImplementedError") };
    expect(checkNotebook(nb(cell))).toBeNull();
  });

  test("TODO matches any case but only as a whole word", () => {
    expect(checkNotebook(nb(stub("todo: tidy later", "x = 1")))).toBeNull();
    expect(checkNotebook(nb(stub("todo: tidy later", "pass")))).toBe("Cell 1: the TODO is still `pass`.");
    expect(checkNotebook(nb(stub("TODOS", "pass")))).toBeNull();
  });

  test("comments ending in ... are not markers (Assignment 1 shape)", () => {
    const cell = { source: lines("b = pr.gendatb()", "#... and then visualize it", "pr.scatterd(b)", "# ... and more!") };
    expect(checkNotebook(nb(cell))).toBeNull();
  });

  test("an empty code cell is refused; a missing source counts as empty", () => {
    expect(checkNotebook(nb(md, { source: "x = 1" }, { source: "   \n" }, { source: "y = 2" }))).toBe("Cell 3 is empty.");
    expect(checkNotebook(nb({}, { source: "x = 1" }))).toBe("Cell 1 is empty.");
  });

  test("empty code cells after the last filled one are ignored (Jupyter adds one on Shift+Enter)", () => {
    expect(checkNotebook(nb({ source: "x = 1" }, { source: [] }, md, { source: "" }))).toBeNull();
  });

  test("a notebook whose code cells are all empty has no code", () => {
    expect(checkNotebook(nb({}, { source: "  " }))).toBe("This notebook has no code.");
  });

  test("a string source is checked like a list", () => {
    expect(checkNotebook(nb({ source: "# TODO\npass" }))).toBe("Cell 1: the TODO is still `pass`.");
    expect(checkNotebook(nb({ source: "# TODO\r\nx = 2" }))).toBeNull();
  });

  test("two markers above one pass count once", () => {
    const cell = { source: lines("# TODO: implement", "# YOUR CODE HERE", "pass") };
    expect(checkNotebook(nb(cell))).toBe("Cell 1: the TODO is still `pass`.");
  });

  test("several problems name the first and count the rest", () => {
    expect(checkNotebook(nb(stub("TODO", "pass"), stub("TODO", "pass"), stub("TODO", "pass")))).toBe(
      "Cell 1: the TODO is still `pass` (and 2 more).",
    );
  });

  test("unreadable notebooks are refused", () => {
    expect(checkNotebook("not json")).toBe("Couldn't read this notebook.");
    expect(checkNotebook('{"cells": 3}')).toBe("Couldn't read this notebook.");
    expect(checkNotebook("null")).toBe("Couldn't read this notebook.");
  });

  test("a notebook without code cells is refused", () => {
    expect(checkNotebook(nb())).toBe("This notebook has no code.");
    expect(checkNotebook(nb(md))).toBe("This notebook has no code.");
  });
});

describe("notes", () => {
  const msg = (n: string) => `This note has ${n} characters; a note needs at least 5,000.`;

  test("4,999 characters are refused; 5,000 are accepted", () => {
    expect(checkNote("a".repeat(4999))).toBe(msg("4,999"));
    expect(checkNote("a".repeat(5000))).toBeNull();
  });

  test("an empty note is refused", () => {
    expect(checkNote("")).toBe(msg("0"));
  });

  test("frontmatter is not counted, with LF or CRLF line endings", () => {
    expect(checkNote("---\ntitle: x\n---\n" + "a".repeat(4999))).toBe(msg("4,999"));
    expect(checkNote("---\r\ntitle: x\r\n---\r\n" + "a".repeat(4999))).toBe(msg("4,999"));
  });

  test("an unclosed frontmatter block counts as text", () => {
    expect(checkNote("---\n" + "a".repeat(5000))).toBeNull();
  });

  test("leading and trailing whitespace is not counted", () => {
    expect(checkNote("\n\n  " + "a".repeat(4999) + "  \n")).toBe(msg("4,999"));
  });
});

test("checkEvidence picks the rule by extension, any case; other files pass", () => {
  expect(checkEvidence("IPYNB", nb(stub("TODO", "pass")))).toBe("Cell 1: the TODO is still `pass`.");
  expect(checkEvidence("md", "short")).toBe("This note has 5 characters; a note needs at least 5,000.");
  expect(checkEvidence("pdf", "")).toBeNull();
});
