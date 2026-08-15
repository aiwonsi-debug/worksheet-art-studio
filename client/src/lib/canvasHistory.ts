export function historyControlAvailability(historyLength: number, futureLength: number) {
  return {
    canUndo: historyLength > 0,
    canRedo: futureLength > 0,
  };
}
