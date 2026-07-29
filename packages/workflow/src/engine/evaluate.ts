import type { WorkflowDefinition } from "../types/definition";
import { incoming } from "../graph";
import type { ConditionRegistry } from "../conditions";

export type TerminalStatus = "COMPLETED" | "SKIPPED" | "CANCELLED";

export interface EvaluateGraphResult {
  readyKeys: string[];
  waitingKeys: string[];
  skippedKeys: string[];
}

/**
 * Pure readiness evaluation against completed terminal keys + variables.
 * Used by Simulation and Runtime (runtime persists WAITING/READY transitions).
 */
export function evaluateReadiness(
  def: WorkflowDefinition,
  terminalByKey: Record<string, TerminalStatus>,
  variables: Record<string, unknown>,
  conditions: ConditionRegistry,
  entity?: Record<string, unknown>
): EvaluateGraphResult {
  const readyKeys: string[] = [];
  const waitingKeys: string[] = [];
  const skippedKeys: string[] = [];

  for (const activity of def.activities) {
    if (terminalByKey[activity.key]) continue;

    const deps = incoming(def, activity.key);
    const depsMet = deps.every((e) => {
      const st = terminalByKey[e.from];
      if (!st) return false;
      if (e.on === "CANCEL") return st === "CANCELLED";
      return st === "COMPLETED" || st === "SKIPPED";
    });

    if (!depsMet) {
      waitingKeys.push(activity.key);
      continue;
    }

    const condOk = conditions.evaluate(activity.condition, variables, entity);
    if (activity.optional && !condOk) {
      skippedKeys.push(activity.key);
      continue;
    }
    if (!activity.optional && activity.condition && !condOk) {
      waitingKeys.push(activity.key);
      continue;
    }

    readyKeys.push(activity.key);
  }

  return { readyKeys, waitingKeys, skippedKeys };
}
