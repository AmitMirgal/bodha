export type AuthIntent = "magic" | "signin" | "signup";

export type LoginResult =
	| { kind: "confirm_email" }
	| { kind: "error"; message: string }
	| { kind: "magic_sent" }
	| { kind: "signed_in" };

export interface LoginAuthClient {
	auth: {
		signInWithOtp: (args: {
			email: string;
			options?: { emailRedirectTo?: string };
		}) => Promise<{ error: { message: string } | null }>;
		signInWithPassword: (args: {
			email: string;
			password: string;
		}) => Promise<{ error: { message: string } | null }>;
		signUp: (args: {
			email: string;
			password: string;
			options?: { emailRedirectTo?: string };
		}) => Promise<{
			data: {
				session: object | null;
				user: object | null;
			};
			error: { message: string } | null;
		}>;
	};
}

export class LoginValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LoginValidationError";
	}
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export function readNamedString(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}

export function readLoginIntent(
	form: FormData,
	submitterIntent?: string | null
): AuthIntent {
	const raw = submitterIntent || readNamedString(form, "intent").trim();
	switch (raw) {
		case "magic":
		case "signin":
		case "signup":
			return raw;
		default:
			throw new LoginValidationError(
				"Choose sign in, create account, or email link."
			);
	}
}

export function requireEmail(form: FormData, intent: AuthIntent): string {
	const email = readNamedString(form, "email").trim();
	if (!(email && EMAIL_PATTERN.test(email))) {
		throw new LoginValidationError(
			intent === "signup"
				? "Enter a valid email address to create an account."
				: "Enter a valid email address."
		);
	}
	return email;
}

export function requirePassword(form: FormData, intent: AuthIntent): string {
	const password = readNamedString(form, "password");
	if (password.length < MIN_PASSWORD) {
		throw new LoginValidationError(
			intent === "signup"
				? "Enter a password of at least 6 characters to create an account."
				: "Enter your password to sign in."
		);
	}
	return password;
}

export function mapAuthError(message: string, intent: AuthIntent): string {
	const lower = message.toLowerCase();
	if (lower.includes("anonymous")) {
		return intent === "signup"
			? "Enter your email and a password to create an account."
			: "Enter your email and password to sign in.";
	}
	if (lower.includes("already registered")) {
		return "An account with that email already exists. Sign in instead.";
	}
	if (
		lower.includes("invalid login") ||
		lower.includes("invalid credentials")
	) {
		return "Email or password is incorrect.";
	}
	if (lower.includes("email not confirmed")) {
		return "Confirm your email, then sign in.";
	}
	return message.trim() || "Something went wrong. Try again.";
}

export async function submitLoginForm(
	client: LoginAuthClient,
	form: FormData,
	options: { emailRedirectTo: string; submitterIntent?: string | null }
): Promise<LoginResult> {
	const intent = readLoginIntent(form, options.submitterIntent);
	try {
		switch (intent) {
			case "signup": {
				const email = requireEmail(form, intent);
				const password = requirePassword(form, intent);
				const { data, error } = await client.auth.signUp({
					email,
					password,
					options: { emailRedirectTo: options.emailRedirectTo },
				});
				if (error) {
					return {
						kind: "error",
						message: mapAuthError(error.message, intent),
					};
				}
				if (data.session) {
					return { kind: "signed_in" };
				}
				return { kind: "confirm_email" };
			}
			case "signin": {
				const email = requireEmail(form, intent);
				const password = requirePassword(form, intent);
				const { error } = await client.auth.signInWithPassword({
					email,
					password,
				});
				if (error) {
					return {
						kind: "error",
						message: mapAuthError(error.message, intent),
					};
				}
				return { kind: "signed_in" };
			}
			case "magic": {
				const email = requireEmail(form, intent);
				const { error } = await client.auth.signInWithOtp({
					email,
					options: { emailRedirectTo: options.emailRedirectTo },
				});
				if (error) {
					return {
						kind: "error",
						message: mapAuthError(error.message, intent),
					};
				}
				return { kind: "magic_sent" };
			}
			default: {
				const exhaustive: never = intent;
				throw new LoginValidationError(
					`Unhandled sign-in action: ${String(exhaustive)}`
				);
			}
		}
	} catch (caught) {
		if (caught instanceof LoginValidationError) {
			return { kind: "error", message: caught.message };
		}
		return {
			kind: "error",
			message:
				caught instanceof Error ? caught.message : "Something went wrong.",
		};
	}
}

export function loginStatusCopy(result: LoginResult): string {
	switch (result.kind) {
		case "confirm_email":
			return "Check your email to confirm your account, then sign in.";
		case "magic_sent":
			return "Check your email for a sign-in link.";
		case "signed_in":
			return "Signed in.";
		case "error":
			return result.message;
		default: {
			const exhaustive: never = result;
			return String(exhaustive);
		}
	}
}
