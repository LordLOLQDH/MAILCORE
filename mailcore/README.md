# MAILCORE 0.4.0 — Live Chat

MAILCORE ist jetzt ein browserbasierter Live-Messenger. Das Frontend wird über GitHub Pages ausgeliefert, Authentifizierung, Profile, Chats und Nachrichten liegen im bestehenden Supabase-Projekt **KDS-AI-v1**.

## Live-Seite

https://lordlolqdh.github.io/mailcore/

## Version 0.4.0\n\n- Einheitliches helles Weiß-Blau-Design mit versionierten Assets gegen Browser-Cache-Probleme\n- Stabilerer App-Start und Schutz vor doppelter Anmeldung/Initialisierung\n- Sichtbare Fehlermeldungen bei Backend-, Chat- und Nachrichtenproblemen\n- Überarbeitete Chat- und Nutzersuche sowie mobile Navigation\n\n## Version 0.4.0\n\n- Google-OAuth-Schaltfläche ergänzt (Google-Anbieter muss in Supabase konfiguriert werden)\n- Mobile Seitenleiste lässt sich über X, erneuten Menü-Klick, Klick auf den abgedunkelten Hintergrund oder Escape schließen\n\n## Funktionen

- Registrierung und Anmeldung mit E-Mail und Passwort
- Nutzerprofile mit automatisch erzeugtem MAILCORE-Benutzernamen
- Suche nach MAILCORE-Benutzernamen
- Direkte Einzelchats
- Live-Nachrichten über Supabase Realtime
- Serverseitig gespeicherter Chatverlauf
- Gelesen-Status und Chatliste mit letzter Nachricht
- Responsives, helles Weiß-Blau-Design

## Backend

Verwendetes Supabase-Projekt: `eopvkwhcgznvubesaszv` (KDS-AI-v1).

MAILCORE verwendet ausschließlich eigene Tabellen und Funktionen:

- `mailcore_profiles`
- `mailcore_conversations`
- `mailcore_participants`
- `mailcore_messages`
- RPC: `mailcore_create_direct_chat(uuid)`

Row Level Security ist für alle MAILCORE-Tabellen aktiviert. Nutzer können nur Unterhaltungen und Nachrichten lesen, an denen sie beteiligt sind. Die Realtime-Veröffentlichung ist für `mailcore_messages` aktiviert.

Das Frontend nutzt den öffentlichen Supabase Publishable Key. Ein Service-Role-Key wird niemals im Browser verwendet.

## Einrichtung in Supabase Auth

In Supabase unter **Authentication → URL Configuration**:

- Site URL: `https://lordlolqdh.github.io`
- Redirect URL: `https://lordlolqdh.github.io/**`

E-Mail-Bestätigungen sind eine Supabase-Auth-Einstellung. Wenn sie aktiviert sind, muss ein neuer Nutzer nach der Registrierung den Bestätigungslink aus seiner E-Mail öffnen, bevor er sich anmelden kann.

## Grenzen

MAILCORE ist ein interner Messenger. Es versendet keine E-Mails an Gmail, Outlook oder andere externe Maildienste. Die Verfügbarkeit hängt von den Limits und dem Betriebsstatus des verwendeten Supabase-Tarifs ab.
