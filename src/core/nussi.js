import { nussiArt } from "./nussi-art.js";
import { esc } from "./ui.js";
let counter = 0;
export function nussi(text, state = "idle") {
  const prefix = `nussi-${++counter}-`;
  const art = nussiArt.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
  return `<div class="nussi nussi-${state}"><div class="nussi-character">${art}</div><div class="nussi-bubble"><strong>Nussi</strong><span class="nussi-words">${esc(text)}</span>${state === "thinking" ? '<span class="nussi-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}</div></div>`;
}
export function thinking(host, task) {
  host.hidden = false;
  host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite");
  host.innerHTML = nussi(task, "thinking");
  const timer = setTimeout(() => {
    const words = host.querySelector(".nussi-words");
    if (words) words.textContent = "Ich bin noch dran. Das kann einen kleinen Moment dauern.";
  }, 16000);
  return () => { clearTimeout(timer); host.hidden = true; host.replaceChildren(); };
}
export function bindNussiPassword(container, password, toggle) {
  const mascot = container.querySelector(".nussi");
  const words = mascot.querySelector(".nussi-words");
  const greeting = words.textContent;
  function update() {
    const cover = document.activeElement === password || password.type === "text";
    mascot.classList.toggle("nussi-covering", cover);
    words.textContent = cover ? "Ich schaue nicht hin." : greeting;
  }
  password.addEventListener("focus", update); password.addEventListener("blur", update);
  toggle.onclick = () => {
    const reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Verbergen" : "Anzeigen";
    toggle.setAttribute("aria-pressed", String(reveal)); update();
  };
  container.addEventListener("pointermove", event => {
    if (mascot.classList.contains("nussi-covering") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = mascot.getBoundingClientRect();
    const x = Math.max(-5, Math.min(5, (event.clientX - bounds.x - bounds.width / 2) / 35));
    const y = Math.max(-3, Math.min(3, (event.clientY - bounds.y - bounds.height / 2) / 45));
    mascot.querySelector('[data-part="pupils"]').style.transform = `translate(${x}px,${y}px)`;
  });
}
