import { redirect } from "next/navigation";

export default async function ResultsAliasPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	redirect(`/session/${id}/report`);
}
