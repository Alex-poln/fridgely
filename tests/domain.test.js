import test from "node:test";
import assert from "node:assert/strict";
import { expiry, positive, missingIngredients } from "../src/core/domain.js";
import {
  validateNutrition,
  validateRecipes,
} from "../supabase/functions/kitchen-ai/validation.js";
test("Ablaufgrenzen und fehlendes Datum", () => {
  const today = new Date(2026, 9, 22, 12);
  assert.equal(expiry("2026-10-22", today).days, 0);
  assert.equal(expiry("2026-10-21", today).tone, "danger");
  assert.equal(expiry("2026-10-25", today).tone, "warning");
  assert.equal(expiry("2026-10-26", today).tone, "neutral");
  assert.equal(expiry(null, today).days, null);
});
test("Mengen sind endlich und positiv", () => {
  assert.equal(positive("2.5"), 2.5);
  for (const v of [-1, 0, "x", Infinity]) assert.throws(() => positive(v));
});
test("Chargen werden addiert, Einheiten getrennt und abgelaufene ausgeschlossen", () => {
  const recipe = {
    ingredients: [
      { product_id: "p", name: "Produkt", quantity: 300, unit: "g" },
    ],
  };
  const stock = [
    { product_id: "p", quantity: 100, unit: "g" },
    { product_id: "p", quantity: 50, unit: "g" },
    { product_id: "p", quantity: 1000, unit: "ml" },
    { product_id: "p", quantity: 1000, unit: "g", expires_on: "2000-01-01" },
  ];
  assert.equal(missingIngredients(recipe, stock)[0].missing, 150);
});
test("Später angelegtes fehlendes Produkt wird über Name und Einheit gefunden", () => {
  const r = {
    ingredients: [
      { product_id: null, name: "Nudeln", quantity: 100, unit: "g" },
    ],
  };
  assert.equal(
    missingIngredients(
      r,
      [{ product_id: "p", quantity: 150, unit: "g" }],
      [{ id: "p", name: "nudeln", unit: "g" }],
    )[0].missing,
    0,
  );
});
test("Gleicher Vorrat wird nicht mehrfach versprochen", () => {
  const r = {
    ingredients: [
      { product_id: "p", quantity: 80, unit: "g" },
      { product_id: "p", quantity: 80, unit: "g" },
    ],
  };
  assert.deepEqual(
    missingIngredients(r, [{ product_id: "p", quantity: 100, unit: "g" }]).map(
      (i) => i.missing,
    ),
    [0, 60],
  );
});
test("Ungültige KI-Nährwerte werden abgewiesen", () => {
  assert.throws(() =>
    validateNutrition({ kcal: -1, protein: 2, carbs: 3, fat: 4 }),
  );
  assert.throws(() =>
    validateNutrition({ kcal: 1, protein: "2", carbs: 3, fat: 4 }),
  );
  assert.equal(
    validateNutrition({ kcal: 1, protein: 2, carbs: 3, fat: 4 }).protein,
    2,
  );
});
const recipe = () => ({
  recipes: [
    {
      title: "Testgericht",
      description: "Test",
      minutes: 10,
      steps: ["Kochen"],
      ingredients: [
        { name: "Produkt", product_id: "p", quantity: 5, unit: "g" },
      ],
    },
  ],
});
test("KI darf keine fremden Produkt-IDs oder falschen Einheiten verwenden", () => {
  assert.throws(() => validateRecipes(recipe(), [], 2));
  assert.throws(() =>
    validateRecipes(recipe(), [{ id: "p", name: "Produkt", unit: "ml" }], 2),
  );
  const valid = validateRecipes(
    recipe(),
    [{ id: "p", name: "Produkt", unit: "g" }],
    2,
  );
  assert.equal(valid[0].servings, 2);
});
test("Doppelte Zutaten und negative Mengen werden abgewiesen", () => {
  const r = recipe();
  r.recipes[0].ingredients.push({ ...r.recipes[0].ingredients[0] });
  assert.throws(() =>
    validateRecipes(r, [{ id: "p", unit: "g", name: "Produkt" }], 2),
  );
  const n = recipe();
  n.recipes[0].ingredients[0].quantity = -2;
  assert.throws(() =>
    validateRecipes(n, [{ id: "p", unit: "g", name: "Produkt" }], 2),
  );
});
