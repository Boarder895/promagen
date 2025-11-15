// frontend/app/widget/preferred/page.tsx
import { cookies } from "next/headers";

type PrefsResponse = { preferredProviders: string[] };

async function getPreferences(): Promise<PrefsResponse | null> {
  const cookieHeader = cookies().toString();

  const res = await fetch("https://app.promagen.com/api/user/me/preferences", {
    method: "GET",
    headers: { cookie: cookieHeader },
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export const dynamic = "force-dynamic";

export default async function PreferredWidget() {
  const prefs = await getPreferences();
  const preferred = prefs?.preferredProviders ?? [];

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* keep styles inline for iframe safety */}
        <style>{`
          :root {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
              "Segoe UI", Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          }
          body { margin: 0; background: transparent; }
          .wrap { padding: 12px; }
          .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; background: #ffffff; }
          .title { font-weight: 600; font-size: 14px; margin: 0 0 8px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
          .chip {
            border: 1px solid #e5e7eb;
            border-radius: 9999px;
            padding: 6px 10px;
            font-size: 12px;
            text-align: center;
            background: #ffffff;
          }
          .muted { color: #6b7280; font-size: 12px; margin-top: 8px; }
          .cta { margin-top: 10px; font-size: 12px; }
          .btn {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            text-decoration: none;
          }
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
                  You have not picked any favourites yet. Once you choose them in Promagen,
                  they will appear here.
                </p>
                <p className="cta">
                  <a
                    className="btn"
                    href="https://app.promagen.com/settings/providers"
                    target="_top"
                    rel="noreferrer"
                  >
                    Choose favourites
                  </a>
                </p>
              </>
            ) : (
              <>
                <div className="grid">
                  {preferred.map((id) => (
                    <div className="chip" key={id}>
                      {id}
                    </div>
                  ))}
                </div>
                <p className="cta">
                  <a
                    className="btn"
                    href="https://app.promagen.com/settings/providers"
                    target="_top"
                    rel="noreferrer"
                  >
                    Edit list
                  </a>
                </p>
              </>
            )}

            <p className="muted">
              Tip: This widget is personalised. If it looks empty, sign in on app.promagen.com.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
