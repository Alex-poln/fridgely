import { configured, db, user } from "../../core/supabase.js";
import { esc, icon, busy, toast } from "../../core/ui.js";
export async function mount(root) {
  const u = await user();
  root.querySelector("#status").innerHTML =
    `<p>${icon(configured ? "link" : "link_off")} ${configured ? "Supabase-Zugangsdaten eingetragen" : "Supabase noch nicht eingerichtet"}</p><p class="help">${configured ? "Der tatsächliche Zugriff wird beim Laden und Speichern geprüft." : "Trage URL und öffentlichen Key in config.js ein. Die Einrichtung ist in README.md beschrieben."}</p>`;
  root.querySelector("#account").innerHTML = u
    ? `<p class="account-details">${esc(u.email)}</p>`
    : '<a class="btn secondary" href="#auth">Zum Login</a>';
  if (u) {
    const { data, error } = await (
      await db()
    )
      .from("user_roles")
      .select("role")
      .eq("user_id", u.id)
      .single();
    if (!error)
      root.querySelector("#account").innerHTML +=
        `<p class="help">Rolle: ${esc(data.role)}</p>`;
    const f = root.querySelector("form");
    f.hidden = false;
    f.onsubmit = (e) => {
      e.preventDefault();
      busy(f.querySelector("button"), async () => {
        const { error } = await (
          await db()
        ).auth.updateUser({ password: f.password.value });
        if (error) throw error;
        f.reset();
        toast("Passwort geändert.");
      });
    };
  }
}
