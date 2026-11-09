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

async function registerDevice(
	origin: string,
	fetchImpl: typeof fetch
): Promise<{ deviceId: string; secret: string; viewerUrl: string }> {
	const response = await fetchImpl(`${origin}/api/capture/v1/devices`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			version: 1,
			grantedAt: new Date().toISOString(),
			scopes: ["prompt_text", "response_text", "file_edit_paths", "usage"],
		}),
	});
	if (!response.ok) {
		throw new Error("Could not register this device.");
	}
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
	const origin =
		process.env.MATI_APP_ORIGIN ||
		(await context.secrets.get(SECRET_ORIGIN)) ||
		"http://127.0.0.1:3000";
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
			const response = await fetch(`${origin}/api/capture/v1/devices`, {
				headers: { Authorization: `Bearer ${secret}` },
			});
			if (!response.ok) {
				await window.showErrorMessage("Could not open the device viewer.");
				return;
			}
			const body = (await response.json()) as { viewerUrl?: string };
			if (body.viewerUrl) {
				await env.openExternal(Uri.parse(body.viewerUrl));
			}
		}),
		commands.registerCommand("mati.capture.stop", async () => {
			stopCapture(context);
			await window.showInformationMessage(
				"Stopped capturing. The device token is kept until you delete capture data."
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
	const tick = () => {
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
