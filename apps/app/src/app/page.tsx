import { MarketingHome } from "../components/Home";
import { listChallenges } from "../lib/challenges";

export default function Page() {
	return <MarketingHome challenges={listChallenges()} />;
}
