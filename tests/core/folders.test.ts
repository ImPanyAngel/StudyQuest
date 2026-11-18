import { defaultCourseFolder, folderChain, folderError } from "../../src/core/folders";

test("the default course folder sits under Courses/", () => {
  expect(defaultCourseFolder("DSAIT4010")).toBe("Courses/DSAIT4010/");
});

test("folderChain normalises slashes and spaces and lists parents first", () => {
  for (const p of ["Courses/X/", "/Courses//X/ ", " Courses / X "]) expect(folderChain(p)).toEqual(["Courses", "Courses/X"]);
  expect(folderChain("A")).toEqual(["A"]);
});

test("folderError accepts a normal path and explains bad ones", () => {
  expect(folderError("Courses/X/")).toBeNull();
  expect(folderError("/")).toBe("A course folder needs a name.");
  expect(folderError("Courses/../X")).toBe("A folder path can't contain . or .. parts.");
  expect(folderError("Courses/./X")).toBe("A folder path can't contain . or .. parts.");
  expect(folderError("Courses/X:Y")).toBe("A folder name can't contain :.");
});
