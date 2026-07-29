import {
  registerExtension,
  listExtensions,
  getExtension,
  type ExtensionManifest,
} from "@erp/extensions";
import type { RegisteredWidget, WidgetFactory, WidgetManifest } from "./types";

export function registerWidget(input: {
  manifest: WidgetManifest;
  factory: WidgetFactory;
}): void {
  const manifest: ExtensionManifest = {
    id: input.manifest.id,
    name: input.manifest.displayName,
    version: input.manifest.version ?? "1.0.0",
    type: "widget",
  };
  registerExtension(manifest, {
    manifest: input.manifest,
    factory: input.factory,
  } satisfies RegisteredWidget);
}

export function getWidget(id: string): RegisteredWidget | undefined {
  return getExtension<RegisteredWidget>("widget", id)?.implementation;
}

export function listWidgets(): RegisteredWidget[] {
  return listExtensions<RegisteredWidget>("widget").map((r) => r.implementation);
}

export function listWidgetManifests(): WidgetManifest[] {
  return listWidgets().map((w) => w.manifest);
}
