# Zusammenarbeiten zu zweit

## Sinnvolle Aufteilung

| Person A | Person B |
|---|---|
| `features/auth/` und `features/settings/` | `features/kitchen/` und `features/goals/` |
| `features/fridge/` | `features/products/` |
| Supabase-Zugriffsregeln gemeinsam abstimmen | KI-Prompt und Antwortformat betreuen |

Gemeinsame Dateien (`src/styles.css`, `src/app.js`, `src/core/*`, Datenbankschema) kurz absprechen. Kleine Feature-spezifische CSS-Dateien könnt ihr bei Bedarf neben dem Feature anlegen und oben in styles.css importieren. Keine Login-Logik in fridge.js schreiben.

## Pro Aufgabe ein Branch

```bash
git switch main
git pull
git switch -c feature/meine-aufgabe
# Dateien bearbeiten, lokal prüfen
npm test
npm run check
git add src/features/DEIN_FEATURE
git commit -m "Beschreibt konkret die Änderung"
git push -u origin feature/meine-aufgabe
```

Dann auf GitHub Pull Request öffnen, die andere Person prüft, anschließend nach `main` mergen. Nicht gleichzeitig direkt auf `main` arbeiten. Vor jeder neuen Aufgabe `git pull` ausführen. Konflikte gemeinsam im VS-Code-Merge-Editor auflösen; nicht pauschal alles von einer Seite übernehmen.

## Entwicklungsvertrag

- Datenzugriff über `src/core/data.js`, nicht überall neue Clients erzeugen.
- Neue Tabellen immer mit RLS und einem `user_id`-Bezug.
- Authentifizierung nur in `features/auth/` und dem zentralen Client.
- Jede dynamische HTML-Ausgabe durch `esc()` oder `textContent`.
- Mengenänderungen über RPC, nicht durch gelesenen Bestand plus Update im Browser.
- KI-Schema, Validierung und Frontend gemeinsam ändern, wenn sich das Rezeptformat ändert.
- Bereits ausgeführte Migrationen nicht nachträglich verändern. Neue Änderungen in `002_...sql`.
- Keine echten Secrets committen. Die öffentlichen Werte in config.js sind erlaubt.
- Feature-Ordner sind eine Organisationshilfe, keine Zugriffsbarriere zwischen Teammitgliedern.

## Für eure Präsentation erklären können

1. Was gehört ins Frontend, was ins Backend?
2. Warum schützt RLS die Daten selbst bei direktem API-Aufruf?
3. Warum kommt der KI-Key nie in den Browser?
4. Warum zieht die KI nicht selbst Zutaten ab?
5. Warum sind KI-Schätzungen und bestätigte Produktwerte unterschiedlich?
6. Warum ist eine atomare Transaktion beim Kochen wichtig?
