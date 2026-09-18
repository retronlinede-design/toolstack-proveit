export function getStrategiesForGoal(strategies = [], goalId = "") {
  if (!goalId) return [];
  return (Array.isArray(strategies) ? strategies : []).filter((strategy) => Array.isArray(strategy?.goalIds) && strategy.goalIds.includes(goalId));
}
