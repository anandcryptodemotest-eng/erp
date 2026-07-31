import type { PricingBasis } from "../context/types";
import type { PricingStrategy } from "../strategies";
import {
  areaStrategy,
  customStub,
  eachStrategy,
  formulaStub,
  volumeStrategy,
  weightStrategy,
} from "../strategies";

export class StrategyRegistry {
  private readonly map = new Map<PricingBasis, PricingStrategy>();

  register(strategy: PricingStrategy): this {
    this.map.set(strategy.basis, strategy);
    return this;
  }

  resolve(basis: PricingBasis): PricingStrategy {
    const s = this.map.get(basis);
    if (!s) throw new Error(`No pricing strategy registered for basis ${basis}`);
    return s;
  }
}

export function createDefaultRegistry(): StrategyRegistry {
  return new StrategyRegistry()
    .register(eachStrategy)
    .register(areaStrategy)
    .register(weightStrategy)
    .register(volumeStrategy)
    .register(formulaStub)
    .register(customStub);
}
