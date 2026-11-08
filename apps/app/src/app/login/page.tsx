import { Suspense } from "react";
import { LoginForm } from "../../components/LoginForm";

export default function LoginPage() {
	return (
		<Suspense
			fallback={
				<main className="mx-auto flex min-h-[100dvh] items-center justify-center px-4">
					<p className="text-muted-foreground">Loading sign-in…</p>
				</main>
			}
		>
			<LoginForm />
		</Suspense>
	);
}
