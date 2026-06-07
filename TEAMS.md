# Teams-Nutzung

Diese Version nutzt `data.json` als zentrale Datendatei. Die App lädt diese Datei bei jedem Öffnen mit Cache-Schutz neu:

```text
data.json?t=<aktueller Zeitstempel>
```

## Dateien in Teams/SharePoint

Alle Dateien muessen im selben Ordner liegen:

- `index.html`
- `app.js`
- `styles.css`
- `logo-gsl.jpg`
- `data.json`

Die `index.html` kann in Teams als Registerkarte vom Typ Website verlinkt werden.

## Bearbeiten

1. Bearbeiter oeffnen die Registerkarte.
2. Auf `Edit` klicken und das Kennwort eingeben.
3. Inhalte aendern.
4. Auf `Daten exportieren` klicken.
5. Die heruntergeladene Datei muss wieder `data.json` heissen.
6. Diese `data.json` im Teams-/SharePoint-Ordner ersetzen.

Danach sehen alle anderen beim naechsten Oeffnen den neuen Stand.

## Importieren

Im Edit-Modus kann mit `Daten importieren` eine lokale `data.json` eingelesen werden. Danach sollte sie bei Bedarf wieder mit `Daten exportieren` ausgegeben und im Teams-/SharePoint-Ordner ersetzt werden.

## Kennwort

Das Kennwort dient nur als Schutz gegen unbeabsichtigte Bearbeitung. Es ist kein echter Zugriffsschutz, da die App statisch im Browser laeuft.

## Rechte

In SharePoint sollten nur ausgewaehlte Kolleginnen und Kollegen Bearbeitungsrechte fuer den Ordner oder mindestens fuer `data.json` bekommen. Alle anderen erhalten nur Leserechte.

## Hinweis zum lokalen Test

Direktes Oeffnen per Doppelklick kann den Zugriff auf `data.json` im Browser blockieren. In Teams/SharePoint wird die App ueber HTTPS geladen, dort funktioniert der Abruf. Fuer lokale Tests sollte ein kleiner Webserver genutzt werden.
