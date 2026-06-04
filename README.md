# Scrap Shelter v0.26.06.03.1936 — Queue Render + Tap Fix

Patch notes:
- Updated visible version label.
- Reworked puzzle board placement to use one centralized board pointer/click handler.
- Added click fallback for devices that do not reliably dispatch pointerdown.
- Added queue step numbers to Place Now and Preview pieces so it is obvious when the queue advances.
- Added a queue panel freshness check after placement.

Test focus:
1. Open Puzzle.
2. Note Place now #1 and Preview #2/#3.
3. Tap/click a valid board anchor.
4. Confirm the active slot advances to Place now #2 and the preview slots update.
