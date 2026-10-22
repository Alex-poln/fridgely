// Nur Login, Registrierung, Passwort-Reset und Logout.
import { configured, db, user } from "../../core/supabase.js";
import { esc, icon, toast, busy, setupNotice } from "../../core/ui.js";
export async function mount(root) {
  const box = root.querySelector("#auth-content");
  const u = await user();
  if (u) {
    box.innerHTML = `<section class="card auth-card account-details"><h2>Dein Konto</h2><p>${esc(u.email)}</p><p>Dein Vorrat ist persönlich und nur für dich sichtbar.</p><button class="btn" id="logout">${icon("logout")} Abmelden</button></section>`;
    box.querySelector("#logout").onclick = (e) =>
      busy(e.currentTarget, async () => {
        const { error } = await (await db()).auth.signOut();
        if (error) throw error;
        window.dispatchEvent(new Event("auth-changed"));
      });
    return;
  }
  box.innerHTML =
    setupNotice(configured) +
    `<section class="card auth-card"><div class="tabs"><button class="chip active" data-mode="login">Anmelden</button><button class="chip" data-mode="signup">Registrieren</button></div><form><label>E-Mail<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Passwort<input name="password" type="password" autocomplete="current-password" minlength="8" required maxlength="128"></label><button class="btn" type="submit">Anmelden ${icon("arrow_forward")}</button></form><button class="btn secondary small" id="reset" style="margin-top:18px">Passwort vergessen?</button><p class="help">Für ein neues Konto mindestens 8 Zeichen verwenden. Je nach Supabase-Einstellung erhältst du eine Bestätigungs-E-Mail.</p></section>`;
  let mode = "login";
  const form = box.querySelector("form");
  box.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        box
          .querySelectorAll("[data-mode]")
          .forEach((t) => t.classList.toggle("active", t === b));
        form.password.autocomplete =
          mode === "login" ? "current-password" : "new-password";
        form.querySelector("[type=submit]").textContent =
          mode === "login" ? "Anmelden" : "Konto erstellen";
      }),
  );
  form.onsubmit = (e) => {
    e.preventDefault();
    busy(form.querySelector("[type=submit]"), async () => {
      const auth = (await db()).auth;
      const credentials = {
        email: form.email.value.trim(),
        password: form.password.value,
      };
      const { data, error } =
        mode === "login"
          ? await auth.signInWithPassword(credentials)
          : await auth.signUp({
              ...credentials,
              options: {
                emailRedirectTo: location.href.split("#")[0] + "#fridge",
              },
            });
      if (error) throw error;
      if (data.session) {
        location.hash = "fridge";
        window.dispatchEvent(new Event("auth-changed"));
      } else toast("Bitte bestätige deine E-Mail und melde dich danach an.");
    });
  };
  box.querySelector("#reset").onclick = (e) =>
    busy(e.currentTarget, async () => {
      if (!form.email.reportValidity()) return;
      const { error } = await (
        await db()
      ).auth.resetPasswordForEmail(form.email.value.trim(), {
        redirectTo: location.href.split("#")[0] + "#settings",
      });
      if (error) throw error;
      toast(
        "Falls ein Konto existiert, erhältst du einen Link zum Zurücksetzen.",
      );
    });
}
