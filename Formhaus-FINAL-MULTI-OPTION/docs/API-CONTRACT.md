# API contract

## POST `/api/generate-plan`

Request: Formhaus `Requirements` JSON.

Response:

```json
{
  "plans": ["FloorPlan option 1", "FloorPlan option 2", "FloorPlan option 3"],
  "generation": {
    "poolSize": 24,
    "returned": 3,
    "method": "latent sampling around learned neural sites/areas + joint partition + generic connectivity validation/ranking"
  }
}
```

Each plan contains canonical `rooms[]`, `doors[]`, plot metadata and `modelPrediction` metadata including:

- `candidateRank`
- `candidateScore`
- `candidateSeed`
- `latentStrength`
- `diversityFromBest`
- `candidateMetrics.allReachable`
- `candidateMetrics.reachableShare`
- `feasibility`
- `coverage`
- `structuredBoxes`

The API returns HTTP 422 when requested room slots exceed the learned 8-slot capacity.
