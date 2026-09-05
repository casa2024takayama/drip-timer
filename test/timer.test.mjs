import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { locate } from "../js/timer.js";

const r46 = JSON.parse(readFileSync(new URL("../recipes/builtin.json", import.meta.url))).recipes.find((r) => r.id === "builtin-46");

test("locate before start", () => {
  const l = locate(r46, -0.1);
  assert.equal(l.index, -1); assert.equal(l.targetG, 0); assert.equal(l.next.at_s, 0);
});
test("locate during steps", () => {
  let l = locate(r46, 0);
  assert.equal(l.index, 0); assert.equal(l.targetG, 60); assert.equal(l.next.target_g, 120); assert.equal(l.remainToNext, 45);
  l = locate(r46, 44.9);
  assert.equal(l.index, 0); assert.ok(l.remainToNext > 0 && l.remainToNext < 0.2);
  l = locate(r46, 45);
  assert.equal(l.index, 1); assert.equal(l.targetG, 120);
  l = locate(r46, 170);
  assert.equal(l.index, 4); assert.equal(l.targetG, 300); assert.equal(l.next, null); assert.equal(l.remainToNext, 40); assert.equal(l.done, false);
});
test("locate done after finish_s", () => {
  const l = locate(r46, 210);
  assert.equal(l.done, true); assert.equal(l.targetG, 300);
});
test("locate without finish_s never reports done", () => {
  const r = { ...r46, finish_s: null };
  const l = locate(r, 999);
  assert.equal(l.done, false); assert.equal(l.remainToNext, null);
});
