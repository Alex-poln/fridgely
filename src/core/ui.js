// Geteilte Anzeige-Helfer. Nutzer- und KI-Texte immer escapen.
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Essential dialog icons work immediately, even before external fonts load.
const localIcons = {
  kitchen: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M8 5v1M8 12v4"/>',
  inventory_2: '<path d="M4 7h16v14H4Z"/><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M10 11h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  tune: '<path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11M8 3v6m6 0v6M6 15v6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  expand_more: '<path d="m6 9 6 6 6-6"/>',
  photo_camera: '<path d="M9 4 7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3Z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  auto_awesome: '<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4M18 4h4"/>',
};
export const icon = (name) => localIcons[name]
  ? `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${localIcons[name]}</svg>`
  : `<span class="material-symbols-rounded" aria-hidden="true">${esc(name)}</span>`;
export const empty = (symbol, title, copy) =>
  `<div class="empty-state">${icon(symbol)}<h3>${esc(title)}</h3><p>${esc(copy)}</p></div>`;
export const fmt = (n) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(
    Number(n),
  );
let timer;
export function toast(message) {
  const modal = document.querySelector("#modal[open]");
  if (modal) {
    let notice = modal.querySelector(".dialog-notice");
    if (!notice) { notice=document.createElement("p"); notice.className="notice dialog-notice"; notice.setAttribute("role","alert"); modal.querySelector("#modal-body").prepend(notice); }
    notice.textContent=message; notice.scrollIntoView({block:"nearest"}); return;
  }
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
