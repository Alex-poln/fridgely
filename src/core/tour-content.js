const nav = page => '#navigation [data-page="' + page + '"]';
export const introductions = {
  fridge: [
    [null, "Hey, ich bin Nussi!", "Ich helfe dir mit deinem Vorrat und beim Kochen. Ich zeige dir kurz den Einstieg. Die anderen Bereiche entdecken wir, wenn du sie zum ersten Mal öffnest."],
    ["#empty-scan, #scan-receipt", "Kassenbon scannen", "Fotografiere deinen Bon, prüfe die erkannten Lebensmittel und übernimm sie in deinen Vorrat."],
    ["#empty-add, #add", "Einzeln hinzufügen", "Hier fügst du Lebensmittel mit Menge und Datum hinzu."],
    ['[data-filter="soon"]', "Bald fällig", "Hier stehen Lebensmittel mit einem Datum von heute bis in drei Tagen. Beim Antippen erscheint die Erklärung."],
    [nav("kitchen"), "Kochen mit mir", "Hier findest du Ideen für deinen Vorrat. Beim ersten Öffnen zeige ich dir die Funktionen."],
    [nav("products"), "Deine Produkte", "Hier verwaltest du wiederverwendbare Produkte und ihre Nährwerte."],
    [nav("goals"), "Deine Wünsche", "Hier legst du Ernährungsweise und Vorlieben für deine Rezeptideen fest."]
  ],
  tracker: [[null, "Dein Ernährungstagebuch", "Hier siehst du deinen Tag. Über das Plus bei einer Mahlzeit trägst du Produkte, eigene Gerichte oder Rezepte ein. Den Tag kannst du oben wechseln."]],
  kitchen: [
    ['[data-mode="suggest"]', "Ideen aus deinem Vorrat", "Ich suche passende Rezeptideen zu deinen vorhandenen Zutaten."],
    ['[data-mode="wish"]', "Ein Wunschgericht", "Hier kannst du sagen, was du kochen möchtest. Ich zeige dir auch fehlende Zutaten."],
    ['[name="servings"]', "Für wie viele?", "Stelle die Anzahl der Portionen ein."],
    ['[name="consent"]', "Du entscheidest", "Bestätige, dass ich Vorrat und Ernährungswünsche für diese Anfrage an die KI senden darf."],
    ['#recipe-form [type="submit"]', "Rezeptideen finden", "Hier startest du die Anfrage. Prüfe die Vorschläge im Fenster und speichere nur die Rezepte, die du behalten möchtest."]
  ],
  products: [
    ["#new-product", "Deine Produktbibliothek", "Lege ein Produkt einmal an. Du kannst es danach immer wieder deinem Vorrat hinzufügen."],
    ["#search", "Produkte wiederfinden", "Suche nach einem Produkt. In den Produkteinträgen kannst du Bilder und Nährwerte ergänzen oder korrigieren."]
  ],
  goals: [
    ["#goal-options", "Dein Ernährungsziel", "Wähle das Ziel, das ich bei Rezeptvorschlägen berücksichtigen soll."],
    ['[name="diet"]', "Deine Ernährungsweise", "Hier wählst du zum Beispiel vegetarisch oder vegan."],
    ['[name="allergies"]', "Was soll ich vermeiden?", "Trage Allergien und Unverträglichkeiten ein. Prüfe Rezepte und Produktetiketten trotzdem selbst."],
    ['[name="preferences"]', "Weitere Wünsche", "Sag mir, was du magst oder wie viel Zeit du zum Kochen hast."],
    ['#goals-form [type="submit"]', "Wünsche speichern", "Speichere deine Auswahl, damit sie bei zukünftigen Rezeptideen berücksichtigt wird."]
  ],
  settings: [
    ["#account", "Dein Konto", "Hier findest du deine Kontoinformationen."],
    ["#restart-tour", "Noch einmal erklären", "Hier kannst du die Einführung jederzeit freiwillig neu starten."]
  ]
};

export function tutorialSeen(user, page, locallySeen = false) {
  return Boolean(user.user_metadata?.["nussi_seen_" + page] || locallySeen);
}
