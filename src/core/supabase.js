import { config } from "../../config.js";
export const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
let clientPromise;
export async function db() {
  if (!configured)
    throw Error(
      "Bitte zuerst die Supabase-Zugangsdaten in config.js eintragen.",
    );
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2.57.4")
      .then(({ createClient }) =>
        createClient(config.supabaseUrl, config.supabaseAnonKey),
      )
      .catch((error) => {
        clientPromise = undefined;
        throw error;
      });
  }
  return clientPromise;
}
export async function user() {
  if (!configured) return null;
  const { data, error } = await (await db()).auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError") return null;
    throw error;
  }
  return data.user;
}
export async function requireUser() {
  const u = await user();
  if (!u) throw Error("Melde dich an, um deine Küche zu nutzen.");
  return u;
}
export async function result(query) {
  const { data, error } = await query;
  if (error) throw Error(error.message);
  return data;
}
