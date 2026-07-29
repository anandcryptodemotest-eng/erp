# Platform KPIs

Track at sprint review / architecture board.

| KPI | Target |
|-----|--------|
| Runtime paths | **1** (no hybrid for new work) |
| Metadata resolution paths | **1** |
| Screen rendering paths | **1** (Screen Controller → UI Runtime) |
| Legacy compatibility branches | Decreasing every sprint |
| Widgets requiring domain imports | **0** |
| Core changes required for new feature | **0** |
| Extension registrations | Increasing |
| Architecture fitness violations | **0** (`pnpm arch:fitness`) |

## How to measure

- Runtime: new SO must create `WorkflowInstance.snapshot` via `startSalesOrderWorkflowV5` only.
- Screens: OMS must not use live `STEP_UI_REGISTRY` fallbacks; UI Runtime + AssetRef only.
- Fitness: CI runs `pnpm arch:fitness`.
