# Web Native Tab Navigation

## Goal

Use the same `MaterialTopTabNavigator` on web and native while keeping the web
sidebar on desktop and bottom navigation on smaller screens.

## Approach

The web layout will render a custom responsive navigation chrome outside the
native navigator. The navigator will render the tab screens and own horizontal
swipe handling on web. Its `swipeEnabled` value will use the existing gesture
store so mess and timetable carousels can temporarily take priority.

## Tradeoffs

- Pros: one tab swipe implementation, native and web route state stay aligned,
  and the existing responsive web navigation remains visible.
- Cons: the web navigation buttons stay separate from the navigator's built-in
  tab bar and must continue to map route names to links.
