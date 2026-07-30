# ADR 0011: Host API Contract

**Status:** Approved (Frozen — Platform v1.2)  
**Gate level:** L2 Core Platform  
**Depends on:** ADR 0010 Multi-Host Runtime

## Context

Hosts differ in operations (Customer submit, Warehouse scanner, Driver camera, Vendor download). A mandatory `submit()` on every Host would force unused surface area or premature abstraction.

## Decision

A Host is a **collection of providers and optional services**:

```ts
interface Host {
  id: string;
  screenController: ScreenController;
  permissions: PermissionProvider;
  navigation: NavigationProvider;
  theme: ThemeProvider;
  services: {
    submit?: (payload: Record<string, unknown>) => Promise<void>;
    upload?: (file: File) => Promise<unknown>;
    open?: (ref: string) => void;
    download?: (ref: string) => Promise<void>;
    print?: (ref: string) => void;
  };
}
```

## Dependency rule

```text
Widgets → Runtime → Host APIs → Host
```

**Never** `Widget → Host`. Widgets must not import host modules. They reach host capabilities only through runtime `hostApis` / Host services facade wired by the Screen Controller.

## Consequences

- Host capabilities grow without changing the Widget interface.
- Screen Controller maps `Host.services` into `UIContext.hostApis` as needed.
- Future services (scanner, camera, map) are additive optional keys.

## Related

- [0010 Multi-Host Runtime](./0010-multi-host-runtime.md)
- [0005 Screen Controller](./0005-screen-controller.md)
