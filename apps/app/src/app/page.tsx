import Home from '../components/Home';
import { listChallenges } from '../lib/challenges';

export default function Page() {
  return <Home challenges={listChallenges()} />;
}
