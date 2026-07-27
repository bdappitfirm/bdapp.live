
# Fix Teachers Page Save Hanging and Dashboard Timeout

## 1. Teachers Page Save Fix
- Reorder steps in `handleUpdateTeacher`: close dialog, reset state, and set saving to false FIRST, then call loadAssignments in background so interface doesn't hang
- Add better error handling with toasts for each step

## 2. Dashboard Stats Timeout Fix
- Increase timeout in `getDashboardStats` from 15s to 30s
- Make sure prefetch doesn't cause issues
- Handle errors even better
