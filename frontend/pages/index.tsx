export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Promagen</h1>
      <p>Frontend is live on Vercel.</p>
      <p>
        API base: {process.env.NEXT_PUBLIC_API_BASE_URL || "(not set)"}
      </p>
    </main>
  );
}
