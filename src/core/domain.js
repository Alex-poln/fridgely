// Reine Geschäftslogik, unabhängig von UI und Supabase; mit node --test prüfbar.
export const units = ["g", "ml", "Stück"];
export function expiry(date, today = new Date()) {
  if (!date) return { label: "Ohne Datum", tone: "neutral", days: null };
  const local = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(date + "T00:00:00");
  const days = Math.round((target - local) / 86400000);
  if (days < 0)
    return {
      label: `Seit ${Math.abs(days)} Tagen abgelaufen`,
      tone: "danger",
      days,
    };
  if (days === 0) return { label: "Heute fällig", tone: "warning", days };
  if (days <= 3)
    return {
      label: `Noch ${days} ${days === 1 ? "Tag" : "Tage"}`,
      tone: "warning",
      days,
    };
  return {
    label: new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "short",
    }).format(target),
    tone: "neutral",
    days,
  };
}
export function positive(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0)
    throw Error("Bitte eine Menge größer als null eingeben.");
  return n;
}
export function missingIngredients(recipe, stock, products = []) {
  const available = new Map();
  for (const lot of stock) {
    if (lot.expires_on && expiry(lot.expires_on).days < 0) continue;
    const key = lot.product_id + "|" + lot.unit;
    available.set(key, (available.get(key) || 0) + Number(lot.quantity));
  }
  return recipe.ingredients.map((i) => {
    const matched =
      i.product_id ||
      products.find(
        (p) =>
          p.name.trim().toLocaleLowerCase("de") ===
            i.name.trim().toLocaleLowerCase("de") && p.unit === i.unit,
      )?.id;
    const key = matched + "|" + i.unit;
    const have = available.get(key) || 0;
    const missing = Math.max(0, Number(i.quantity) - have);
    available.set(key, Math.max(0, have - Number(i.quantity)));
    return { ...i, missing };
  });
}
