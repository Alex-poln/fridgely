import test from "node:test";
import assert from "node:assert/strict";
import { tutorialSeen, introductions } from "../src/core/tour-content.js";
test("New account receives introduction and each page independently", () => {
  const user = { user_metadata: {} };
  for (const page of Object.keys(introductions)) assert.equal(tutorialSeen(user, page), false);
  user.user_metadata.nussi_seen_fridge = true;
  assert.equal(tutorialSeen(user, "fridge"), true);
  assert.equal(tutorialSeen(user, "kitchen"), false);
});
test("Account flag survives a new device without local history", () => {
  assert.equal(tutorialSeen({ user_metadata: { nussi_seen_goals: true } }, "goals", false), true);
  assert.equal(tutorialSeen({ user_metadata: {} }, "products", true), true);
});
test("Welcome is concise and reserved for the initial tour", () => {
  assert.equal(introductions.fridge[0][0], null);
  for (const page of ["kitchen", "products", "goals", "settings"]) {
    assert.ok(introductions[page].every(([target]) => target));
  }
});
