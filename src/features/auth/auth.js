import { configured, db } from "../../core/supabase.js";
import { esc, busy, setupNotice } from "../../core/ui.js";
import { nussi, bindNussiPassword } from "../../core/nussi.js";
export async function mount(root, currentUser) {
  const box = root.querySelector("#auth-content");
  if (currentUser) {
    box.innerHTML = `<section class="card auth-card account-details">${nussi("Schön, dass du da bist. Dein Vorrat wartet auf dich!")}<h1>Dein Konto</h1><p>${esc(currentUser.email)}</p><div class="actions"><a class="btn" href="#fridge">Zum Kühlschrank</a><button class="btn secondary" id="logout">Abmelden</button></div></section>`;
    box.querySelector("#logout").onclick = e => busy(e.currentTarget, async () => {
      const { error } = await (await db()).auth.signOut();
      if (error) throw error;
      window.dispatchEvent(new Event("auth-changed"));
    });
    return;
  }
  box.innerHTML = `<div class="login-layout"><section class="login-intro"><a class="login-brand" href="#auth" aria-label="Fridgely"><img src="./src/assets/brand/fridgely-logo.svg" alt="Fridgely" width="240" height="53"></a><h1>Mehr Frische.<br>Weniger<br class="login-desktop-break"> verschwenden.</h1><div class="login-benefits"><span>Vorrat im Blick</span><span>Mit Nussi kochen</span></div></section>
    <section class="nussi-login-card">${nussi("Hallo! Melde dich an und lass uns deine Küche entdecken.")}<div class="login-card-content">${setupNotice(configured)}
    <div class="tabs" aria-label="Konto-Zugang"><button type="button" class="chip active" aria-pressed="true" data-mode="login">Anmelden</button><button type="button" class="chip" aria-pressed="false" data-mode="signup">Registrieren</button></div>
    <h2 id="login-title">Willkommen zurück</h2><p class="help" id="login-copy"></p>
    <form class="stack"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="email" placeholder="du@beispiel.de" required maxlength="254"></label>
    <label>Passwort<span class="login-password"><input name="password" type="password" autocomplete="current-password" required maxlength="128"><button id="show-password" type="button" aria-pressed="false">Anzeigen</button></span></label>
    <p class="login-feedback" role="status" aria-live="polite" hidden></p><button class="btn" type="submit">Anmelden</button></form>
    <button class="text-link" id="reset" type="button">Passwort vergessen?</button></div></section></div>`;
  let mode = "login", working = false;
  const form = box.querySelector("form"), feedback = box.querySelector(".login-feedback");
  const submit = form.querySelector('[type="submit"]');
  bindNussiPassword(box, form.password, box.querySelector("#show-password"));
  function message(text) { feedback.textContent = text; feedback.hidden = !text; }
  function lock(value) {
    working = value;
    box.querySelectorAll("button,input").forEach(control => control.disabled = value);
    submit.textContent = value ? "Einen Moment …" : mode === "login" ? "Anmelden" : "Konto erstellen";
    form.setAttribute("aria-busy", String(value));
  }
  box.querySelectorAll("[data-mode]").forEach(button => button.onclick = () => {
    mode = button.dataset.mode; message("");
    box.querySelectorAll("[data-mode]").forEach(tab => { tab.classList.toggle("active", tab === button); tab.setAttribute("aria-pressed", String(tab === button)); });
    form.password.autocomplete = mode === "login" ? "current-password" : "new-password";
    form.password.minLength = mode === "signup" ? 8 : 1;
    box.querySelector("#login-title").textContent = mode === "signup" ? "Deine Küche beginnt hier" : "Willkommen zurück";
    box.querySelector("#login-copy").textContent = mode === "signup" ? "Wähle ein Passwort mit mindestens 8 Zeichen." : "";
    box.querySelector("#reset").hidden = mode === "signup";
    lock(false);
  });
  form.onsubmit = async event => {
    event.preventDefault(); if (working) return;
    const credentials = { email: form.email.value.trim(), password: form.password.value };
    lock(true); message(mode === "signup" ? "Dein Konto wird erstellt …" : "Du wirst angemeldet …");
    try {
      const auth = (await db()).auth;
      const { data, error } = mode === "login" ? await auth.signInWithPassword(credentials)
        : await auth.signUp({ ...credentials, options: { emailRedirectTo: location.href.split("#")[0] + "#fridge" } });
      if (error) throw error;
      if (data.session) {
        location.hash = "fridge"; window.dispatchEvent(new Event("auth-changed"));
      } else { form.password.value = ""; message("Fast geschafft! Bitte bestätige deine E-Mail und melde dich danach an."); }
    } catch (error) { message(error.message); }
    finally { lock(false); }
  };
  box.querySelector("#reset").onclick = async () => {
    if (working || !form.email.reportValidity()) return;
    const email = form.email.value.trim(); lock(true); message("Ich fordere deinen Link an …");
    try {
      const { error } = await (await db()).auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] + "#settings" });
      if (error) throw error;
      message("Falls ein Konto existiert, erhältst du eine E-Mail zum Zurücksetzen.");
    } catch (error) { message(error.message); }
    finally { lock(false); }
  };
}

