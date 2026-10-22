# Prüfbericht – 22.10.2026

- 8 automatisierte JavaScript-Tests bestanden (siehe tests/domain.test.js).
- JavaScript-Syntaxprüfung bestanden; TypeScript-Backend zusätzlich mit Node 24 auf Syntax geprüft.
- Vollständige SQL-Migration in PGlite erfolgreich ausgeführt.
- Nutzerisolation, Schutz vor eigener Rollenänderung, fremde Produkt-IDs und Einheitenprüfung getestet.
- Zutatenabzug nach Ablaufdatum und Blockierung doppelter Kochbuchungen getestet.
- Vollständiger Rollback bei fehlender zweiter Zutat getestet.
- Tageslimit von 20 Anfragen getestet.

Offen: visuelle Desktop-/Mobilprüfung (Vorschau-Infrastruktur nicht verfügbar), echte Supabase-Auth-/Storage-/Edge-Function-Integration und Gemini-Aufrufe. PGlite ersetzt nicht den Test der gehosteten Supabase-Umgebung oder echter paralleler Sitzungen. Zugangsdaten sind absichtlich leer.
