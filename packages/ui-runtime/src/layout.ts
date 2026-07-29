import type { ReactNode } from "react";
import type { UIRuntime } from "./types";
import { getWidget } from "./registry";
import { normalizeScreenDefinition } from "./screen";

export function renderScreenLayout(runtime: UIRuntime): ReactNode[] {
  const screen = normalizeScreenDefinition(runtime.context.screen);
  const nodes: ReactNode[] = [];
  const sections = screen.sections?.length
    ? screen.sections
    : [{ widgets: screen.layout ?? [] }];

  for (const section of sections) {
    for (const ref of section.widgets) {
      const reg = getWidget(ref.widget);
      if (!reg) {
        nodes.push(
          // string node for missing widget — host may style
          `Missing widget: ${ref.widget}` as unknown as ReactNode
        );
        continue;
      }
      const widget = reg.factory();
      nodes.push(widget.render(runtime, ref.props ?? {}));
    }
  }
  return nodes;
}
