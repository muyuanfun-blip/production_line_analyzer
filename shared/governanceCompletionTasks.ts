export function shouldCreateHighFrequencyCompletionTask(input: { frequencyCount: number; threshold: number; hasActiveTask: boolean }) {
  return input.frequencyCount >= input.threshold && !input.hasActiveTask;
}

export function nextTaskStatusForManualDecision(decision: "approved" | "returned" | "closed") {
  return decision === "returned" ? "pending" : decision;
}
