import type { WorkflowDefinition } from "../types/definition";
import type { ConditionRegistry } from "../conditions";
import { evaluateReadiness, type TerminalStatus } from "../engine/evaluate";

export interface SimulationStep {
  readyKeys: string[];
  waitingKeys: string[];
  skippedKeys: string[];
  completedKey?: string;
  variables: Record<string, unknown>;
}

/**
 * Dry-run the graph: BA steps through READY activities without touching live entities.
 */
export function* simulateWorkflow(
  def: WorkflowDefinition,
  conditions: ConditionRegistry,
  initialVariables: Record<string, unknown> = {},
  entity?: Record<string, unknown>
): Generator<SimulationStep, SimulationStep, { completeKey: string; variablesPatch?: Record<string, unknown> } | undefined> {
  const terminal: Record<string, TerminalStatus> = {};
  let variables = { ...initialVariables, ...(def.variableDefaults ?? {}) };

  let state = evaluateReadiness(def, terminal, variables, conditions, entity);
  let input = yield {
    ...state,
    variables: { ...variables },
  };

  while (state.readyKeys.length > 0 || Object.keys(terminal).length < def.activities.length) {
    // Auto-mark skipped as terminal
    for (const k of state.skippedKeys) {
      if (!terminal[k]) terminal[k] = "SKIPPED";
    }

    if (!input?.completeKey) {
      state = evaluateReadiness(def, terminal, variables, conditions, entity);
      if (state.readyKeys.length === 0 && state.skippedKeys.every((k) => terminal[k])) {
        return { ...state, variables: { ...variables } };
      }
      input = yield { ...state, variables: { ...variables } };
      continue;
    }

    const key = input.completeKey;
    if (!state.readyKeys.includes(key) && !state.skippedKeys.includes(key)) {
      input = yield {
        ...state,
        variables: { ...variables },
        completedKey: undefined,
      };
      continue;
    }

    if (input.variablesPatch) {
      variables = { ...variables, ...input.variablesPatch };
    }
    terminal[key] = "COMPLETED";
    state = evaluateReadiness(def, terminal, variables, conditions, entity);
    for (const k of state.skippedKeys) {
      if (!terminal[k]) terminal[k] = "SKIPPED";
    }
    state = evaluateReadiness(def, terminal, variables, conditions, entity);

    const done =
      def.activities.every((a) => terminal[a.key]) ||
      (state.readyKeys.length === 0 &&
        state.waitingKeys.every((k) => {
          const act = def.activities.find((a) => a.key === k);
          return act?.optional;
        }));

    input = yield {
      ...state,
      completedKey: key,
      variables: { ...variables },
    };

    if (done && state.readyKeys.length === 0) {
      return { ...state, variables: { ...variables }, completedKey: key };
    }
  }

  return { ...state, variables: { ...variables } };
}
