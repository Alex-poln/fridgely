import { icon, template } from "./core/ui.js";
import { configured, db, user } from "./core/supabase.js";
import { nussi } from "./core/nussi.js";
import { startTour, stopTour } from "./core/tour.js";
const pages = [["fridge", "kitchen", "Kühlschrank"], ["kitchen", "auto_awesome", "KI-Küche"], ["products", "inventory_2", "Produkte"], ["goals", "target", "Meine Ziele"], ["settings", "tune", "Einstellungen"]];
const nav = document.querySelector("#navigation"), main = document.querySelector("#main");
nav.innerHTML = pages.map(([id, symbol, label]) => `<a href="#${id}" data-page="${id}">${icon(symbol)}<span>${label}</span></a>`).join("");
document.querySelector("#nussi-guide").innerHTML = nussi("Ein kleiner Vorrat. Viele gute Ideen.");
let sequence = 0, cleanup, currentUser = null, scheduled;
function conceal() {
  document.body.dataset.auth = "checking";
  main.innerHTML = '<p class="session-loading" role="status">Deine Küche wird geöffnet …</p>';
  document.querySelector("#modal")?.close(); stopTour();
}
async function route() {
  const seq = ++sequence;
  cleanup?.(); cleanup = null; stopTour();
  main.setAttribute("aria-busy", "true");
  // Never leave private content visible while revalidating the account.
  main.replaceChildren();
  try {
    const u = await user();
    if (seq !== sequence) return;
    currentUser = u;
    document.body.dataset.auth = u ? "signed-in" : "signed-out";
    document.querySelector("#account-label").textContent = u ? "Mein Konto" : "Anmelden";
    const requested = location.hash.slice(1).split("?")[0] || "fridge";
    const page = !u ? "auth" : [...pages.map(p => p[0]), "auth"].includes(requested) ? requested : "fridge";
    document.body.dataset.page = page;
    nav.querySelectorAll("a").forEach(a => { a.classList.toggle("active", a.dataset.page === page); if (a.dataset.page === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const [html, module] = await Promise.all([template(page), import(`./features/${page}/${page}.js`)]);
    if (seq !== sequence) return;
    const view = document.createElement("div"); view.innerHTML = html; main.replaceChildren(view);
    const dispose = await module.mount(view, u);
    if (seq !== sequence) { if (typeof dispose === "function") dispose(); return; }
    cleanup = typeof dispose === "function" ? dispose : null;
    main.removeAttribute("aria-busy");
    document.title = `${!u ? "Willkommen bei Nussi" : pages.find(p => p[0] === page)?.[2] || "Dein Konto"} · Fridgely`;
    if (u && page === "fridge") startTour(u.id);
  } catch (error) {
    if (seq !== sequence) return;
    currentUser = null; document.body.dataset.auth = "signed-out";
    main.innerHTML = '<section class="card auth-card"><h1>Kurze Küchenpause</h1><p>Deine Anmeldung konnte gerade nicht geprüft werden.</p><p id="session-error" role="status"></p><button class="btn" id="retry-session">Erneut versuchen</button></section>';
    main.querySelector("#session-error").textContent = error.message;
    main.querySelector("#retry-session").onclick = route;
    main.removeAttribute("aria-busy");
  }
}
function scheduleRoute() { clearTimeout(scheduled); scheduled = setTimeout(route, 0); }
window.addEventListener("hashchange", scheduleRoute);
window.addEventListener("auth-changed", () => { conceal(); scheduleRoute(); });
window.addEventListener("nussi-tour", () => startTour(currentUser?.id, true));
document.querySelector("#nussi-guide").onclick = () => startTour(currentUser?.id, true);
conceal(); route();
if (configured) db().then(client => client.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { ++sequence; currentUser = null; conceal(); scheduleRoute(); }
  else if (event === "SIGNED_IN" && !currentUser) scheduleRoute();
  else if (event === "PASSWORD_RECOVERY") { location.hash = "settings"; scheduleRoute(); }
})).catch(() => { /* route displays connection errors without exposing private views. */ });
