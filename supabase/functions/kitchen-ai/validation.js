// Reine Validierung: wird auch mit Node getestet. Keine KI-Ausgabe ungeprüft speichern.
export function validateNutrition(raw) {
  const result = {};
  for (const key of ["kcal", "protein", "carbs", "fat"]) {
    const n = raw?.[key];
    if (
      typeof n !== "number" ||
      !Number.isFinite(n) ||
      n < 0 ||
      n > (key === "kcal" ? 10000 : 1000)
    )
      throw Error("Die KI hat ungültige Nährwerte geliefert.");
    result[key] = n;
  }
  return result;
}
export function validateRecipes(raw, products, servings) {
  if (
    !Array.isArray(raw?.recipes) ||
    raw.recipes.length < 1 ||
    raw.recipes.length > 3
  )
    throw Error("Die KI hat keine gültigen Rezepte geliefert.");
  const text = (v, max) => {
    if (typeof v !== "string" || !v.trim() || v.length > max)
      throw Error("Ungültiger Rezepttext.");
    return v.trim();
  };
  return raw.recipes.map((r) => {
    if (!Number.isInteger(r.minutes) || r.minutes < 1 || r.minutes > 720)
      throw Error("Ungültige Kochzeit.");
    if (
      !Array.isArray(r.ingredients) ||
      r.ingredients.length < 1 ||
      r.ingredients.length > 30 ||
      !Array.isArray(r.steps) ||
      r.steps.length < 1 ||
      r.steps.length > 30
    )
      throw Error("Unvollständiges Rezept.");
    const seen = new Set();
    return {
      title: text(r.title, 150),
      description: text(r.description, 1000),
      servings,
      minutes: r.minutes,
      note: typeof r.note === "string" ? r.note.slice(0, 1000) : "",
      steps: r.steps.map((s) => text(s, 2000)),
      ingredients: r.ingredients.map((i) => {
        if (
          !["g", "ml", "Stück"].includes(i.unit) ||
          typeof i.quantity !== "number" ||
          !Number.isFinite(i.quantity) ||
          i.quantity <= 0 ||
          i.quantity > 10000000
        )
          throw Error("Ungültige Zutatenmenge.");
        const name = text(i.name, 100);
        let product = null;
        if (i.product_id) {
          product = products.find((p) => p.id === i.product_id);
          if (!product || product.unit !== i.unit)
            throw Error(
              "Rezept verweist auf ein unbekanntes Produkt oder eine falsche Einheit.",
            );
        } else
          product =
            products.find(
              (p) =>
                p.name.toLocaleLowerCase("de") ===
                  name.toLocaleLowerCase("de") && p.unit === i.unit,
            ) || null;
        const key =
          (product?.id || name.toLocaleLowerCase("de")) + "|" + i.unit;
        if (seen.has(key))
          throw Error(
            "Die KI hat eine Zutat doppelt angegeben. Bitte erneut versuchen.",
          );
        seen.add(key);
        return {
          name: product?.name || name,
          product_id: product?.id || null,
          unit: i.unit,
          quantity: i.quantity,
          ...(i.nutrition == null ? {} : {nutrition: validateNutrition(i.nutrition)}),
        };
      }),
    };
  });
}

