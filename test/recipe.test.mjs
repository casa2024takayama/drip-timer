import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  scaleRecipe, validateRecipe, encodeRecipe, decodeRecipe, formatTime, formatRatio, parseShareHash, shareUrl, normalizeRecipe,
} from "../js/recipe.js";

const builtin = JSON.parse(readFileSync(new URL("../recipes/builtin.json", import.meta.url)));

test("builtin recipes are valid", () => {
  for (const r of builtin.recipes) assert.deepEqual(validateRecipe(r), [], r.name);
});

test("scaleRecipe scales water and steps proportionally", () => {
  const r46 = builtin.recipes.find((r) => r.id === "builtin-46");
  const s = scaleRecipe(r46, 15);
  assert.equal(s.coffee_g, 15);
  assert.equal(s.water_g, 225);
  assert.deepEqual(s.steps.map((x) => x.target_g), [45, 90, 135, 180, 225]);
  assert.deepEqual(s.steps.map((x) => x.at_s), r46.steps.map((x) => x.at_s));
  assert.deepEqual(validateRecipe(s), []);
});

test("validateRecipe catches ordering errors", () => {
  const bad = { name: "x", coffee_g: 10, water_g: 100, steps: [
    { at_s: 0, target_g: 50 }, { at_s: 0, target_g: 40 },
  ] };
  const errs = validateRecipe(bad);
  assert.ok(errs.some((e) => e.includes("開始秒")));
  assert.ok(errs.some((e) => e.includes("累計 g")));
});

test("encode/decode round trip (compressed and plain)", async () => {
  const r = builtin.recipes[0];
  const enc = await encodeRecipe(r);
  assert.equal(enc[0], "z");
  const dec = await decodeRecipe(enc);
  assert.equal(dec.name, r.name);
  assert.deepEqual(dec.steps, r.steps);
  assert.notEqual(dec.id, r.id);
  // plain fallback
  const plain = "j" + Buffer.from(JSON.stringify({ ...r, id: undefined })).toString("base64url");
  const dec2 = await decodeRecipe(plain);
  assert.equal(dec2.water_g, r.water_g);
});

test("decodeRecipe rejects invalid payload", async () => {
  const bad = "j" + Buffer.from(JSON.stringify({ name: "", steps: [] })).toString("base64url");
  await assert.rejects(decodeRecipe(bad));
  await assert.rejects(decodeRecipe("q123"));
});

test("helpers", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(125.9), "2:05");
  assert.equal(formatRatio({ coffee_g: 20, water_g: 300 }), "1:15");
  assert.equal(formatRatio({ coffee_g: 15, water_g: 250 }), "1:16.7");
  assert.equal(parseShareHash("#r=zAbC_-1"), "zAbC_-1");
  assert.equal(parseShareHash("#foo"), null);
  assert.equal(shareUrl("https://x.test/app/", "zAAA"), "https://x.test/app/#r=zAAA");
  const n = normalizeRecipe({ name: "a".repeat(100), coffee_g: "20", steps: [{ at_s: "0", target_g: "60" }], extra: 1 });
  assert.equal(n.name.length, 60);
  assert.equal(n.coffee_g, 20);
  assert.equal("extra" in n, false);
});
