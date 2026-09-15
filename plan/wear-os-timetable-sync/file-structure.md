# Final relevant structure

```text
bunkialo2/
├── plan/wear-os-timetable-sync/
│   ├── summary.md
│   └── file-structure.md
├── modules/wear-timetable/
│   ├── android/build.gradle
│   ├── android/src/main/java/expo/modules/weartimetable/WearTimetableModule.kt
│   ├── expo-module.config.json
│   ├── index.ts
│   └── package.json
├── shared/wear-timetable.ts
├── src/components/timetable/wear-timetable-modal.tsx
├── src/services/wear-timetable.ts
├── src/stores/wear-timetable-store.ts
├── wear-os/
│   ├── app/src/main/java/com/codialo/bunkialo/schedule/Timetable.kt
│   ├── app/src/main/java/com/codialo/bunkialo/schedule/WearTimetableRepository.kt
│   ├── app/src/main/java/com/codialo/bunkialo/schedule/WearTimetableDataService.kt
│   ├── app/src/main/java/com/codialo/bunkialo/presentation/MainActivity.kt
│   └── ...
└── src/app/(tabs)/timetable.tsx
```

The Wear project remains an independent Gradle application inside the Bunkialo repository. Generated Android folders, IDE state, local properties, and build output stay untracked.
