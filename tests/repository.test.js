import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const conflictMarker = /^(?:<<<<<<<(?: |\r?$)|=======\r?$|>>>>>>>(?: |\r?$))/m;
const trailingWhitespace = /[ \t]+\r?$/m;
const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const textFiles = trackedFiles
  .map((name) => ({ name, content: readFileSync(join(root, name)) }))
  .filter(({ content }) => !content.includes(0))
  .map(({ name, content }) => ({ name, text: content.toString("utf8") }));

test("required app and repository files exist and have content", () => {
  const requiredFiles = [
    "README.md",
    "index.html",
    "styles.css",
    "app.js",
    "auth.js",
    "todo.js",
    join(".github", "CODEOWNERS"),
    join(".github", "workflows", "blank.yml"),
  ];
  for (const name of requiredFiles) {
    assert.ok(readFileSync(join(root, name), "utf8").trim(), `${name} is empty`);
  }
});

test("tracked text files contain no unresolved merge-conflict markers", () => {
  for (const { name, text } of textFiles) {
    assert.equal(conflictMarker.test(text), false, `Conflict marker in ${name}`);
  }
});

test("tracked text files contain no trailing spaces or tabs", () => {
  for (const { name, text } of textFiles) {
    assert.equal(trailingWhitespace.test(text), false, `Trailing whitespace in ${name}`);
  }
});

test("conflict detection handles LF and CRLF without flagging ordinary text", () => {
  for (const newline of ["\n", "\r\n"]) {
    for (const marker of ["<<<<<<< HEAD", "<<<<<<<", "=======", ">>>>>>> topic", ">>>>>>>"]) {
      assert.equal(conflictMarker.test(`before${newline}${marker}${newline}after`), true);
    }
    assert.equal(conflictMarker.test(`ordinary text${newline}== heading ==${newline}`), false);
  }
});

test("whitespace detection handles LF and CRLF without rejecting indentation", () => {
  for (const newline of ["\n", "\r\n"]) {
    assert.equal(trailingWhitespace.test(`bad ${newline}`), true);
    assert.equal(trailingWhitespace.test(`bad\t${newline}`), true);
    assert.equal(trailingWhitespace.test(`  indented${newline}`), false);
  }
});
