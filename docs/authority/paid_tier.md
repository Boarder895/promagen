# paid_tier.md — What Is Free and What Is Paid in Promagen

**Status:** Authoritative  
**Scope:** Product behaviour, access rules, and monetisation boundaries  
**Rule:** If a capability is not explicitly listed in this document, it is free.

---

## 1. Core rule (non-negotiable)

**Anything not written in this document is part of standard (free) Promagen.**

There are no implied paywalls.
There are no “soft locks”.
There are no hidden tier changes.

`paid_tier.md` is the **exception list**, not the feature catalogue.

---

## 2. Promagen v1 (Free, no sign-in)

Version 1 of Promagen is **completely free**.

The purpose of v1 is:

- Stability
- Correctness
- Behavioural truth
- Real-world bug discovery

There is **no sign-in** during this phase.

Free users see the world as Promagen defines it:

- Neutral
- Predictable
- Honest
- Calm

No personalisation, no memory, no gating.

---

## 3. Sign-in (not paid): memory, not access

After v1 is stable, **sign-in is introduced**.

Sign-in does **not** make the product paid.
It gives Promagen memory and context.

### Behaviour when signed in (still free)

When a user signs in:

- Stock exchanges are arranged **east → west**.
- The **default centre** is the user’s own location.
- The user may switch the reference frame to **Greenwich (London / 0°)**.
- Greenwich is always available and is the canonical baseline.

### Explicit exclusions at sign-in stage

The following do **not** exist:

- No arbitrary time zone selection
- No city pickers
- No custom ordering
- No drag-and-drop
- No favourites-first behaviour

Sign-in unlocks **context**, not features.

---

## 4. Paid tier: control within invariant rules

Paid users do **not** gain the ability to rewrite reality.

They gain **controlled freedom within physical and logical invariants**.

---

## 5. What paid users can control (explicit list)

### 5.1 Reference frame (two options only)

Paid users may choose **one** of the following reference frames:

- Relative to **my location**
- Relative to **Greenwich (0° / GMT)**

No other time zones exist.
Time zone selection is deliberately excluded.

> Authority note:  
> Greenwich is the universal baseline used for debugging, screenshots, and reasoning.

---

### 5.2 Exchange selection (scope control)

Paid users may choose **which stock exchanges** are shown.

Rules:

- Any combination is allowed.
- All exchanges may be from one hemisphere if the user wishes.
- Selection affects **scope only**, never ordering logic.

---

### 5.3 Exchange count (scale control)

Paid users may choose how many exchanges are shown.

Allowed values:

- **6**
- **8**
- **10**
- **12**
- **14**
- **16**

Rules:

- Multiples of two only.
- No odd numbers.
- No arbitrary counts.

This constraint is intentional and enforced.

---

## 6. Invariants (apply to everyone, always)

These rules are **never overridden**, including for paid users:

- Exchanges are **always ordered by longitude**.
- **Most easterly exchange appears on the left**.
- **Most westerly exchange appears on the right**.
- Ordering is **absolute**, not user-defined.
- No drag-and-drop ordering.
- No favourites-first ordering.
- No manual pinning.

Users may choose **scope** and **reference**, but not **physics**.

---

## 7. What this document does NOT cover

This document does **not** redefine or duplicate:

- FX ribbon rules
- API cost control rules
- Caching and budget guards
- Analytics and metrics derivation
- UI layout invariants

Authority for those lives elsewhere:

- FX behaviour and SSOT rules → `Ribbon_Homepage.md`
- Cost control and provider authority → `promagen-api-brain-v2.md`
- Platform and spend guardrails → `vercel-pro-promagen-playbook.md`

This document only defines **who can control what**, and **when**.

---

## 8. Design intent (for future contributors)

This is not feature gating.
This is **perspective gating**.

- Free users get a complete, honest product.
- Sign-in adds orientation and memory.
- Paid features add control and focus.
- No tier ever withholds truth.

If a proposed paid feature violates these principles, it does not belong in Promagen.

---

## 9. Change discipline

Any change to paid behaviour must:

1. Be added explicitly to this document.
2. State the exact capability gained.
3. Preserve all invariants listed above.

If it is not written here, it is free.
