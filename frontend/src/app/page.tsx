export default function Page() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "â€” not set â€”";

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: 24
    }}>
      <header style={{ textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 36 }}>Promagen</h1>
        <p style={{ marginTop: 8, color: "#555" }}>
          Frontend is live on Vercel.
        </p>
      </header>

      <section style={{
        padding: 16,
        border: "1px solid #eee",
        borderRadius: 12,
        background: "#fafafa"
      }}>
        <strong>API base:</strong> {apiBase}
      </section>

      <footer style={{ marginTop: 24, color: "#777" }}>
        <span>Private preview â€” not indexed.</span>
      </footer>
    </main>
  );
}
