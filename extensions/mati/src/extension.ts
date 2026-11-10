import { homedir } from "node:os";
import path from "node:path";
import {
	commands,
	type ExtensionContext,
	env,
	Uri,
	window,
	workspace,
} from "vscode";
import {
	defaultMatiHome,
	installCopilotHooks,
	installCursorHooks,
	uninstallCopilotHooks,
	uninstallCursorHooks,
} from "./install-hooks";
import { describeFetchError, resolveMatiOrigin } from "./origin";
import {
	defaultOtelOutfile,
	installCopilotOtel,
	uninstallCopilotOtel,
} from "./otel";
import {
	drainOtelFile,
	drainQueueFile,
	workspaceHashFromFolders,
} from "./queue";

const SECRET_ID = "mati.deviceId";
const SECRET_TOKEN = "mati.deviceSecret";
const SECRET_ORIGIN = "mati.appOrigin";
const CONSENT_FLAG = "mati.consent.v1";
const OTEL_MANAGED = "mati.otel.managed";

const CONSENT_HTML = `<!doctype html>
<html><body style="font-family:sans-serif;padding:1.5rem;max-width:40rem">
<h1>Capture Agent prompts on this device</h1>
<p>Mati stores the prompts you send to Cursor Agent or Copilot Chat, the assistant text, edited file names, and a device token on this machine. It does not create a Mati account. Cursor hooks have no vendor token counts; any estimate is labelled and undercounts. Copilot Chat can report measured tokens from OpenTelemetry chat spans when Mati is allowed to write a file exporter. captureContent stays off. Known secret patterns are replaced with [redacted:class] on this device before upload. That is not a guarantee.</p>
<p>Sample upload:</p>
<pre>{"kind":"prompt","text":"Fix the flaky test [redacted:aws_access_key]","attachmentNames":["app.ts"]}</pre>
<button id="accept">Accept and start capturing</button>
<script>
const vscode = acquireVsCodeApi();
document.getElementById("accept").addEventListener("click", () => vscode.postMessage({ type: "accept" }));
</script>
</body></html>`;

async function currentOrigin(context: ExtensionContext): Promise<string> {
	const setting = workspace.getConfiguration("mati").get<string>("serverUrl");
	return resolveMatiOrigin({
		envOrigin: process.env.MATI_APP_ORIGIN,
		secretOrigin: await context.secrets.get(SECRET_ORIGIN),
		settingOrigin: typeof setting === "string" ? setting : undefined,
	});
}

async function fetchCapture(
	origin: string,
	pathname: string,
	init: RequestInit,
	action: string,
	fetchImpl: typeof fetch
): Promise<Response> {
	let response: Response;
	try {
		response = await fetchImpl(`${origin}${pathname}`, init);
	} catch (error) {
		throw new Error(
			describeFetchError(action, origin, {
				kind: "network",
				message: error instanceof Error ? error.message : String(error),
			})
		);
	}
	if (!response.ok) {
		throw new Error(
			describeFetchError(action, origin, {
				kind: "http",
				status: response.status,
			})
		);
	}
	return response;
}

async function registerDevice(
	origin: string,
	fetchImpl: typeof fetch
): Promise<{ deviceId: string; secret: string; viewerUrl: string }> {
	const response = await fetchCapture(
		origin,
		"/api/capture/v1/devices",
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				version: 1,
				grantedAt: new Date().toISOString(),
				scopes: ["prompt_text", "response_text", "file_edit_paths", "usage"],
			}),
		},
		"register this device",
		fetchImpl
	);
	return (await response.json()) as {
		deviceId: string;
		secret: string;
		viewerUrl: string;
	};
}

function stopCapture(context: ExtensionContext | null) {
	uninstallCursorHooks();
	uninstallCopilotHooks();
	uninstallCopilotOtel({
		managed: Boolean(context?.globalState.get<boolean>(OTEL_MANAGED)),
	});
}

export async function activate(context: ExtensionContext) {
	context.subscriptions.push(
		commands.registerCommand("mati.capture.consent", () => {
			const panel = window.createWebviewPanel(
				"matiConsent",
				"Mati capture",
				1,
				{ enableScripts: true }
			);
			panel.webview.html = CONSENT_HTML;
			panel.webview.onDidReceiveMessage(async (message) => {
				if (message.type !== "accept") {
					return;
				}
				try {
					const origin = await currentOrigin(context);
					const registered = await registerDevice(origin, fetch);
					await context.secrets.store(SECRET_ID, registered.deviceId);
					await context.secrets.store(SECRET_TOKEN, registered.secret);
					await context.globalState.update(CONSENT_FLAG, true);
					process.env.MATI_DEVICE_ID = registered.deviceId;
					installCursorHooks({
						hookScriptSource: path.join(
							context.extensionPath,
							"hooks",
							"cursor.mjs"
						),
					});
					installCopilotHooks({
						hookScriptSource: path.join(
							context.extensionPath,
							"hooks",
							"copilot.mjs"
						),
					});
					const otel = installCopilotOtel({ matiHome: defaultMatiHome() });
					await context.globalState.update(
						OTEL_MANAGED,
						otel.action === "write"
					);
					panel.dispose();
					await window.showInformationMessage(
						otel.action === "write"
							? "Mati is capturing Cursor Agent and Copilot Chat prompts on this device."
							: `Mati is capturing prompts. ${otel.reason}`
					);
				} catch (error) {
					await window.showErrorMessage(
						error instanceof Error ? error.message : "Consent failed."
					);
				}
			});
		}),
		commands.registerCommand("mati.capture.openReport", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			if (!secret) {
				await window.showErrorMessage(
					"Accept capture consent before opening a report."
				);
				return;
			}
			try {
				const origin = await currentOrigin(context);
				const response = await fetchCapture(
					origin,
					"/api/capture/v1/devices",
					{ headers: { Authorization: `Bearer ${secret}` } },
					"open the device viewer",
					fetch
				);
				const body = (await response.json()) as { viewerUrl?: string };
				if (body.viewerUrl) {
					await env.openExternal(Uri.parse(body.viewerUrl));
				}
			} catch (error) {
				await window.showErrorMessage(
					error instanceof Error
						? error.message
						: "Could not open the device viewer."
				);
			}
		}),
		commands.registerCommand("mati.capture.stop", async () => {
			stopCapture(context);
			await window.showInformationMessage(
				"Stopped capturing. The device token is kept until you delete capture data."
			);
		}),
		commands.registerCommand("mati.capture.claim", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			if (!secret) {
				await window.showErrorMessage(
					"Accept capture consent before claiming this device."
				);
				return;
			}
			const code = await window.showInputBox({
				prompt: "Enter the pairing code from Mati Settings",
				placeHolder: "ABCD2345",
				ignoreFocusOut: true,
			});
			if (!code) {
				return;
			}
			try {
				const origin = await currentOrigin(context);
				await fetchCapture(
					origin,
					"/api/capture/v1/pair/claim",
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${secret}`,
							"content-type": "application/json",
						},
						body: JSON.stringify({ code }),
					},
					"claim this device",
					fetch
				);
				await window.showInformationMessage(
					"This device is linked to your Mati account."
				);
			} catch (error) {
				await window.showErrorMessage(
					error instanceof Error
						? error.message
						: "Could not claim this device. Check the code and try again."
				);
			}
		}),
		commands.registerCommand("mati.capture.deleteData", async () => {
			const secret = await context.secrets.get(SECRET_TOKEN);
			const confirm = await window.showWarningMessage(
				"Delete all captured editor data for this device? Trainer sessions are not touched.",
				{ modal: true },
				"Delete"
			);
			if (confirm !== "Delete") {
				return;
			}
			if (secret) {
				try {
					const origin = await currentOrigin(context);
					await fetchCapture(
						origin,
						"/api/capture/v1/device",
						{
							method: "DELETE",
							headers: { Authorization: `Bearer ${secret}` },
						},
						"delete capture data",
						fetch
					);
				} catch (error) {
					await window.showErrorMessage(
						error instanceof Error
							? error.message
							: "Could not delete capture data on the server."
					);
					return;
				}
			}
			stopCapture(context);
			await context.secrets.delete(SECRET_ID);
			await context.secrets.delete(SECRET_TOKEN);
			await context.globalState.update(CONSENT_FLAG, false);
			await window.showInformationMessage(
				"Deleted capture data for this device."
			);
		})
	);
	const consented = context.globalState.get<boolean>(CONSENT_FLAG);
	if (!consented) {
		return;
	}
	const deviceId = await context.secrets.get(SECRET_ID);
	const secret = await context.secrets.get(SECRET_TOKEN);
	if (!(deviceId && secret)) {
		return;
	}
	process.env.MATI_DEVICE_ID = deviceId;
	const matiHome = defaultMatiHome();
	const queuePath = path.join(matiHome, "queue", `${deviceId}.jsonl`);
	const otelPath = defaultOtelOutfile(matiHome);
	const folders = workspace.workspaceFolders?.map(
		(folder) => folder.uri.fsPath
	) ?? [homedir()];
	const tick = async () => {
		const origin = await currentOrigin(context);
		const workspaceHash = workspaceHashFromFolders(folders);
		return Promise.all([
			drainQueueFile({
				queuePath,
				origin,
				secret,
				workspaceHash,
			}),
			drainOtelFile({
				otelPath,
				origin,
				secret,
				workspaceHash,
			}),
		]).then(
			() => undefined,
			() => undefined
		);
	};
	const timer = setInterval(() => {
		tick();
	}, 4000);
	context.subscriptions.push({ dispose: () => clearInterval(timer) });
	tick();
}

export function deactivate() {
	stopCapture(null);
}
