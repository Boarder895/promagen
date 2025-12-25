# Environment Variables (Public)

| Name                         | Scope   | Description                                      |
|-----------------------------|---------|--------------------------------------------------|
| NEXT_PUBLIC_SITE_URL        | public  | Canonical origin for canonical links and OG.     |
| NEXT_PUBLIC_GIT_SHA         | public  | Short or full git SHA for footer provenance.     |
| NEXT_PUBLIC_CI_RUN_ID       | public  | CI run/build identifier for provenance.          |
| KV_URL                      | server  | KV service base URL (private).                   |
| KV_TOKEN                    | server  | KV bearer token (private).                       |
| KV_NAMESPACE                | server  | KV namespace (e.g., `promagen`).                 |
| FX_API_BASE                 | server  | Upstream FX API base (private).                  |
| FX_API_KEY                  | server  | Upstream FX API key (private).                   |

> **Rule:** No secret appears in client bundles. Public vars prefixed with `NEXT_PUBLIC_`.
