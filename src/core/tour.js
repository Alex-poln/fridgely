import { nussi } from "./nussi.js";
import { visibleTarget, panelPlacement } from "./tour-layout.js";
const navigationSteps = [
  ["fridge", "Dein Kühlschrank", "Hier siehst du deine Lebensmittel, Mengen und Haltbarkeit. Mit einem Bonfoto füllen wir deinen Vorrat gemeinsam auf."],
  ["kitchen", "Kochen mit Nussi", "Ich schlage dir Rezepte aus deinem Vorrat vor. Oder du sagst mir, was du gerne kochen möchtest."],
  ["products", "Deine Produkte", "Lege Produkte an, die du immer wieder verwendest. Hier kannst du auch ihre Nährwerte ergänzen."],
  ["goals", "Deine Ziele", "Sag mir, wie du dich ernähren möchtest und was ich bei meinen Vorschlägen beachten soll."],
  ["settings", "Alles für dich eingestellt", "Hier verwaltest du dein Konto. Und wenn du mich noch einmal als Wegweiser brauchst, startest du diese Einführung hier neu."],
];
let active = null;
const seen = new Set();
const key = userId => `fridgely:nussi-tour:v2:${userId}`;
export function stopTour() { active?.close(); }
export function startTour(userId, force = false) {
  if (!userId || active) return;
  let done = seen.has(userId);
  try { done ||= localStorage.getItem(key(userId)) === "done"; } catch {}
  if (done && !force) return;
  const overlay = document.createElement("dialog");
  overlay.className = "nussi-tour"; overlay.setAttribute("aria-labelledby", "tour-title");
  overlay.innerHTML = `<div class="tour-highlight" aria-hidden="true"></div><section class="tour-panel"><span class="eyebrow" id="tour-count"></span><h2 id="tour-title"></h2><div id="tour-mascot" aria-live="polite"></div><div class="tour-actions"><button class="text-link" id="tour-skip">Überspringen</button><button class="btn secondary" id="tour-back">Zurück</button><button class="btn" id="tour-next">Weiter</button></div></section>`;
  document.body.append(overlay); active = overlay;
  const steps = [
    ["#empty-scan, #scan-receipt", "Kassenbon scannen", "Fotografiere deinen Bon. Prüfe die erkannten Lebensmittel und übernimm sie in deinen Vorrat."],
    ["#empty-add, #add", "Einzeln hinzufügen", "Hier trägst du Lebensmittel mit Menge und Datum selbst ein."],
    ...navigationSteps.map(([page, title, text]) => ['#navigation [data-page="' + page + '"]', title, text])
  ].filter(([selector]) => visibleTarget(document, selector));
  const soon = document.querySelector('[data-filter="soon"]');
  if (soon && soon.getClientRects().length) steps.splice(2, 0, ['[data-filter="soon"]', "Bald fällig", "Hier findest du Lebensmittel, deren Datum heute oder in den nächsten drei Tagen erreicht ist. Tippe den Filter an, um sie zu sehen."]);
  if (!steps.length) { overlay.remove(); active = null; return; }
  let index = 0;
  function finish() { seen.add(userId); try { localStorage.setItem(key(userId), "done"); } catch {} overlay.close(); }
  function position() {
    const target = visibleTarget(document, steps[index][0]);
    if (!target) { overlay.close(); return; }
    const bounds = target.getBoundingClientRect(), highlight = overlay.querySelector(".tour-highlight"), panel = overlay.querySelector(".tour-panel");
    // Copy the real control, preserving its layout; never measure hidden alternatives.
    const copy = target.cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
    copy.setAttribute("tabindex", "-1");
    copy.style.cssText = "margin:0;width:100%;height:100%;box-sizing:border-box;pointer-events:none";
    highlight.replaceChildren(copy);
    Object.assign(highlight.style, { left: bounds.left + "px", top: bounds.top + "px", width: bounds.width + "px", height: bounds.height + "px", padding: "0", display: "block", boxSizing: "border-box" });
    const vv = window.visualViewport;
    const viewport = { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0, width: vv?.width || innerWidth, height: vv?.height || innerHeight };
    panel.style.boxSizing = "border-box";
    panel.style.width = Math.min(390, viewport.width - 28) + "px";
    panel.style.maxHeight = viewport.height - 28 + "px";
    const layout = panelPlacement(bounds, { height: panel.scrollHeight }, viewport);
    for (const [property, value] of Object.entries(layout)) panel.style[property] = value + "px";

  }
  function render() {
    overlay.querySelector("#tour-count").textContent = `DEINE KÜCHE ENTDECKEN · ${index + 1} / ${steps.length}`;
    overlay.querySelector("#tour-title").textContent = steps[index][1];
    overlay.querySelector("#tour-mascot").innerHTML = nussi(steps[index][2]);
    overlay.querySelector("#tour-back").disabled = index === 0;
    overlay.querySelector("#tour-next").textContent = index === steps.length - 1 ? "Los geht’s" : "Weiter";
    const target = visibleTarget(document, steps[index][0]);
    target?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
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

