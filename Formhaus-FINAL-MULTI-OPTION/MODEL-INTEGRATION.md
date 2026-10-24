# Final model integration

## Generator

The bundled checkpoint `backend/formhaus_final_model.pt` predicts normalized room sites/areas plus passage/connectivity signals from the exact plot width, length, entrance, and requested room tokens.

For every API request the backend:

1. runs the checkpoint once for the base neural prediction;
2. generates 24 room-type-agnostic latent samples around learned sites and areas;
3. converts each sample into a zero-gap / zero-overlap orthogonal joint partition;
4. builds a physical shared-wall graph;
5. combines learned adjacency probabilities with shared-wall geometry to choose valid openings;
6. checks entrance-to-room reachability and compact-plot feasibility;
7. ranks candidates and removes near-duplicates;
8. returns the top 3 alternatives.

No room type has a preferred side, row, coordinate, or handwritten adjacency template.

## 2D / 3D synchronization

`rooms[]` and `doors[]` in the selected `FloorPlan` are the canonical geometry. Both `PlanSVG` and the Three.js scene consume those same coordinates, so switching alternatives changes both representations without regeneration.
