---
Task ID: 1
Agent: main
Task: Fix crash by making store.ts more robust for old localStorage data

Work Log:
- Added validateFamily() function that validates and sanitizes family objects from localStorage
- Made loadData() validate all families and clean corrupted data, auto-saving cleaned version
- Made getSettings() more defensive with type checking for each field
- Added proper error handling with localStorage.removeItem() for corrupted data
- Removed seedDemoData() function that was no longer needed

Stage Summary:
- store.ts is now resilient to any shape of localStorage data
- Corrupted or incompatible data is automatically cleaned up
- App won't crash even with malformed localStorage entries

---
Task ID: 2
Agent: main
Task: Remove Switch from main screen header, replace with status badge

Work Log:
- Removed Switch component from the header auto-reset section
- When auto-reset is on: shows emerald badge with Zap icon, "تلقائي" text, and reset day name
- When auto-reset is off: shows red "تصفير" button only (no switch)
- Auto-reset toggle is now only accessible through the Settings dialog

Stage Summary:
- Header no longer has a Switch component
- Clean status indicator replaces the switch
- Toggle functionality moved entirely to Settings dialog

---
Task ID: 3-4
Agent: main
Task: Add toast notifications and replace alert/confirm with styled dialogs

Work Log:
- Created Toast notification system with 4 types: success, error, warning, info
- Toasts appear at top-center with animated slide-in, auto-dismiss after 3s
- Each toast type has distinct colors matching the app's design (emerald, red, amber, cyan)
- Created custom Confirm Dialog replacing browser confirm()
- Confirm dialog has 3 variants: danger (red), warning (amber), info (cyan)
- Replaced all alert() calls with showToast('error', ...)
- Replaced all confirm() calls with showConfirm() custom dialog
- Added toast messages for all user actions:
  - Adding family, deleting family, editing family
  - Starting/stopping sessions
  - Resetting weekly usage, resetting all counters
  - Saving settings, resetting settings
  - Auto-reset notifications
  - PWA installation

Stage Summary:
- No more browser alert() or confirm() dialogs
- All feedback uses styled, app-consistent toasts and dialogs
- Toast notifications with auto-dismiss and manual close
- Custom confirmation dialogs with appropriate styling per action type
