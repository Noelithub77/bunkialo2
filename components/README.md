# Components Organization

Components are organized by the tab they belong to:

## Directory Structure

```
components/
├── dashboard/          # Components used in Dashboard tab
│   ├── event-card.tsx
│   ├── timeline-section.tsx
│   └── index.ts
├── attendance/         # Components used in Attendance tab (includes bunk management)
│   ├── add-bunk-modal.tsx
│   ├── attendance-card.tsx
│   ├── course-edit-modal.tsx
│   ├── dl-input-modal.tsx
│   ├── duty-leave-modal.tsx
│   ├── presence-input-modal.tsx
│   ├── swipeable-attendance-slot.tsx
│   ├── swipeable-bunk-item.tsx
│   ├── total-absence-calendar.tsx
│   ├── unified-course-card.tsx
│   ├── unknown-status-modal.tsx
│   └── index.ts
├── timetable/          # Components used in Timetable tab
│   ├── day-schedule.tsx
│   ├── day-selector.tsx
│   ├── upnext-carousel.tsx
│   └── index.ts
├── faculty/            # Components used in Faculty tab
│   ├── faculty-card.tsx
│   └── index.ts
├── mess/              # Components used in Mess tab
│   ├── day-meals.tsx
│   ├── meal-carousel.tsx
│   ├── meal-day-selector.tsx
│   └── index.ts
├── shared/            # Shared components used across multiple tabs
│   ├── confirm-modal.tsx
│   ├── external-link.tsx
│   ├── haptic-tab.tsx
│   ├── logs-section.tsx
│   ├── current-class-card.tsx
│   └── index.ts
├── ui/                # Base UI components
│   ├── button.tsx
│   ├── collapsible.tsx
│   ├── container.tsx
│   ├── gradient-card.tsx
│   ├── input.tsx
│   ├── loading.tsx
│   ├── pressable-card.tsx
│   └── index.ts
├── modals/            # All modal components re-exported
│   └── index.ts
├── themed-text.tsx    # Theme components (kept at root)
├── themed-view.tsx    # Theme components (kept at root)
├── index.ts           # Main export file
└── README.md
```

## Import Guidelines

1. **Tab-specific imports**: Import directly from the tab's directory

   ```tsx
   import { EventCard } from "@/components/dashboard";
   ```

2. **Shared components**: Import from shared directory

   ```tsx
   import { ConfirmModal } from "@/components/shared";
   ```

3. **UI components**: Import from ui directory

   ```tsx
   import { Button } from "@/components/ui";
   ```

4. **Convenience imports**: Use the main index for multiple imports
   ```tsx
   import { EventCard, TimelineSection, Button } from "@/components";
   ```

## Notes

- Bunk management functionality is part of the `attendance` directory as it's accessed from the Attendance tab
- Modal components are re-exported from the `modals` directory for convenience
- Theme components (`themed-text.tsx`, `themed-view.tsx`) remain at the root as they're fundamental utilities
