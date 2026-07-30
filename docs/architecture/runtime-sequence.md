# Runtime Sequence

```text
Host → Screen Controller → UIContext → Runtime → Widgets
```

1. Host loads published FORM (audience-filtered).
2. Screen Controller assembles UIContext from Host data + form layout.
3. Runtime renders layout, runs validate / collectPayload.
4. Screen Controller maps payload to Host.services (e.g. submit).

Runtime never builds UIContext. Widgets never call Host or REST.
