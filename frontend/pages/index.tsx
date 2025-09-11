import Head from "next/head";
import Leaderboard from "../components/Leaderboard";
import WorldClocks from "../components/WorldClocks";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Home() {
  return (
    <>
      <Head><title>Promagen</title></Head>
      <main style={{maxWidth:900, margin:"40px auto", padding:"0 16px", fontFamily:"Inter,system-ui"}}>
        <h1>Promagen Leaderboard</h1>
        <LanguageSwitcher />
        <WorldClocks />
        <Leaderboard />
      </main>
    </>
  );
}
