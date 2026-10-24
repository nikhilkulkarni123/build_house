# Training / inference provenance

The runtime checkpoint remains the validated physical-size-aware structured neural model distilled from the supplied epoch-9 DoorFloorNet teacher. This multi-option release does **not** claim a newly retrained generative latent model.

Instead, alternative generation samples small room-type-agnostic latent perturbations around the checkpoint's learned room sites and areas, then uses the same generic joint-partition decoder for every sample. This preserves the learned layout signal while producing distinct candidates without semantic placement rules.

The candidate pool is ranked only after generation. Ranking/validation does not relocate rooms.

## Runtime candidate pool

- base neural prediction + stochastic variants
- 24 candidates sampled per request
- top 3 distinct candidates returned
- zero-gap / zero-overlap joint partition for each candidate
- generic shared-wall connectivity graph
- learned adjacency probabilities contribute to opening selection
- actual entrance-to-every-room reachability measured before ranking

## Known limitations

- maximum 8 requested learned room slots
- Parking/Pooja use proxy teacher semantics because the supplied DoorFloorNet teacher has no native Parking/Pooja class
- windows are not learned outputs of the checkpoint
- compact plots can yield infeasible room sizes; Formhaus reports them instead of silently resizing the learned geometry
