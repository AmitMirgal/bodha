import { redirect } from "next/navigation";

export default async function RoundAliasPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await params;
	redirect("/");
}
