# Formhaus — FINAL Multi-Option Joint Partition

This is the final project build that returns **three distinct AI-generated floor-plan alternatives from one request**.

## Runtime generation

`requirements → neural room sites/areas → 24 latent samples → joint partition → physical shared-wall connectivity → rank/deduplicate → top 3 options → 2D + 3D`

The runtime has **no room-type placement template**. There is no code such as “kitchen goes north”, “parking goes bottom-left”, or a fixed bedroom corridor. Candidate variation is generic latent perturbation around the neural model's learned sites and areas. A generic partition layer fills the whole plot, and a generic shared-wall graph creates physically valid openings.

## What one request returns

- Option 1 — best-ranked learned layout
- Option 2 — structurally different learned alternative
- Option 3 — structurally different learned alternative

The 2D page shows all three as selectable thumbnails. The selected option is also used by the 3D viewer, where Option 1/2/3 can be switched directly.

## Supported requirements

- Plot sides: 12–100 ft
- 1–3 bedrooms
- 1–3 bathrooms, subject to the 8 requested-room-slot model limit
- Living room
- Kitchen
- Master / second / third bedroom
- Bathroom
- Balcony/open space
- Study
- Utility
- Parking
- Pooja
- North / South / East / West entrance

Passage is generated as an additional joint-partition leaf and does not consume one of the 8 requested-room slots.

## Candidate validation and ranking

Each sampled candidate is evaluated without moving its rooms. Ranking considers:

- entrance-to-every-room reachability through actual wall openings
- compact-plot feasibility
- room compactness/aspect quality
- passage width
- entrance availability

The backend samples 24 candidates, removes near-duplicates and returns the top 3 distinct layouts. The joint partition has 100% assigned plot area and 0% overlap/residual by construction.

## Verification bundled with this build

- Backend tests: **10/10 passed**
- Multi-option response: **3 distinct ranked layouts**
- Returned normal-size layouts: **all rooms reachable from outside**
- Frontend TS/TSX syntax parse: **24 files, 0 syntax errors**
- 12×20 compact plot: predictions are returned; impractical room sizes are surfaced instead of rule-resized

A complete Vite production build still requires `npm install` on an internet-connected machine because dependency installation in the build environment timed out.

## Start on Windows

See `RUN-WINDOWS.md`.

## Important limitation

Parking and pooja are learned proxy-supervised tokens because the supplied DoorFloorNet teacher did not contain native parking/pooja classes. Windows are not learned outputs of this checkpoint and are not fabricated by the backend.
