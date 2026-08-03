import type { FieldValues } from "react-hook-form";
import type { StudioStepDefinition } from "../core/types";

export type StudioRegistry<T extends FieldValues = FieldValues> = {
  steps: StudioStepDefinition<T>[];
};

class RegistryBuilder<T extends FieldValues> {
  private readonly _steps: StudioStepDefinition<T>[] = [];

  step(def: StudioStepDefinition<T>): this {
    this._steps.push(def);
    return this;
  }

  build(): StudioRegistry<T> {
    return { steps: [...this._steps] };
  }
}

/** Fluent, immutable step registry. Order = registration order. */
export function createStudioRegistry<T extends FieldValues = FieldValues>() {
  return new RegistryBuilder<T>();
}
