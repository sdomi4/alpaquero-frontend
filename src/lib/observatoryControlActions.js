/**
 * @typedef {'startup' | 'shutdown' | 'emergency_halt'} ObservatoryAction
 * @typedef {{
 *   runSequence: (sequenceName: string) => Promise<unknown>,
 *   runObservatoryAction: (action: ObservatoryAction) => Promise<unknown>
 * }} ObservatoryControlActionDeps
 */

/** @type {ReadonlySet<ObservatoryAction>} */
const SEQUENCE_OBSERVATORY_ACTIONS = new Set(['startup', 'shutdown']);

/**
 * @param {ObservatoryAction} action
 * @param {ObservatoryControlActionDeps} deps
 */
export function runObservatoryControlAction(action, deps) {
	if (SEQUENCE_OBSERVATORY_ACTIONS.has(action)) {
		return deps.runSequence(action);
	}

	return deps.runObservatoryAction(action);
}
