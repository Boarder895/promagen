// frontend/app/widget/preferred/page.tsx
import { cookies } from "next/headers";

type PrefsResponse = { preferredProviders: string[] };

async function getPreferences(): Promise<PrefsResponse | null> {
  // Forward auth cookies to your Express API running on the same domain
  // If Next.js and Express share the domain (app.promagen.com), absolute path is fine.
  const cookieHeader = cookies().toString();
  const res = await fetch("https://app.promagen.com/api/user/me/preferences", {
    method: "GET",
    headers: { cookie: cookieHeader },
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic"; // never cache; reflects the current user

export default async function PreferredWidget() {
  const prefs = await getPreferences();

  // If not signed in or no prefs set yet, show a helpful prompt
  const preferred = prefs?.preferredProviders ?? [];

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* keep styles inline for iframe safety */}
        <style>{`
          :root { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji"; }
          body { margin: 0; background: transparent; }
          .wrap { padding: 12px; }
          .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; }
          .title { font-weight: 600; font-size: 14px; margin: 0 0 8px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
          .chip { border: 1px solid #e5e7eb; border-radius: 9999px; padding: 6px 10px; font-size: 12px; text-align:center; background:#fff; }
          .muted { color: #6b7280; font-size: 12px; margin-top: 8px; }
          .cta { margin-top: 10px; font-size: 12px; }
          .btn { display:inline-block; padding:6px 10px; border-radius:8px; border:1px solid #e5e7eb; text-decoration:none; }
          a { color: #111827; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="card">
            <p className="title">Your preferred platforms</p>

            {preferred.length === 0 ? (
              <>
                <p className="muted">
                  No preferred platforms yet. Customize your set to keep the UI focused.
                </p>
                <p className="cta">
                  <a className="btn" href="https://app.promagen.com/settings/providers" target="_top" rel="noopener">
                    Pick providers
                  </a>
                </p>
              </>
            ) : (
              <>
                <div className="grid">
                  {preferred.map((id) => (
                    <div className="chip" key={id}>{id}</div>
                  ))}
                </div>
                <p className="cta">
                  <a className="btn" href="https://app.promagen.com/settings/providers" target="_top" rel="noopener">
                    Edit list
                  </a>
                </p>
              </>
            )}

            <p className="muted">
              Tip: This widget is personalized. If it looks empty, sign in on app.promagen.com.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}






