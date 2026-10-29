# Ein gemeinsames KI-Update

Dieses Update enthält den vorherigen Gemini-Rezeptfix UND die neuen Zutaten-Nährwerte. Nicht zuerst den alten Stand deployen.

Im Supabase Dashboard: Edge Functions → kitchen-ai → Code.

1. index.ts durch supabase/functions/kitchen-ai/index.ts aus diesem Repository ersetzen.
2. validation.js durch supabase/functions/kitchen-ai/validation.js ersetzen.
3. receipt.js unverändert beibehalten.
4. Erst wenn beide Dateien aktualisiert sind, einmal Deploy ausführen.

Alternativ aus dem aktuellen Repository einmal:
```sh
supabase functions deploy kitchen-ai --project-ref DEINE_PROJEKT_REFERENZ
```

Kein SQL-Update und kein neuer API-Key erforderlich. Falls der ältere Fix schon veröffentlicht wurde, ist für die neue Nährwertausgabe noch eine Veröffentlichung dieses kombinierten Stands erforderlich.

Neue Rezeptvorschläge enthalten geschätzte Referenzwerte je Zutat. Die Oberfläche rechnet mit Zutatenmengen und Portionszahl; bekannte Produktwerte haben Vorrang. Bestehende Rezepte behalten ihre Daten. Ohne bekannte Werte oder gespeicherte Schätzungen erscheint „—“, kein erfundener Nullwert.

Nach Veröffentlichung: ein neues Rezept erzeugen und Nährwerte pro Portion in Vorschau, Sammlung und beim Tagebucheintrag vergleichen. Live-KI und Safari-Darstellung sind durch lokale Tests nicht verifiziert.
