import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@repo/design-system/components/ui/alert";
import {
	GAMIFICATION_MIGRATE_COMMAND,
	GAMIFICATION_MIGRATION_MESSAGE,
} from "../lib/habits/copy";

export function GamificationMigrationNotice() {
	return (
		<Alert>
			<AlertTitle>Database migration required</AlertTitle>
			<AlertDescription>
				{GAMIFICATION_MIGRATION_MESSAGE} An operator must run{" "}
				<code className="font-mono text-xs">
					{GAMIFICATION_MIGRATE_COMMAND}
				</code>
				. Do not prisma db push.
			</AlertDescription>
		</Alert>
	);
}
