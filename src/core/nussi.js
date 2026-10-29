import { nussiArt } from "./nussi-art.js";
import { esc } from "./ui.js";
let counter = 0;
export function nussi(text, state = "idle") {
  const prefix = `nussi-${++counter}-`;
  const art = nussiArt.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
  return `<div class="nussi nussi-${state}"><div class="nussi-character">${art}</div><div class="nussi-bubble"><strong>Nussi</strong><span class="nussi-words">${esc(text)}</span>${state === "thinking" ? '<span class="nussi-dots" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}</div></div>`;
}
let thinkingOverlay, thinkingTimer;
const thinkingTasks=new Set();
export function thinking(host,task="Ich denke kurz nach …") {
 if(host) {host.hidden=true;host.replaceChildren();}
 const token=Symbol();thinkingTasks.add(token);
 if(!thinkingOverlay){
  thinkingOverlay=document.createElement("dialog");
  thinkingOverlay.className="ai-thinking-overlay";
  thinkingOverlay.setAttribute("aria-label","Nussi arbeitet");
  thinkingOverlay.innerHTML='<div role="status" aria-live="polite">'+nussi(task,"thinking")+'</div>';
  thinkingOverlay.addEventListener("cancel",e=>e.preventDefault());
  document.body.append(thinkingOverlay);thinkingOverlay.showModal();
  thinkingTimer=setTimeout(()=>{
   const words=thinkingOverlay?.querySelector(".nussi-words");
   if(words)words.textContent="Ich bin noch dran. Das kann einen kleinen Moment dauern.";
  },16000);
 }
 let stopped=false;
 return ()=>{
  if(stopped)return;stopped=true;thinkingTasks.delete(token);
  if(thinkingTasks.size)return;
  clearTimeout(thinkingTimer);thinkingOverlay?.close();thinkingOverlay?.remove();thinkingOverlay=null;
 };
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

