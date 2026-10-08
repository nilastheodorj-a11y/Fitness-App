# FitTrack – Fitness-App für iPhone & Android

App (React Native / Expo) zum Tracken von **Makros**, **verbrannten Kalorien** und **Aktivitäten** – mit **Apple Health** (iPhone) bzw. **Google Health Connect** (Android), **Barcode-Scanner**, **Trainingsplänen** und einer **Übungsbibliothek mit Erklärvideos**.

## Funktionen

| Bereich | Was du machen kannst |
| --- | --- |
| **Heute** | Gegessene vs. verbrannte Kalorien, Fortschritt bei Protein/Kohlenhydraten/Fett, Schritte & aktive Kalorien aus Apple Health / Health Connect, 7-Tage-Übersicht |
| **Ernährung** | Mahlzeiten eintragen, **Barcode scannen** (Nährwerte aus Open Food Facts), pro Portion oder pro 100 g, Kalorien aus Makros berechnen, „Zuletzt verwendet“ |
| **Aktivität** | Trainings eintragen mit Kalorienschätzung, Trainings von Apple Watch / Smartwatch werden mit angezeigt |
| **Training › Pläne** | Übungen zu Trainingsplänen kombinieren (Sätze, Wiederholungen, Pause), **geführtes Training** mit Video, Gewicht/Wdh. pro Satz, Pausen-Timer mit Vibration, Gewichte der letzten Einheit werden vorausgefüllt |
| **Training › Übungen** | Übungen mit **Erklärvideo** (aus Galerie oder direkt aufnehmen), Anleitung, Muskelgruppe, Verlauf mit Gewichten |
| **Einstellungen** | Tagesziele, Körpergewicht, **Dark Mode** (System/Hell/Dunkel), Gesundheits-App verbinden |

Alle Daten bleiben lokal auf dem Handy (SQLite). Videos werden in den App-Speicher kopiert.

### Barcode-Scanner

Gescannte Produkte werden in [Open Food Facts](https://world.openfoodfacts.org) nachgeschlagen (kostenlos, ohne Konto) und lokal gespeichert – beim nächsten Scan klappt es auch offline. Ist ein Produkt unbekannt, gibst du die Werte pro 100 g einmal selbst ein; sie werden unter dem Barcode gespeichert.

### Apple Health (iPhone) / Health Connect (Android)

- **Gelesen:** Schritte, aktive & gesamt verbrannte Kalorien, Trainings anderer Apps/Geräte (Apple Watch, Fitbit, Samsung …)
- **Geschrieben:** Mahlzeiten (Kalorien, Protein, Kohlenhydrate, Fett) und Trainings aus FitTrack
- Gelöschte Einträge werden auch dort entfernt.

## Auf dem iPhone ausprobieren

Du hast drei Möglichkeiten:

### 1. Sofort & kostenlos: Expo Go (ohne Apple Health)

Alles außer Apple Health funktioniert in der App **Expo Go** – auch Barcode-Scanner, Videos und Trainingspläne.

1. [Node.js](https://nodejs.org) auf deinem Computer installieren (Windows, Mac oder Linux).
2. **Expo Go** aus dem App Store aufs iPhone laden.
3. Im Projektordner:
   ```bash
   npm install
   npm run start:go
   ```
4. Den QR-Code im Terminal mit der iPhone-Kamera scannen. Handy und Computer müssen im selben WLAN sein.

### 2. Komplette App mit Apple Health: EAS-Build (kostenpflichtiges Apple-Konto)

Für Apple Health braucht die App einen eigenen Build. Apple verlangt dafür eine Mitgliedschaft im **Apple Developer Program (99 €/Jahr)**. Kein Mac nötig – gebaut wird in der Cloud:

```bash
npm install
npx eas-cli@latest login                                  # kostenloses Expo-Konto
npx eas-cli@latest device:create                          # iPhone registrieren (einmalig)
npx eas-cli@latest build --profile preview --platform ios
```

Danach bekommst du einen Link, über den du die App direkt aufs iPhone installierst. Alternativ per TestFlight: `build --profile production` und dann `npx eas-cli@latest submit --platform ios`.

### 3. Mit einem Mac: Xcode & kostenlose Apple-ID

```bash
npm install
npx expo run:ios --device
```

Mit einer kostenlosen Apple-ID läuft die App 7 Tage, danach musst du sie neu installieren. Ob HealthKit mit einer kostenlosen Apple-ID funktioniert, legt Apple fest; sicher funktioniert es nur mit dem Developer Program (Weg 2).

## Auf Android

```bash
npm install
npx eas-cli@latest build --profile preview --platform android
```

Das ergibt eine `.apk`, die du direkt installierst. Expo Go (`npm run start:go`) geht auch hier – dann ohne Health Connect.

## Entwickeln

```bash
npx eas-cli@latest build --profile development --platform ios   # bzw. android – einmalig
npm start                                                       # Live-Reload im Dev-Build
npm run typecheck
```

## Projektstruktur

```
src/
  app/                    Bildschirme (Expo Router)
    (tabs)/               Heute, Ernährung, Aktivität, Training, Einstellungen
    food/                 Mahlzeit hinzufügen, Barcode-Scanner
    activity/             Aktivität hinzufügen
    exercise/             Übung erstellen/bearbeiten, Details mit Video
    workout/              Trainingsplan bearbeiten, Details, geführtes Training
  db/database.ts          Lokale SQLite-Datenbank (mit Migrationen)
  health/                 Apple Health (iOS) & Health Connect (Android) hinter einer gemeinsamen Schnittstelle
  lib/                    Datum, Aktivitätstypen, Open Food Facts, Videos, Formatierung
  components/             UI-Bausteine und Farbschema (hell/dunkel)
```

## Veröffentlichung im App Store / Play Store

Für eine öffentliche Veröffentlichung brauchst du eine Datenschutzerklärung und musst angeben, welche Gesundheitsdaten die App nutzt. Für die private Nutzung ist das nicht nötig.
