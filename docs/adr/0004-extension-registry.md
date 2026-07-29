# ADR 0004: Extension Registry

## Context

Widgets, activities, themes, validators, integrations must grow without editing core packages.

## Decision

In-process Extension Registry with `ExtensionManifest` and `register*` / `list` / `get`. Widgets, activities, and themes register at bootstrap. Dynamic marketplace loading is deferred.

## Consequences

`registerWidget` / `registerActivity` / `registerTheme` prove extensibility; fitness tests forbid hardcoded switches.

## Alternatives

Hardcoded maps in engine (rejected); OSGi-style dynamic load in v1 (deferred — premature).
