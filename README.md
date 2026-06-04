# Scrap Shelter v0.26.06.03.2048 - Immediate Tile Render Fix

Patch notes:
- Visible version updated to v0.26.06.03.2048.
- Board cells are now persistent DOM elements instead of being destroyed/recreated after every render.
- Successful placement paints occupied cells immediately before queue advancement, save, or log updates.
- Ghost preview is applied as a separate overlay after placed tile rendering so it cannot hide newly placed parts.
- Uses a versioned save key so older broken puzzle state will not overwrite this patch.

Test:
- Open Puzzle.
- Tap/click a valid preview location.
- The placed tiles should appear instantly, then the queue should advance.
