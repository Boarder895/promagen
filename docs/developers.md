# 📘 Developers Book — *How to Use Promagen*
**Edition: 2025-09-27**

### What’s New in This Edition
- Reinforced dual-option model: both buttons shown for all providers.
- Provider schema updated with `copyAndOpenEnabled: true` policy.
- Prompt Runner fallback flow clarified.

---

## Entry points
- Marketing → https://promagen.com  
- Web app → https://app.promagen.com  

## Core features
- **Leaderboard** → /leaderboard  
- **Providers Registry** → /providers  
- **Prompt Runner** → /prompt  
  - Paste prompt → select providers → choose:  
    - **Run in Promagen ⚡** (if `apiEnabled` and user key valid)  
    - **Copy & Open ✂️** (always available)  

## Popular Prompts
- /prompts → ❤️ like · **Refine/Remix**

## Copy & Open ✂️
- Always rendered for all providers.  
- Uses affiliate routing when available.  
- Opens embedded view where allowed; falls back to new tab if blocked.  
- Fallback if API run fails.

## Provider Capabilities Map
```ts
type Provider = {
  id: string;              // canonical 20 IDs
  name: string;
  apiEnabled: boolean;
  copyAndOpenEnabled: true; // enforced policy
  affiliateLink?: string;
  embedAllowed?: boolean;
}
