# Verification

Run backend tests:

```powershell
cd backend
pytest -q
```

Expected for this frozen build: `10 passed`.

Core invariants checked:

- 3 alternatives are returned for a normal request
- alternatives are geometrically distinct
- ranking scores are descending
- every returned normal-size option is reachable from `outside`
- rooms + passage exactly conserve plot area
- no overlap/residual is introduced by the joint partition
- 12×20 compact plots are predicted and feasibility-labelled
- requests over 8 learned room slots are rejected clearly
