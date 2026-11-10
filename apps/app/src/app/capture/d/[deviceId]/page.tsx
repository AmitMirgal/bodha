import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppNav } from "../../../../components/AppNav";
import { CaptureClaimForm } from "../../../../components/CaptureClaimForm";
import { CaptureViewerPreview } from "../../../../components/CaptureViewerPreview";
import { listDeviceTasks } from "../../../../lib/capture/ingest";
import {
	captureViewerSecret,
	verifyViewerToken,
} from "../../../../lib/capture/viewer";
import { withDeviceDb, withUserDb } from "../../../../lib/db/client";
import { requireUser } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Mati capture",
};

function loginHref(
	deviceId: string,
	viewer: string,
	claim: string | undefined
) {
	const next = claim
		? `/capture/d/${deviceId}?v=${viewer}&claim=${claim}`
		: `/capture/d/${deviceId}?v=${viewer}`;
	return `/login?next=${encodeURIComponent(next)}`;
}

export default async function CaptureViewerPage({
	params,
	searchParams,
}: {
	params: Promise<{ deviceId: string }>;
	searchParams: Promise<{ claim?: string; v?: string }>;
}) {
	const { deviceId } = await params;
	const { claim, v } = await searchParams;
	const secret = captureViewerSecret();
	if (!(secret && v && verifyViewerToken(deviceId, v, secret))) {
		notFound();
	}
	const { supabase, userId } = await requireUser();
	const email = userId
		? ((await supabase.auth.getUser()).data.user?.email ?? null)
		: null;
	const device = await withDeviceDb(deviceId, (db) =>
		db.device.findFirst({
			select: { claimedUserId: true, id: true },
			where: { id: deviceId },
		})
	);
	if (!device) {
		notFound();
	}
	if (userId && device.claimedUserId === userId) {
		const latest = await withUserDb(userId, (db) =>
			db.captureTask.findFirst({
				orderBy: { startedAt: "desc" },
				select: { id: true },
				where: { deviceId, userId },
			})
		);
		redirect(latest ? `/capture/tasks/${latest.id}` : "/progress");
	}
	const tasks = await withDeviceDb(deviceId, (db) =>
		listDeviceTasks(db, deviceId)
	);
	if (userId && device.claimedUserId && device.claimedUserId !== userId) {
		return (
			<>
				<AppNav email={email} />
				<main className="mx-auto grid max-w-3xl gap-4 px-4 py-10">
					<h1 className="font-semibold text-3xl tracking-tight">
						This device is linked to another account
					</h1>
					<p className="text-muted-foreground">
						Sign in with the account that already claimed this editor, or
						capture from a device that is not linked yet.
					</p>
				</main>
			</>
		);
	}
	if (userId && claim) {
		return (
			<>
				<AppNav email={email} />
				<CaptureClaimForm token={claim} />
			</>
		);
	}
	if (userId && !claim) {
		return (
			<>
				<AppNav email={email} />
				<main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
					<h1 className="font-semibold text-3xl tracking-tight">
						Link this device
					</h1>
					<p className="text-muted-foreground">
						You are signed in. Run <strong>Mati: Open report</strong> again from
						the editor so Mati can pass a short-lived claim code. The device
						secret is never placed in this URL.
					</p>
				</main>
			</>
		);
	}
	return (
		<>
			<AppNav email={null} />
			<CaptureViewerPreview
				loginHref={loginHref(deviceId, v, claim)}
				tasks={tasks}
			/>
		</>
	);
}
