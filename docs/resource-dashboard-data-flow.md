# Cloud resource dashboard data flow

The cloud `/resources` page renders `ResourcePanel` and `DistributionPanel`.
This note maps their live requests to the current backend routes so an operator
can distinguish a data problem from a display problem.

## Inventory and usage panel

`ResourcePanel.js` starts in live mode. Its mock-data toggle is a demonstration
mode; mock values do not confirm that the backend or database is healthy.
In live mode the panel requests these endpoints in parallel:

| Request | Displayed purpose |
| --- | --- |
| `GET /api/resources/inventory?page=0&limit=100` | Inventory rows; optional `category` and `status` filters come from the panel. |
| `GET /api/resources/resource-summary` | Headline inventory totals. |
| `GET /api/resources/usage-timeline?days=30` | Recent consumption chart. |
| `GET /api/resources/predictions?limit=10` | Prediction list. |
| `GET /api/resources/categories` | Category choices for filtering. |

The inventory request is the required request in the current frontend: if it
fails, the panel enters its error state and clears the displayed live data.
The route definitions live in
`cloud-platform/backend/src/routers/resources.routes.js`.

## Distribution panel

`DistributionPanel.js` requests
`GET /api/resources/distribution/plan?days=7` and
`GET /api/resources/distribution/rates`. The plan is based on the live camp
roster and registration history; the rates endpoint exposes the table and
provenance used for the daily food and drinking-water calculation. The
controller limits the plan horizon to 1–30 days.

## Stock outlook endpoint

The separate `GET /api/resources/stock/outlook` endpoint combines the resource
inventory with population history to calculate days of cover, runout dates,
reorder dates, and suggested quantities. Its `days` query is bounded to 7–90
days. `GET /api/resources/stock/alerts` returns the actionable low and critical
items from that outlook. These routes are defined independently of the two
panels on `/resources`.

## Quick verification

1. Select live mode in the inventory panel and check the five requests above
   in the browser network tab. A populated mock view is not evidence of live
   inventory.
2. Compare an inventory row with the JSON from `/api/resources/inventory`.
   If the JSON is present but the row is missing, inspect the category and
   status filters in the UI.
3. Compare the distribution panel with the plan and rates JSON. Check the
   `source` and `generated_at` fields before treating a forecast as current.
4. Check the stock outlook endpoint separately when investigating a reorder
   date; the frontend formats the dates returned by the backend.
