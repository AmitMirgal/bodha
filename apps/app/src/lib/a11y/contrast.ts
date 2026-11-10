export function hexToRgb(hex: string): [number, number, number] {
	const raw = hex.replace("#", "");
	if (raw.length !== 6) {
		throw new Error(`Expected #rrggbb, got ${hex}`);
	}
	return [
		Number.parseInt(raw.slice(0, 2), 16),
		Number.parseInt(raw.slice(2, 4), 16),
		Number.parseInt(raw.slice(4, 6), 16),
	];
}

function linearize(channel: number): number {
	const c = channel / 255;
	return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex).map(linearize) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
	const a = relativeLuminance(foreground);
	const b = relativeLuminance(background);
	const lighter = Math.max(a, b);
	const darker = Math.min(a, b);
	return (lighter + 0.05) / (darker + 0.05);
}

export const LIGHT_BG = "#f2f0e8";
export const DARK_BG = "#0d0d0f";
export const LIGHT_PANEL = "#ffffff";
export const DARK_PANEL = "#16161b";
export const LIME_FILL = "#c6ff3d";
export const LIME_TEXT_LIGHT = "#3f5a00";
export const LIME_TEXT_DARK = "#c6ff3d";
export const LIME_FG = "#0d0d0f";
export const BODY_LIGHT = "#0d0d0f";
export const BODY_DARK = "#f2f0e8";
export const DIM_LIGHT = "#5c5c68";
export const DIM_DARK = "#8b8b99";
export const DESTRUCTIVE_LIGHT = "#b00040";
export const DESTRUCTIVE_DARK = "#ff4d8d";
export const RING_LIGHT = "#3f5a00";
export const RING_DARK = "#c6ff3d";

export interface ContrastRow {
	darkBg: string;
	darkFg: string;
	lightBg: string;
	lightFg: string;
	token: string;
	ui?: boolean;
}

export const CONTRAST_ROWS: ContrastRow[] = [
	{
		token: "--foreground on --background",
		lightFg: BODY_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: BODY_DARK,
		darkBg: DARK_BG,
	},
	{
		token: "--muted-foreground / --dim on --background",
		lightFg: DIM_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: DIM_DARK,
		darkBg: DARK_BG,
	},
	{
		token: "--lime-text on --background",
		lightFg: LIME_TEXT_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: LIME_TEXT_DARK,
		darkBg: DARK_BG,
	},
	{
		token: "--lime-text on --panel",
		lightFg: LIME_TEXT_LIGHT,
		lightBg: LIGHT_PANEL,
		darkFg: LIME_TEXT_DARK,
		darkBg: DARK_PANEL,
	},
	{
		token: "--lime-foreground on --lime fill",
		lightFg: LIME_FG,
		lightBg: LIME_FILL,
		darkFg: LIME_FG,
		darkBg: LIME_FILL,
	},
	{
		token: "--primary / --lime-border on --background",
		lightFg: RING_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: RING_DARK,
		darkBg: DARK_BG,
	},
	{
		token: "--destructive on --background",
		lightFg: DESTRUCTIVE_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: DESTRUCTIVE_DARK,
		darkBg: DARK_BG,
	},
	{
		token: "--ring on --background (UI 3:1)",
		lightFg: RING_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: RING_DARK,
		darkBg: DARK_BG,
		ui: true,
	},
	{
		token: "--pink-text on --background",
		lightFg: DESTRUCTIVE_LIGHT,
		lightBg: LIGHT_BG,
		darkFg: DESTRUCTIVE_DARK,
		darkBg: DARK_BG,
	},
];
