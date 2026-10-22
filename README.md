# Fridgely

Eine mobile Web-App für Vorrat, Ablaufdaten und KI-Rezepte. Funktioniert auch am Desktop. Vanilla HTML/CSS/JavaScript, Supabase und Google Gemini. Kein Build-Framework und keine npm-Abhängigkeiten für das Frontend erforderlich.

**Startpunkt:** ZIP entpacken, den Ordner `fridgely` in VS Code öffnen. Alle Zugangsdaten sind leer. Die Anwendung erzeugt keine Dummyprodukte, Beispielrezepte oder Demokonten.

## 1. Lokal ansehen (ohne Supabase möglich)

Node.js ab Version 20 installieren. Im VS-Code-Terminal:

```bash
npm run dev
```

`http://localhost:4173` öffnen. Nicht `index.html` doppelklicken: JavaScript-Module und HTML-Teilseiten benötigen HTTP. Alternativ VS Code Live Server verwenden; dann die andere Origin später in `ALLOWED_ORIGINS` eintragen.

Ohne Konfiguration kannst du durch die Ansichten navigieren. Lesen zeigt leere Zustände, Schreibaktionen weisen auf die fehlende Verbindung hin. Es gibt keinen versteckten lokalen Demodatenspeicher.

## 2. Supabase einrichten

1. Ein neues Supabase-Projekt erstellen.
2. Den vollständigen Inhalt von `supabase/migrations/001_initial.sql` im **SQL Editor** einmal ausführen. Die Migration legt Tabellen, Zugriffsregeln, Funktionen und den privaten Bilder-Bucket an. Nicht wiederholt und nicht ungeprüft in einer bestehenden Datenbank ausführen.
3. Unter Project Settings / API die Projekt-URL und den **Publishable Key** oder Legacy **anon Key** kopieren.
4. In `config.js` eintragen:

```js
export const config = Object.freeze({
  supabaseUrl: 'DEINE_SUPABASE_PROJEKT_URL',
  supabaseAnonKey: 'DEIN_OEFFENTLICHER_KEY',
});
```

Diese beiden Werte sind öffentlich und dürfen im Repository stehen. **Niemals Service-Role-Key, Secret Key oder Gemini-Key in config.js eintragen.** Sicherheit wird durch die Datenbankregeln umgesetzt, nicht durch das Verstecken des öffentlichen Keys.

5. In Authentication die E-Mail/Passwort-Anmeldung aktivieren. Unter URL Configuration:
   - Site URL: zunächst `http://localhost:4173`, später eure GitHub-Pages-URL.
   - Redirect URLs: eure lokale Basis-URL und die veröffentlichte Basis-URL erlauben; falls notwendig die von Supabase unterstützten Wildcards für die jeweiligen Pfade ergänzen.
6. In der App registrieren, Bestätigungs-E-Mail öffnen und anmelden. Bei einer Bestätigung auf einem anderen Gerät anschließend regulär anmelden.

Alle Inhalte gehören jeweils einem angemeldeten Nutzer. Die Zweierarbeit bezieht sich auf euren **Code**, nicht auf einen gemeinsamen Haushaltsvorrat. Eine geteilte Haushaltsfunktion ist nicht enthalten.

## 3. KI einrichten

Ein Gemini-API-Key ist nötig. Ein geeigneter Free-Tier-Zugang kann für euren Prototyp ausreichen; Kontingente und Modellverfügbarkeit werden vom Anbieter bestimmt. Es gibt keine Garantie auf dauerhaft kostenlose oder unbegrenzte Nutzung.

1. In [Google AI Studio](https://aistudio.google.com/) einen API-Key erstellen.
2. Ein aktuell verfügbares textfähiges Modell wählen, das strukturierte JSON-Ausgaben unterstützt und für euer Konto im gewünschten Kontingent verfügbar ist. Die Modell-ID bleibt bewusst konfigurierbar: [Modelle](https://ai.google.dev/gemini-api/docs/models), [Preise](https://ai.google.dev/gemini-api/docs/pricing).
3. Supabase CLI über die [offizielle Anleitung](https://supabase.com/docs/guides/local-development/cli/getting-started) bereitstellen. Alternativ können die beiden Funktionsdateien im Supabase Dashboard angelegt werden.
4. Terminal im Projektordner:

```bash
npx supabase login
npx supabase link --project-ref DEINE_PROJEKT_ID
```

5. `.env.example` nach `.env.local` kopieren und dort lokal füllen:

```dotenv
GEMINI_API_KEY=DEIN_GEHEIMER_KEY
GEMINI_MODEL=DEINE_MODELL_ID
ALLOWED_ORIGINS=http://localhost:4173,https://DEIN_GITHUB_NAME.github.io
```

Origins enthalten **keinen Pfad und keinen abschließenden Slash**. Für GitHub Pages gehört daher `/fridgely/` nicht in `ALLOWED_ORIGINS`. Niemals `.env.local` hochladen. Die eingebauten `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` werden der gehosteten Edge Function von Supabase bereitgestellt.

6. Secrets setzen und Funktion veröffentlichen:

```bash
npx supabase secrets set --env-file .env.local
npx supabase functions deploy kitchen-ai --no-verify-jwt
```

`--no-verify-jwt` deaktiviert nur die vorgeschaltete Legacy-Prüfung. Die Funktion validiert **jede Anfrage selbst mit auth.getUser** und prüft die Origin. Sie ist nicht anonym nutzbar.

Die Funktion lädt den Vorrat selbst aus der Datenbank, schließt abgelaufene Chargen aus, validiert die KI-Antwort und speichert Rezepte. Sie kann den Vorrat nicht selbst verändern. Erst der bestätigte Kochvorgang ruft die atomare Datenbankfunktion auf.

## 4. Euer erstes echtes Szenario

1. Registrieren und anmelden.
2. Unter **Produkte** ein eigenes Produkt mit Einheit erstellen; Nährwerte optional manuell oder per KI eintragen, optional Bild hochladen.
3. Unter **Kühlschrank** dieses Produkt mit echter Menge und optionalem Datum hinzufügen. Mehrere Chargen desselben Produkts sind möglich.
4. **Meine Ziele** auswählen und bei Bedarf Ernährungshinweise speichern.
5. **KI-Küche**: Vorratsideen oder ein Wunschgericht anfordern. Datenübermittlung bestätigen.
6. Zutaten und Zubereitung öffnen. Fehlmengen werden aus dem echten Bestand berechnet.
7. Fehlende Produkte unter exakt dem im Rezept genannten Namen und derselben Einheit anlegen und einlagern. Die App erkennt sie anschließend beim erneuten Öffnen der KI-Küche. Alternativ ein neues Rezept erzeugen.
8. **Gekocht – Zutaten abziehen** bestätigen. Die Datenbank verwendet zuerst die am frühesten fälligen, nicht abgelaufenen Chargen. Bei unzureichendem Bestand wird alles zurückgerollt. Pro gespeichertem Rezept ist genau eine Kochbuchung möglich; für erneutes Kochen eine neue Idee erzeugen.

Einheiten werden bewusst nicht automatisch umgerechnet: g, ml und Stück sind verschieden. KI-Nährwerte sind Näherungen, besonders bei „Stück“. Pro g/ml gelten Nährwerte pro 100 Einheiten, bei Stück pro Stück. Korrigierte Werte bleiben in der persönlichen Produktbibliothek gespeichert.

## 5. GitHub und Veröffentlichung

Am einfachsten gemeinsam mit GitHub Desktop oder Git in VS Code arbeiten. Erst ein leeres GitHub-Repository anlegen, dann im entpackten Projektordner:

```bash
git init
git add .
git commit -m "Initial Fridgely app"
git branch -M main
git remote add origin https://github.com/DEIN_NAME/DEIN_REPO.git
git push -u origin main
```

**Der Inhalt von `fridgely` muss im Repository-Wurzelverzeichnis liegen**, nicht die ZIP und nicht ein zusätzlicher Unterordner. Auch `.github/` mit hochladen; Git übernimmt das automatisch.

1. Teammitglied unter Repository Settings → Collaborators einladen.
2. Settings → Pages → Source auf **GitHub Actions** stellen.
3. Unter Actions den Workflow `Test and publish GitHub Pages` starten oder erneut nach `main` pushen.
4. Der Workflow prüft Tests/Syntax und veröffentlicht nur `index.html`, `config.js`, Icons/Manifest und `src/`. Die Website liegt üblicherweise unter `https://DEIN_NAME.github.io/DEIN_REPO/`.
5. Die veröffentlichte URL bei Supabase als Site URL / Redirect URL eintragen. Die Origin in `ALLOWED_ORIGINS` ergänzen und Secrets erneut setzen.

Das Frontend wird über GitHub Pages veröffentlicht; die Datenbank und Edge Function bleiben bei Supabase. GitHub Pages führt keinen Backend-Code aus.

Auf dem Handy die URL öffnen und im Browser „Zum Home-Bildschirm“ wählen. Dies ist eine responsive Web-App mit Manifest, keine native iOS/Android-App und kein App-Store-Paket. Kein Offline-Modus; Netzwerkzugriff ist nötig.

## 6. Wo ändere ich was?

| Bereich | Dateien |
|---|---|
| Login / Registrierung / Logout | `src/features/auth/auth.html` + `auth.js` |
| Kühlschrank, Chargen, Ablaufdatum, + / − | `src/features/fridge/fridge.html` + `fridge.js` |
| Produktbibliothek, Bilder, Nährwerte | `src/features/products/products.html` + `products.js` |
| KI-Küche und Rezeptsammlung | `src/features/kitchen/kitchen.html` + `kitchen.js` |
| Ziele und Ernährungswünsche | `src/features/goals/goals.html` + `goals.js` |
| Konto / Passwort / Verbindung | `src/features/settings/settings.html` + `settings.js` |
| Navigation, Routing | `src/app.js` |
| Farben, Abstände, responsive Darstellung | `src/styles.css` |
| Supabase-Client | `src/core/supabase.js` |
| Datenzugriff / Uploads / KI-Aufruf | `src/core/data.js` |
| Mengen / Fehlmengen / Datumslogik | `src/core/domain.js` |
| KI-Prompt und Backend | `supabase/functions/kitchen-ai/index.ts` |
| KI-Antwortprüfung | `supabase/functions/kitchen-ai/validation.js` |
| Tabellen, Rollen, Sicherheit, Kochbuchung | `supabase/migrations/001_initial.sql` |

Die Feature-HTML-Dateien sind geladene Teilansichten; öffnet immer `index.html` über den Entwicklungsserver. Die Trennung sorgt dafür, dass Kühlschrank-Code keine Login-Oberfläche enthält. Das verhindert keine manuellen Änderungen an anderen Dateien – eure Arbeitsaufteilung und Pull Requests regeln das.

## 7. Rollen

Neue Konten erhalten `member`. Projektverantwortliche können im Supabase SQL Editor gezielt `admin` vergeben:

```sql
update public.user_roles set role = 'admin'
where user_id = 'ECHTE_USER_UUID_AUS_AUTHENTICATION';
```

`member`: 20 KI-Anfragen pro UTC-Tag. `admin`: 40. Auch Fehler nach Reservierung zählen zum Limit. Beide Rollen sehen ausschließlich ihre eigenen Produkte, Vorräte, Ziele und Rezepte. Es gibt keinen Admin-Zugriff auf fremde persönliche Daten und keine Admin-Verwaltungsoberfläche. Rollen können nicht durch Selbstregistrierung oder Frontend-Updates erhöht werden. Das App-Limit ersetzt nicht die Limits des KI-Anbieters.

## 8. Tests und bekannte Grenzen

```bash
npm test
npm run check
```

Automatisierte Tests prüfen Ablaufgrenzen, Mengen, Fehlmengen, nachträglich angelegte Zutaten und fehlerhafte KI-Antworten. Syntax wird separat geprüft. Die Tests legen keine Daten in eurer Anwendung an.

Zusätzlich wurde die SQL-Migration in einer isolierten PostgreSQL-kompatiblen PGlite-Testumgebung ausgeführt: Nutzerisolation, Rollen, Einheitenprüfung, Abzug nach Ablaufdatum, Doppelbuchungsschutz, Transaktions-Rollback und Tageslimit bestanden. Optional reproduzieren (Testdaten existieren nur in einer temporären In-Memory-Datenbank):

```bash
npm install --no-save --package-lock=false @electric-sql/pglite@0.5.11
npm run test:db
```

Die visuelle Browserprüfung konnte in der Erstellungsumgebung wegen fehlender Vorschau-Infrastruktur nicht ausgeführt werden. Ohne echte Supabase-/Gemini-Zugangsdaten wurden keine Live-Integrationstests ausgeführt. Arbeitet vor der Abgabe die Checkliste in `docs/ABNAHME.md` durch, insbesondere RLS, Doppelbuchung, parallele Mengenänderungen, Bildzugriff und Passwort-Reset.

Weitere Grenzen: keine Barcode-Erkennung, keine automatische Fotoerkennung, keine Push-Benachrichtigungen, kein Ernährungstagebuch, keine automatische Einheitenumrechnung und keine geteilten Haushalte. Nährwerte werden produktbezogen geschätzt/gespeichert; Tages-Makrotracking ist nicht enthalten. Die Bibliothek „lernt“ durch gespeicherte Korrekturen, nicht durch Modelltraining. Für starke Datenmengen ist später Pagination sinnvoll; der KI-Kontext ist auf 500 Produkte / 1000 Vorratschargen begrenzt.

Externe Laufzeitressourcen: Supabase JS über esm.sh und die einzige Icon-Schrift **Material Symbols Rounded** über Google Fonts. Keine Emojis. Eine eigene Auslieferung der Schrift/SDK-Dateien kann später ergänzt werden. Das Design ist eigenständig, angelehnt an großzügige Abstände, abgerundete Karten und klare Navigation; keine Airbnb-/Revolut-Assets kopiert.

Weitere Dokumentation: `docs/TEAM.md`, `docs/ARCHITEKTUR.md`, `docs/ABNAHME.md`.
