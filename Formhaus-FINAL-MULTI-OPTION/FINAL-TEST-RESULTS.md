# Final test results — multi-option build

## Backend

`pytest -q` → **10 passed**

Coverage includes:

- model health/checkpoint load
- extended room types
- third bedroom + parking + pooja
- explicit 8-slot capacity limit
- 12×20 compact-plot prediction
- exact physical-size conditioning
- exhaustive zero-overlap joint partition
- geometry-supported wall openings
- three distinct ranked alternatives
- entrance-to-every-room accessibility for every returned option

## Multi-option 30×45 example

One 3-BHK + Parking + Pooja request returned three distinct candidates with approximately:

- Option 1: score 99.5, all rooms reachable
- Option 2: score 99.0, all rooms reachable
- Option 3: score 98.9, all rooms reachable

All have 100% assigned area and zero partition overlap.

## Frontend source

TypeScript transpile/syntax verification → **24 TS/TSX files parsed, 0 syntax errors**.

A full `npm run build` could not complete in this environment because `npm ci` timed out and left incomplete package directories. Run `npm install` on the target Windows machine before `npm run dev` / `npm run build`.
