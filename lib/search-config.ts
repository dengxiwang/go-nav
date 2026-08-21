export const DEFAULT_ENGINE_SELECTOR_WIDTH = 120;
export const MIN_ENGINE_SELECTOR_WIDTH = 100;
export const MAX_ENGINE_SELECTOR_WIDTH = 240;

export function resolveEngineSelectorWidth(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return DEFAULT_ENGINE_SELECTOR_WIDTH;
	}

	return Math.min(
		MAX_ENGINE_SELECTOR_WIDTH,
		Math.max(MIN_ENGINE_SELECTOR_WIDTH, Math.round(value)),
	);
}
