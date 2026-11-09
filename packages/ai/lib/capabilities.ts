import type { CapabilityStatus, ProviderCapabilities } from "./provider-types";
import { describeCapabilityGaps, requireMatiProvider } from "./providers";

export function requireTools(
	capabilities: ProviderCapabilities
): CapabilityStatus {
	return capabilities.tools;
}

export function describeUnsupported(
	capabilities: ProviderCapabilities
): string[] {
	return describeCapabilityGaps(capabilities);
}

export function documentedCapabilitiesFor(
	provider: string
): ProviderCapabilities {
	return requireMatiProvider(provider).capabilities;
}
