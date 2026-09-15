# Wear OS timetable source and phone editing

## Goal

Make the Wear OS app use its built-in timetable template by default while allowing the phone app to send either the current account timetable or a manually configured timetable. Add a reliable reset-to-template action and an Edit on phone action.

## Requirements

- Keep the built-in Wear timetable as the default and offline fallback.
- Persist the selected source and the latest received timetable on the watch.
- Offer Template, Current account, and Manual timetable sources from the phone flow.
- Open the phone timetable screen from the watch through a browsable deep link.
- Send only display timetable data over the Wear OS Data Layer.
- Reset the watch to the exact built-in template without affecting phone data.
- Keep LMS credentials, attendance records, and session cookies off the watch.

## Approaches considered

### Phone-to-watch Data Layer

Pros: fast nearby sync, offline cache, no server credentials on the watch, and a natural companion-app model.

Cons: requires a small native bridge in the Expo app and the watch can be stale while the phone is unavailable.

### Cloud-backed timetable

Pros: works without the phone nearby and supports multiple devices.

Cons: requires new authenticated server storage, pairing, conflict handling, and additional privacy/security surface.

## Chosen approach

Use the phone-to-watch Data Layer for normal synchronization. The watch keeps the built-in template as its initial state and fallback. The phone remains the source of truth for account-derived and manually edited timetable data.

## Main implementation steps

1. Define a small JSON timetable payload shared by the TypeScript and Kotlin implementations.
2. Add a local Wear timetable repository with template, account, and manual sources.
3. Add Wear actions for Edit on phone, source selection, and reset to template.
4. Add an Expo native module that sends the selected payload through `DataClient`.
5. Add a phone-side Wear settings modal using the existing generated/manual timetable.
6. Add a phone deep-link route into the timetable screen.
7. Build/type-check and inspect Git scope before committing.
