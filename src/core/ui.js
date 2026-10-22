// Geteilte Anzeige-Helfer. Nutzer- und KI-Texte immer escapen.
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name) =>
  `<span class="material-symbols-rounded" aria-hidden="true">${esc(name)}</span>`;
export const empty = (symbol, title, copy) =>
  `<div class="empty-state">${icon(symbol)}<h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
export const fmt = (n) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(
    Number(n),
  );
let timer;
export function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (el.hidden = true), 5500);
}
export async function busy(button, action) {
  if (button.disabled) return;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await action();
  } catch (e) {
    toast(e.message || "Das hat nicht geklappt. Bitte erneut versuchen.");
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
export function dialog(html, onReady) {
  const el = document.querySelector("#modal");
  document.querySelector("#modal-body").innerHTML =
    `<button class="icon-button close-modal" aria-label="Schließen">${icon("close")}</button>${html}`;
  el.querySelector(".close-modal").onclick = () => el.close();
  el.showModal();
  onReady?.(el);
}
export function closeDialog() {
  document.querySelector("#modal").close();
}
export async function template(feature) {
  const r = await fetch(
    new URL(`../features/${feature}/${feature}.html`, import.meta.url),
  );
  if (!r.ok) throw Error("Die Seite konnte nicht geladen werden.");
  return r.text();
}
export function setupNotice(configured) {
  return configured
    ? ""
    : '<div class="notice">Deine Küche ist startklar gestaltet. Verbinde Supabase in <code>config.js</code>, um echte Daten zu speichern. Bis dahin bleibt alles leer.</div>';
}
