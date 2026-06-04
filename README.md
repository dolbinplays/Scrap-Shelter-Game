# Scrap Shelter v0.26.06.03.1730 - Stage 1 Prototype

## What this build proves
This is the first playable loop for Scrap Shelter:

1. Play the block-placement salvage puzzle.
2. Clear rows/columns to recover Scrap, Gears, Wiring, and Batteries.
3. Spend those parts to repair or upgrade Workshop, Generator, and Water Filter rooms.
4. Rooms wear down as in-game time advances.
5. Puzzle play remains the recovery path if the base deteriorates.

## Roadmap updates rolled in
- Rewarded ads should be the primary monetization model once the loop is proven.
- Banner ads should be light and limited to the base screen, with a future ad-removal/supporter option.
- Forced ads and aggressive app-open ads should be avoided during early retention testing.
- The prototype includes ad-placement placeholders only; no real ads are integrated yet.
- Polish priorities for the store version: portrait UI, tactile puzzle feedback, clear room condition states, save stability, and readable icons.

## Controls
- Base: repair or upgrade rooms, then play the puzzle for more salvage.
- Puzzle: select one of the three part shapes, then tap a board cell to place it.
- Completed rows and columns clear and award resources.
- Claim Salvage returns to the base and advances time by 12 hours.

## Technical notes
- Single-file HTML/CSS/JS prototype.
- Uses localStorage for save data.
- Designed as a web prototype that can later be rebuilt in GDevelop or wrapped for Android testing.
