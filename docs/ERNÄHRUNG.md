# Ernährungstagebuch: Einrichtung und Prüfung

Voraussetzung ist die im Chat ausgeführte SQL-Erweiterung mit nutrition_profiles,
custom_meals, food_entries, recipes.is_saved und log_product_consumption.

## Veröffentlichung

GitHub Pages veröffentlicht die Oberfläche über den vorhandenen Workflow.
Die Supabase Edge Function wird dadurch NICHT veröffentlicht.

Im Supabase-Projekt die bestehende Funktion kitchen-ai mit dem aktuellen
Ordner supabase/functions/kitchen-ai aktualisieren (index.ts, validation.js,
receipt.js). Bestehende Secrets und CORS-Konfiguration beibehalten.

Mit bereits angemeldeter Supabase CLI aus dem Repository:

    supabase functions deploy kitchen-ai --project-ref DEINE_PROJEKT_REFERENZ

Keine Service-Role- oder Gemini-Schlüssel ins Frontend oder Repository eintragen.

Vor dem Edge-Deployment unterstützt die Oberfläche die bisherige Antwort mit
Rezept-IDs: neu erzeugte Rezepte werden auf is_saved=false gesetzt und dann
zur Auswahl angezeigt. Es gibt dabei ein kurzes Zeitfenster zwischen Erzeugen
und Ausblenden. Mit der neuen Funktion werden sie von Anfang an ungespeichert
angelegt. Neue Anfragewünsche und bestätigte Tagesziele werden erst nach dem
Edge-Deployment berücksichtigt.

## Daten und Berechnung

- Produktnährwerte: pro 100 g / 100 ml, bei Stück pro Stück.
- Eigene Gerichte: gespeicherte Nährwerte pro Portion; Zutaten für alle Portionen.
- Tagebucheinträge: Momentaufnahme der tatsächlich gegessenen Menge.
- Unbekannte Nährwerte sind NULL, keine Nullwerte.
- Profil: bestätigte Tagesziele; kein automatisches Kaloriendefizit.
- Mifflin–St Jeor für Erwachsene, multipliziert mit gewähltem Aktivitätsfaktor.
- Eiweiß wird nur bei ausdrücklich eingegebenem Faktor berechnet.
- Quellen: https://pubmed.ncbi.nlm.nih.gov/2305711/ und https://pubmed.ncbi.nlm.nih.gov/28642676/
- Die KI erhält ausschließlich bestätigte Tagesziele, nicht Geburtsdatum,
  Gewicht oder Tagebuch. Tagesziele sind eine lockere Orientierung.
- Änderungen/Löschen im Tagebuch ändern den Vorrat nicht rückwirkend.
- Bei Rezepten sind Kochen (alle Zutaten abziehen) und Essen (eigene Portion)
  getrennte Aktionen. Eigene Gerichte buchen keinen Vorrat automatisch ab.

## Abnahme auf dem echten Projekt

1. Erstes Profil speichern / überspringen; später unter Ziele ändern.
2. Beispieldaten nur im eigenen Testkonto anlegen: 100 g Produkt mit 400 kcal.
   50 g im Tagebuch müssen 200 kcal ergeben.
3. Aus dem Kühlschrank essen: Tagebucheintrag und Vorratsmenge prüfen.
   Bei unzureichendem Vorrat darf kein Tagebucheintrag entstehen.
4. Manuelle Einträge, unbekannte Werte, Datum und alle vier Mahlzeiten prüfen.
5. Eigenes Gericht mit zwei Portionen anlegen; eine Portion protokollieren.
6. Rezept generieren: Vorschau prüfen, eines speichern, Rest nicht in Sammlung.
7. Rezept kochen und eigene gegessene Portion getrennt protokollieren.
8. Tageswechsel, Eintrag bearbeiten/löschen, Produktsuche und Rezeptsuche prüfen.
9. Handy, iPad hoch/quer und Desktop prüfen. Tastatur darf Bestätigen nicht verdecken.
10. Zwei Testkonten verwenden: keine fremden Profile, Gerichte oder Einträge sichtbar.

Lokale Tests: npm test und npm run check.
Browser-QA konnte in der ausführenden Umgebung mangels installiertem Browser
nicht gestartet werden. Die echten Supabase-Buchungen und das Edge-Deployment
wurden hier nicht ausgeführt.
