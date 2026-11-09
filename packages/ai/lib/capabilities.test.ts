import { describe, expect, it } from "vitest";
import {
	describeUnsupported,
	documentedCapabilitiesFor,
	requireTools,
} from "./capabilities";
import { MATI_PROVIDERS } from "./providers";

describe("documented provider capabilities", () => {
	it("returns a matrix for each of the five providers and no others", () => {
		for (const id of MATI_PROVIDERS) {
			const capabilities = documentedCapabilitiesFor(id);
			expect(requireTools(capabilities)).toMatch(
				/supported|unsupported|unknown/
			);
		}
		expect(() => documentedCapabilitiesFor("openrouter")).toThrow(
			/Unknown provider/
		);
	});

	it("surfaces Sarvam usage as not guaranteed", () => {
		const gaps = describeUnsupported(documentedCapabilitiesFor("sarvam"));
		expect(gaps.some((line) => /not reported by provider/i.test(line))).toBe(
			true
		);
	});
});
