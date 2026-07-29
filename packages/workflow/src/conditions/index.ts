export type ConditionFn = (variables: Record<string, unknown>, entity?: Record<string, unknown>) => boolean;

const builtins: Record<string, ConditionFn> = {
  always: () => true,
  never: () => false,
  shortage: (vars, entity) => {
    if (typeof vars.shortage === "boolean") return vars.shortage;
    if (typeof vars.procurementRequired === "boolean") return vars.procurementRequired;
    const items = (entity?.items ?? vars.items) as { shortageQty?: number }[] | undefined;
    if (Array.isArray(items)) return items.some((i) => (i.shortageQty ?? 0) > 0);
    return false;
  },
};

export class ConditionRegistry {
  private conditions = new Map<string, ConditionFn>(Object.entries(builtins));

  register(key: string, fn: ConditionFn): void {
    this.conditions.set(key, fn);
  }

  has(key: string): boolean {
    return this.conditions.has(key);
  }

  keys(): string[] {
    return [...this.conditions.keys()];
  }

  evaluate(
    key: string | undefined,
    variables: Record<string, unknown>,
    entity?: Record<string, unknown>
  ): boolean {
    if (!key) return true;
    const fn = this.conditions.get(key);
    if (!fn) return false;
    return fn(variables, entity);
  }
}

export const defaultConditionRegistry = new ConditionRegistry();
