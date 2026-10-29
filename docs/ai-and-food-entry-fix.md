# KI- und Tagebuchkorrektur

## Noch in Supabase zu veröffentlichen
GitHub Pages stellt nur die Oberfläche bereit. Im Supabase Dashboard unter Edge Functions → kitchen-ai → Code die index.ts durch die aktuelle Datei supabase/functions/kitchen-ai/index.ts ersetzen und Deploy ausführen. Die bestehenden validation.js und receipt.js beibehalten. Der API-Key muss für diese Korrektur nicht geändert werden.

Alternativ aus dem aktuellen Repository:
```sh
supabase functions deploy kitchen-ai --project-ref DEINE_PROJEKT_REFERENZ
```

Der Rezept-Request enthielt noch minItems/maxItems. Beim Bon-Schema waren diese wegen eines beobachteten Gemini-400-Fehlers schon entfernt. Rezeptanzahl bleibt serverseitig durch validateRecipes auf 1–3 begrenzt. Providerfehler unterscheiden nun Format, Berechtigung, Modell und Kontingent. Ohne Zugriff auf Function-Logs und Provider ist damit keine erfolgreiche Live-Anfrage nachgewiesen.

## Prüfen
- Bon scannen, Rezept aus Vorrat, Wunschgericht und Nährwertschätzung jeweils erfolgreich ausführen.
- Während jeder KI-Anfrage nur ein Nussi auf blickdichtem, modalem Vollbild; nach Erfolg und Fehler wird die Eingabe wieder frei.
- Produkt mit unbekannten Nährwerten auswählen, 100 g konsumieren, Werte pro 100 g ergänzen; Eintrag speichern und Tagebuch neu öffnen.
- Produktwerte werden bei Ergänzung auch am eigenen Produkt gespeichert. Ohne Vorratscharge wird direkt ins Tagebuch geschrieben; mit Charge erfolgt weiterhin die gemeinsame RPC-Buchung.
- Manuell Wasser mit Einheit ml anlegen, 250 ml konsumieren, vier bekannte Nullwerte pro 100 ml eintragen.
- 40 kcal pro 100 ml und 250 ml Konsum ergeben 100 kcal; Zurück/Weiter darf den Bezugswert nicht ändern.
- Unbekannte Werte werden nur nach ausdrücklicher Bestätigung als unvollständiger Eintrag gespeichert.
- Heute, Gestern, Vorgestern und anderes Datum prüfen, auch beim Bearbeiten.
