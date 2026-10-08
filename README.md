# FitTrack – Fitness-App

Android-App (React Native / Expo) zum Tracken von **Makros**, **verbrannten Kalorien** und **Aktivitäten**, mit Anbindung an **Google Health Connect** und einer **Übungsbibliothek mit Erklärvideos**.

## Funktionen

| Bereich | Was du machen kannst |
| --- | --- |
| **Heute** | Gegessene vs. verbrannte Kalorien, Fortschritt bei Protein/Kohlenhydraten/Fett, Schritte & aktive Kalorien aus Health Connect, 7-Tage-Übersicht |
| **Ernährung** | Mahlzeiten nach Frühstück/Mittag/Abend/Snack eintragen, Werte pro Portion oder pro 100 g, Kalorien automatisch aus Makros berechnen, „Zuletzt verwendet“ zum schnellen Wiedereintragen |
| **Aktivität** | Trainings eintragen (Krafttraining, Laufen, Radfahren, …), Kalorienschätzung über MET-Werte & Körpergewicht, Trainings von Smartwatch/anderen Apps aus Health Connect anzeigen |
| **Übungen** | Eigene Übungen mit Erklärvideo anlegen (aus Galerie oder direkt aufnehmen), Anleitung, Sätze/Wiederholungen, Muskelgruppe, Suche & Filter, „Training erledigt“ trägt eine Aktivität ein, Verlauf pro Übung |
| **Einstellungen** | Tagesziele für Kalorien & Makros, Körpergewicht, Health Connect verbinden/trennen |

Alle Daten werden lokal auf dem Handy gespeichert (SQLite). Videos werden in den App-Speicher kopiert, damit sie auch dann noch da sind, wenn du sie aus der Galerie löschst.

### Google Health Connect

- **Gelesen:** Schritte, aktive & gesamt verbrannte Kalorien, Trainingseinheiten anderer Apps (z. B. Pixel Watch, Fitbit, Samsung Health, Google Fit)
- **Geschrieben:** deine in FitTrack erfassten Mahlzeiten (Nutrition) und Trainings (ExerciseSession)
- Beim Löschen eines Eintrags in FitTrack wird er auch aus Health Connect entfernt.

Health Connect gibt es nur auf Android (ab Android 14 im System integriert, davor als App aus dem Play Store).

## App auf dein Handy bringen

Weil Health Connect nativen Code braucht, läuft die App **nicht in Expo Go** – du brauchst einen eigenen Build. Am einfachsten ohne Android Studio über EAS (Cloud-Build von Expo, kostenloses Konto):

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android
```

Am Ende bekommst du einen Link/QR-Code zu einer `.apk`, die du direkt auf dem Handy installierst.

### Entwickeln (mit Live-Reload)

```bash
npx eas-cli@latest build --profile development --platform android   # einmalig: Dev-Build installieren
npm start                                                            # danach: Code ändern, App lädt neu
```

Mit installiertem Android Studio geht es auch lokal: `npm run android`.

## Projektstruktur

```
src/
  app/                 Bildschirme (Expo Router)
    (tabs)/            Heute, Ernährung, Aktivität, Übungen, Einstellungen
    food/new.tsx       Mahlzeit hinzufügen
    activity/new.tsx   Aktivität hinzufügen
    exercise/new.tsx   Übung erstellen/bearbeiten (inkl. Video-Upload)
    exercise/[id].tsx  Übungsdetails mit Videoplayer
  db/database.ts       Lokale SQLite-Datenbank
  health/healthConnect.ts  Google-Health-Connect-Anbindung
  lib/                 Hilfsfunktionen (Datum, Aktivitätstypen, Videos)
  components/          UI-Bausteine
```

## Checks

```bash
npm run typecheck
```

## Hinweis zur Veröffentlichung im Play Store

Für eine Veröffentlichung musst du in der Play Console angeben, welche Health-Connect-Daten die App nutzt, und eine Datenschutzerklärung hinterlegen. Für die private Nutzung per APK ist das nicht nötig.
