export function captureSettingsDocument(options: {
	code: string | null;
	deviceId: string | null;
}): string {
	const codeBlock = options.code
		? `<p>Pairing code <code>${escapeHtml(options.code)}</code> expires in 10 minutes. Enter it in the editor with <strong>Mati: Claim this device</strong>.</p>`
		: `<p class="muted">No pairing code yet.</p>`;
	const deviceBlock = options.deviceId
		? `<p>Claimed device <code>${escapeHtml(options.deviceId)}</code></p>
<button type="button">Delete editor capture</button>`
		: `<p class="muted">No claimed editor devices yet.</p>`;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Editor capture settings</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;background:#fafafa;color:#111}
main{max-width:40rem;margin:0 auto;padding:2rem 1rem;display:grid;gap:1rem}
.card{border:1px solid #ddd;border-radius:1rem;background:#fff;padding:1rem}
.muted{color:#555}
code{font-family:ui-monospace,monospace;background:#f3f3f3;padding:.15rem .4rem;border-radius:.4rem}
button{border:1px solid #111;background:#111;color:#fff;border-radius:.5rem;padding:.4rem .75rem}
</style>
</head>
<body>
<main>
<h1>Settings</h1>
<section class="card">
<h2>Editor capture</h2>
<p class="muted">Link a no-sign-in editor device to this account with a pairing code, or run Mati: Open report and confirm Link this device to your account. Trainer sessions are not deleted.</p>
${codeBlock}
${deviceBlock}
</section>
</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
