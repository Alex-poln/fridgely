import { nussi } from "./nussi.js";
import { visibleTarget, panelPlacement } from "./tour-layout.js";
import { db } from "./supabase.js";
import { toast } from "./ui.js";
import { introductions, tutorialSeen } from "./tour-content.js";
let active = null;
const seen = new Set();
const key = (userId, page) => `fridgely:nussi-seen:${userId}:${page}`;
export function stopTour() { active?.close(); }
export function startTour(user, force = false, page = document.body.dataset.page) {
  const userId = user?.id;
  if (!userId || active) return;
  if (!introductions[page]) return;
  let localDone = seen.has(key(userId, page));
  try {
    localDone ||= localStorage.getItem(key(userId, page)) === "done";
    if (page === "fridge") localDone ||= ["v1", "v2"].some(version => localStorage.getItem(`fridgely:nussi-tour:${version}:${userId}`) === "done");
  } catch {}
  if (!force && tutorialSeen(user, page, localDone)) return;
  const overlay = document.createElement("dialog");
  overlay.className = "nussi-tour"; overlay.setAttribute("aria-labelledby", "tour-title");
  overlay.innerHTML = `<div class="tour-highlight" aria-hidden="true"></div><section class="tour-panel"><span class="eyebrow" id="tour-count"></span><h2 id="tour-title"></h2><div id="tour-mascot" aria-live="polite"></div><div class="tour-actions"><button class="text-link" id="tour-skip">Überspringen</button><button class="btn secondary" id="tour-back">Zurück</button><button class="btn" id="tour-next">Weiter</button></div></section>`;
  document.body.append(overlay); active = overlay;
  const steps = introductions[page].filter(([selector]) => !selector || visibleTarget(document, selector));
  if (!steps.length) { overlay.remove(); active = null; return; }
  let index = 0;
  // Record first presentation, including skipping, without resetting other page flags.
  seen.add(key(userId, page));
  try { localStorage.setItem(key(userId, page), "done"); } catch {}
  user.user_metadata = { ...user.user_metadata, ["nussi_seen_" + page]: true };
  db().then(client => client.auth.updateUser({ data: { ["nussi_seen_" + page]: true } }))
    .then(({ error }) => { if (error) throw error; })
    .catch(() => toast("Einführung auf diesem Gerät gemerkt. Kontosynchronisierung fehlgeschlagen."));
  function finish() { overlay.close(); }
  function position() {
    const selector = steps[index][0];
    const target = selector ? visibleTarget(document, selector) : null;
    const highlight = overlay.querySelector(".tour-highlight"), panel = overlay.querySelector(".tour-panel");
    const bounds = target?.getBoundingClientRect();
    highlight.hidden = !target;
    if (target) {
    // Copy the real control, preserving its layout; never measure hidden alternatives.
    const copy = target.cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    copy.setAttribute("tabindex", "-1");
    // Navigation styles depend on ancestors (nav/sidebar). Freeze resolved styles
    // for the entire visual copy so moving it into the dialog changes no layout.
    const originals = [target, ...target.querySelectorAll("*")];
    const copies = [copy, ...copy.querySelectorAll("*")];
    originals.forEach((original, i) => {
      const style = getComputedStyle(original);
      for (const property of style) copies[i].style.setProperty(property, style.getPropertyValue(property));
      copies[i].style.setProperty("animation", "none", "important");
      copies[i].style.setProperty("transition", "none", "important");
    });
    Object.assign(copy.style, { margin: "0", width: "100%", height: "100%", position: "static", transform: "none", boxSizing: "border-box", pointerEvents: "none" });
    highlight.replaceChildren(copy);
    Object.assign(highlight.style, { left: bounds.left + "px", top: bounds.top + "px", width: bounds.width + "px", height: bounds.height + "px", padding: "0", display: "block", boxSizing: "border-box" });
    }
    const vv = window.visualViewport;
    const viewport = { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0, width: vv?.width || innerWidth, height: vv?.height || innerHeight };
    panel.style.boxSizing = "border-box";
    panel.style.width = Math.min(390, viewport.width - 28) + "px";
    panel.style.maxHeight = viewport.height - 28 + "px";
    const layout = bounds ? panelPlacement(bounds, { height: panel.scrollHeight }, viewport) : {
      left: viewport.left + (viewport.width - Math.min(390, viewport.width - 28)) / 2,
      top: viewport.top + Math.max(14, (viewport.height - Math.min(panel.scrollHeight, viewport.height - 28)) / 2),
      width: Math.min(390, viewport.width - 28), maxHeight: viewport.height - 28
    };
    for (const [property, value] of Object.entries(layout)) panel.style[property] = value + "px";

  }
  function render() {
    overlay.querySelector("#tour-count").textContent = `DEINE KÜCHE ENTDECKEN · ${index + 1} / ${steps.length}`;
    overlay.querySelector("#tour-title").textContent = steps[index][1];
    overlay.querySelector("#tour-mascot").innerHTML = nussi(steps[index][2]);
    overlay.querySelector("#tour-back").disabled = index === 0;
    overlay.querySelector("#tour-next").textContent = index === steps.length - 1 ? "Los geht’s" : "Weiter";
    const target = steps[index][0] ? visibleTarget(document, steps[index][0]) : null;
    if (target && !target.closest("#navigation")) target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    position();
  }
  overlay.querySelector("#tour-next").onclick = () => { if (index === steps.length - 1) finish(); else { index++; render(); } };
  overlay.querySelector("#tour-back").onclick = () => { if (index > 0) { index--; render(); } };
  overlay.querySelector("#tour-skip").onclick = finish;
  overlay.addEventListener("cancel", event => { event.preventDefault(); finish(); });
  overlay.addEventListener("close", () => { window.visualViewport?.removeEventListener("resize", position); window.visualViewport?.removeEventListener("scroll", position); window.removeEventListener("resize", position); window.removeEventListener("scroll", position, true); overlay.remove(); active = null; }, { once: true });
  window.visualViewport?.addEventListener("resize", position); window.visualViewport?.addEventListener("scroll", position);
  window.addEventListener("resize", position); window.addEventListener("scroll", position, true);
  overlay.showModal(); render(); overlay.querySelector("#tour-next").focus({ preventScroll: true });
}

