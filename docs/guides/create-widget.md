# Create a widget

1. Implement `Widget` (`render` / `validate` / `collectPayload`) using only `UIRuntime`.
2. Export a `WidgetManifest` (`id`, `category`, `displayName`, `icon`, flags).
3. Call `registerWidget({ manifest, factory })` at app bootstrap.
4. Do not import sales/inventory API clients inside the widget.

See `@erp/ui-runtime` and Platform Architecture v1.0.
