import { icon, toast, template } from "./core/ui.js";
import { configured, db, user } from "./core/supabase.js";
const pages = [
  ["fridge", "kitchen", "Kühlschrank"],
  ["kitchen", "auto_awesome", "KI-Küche"],
  ["products", "inventory_2", "Produkte"],
  ["goals", "target", "Meine Ziele"],
  ["settings", "tune", "Einstellungen"],
];
const nav = document.querySelector("#navigation");
nav.innerHTML = pages
  .map(
    ([id, symbol, label]) =>
      `<a href="#${id}" data-page="${id}">${icon(symbol)}<span>${label}</span></a>`,
  )
  .join("");
let sequence = 0;
async function route() {
  const seq = ++sequence;
  const id = location.hash.slice(1).split("?")[0] || "fridge";
  const page = [...pages.map((p) => p[0]), "auth"].includes(id) ? id : "fridge";
  nav.querySelectorAll("a").forEach((a) => {
    a.classList.toggle("active", a.dataset.page === page);
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const main = document.querySelector("#main");
  main.setAttribute("aria-busy", "true");
  try {
    const [html, module] = await Promise.all([
      template(page),
      import(`./features/${page}/${page}.js`),
    ]);
    if (seq !== sequence) return;
    // Jede Navigation erhält einen eigenen Container. Langsame Antworten einer
    // verlassenen Seite können dadurch nicht die neue Ansicht verändern.
    const view = document.createElement("div");
    view.innerHTML = html;
    main.replaceChildren(view);
    await module.mount(view);
    if (seq === sequence) {
      main.removeAttribute("aria-busy");
      document.title = `${pages.find((p) => p[0] === page)?.[2] || "Anmelden"} · Fridgely`;
    }
  } catch (e) {
    if (seq === sequence) {
      main.textContent = "Diese Seite konnte nicht geladen werden.";
      main.removeAttribute("aria-busy");
      toast(e.message);
    }
  }
}
async function account() {
  try {
    const u = await user();
    document.querySelector("#account-label").textContent = u
      ? "Mein Konto"
      : "Anmelden";
  } catch (e) {
    toast("Supabase ist momentan nicht erreichbar: " + e.message);
  }
}
window.addEventListener("hashchange", route);
window.addEventListener("auth-changed", () => {
  account();
  route();
});
route();
account();
if (configured)
  db()
    .then((c) =>
      c.auth.onAuthStateChange(() => {
        setTimeout(account, 0);
      }),
    )
    .catch((e) => toast(e.message));
