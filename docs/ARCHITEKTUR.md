# Architektur

## Datenfluss

Browser → Supabase Auth / Tabellen / privater Bildspeicher. KI-Aufrufe: Browser → authentifizierte Edge Function → Gemini → Validierung → gespeichertes Rezept. Kochbuchungen: Browser → `cook_recipe` → eine Datenbanktransaktion.

## Datenmodell

| Tabelle | Inhalt / Grenze |
|---|---|
| products | Persönliche Stammdaten, Einheit, Nährwerte und privater Bildpfad |
| inventory | Konkrete Charge mit Menge und Ablaufdatum; mehrere pro Produkt |
| goals | Genau ein Zielprofil je Nutzer |
| recipes | Validiertes Rezept als JSON, Kochzeitpunkt für Doppelbuchungsschutz |
| user_roles | Rolle; nur serverseitig / SQL administrierbar |
| ai_usage | Tageskontingent; nur die Edge Function kann hochzählen |

Produkt und Charge sind über `(product_id,user_id)` verknüpft. Eine fremde Produkt-ID kann dadurch nicht für eine eigene Charge verwendet werden. Ein Einheitentrigger verhindert Inkonsistenzen. Produktnamen sind pro Nutzer und Einheit ohne Beachtung der Großschreibung eindeutig.

## Rezeptformat

`title`, `description`, `servings`, `minutes`, `note`, `steps[]`, `ingredients[]`.
Eine Zutat enthält `name`, `product_id` oder null, `quantity` und `unit`. Fehlmengen werden deterministisch berechnet. Fehlende Produkte können später über denselben Namen und dieselbe Einheit aufgelöst werden. Bei einem bereits bekannten, inzwischen gelöschten Produkt das Rezept neu generieren.

## Sicherheit

RLS trennt persönliche Daten. Rezept-Insert/Update ist für Browser gesperrt. Eine SQL-Funktion mit festem search_path und explizitem auth.uid()-Check bucht Mengen atomar; Rezeptzeile und Nutzersperre verhindern doppelte / konkurrierende Kochbuchungen. Die Edge Function authentifiziert Tokens, lädt nur Daten des verifizierten Nutzers und begrenzt Aufrufe. Der Service-Role-Key liegt nur in der Serverumgebung. Bilder liegen in einem privaten Bucket mit nutzerbezogenen Ordnerregeln.

Die App ist ein nachvollziehbarer Studienprototyp. Vor größerem öffentlichen Betrieb: zusätzliche Abuse-Prävention (z. B. CAPTCHA / Registrierungsschutz), Aufbewahrungsregeln, Monitoring und Datenschutzinformationen passend zu eurem Projekt ergänzen. Ein Tageslimit pro Konto begrenzt keine massenhaften Neuregistrierungen.

## Wartung

HTML und JavaScript sind pro Feature getrennt. Das Designsystem bleibt zentral. Ein Hash-Router vermeidet 404-Probleme beim Neuladen auf GitHub Pages. SDK-Version ist fixiert. Die KI-Modell-ID liegt in Secrets und kann ohne Änderung des Frontends gewechselt werden.
