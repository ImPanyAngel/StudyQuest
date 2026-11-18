import { courseFolder, folderChain, folderError } from "../../src/core/folders";

test("an empty folder field gives Courses/<CODE>/", () => {
  expect(courseFolder("", "DSAIT4010")).toBe("Courses/DSAIT4010/");
  expect(courseFolder("   ", "DSAIT4010")).toBe("Courses/DSAIT4010/");
});

test("a typed folder goes inside Courses/, without doubling it", () => {
  expect(courseFolder("DSAIT4005", "TEST")).toBe("Courses/DSAIT4005/");
  expect(courseFolder("Year 1/Career", "CV")).toBe("Courses/Year 1/Career/");
  expect(courseFolder("Courses/DSAIT4005/", "TEST")).toBe("Courses/DSAIT4005/");
  expect(courseFolder("/courses/X", "TEST")).toBe("Courses/X/");
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
