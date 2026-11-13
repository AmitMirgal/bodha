const GOAL =
	/\b(build|add|fix|implement|create|make|write|refactor|update|replace|remove|migrate|design)\b/i;
const CONSTRAINT =
	/\b(must|should|must not|should not|don't|do not|without|only|require[ds]?|constraint|acceptance|criteria|criterion|given|so that|ensure|never|always)\b/i;

export const CLEAR_SPEC_HEURISTIC =
	"Heuristic: the first prompt is at least 40 characters and mentions a goal verb (build, fix, implement, …) plus a constraint or acceptance word (must, should, require, acceptance, …).";

export function hasClearSpec(prompt: string): boolean {
	const text = prompt.trim();
	if (text.length < 40) {
		return false;
	}
	return GOAL.test(text) && CONSTRAINT.test(text);
}
