import { PluginLog, type Files } from "../../src/store/plugin-log";

/** In-memory stand-in for Obsidian's file adapter. */
function fakeFiles(): Files & { data: Map<string, string>; dirs: Set<string> } {
  const data = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    data,
    dirs,
    exists: async (p) => data.has(p) || dirs.has(p),
    mkdir: async (p) => void dirs.add(p),
    list: async (p) => ({ files: [...data.keys()].filter((f) => f.startsWith(p + "/") && !f.slice(p.length + 1).includes("/")), folders: [] }),
    read: async (p) => {
      if (!data.has(p)) throw new Error(`no ${p}`);
      return data.get(p)!;
    },
    write: async (p, text) => void data.set(p, text),
  };
}

const DIR = ".obsidian/plugins/studyquest/log";

test("append creates the folder and a run's file, then adds lines on new lines", async () => {
  const f = fakeFiles();
  const log = new PluginLog(f, DIR);
  await log.append("R", ['{"a":1}']);
  await log.append("R", ['{"b":2}', '{"c":3}']);
  expect(f.dirs.has(DIR)).toBe(true);
  expect(f.data.get(`${DIR}/R.jsonl`)).toBe('{"a":1}\n{"b":2}\n{"c":3}\n');
});

test("readAll returns every run's file, ignoring other files", async () => {
  const f = fakeFiles();
  const log = new PluginLog(f, DIR);
  await log.append("A", ["1"]);
  await log.append("B", ["2"]);
  f.data.set(`${DIR}/notes.txt`, "x");
  expect((await log.readAll()).sort()).toEqual(["1\n", "2\n"]);
  expect(await new PluginLog(fakeFiles(), DIR).readAll()).toEqual([]);
});

test("importing an old log merges into an existing file without gluing lines together", async () => {
  const f = fakeFiles();
  const log = new PluginLog(f, DIR);
  await log.append("R", ["new"]);
  await log.importText("R", "old1\nold2");
  await log.importText("Q", "only\n");
  expect(f.data.get(`${DIR}/R.jsonl`)).toBe("new\nold1\nold2\n");
  expect(f.data.get(`${DIR}/Q.jsonl`)).toBe("only\n");
});
