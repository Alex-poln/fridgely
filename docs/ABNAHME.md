# Abnahme vor der Präsentation

Ohne eure Zugangsdaten sind diese Live-Prüfungen noch offen. Für Tests eigene Konten A/B anlegen, keine öffentlichen echten Gesundheitsdaten verwenden.

## Verbindung / Konten

- [ ] Ohne config.js-Werte bleibt alles leer; keine erfundenen Inhalte.
- [ ] Registrierung, Bestätigungs-Mail, Login, Logout und Passwort-Reset funktionieren.
- [ ] Nach Neuladen bleibt die Sitzung bestehen.
- [ ] Konto B sieht keine Daten von A; direkter Zugriff auf A-Datensatz liefert nichts / Fehler.
- [ ] Konto A kann seine eigene Rolle nicht per API hochstufen.

## Vorrat / Produkte

- [ ] Produkt mit jeder Einheit, optionalen Nährwerten und Bild speichern.
- [ ] JPG/PNG/WebP bis 5 MB erlaubt; falsches Format / größere Datei abgewiesen.
- [ ] Privates Bild kann ohne gültige Berechtigung nicht gelesen werden (signierte Links sind bis zum Ablauf nutzbar).
- [ ] Nährwerte korrigieren, neu laden, Korrektur bleibt erhalten.
- [ ] Zwei Chargen desselben Produkts mit verschiedenen Ablaufdaten anlegen.
- [ ] + / − verändern nur die ausgewählte Charge; Null entfernt sie.
- [ ] Negativer Bestand ist nicht möglich; parallel ausgeführte Änderungen sind korrekt.
- [ ] Ablauf heute, in 3 Tagen, in 4 Tagen, gestern und ohne Datum prüfen.
- [ ] Produkt mit vorhandener Charge kann nicht gelöscht / in der Einheit geändert werden.

## KI / Kochen

- [ ] Ohne Secrets erscheint eine verständliche Fehlermeldung.
- [ ] Ohne Login wird die KI-Anfrage abgewiesen.
- [ ] Vorratsideen beachten Ziele und enthalten keine abgelaufenen Chargen.
- [ ] Wunschgericht zeigt korrekte Fehlmengen; KI-Zubereitung inhaltlich prüfen.
- [ ] Neue fehlende Zutat mit identischem Namen/Einheit einlagern; erneut KI-Küche öffnen.
- [ ] Rezept öffnen zieht nichts ab.
- [ ] Bestätigtes Kochen zieht früheste verwendbare Chargen zuerst ab.
- [ ] Zweiter Aufruf desselben cook_recipe ist blockiert.
- [ ] Bei zwischenzeitlich reduziertem Bestand wird die gesamte Buchung zurückgerollt.
- [ ] Zwei gleichzeitige Kochvorgänge können keinen negativen Vorrat erzeugen.
- [ ] KI-Limit wird eingehalten; fremde Produkt-IDs und unplausible Antwortformate werden abgewiesen.

## Darstellung / Veröffentlichung

- [ ] GitHub-Action ist grün und Pages lädt auch unter dem Repository-Unterpfad.
- [ ] Supabase Redirect URLs und ALLOWED_ORIGINS passen zur veröffentlichten Adresse.
- [ ] Navigation, Dialoge und Formulare bei 375 px Breite und Desktop testen.
- [ ] Tastaturbedienung, sichtbarer Fokus, Escape zum Schließen von Dialogen.
- [ ] Keine geheimen Schlüssel im Repository / ausgelieferten Frontend.
