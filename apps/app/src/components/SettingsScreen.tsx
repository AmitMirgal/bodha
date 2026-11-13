import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { CaptureSettingsForm } from "./CaptureSettingsForm";
import { CursorAdminSettingsForm } from "./CursorAdminSettingsForm";
import { LeaderboardSettingsForm } from "./LeaderboardSettingsForm";
import { LlmSettingsForm } from "./LlmSettingsForm";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SettingsScreen({ email }: { email: string }) {
	return (
		<main className="mx-auto grid max-w-2xl gap-8 px-4 py-10">
			<h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
			<Card>
				<CardHeader>
					<CardTitle>Account</CardTitle>
					<CardDescription>
						Email comes from your sign-in. It cannot be changed here.
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-2">
					<Label htmlFor="profile-email">Email</Label>
					<Input id="profile-email" readOnly value={email} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Theme</CardTitle>
					<CardDescription>
						Light, Dark, or System. System follows this device.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ThemeSwitcher />
				</CardContent>
			</Card>
			<LeaderboardSettingsForm />
			<CaptureSettingsForm />
			<CursorAdminSettingsForm />
			<LlmSettingsForm />
		</main>
	);
}
