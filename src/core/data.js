import { thinking } from "./nussi.js";
import { db, result, requireUser, configured, user } from "./supabase.js";
export async function list(table) {
  if (!configured || !(await user())) return [];
  return result(
    (await db())
      .from(table)
      .select("*")
      .order("created_at", { ascending: false }),
  );
}
export async function save(table, values, id) {
  const u = await requireUser();
  const client = await db();
  return result(
    id
      ? client.from(table).update(values).eq("id", id).select().single()
      : client
          .from(table)
          .insert({ ...values, user_id: u.id })
          .select()
          .single(),
  );
}
export async function remove(table, id) {
  await requireUser();
  return result((await db()).from(table).delete().eq("id", id));
}
export async function rpc(name, args) {
  await requireUser();
  try { return await result((await db()).rpc(name, args)); }
  catch(e) { if (["cook_recipe_available","log_dish_consumption"].includes(name) && (e.code==="PGRST202" || /function.*(schema cache|does not exist)/i.test(e.message))) throw Error("Bitte zuerst das Supabase-Update 004_dish_consumption.sql ausführen. Es wurde noch nichts gebucht."); throw e; }
}
export async function ai(mode, payload = {}) {
  await requireUser();
  const stop=thinking(null,mode==="receipt"?"Ich lese deinen Bon …":mode==="nutrition"?"Ich schätze die Nährwerte …":"Ich sammle passende Rezeptideen …");
  try {
  const { data, error } = await (
    await db()
  ).functions.invoke("kitchen-ai", { body: { mode, ...payload } });
  if (error) {
    let message =
      "KI-Anfrage fehlgeschlagen. Prüfe Verbindung, Konfiguration und Kontingent.";
    try {
      const body = await error.context.json();
      message = body.error || message;
    } catch {}
    throw Error(message);
  }
  if (!data) throw Error("Keine KI-Antwort erhalten. Bitte erneut versuchen.");
  if (data.error) throw Error(data.error);
  return data;
  } finally {stop();}
}
export async function uploadImage(file) {
  const u = await requireUser();
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Bitte JPG, PNG oder WebP bis 5 MB auswählen.");
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    file.type
  ];
  const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
  await result((await db()).storage.from("product-images").upload(path, file));
  return path;
}
export async function imageUrl(path) {
  if (!path) return "";
  const data = await result(
    (await db()).storage.from("product-images").createSignedUrl(path, 3600),
  );
  return data.signedUrl;
}

