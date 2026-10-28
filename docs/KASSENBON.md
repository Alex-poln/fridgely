# Kassenbon-Erkennung lokal testen

Die Änderungen sind lokal; ein Git-Push oder ein Supabase-Deployment wurde nicht ausgeführt.

1. In der gewünschten Supabase-Testdatenbank zusätzlich `supabase/migrations/002_receipt_import.sql` im SQL Editor ausführen. Die bestehende `001_initial.sql` nicht erneut ausführen.
2. Die Edge Function `kitchen-ai` aktualisieren. Zu ihr gehören jetzt **drei** Dateien im selben Ordner: `index.ts`, `validation.js`, `receipt.js`. Entweder alle drei im Edge-Functions-Editor übernehmen und deployen oder im Projektterminal:

   ```powershell
   npx supabase login
   npx supabase functions deploy kitchen-ai --project-ref DEINE_TEST_PROJEKT_ID
   ```

   `supabase/config.toml` enthält bereits `verify_jwt = false`; die Anmeldung wird innerhalb der Funktion mit `auth.getUser` geprüft.
3. Unter Edge Functions / Secrets müssen `GEMINI_API_KEY`, ein bildfähiges `GEMINI_MODEL` mit JSON-Schema-Unterstützung und `ALLOWED_ORIGINS` gesetzt sein. In `ALLOWED_ORIGINS` die Origin `http://localhost:4173` ergänzen, bestehende Origins beibehalten. Keine geheimen Schlüssel in `config.js` schreiben.
4. Für isolierte Tests `config.js` mit URL und öffentlichem Key des Testprojekts konfigurieren. Ein lokales Frontend mit Produktions-URL liest und schreibt weiterhin echte Produktionsdaten. Ein Deployment in das Produktionsprojekt ändert die dortige Serverfunktion auch für die bestehende Website.
5. `npm run dev` starten und `http://localhost:4173` öffnen. Anmelden, unter Kühlschrank **Kassenbon scannen** wählen. Ein Foto bis 25 MB auswählen oder über **Bon fotografieren** aufnehmen. Nach der Vorschau **Produkte erkennen** wählen. Das Bild wird lokal auf maximal 3600 Pixel Kantenlänge und unter 5 MB verkleinert.
6. Produktnamen, Mengen, Einheiten und Reinlegen-Schalter prüfen. Unbekannte Mengen bleiben leer. Die Karten zeigen zunächst nur Namen und Menge. Antippen öffnet die Bearbeitung. Erst **Produkte hinzufügen** schreibt den Vorrat.

## Verhalten

- Ein Bonaufruf verwendet das bestehende KI-Tageslimit. Rezept- und Nährwertmodi bleiben erhalten.
- Bilder werden an Gemini gesendet, aber von der App nicht in Supabase Storage gespeichert. Die Importmarkierung enthält nur Nutzer-ID, SHA-256 des Bildes und Zeitpunkt.
- Vorhandene Produkte mit gleichem Namen (ohne Beachtung der Großschreibung und äußerer Leerzeichen) und Einheit werden wiederverwendet. Neue Produkte erhalten keine erfundenen Nährwerte. Jede ausgewählte Position wird eine neue Charge ohne Ablaufdatum.
- Ein Import erfolgt vollständig in einer Datenbanktransaktion. Wiederholtes Speichern desselben Bildes wird auch nach einem Netzwerkfehler nicht doppelt gebucht. Ein neu fotografierter oder bearbeiteter Bon hat einen anderen Hash und wird nicht automatisch als Duplikat erkannt.
- Maximal 60 Positionen; bei unlesbarem Bon oder mehr Positionen soll die KI um ein geeignetes Bild bitten. HEIC funktioniert nur, wenn der verwendete Browser das Bild dekodieren kann; andernfalls wird auf direkte Fotoaufnahme oder JPG/PNG verwiesen. PDF wird nicht unterstützt.

## Prüfung

`npm test`, `npm run check` und `node --check supabase/functions/kitchen-ai/index.ts` prüfen die lokalen JavaScript-Tests und Syntax. `tests/database.integration.mjs` prüft zusätzlich die SQL-Migrationen in einer isolierten PGlite-Datenbank, einschließlich Wiederholung, Rollback und Nutzerisolation (benötigt `@electric-sql/pglite`). Die Desktop- und Mobiloberfläche wurde mit simulierten KI-Antworten im Browser geprüft. Ein echter Gemini-/Supabase-End-to-End-Test steht bis zur Einrichtung der Testumgebung aus.

Referenzen: [Supabase Function Deployment](https://supabase.com/docs/guides/functions/deploy), [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets), [Gemini Bild-Eingaben](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding).
