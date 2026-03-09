# Human Factors in Digital Product Design — Authority Document

**Last updated:** 7 March 2026
**Version:** 1.0.0
**Owner:** Promagen
**Scope:** Universal — applicable to any digital product with a user interface
**Authority:** Every user-facing visual feature must name the human factor it exploits before implementation begins. This document defines what those factors are, why they work, and how to apply them. Backend and data-layer work is exempt.

---

## Why This Document Exists

Users don't experience your code. They experience what your code makes them feel.

A feature that is technically brilliant but psychologically invisible is wasted engineering. A feature that is technically simple but psychologically precise converts visitors into users. The difference between a product people admire and a product people use is not the technology — it is the understanding of the human sitting in front of it.

This document arms you with that understanding. It is not a textbook. It is a field manual. Every principle here has been tested, measured, and — where relevant — applied in production.

**The rule:** before building any user-facing visual feature, state which human factor it exploits and why. One sentence is enough. If you cannot name the factor, the feature does not have a psychological reason to exist — and features without psychological reasons are decoration, not design.

---

## Table of Contents

1. [The Curiosity Gap](#1-the-curiosity-gap)
2. [Variable Reward](#2-variable-reward)
3. [Anticipatory Dopamine](#3-anticipatory-dopamine)
4. [The Zeigarnik Effect](#4-the-zeigarnik-effect)
5. [Optimal Stimulation Theory](#5-optimal-stimulation-theory)
6. [Temporal Compression](#6-temporal-compression)
7. [Spatial Framing](#7-spatial-framing)
8. [Loss Aversion](#8-loss-aversion)
9. [Social Proof](#9-social-proof)
10. [The Peak-End Rule](#10-the-peak-end-rule)
11. [Cognitive Load Theory](#11-cognitive-load-theory)
12. [The Von Restorff Effect](#12-the-von-restorff-effect)
13. [Fitts's Law](#13-fittss-law)
14. [The Aesthetic-Usability Effect](#14-the-aesthetic-usability-effect)
15. [Dwell Time and Bounce Psychology](#15-dwell-time-and-bounce-psychology)
16. [Audio and Voice Psychology](#16-audio-and-voice-psychology)
17. [Colour Psychology in Dark Interfaces](#17-colour-psychology-in-dark-interfaces)
18. [Animation as Communication](#18-animation-as-communication)
19. [Quick Reference: The Decision Matrix](#19-quick-reference-the-decision-matrix)
20. [Applying This Document](#20-applying-this-document)

---

## 1. The Curiosity Gap

**Source:** George Loewenstein, Carnegie Mellon, 1994 — "The Psychology of Curiosity"

**The principle:** The human brain experiences genuine discomfort when it detects a gap between what it knows and what it wants to know. This discomfort is not metaphorical — it activates the same neural pathways as physical hunger. The brain will expend effort to close the gap, and that effort is your user staying on the page.

**How it works:** You give the user enough information to realise something interesting exists, but not enough to satisfy them without action. The gap must be narrow enough to feel closable (wide gaps cause frustration and abandonment) but wide enough to require engagement (no gap means no motivation).

**What kills it:** Explaining everything upfront. The moment you satisfy the curiosity, the user has no reason to explore. Product tours, tooltips that explain every feature on load, and "here's what this does" labels all close gaps that should remain open.

**Practical application:**

| Do this                                        | Not this                                                          | Why                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| "Every colour you see has a reason"            | "Gold means subject, amber means lighting, cyan means atmosphere" | The first makes them look. The second makes them nod and scroll away.               |
| Show a countdown to an unnamed destination     | Show a countdown with "refreshes in 2:47"                         | "Refreshes" closes the gap. A destination name without the content opens it.        |
| Display a score without explaining the formula | Display a score with a tooltip explaining every factor            | The unexplained score makes them investigate. The tooltip satisfies them instantly. |

**Measurement:** If users are clicking or hovering on elements that don't have explicit calls-to-action, the curiosity gap is working. Track interaction rates on elements that "shouldn't" be interactive.

---

## 2. Variable Reward

**Source:** B.F. Skinner, 1957 — operant conditioning schedules. Modernised by Nir Eyal in "Hooked" (2014).

**The principle:** Predictable rewards lose their power. A slot machine that paid out every 10th pull would be boring. A slot machine that pays out randomly is addictive. The uncertainty of the reward — not the reward itself — drives repeated behaviour.

**The four reinforcement schedules:**

| Schedule          | Pattern           | Engagement | Example                                                                             |
| ----------------- | ----------------- | ---------- | ----------------------------------------------------------------------------------- |
| Fixed interval    | Same time gap     | Lowest     | "New content every 10 minutes" — user learns the schedule, checks back mechanically |
| Fixed ratio       | Every Nth action  | Low        | "Like 5 posts to unlock a badge" — grind, not delight                               |
| Variable interval | Random time gaps  | High       | Social media refresh — sometimes new content, sometimes not                         |
| Variable ratio    | Random Nth action | Highest    | Slot machines, loot boxes — "maybe this next one"                                   |

**The trap:** Pure variable reward without substance is manipulation. The reward must be genuinely valuable. If the user feels tricked — if the "surprise" is always the same quality — trust collapses and they leave permanently. Variable reward amplifies good content. It cannot substitute for it.

**Practical application:** Content that rotates through a known set but where the user cannot predict which item comes next. The 102-city rotation in Promagen is deterministic (same sequence for every user at the same time) but feels variable because no user memorises 102 cities. The user cannot predict whether the next prompt will be Tokyo in rain or Santiago in sunshine. That unpredictability is the reward.

**Design rule:** If your feature has a timer, ask whether the user can predict what happens when it expires. If yes, you're on a fixed schedule. Find a way to make the outcome uncertain while keeping the timing reliable.

---

## 3. Anticipatory Dopamine

**Source:** Wolfram Schultz, University of Cambridge, 1997 — dopamine neuron studies in primates.

**The principle:** Dopamine — the neurotransmitter associated with pleasure and motivation — fires during anticipation, not during the reward itself. The moment before the gift is opened produces more dopamine than the gift. The countdown is more exciting than the destination.

**The implication for product design:** Your most psychologically powerful moment is not when you show the user the content. It is the seconds before you show it. If you skip straight to the reveal, you waste the highest-engagement window your product has.

**The three-phase anticipation pattern:**

| Phase        | Duration         | User state            | Design response                                                                                  |
| ------------ | ---------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Awareness    | Minutes before   | "Something is coming" | Show what's coming (name, preview, flag). Don't show the content itself.                         |
| Acceleration | Final 30 seconds | "It's almost here"    | Intensify visual cues. Shorten text. Brighten colours. The UI should feel like it's speeding up. |
| Payoff       | 0–3 seconds      | "Now"                 | Deliver with impact. Animation, transition, morph. The reveal must feel earned.                  |

**What kills it:** Instant delivery. If content appears with no build-up, there is no anticipation and therefore no dopamine spike. Loading spinners are not anticipation — they are frustration. The difference is whether the user knows WHAT is coming (anticipation) or is simply waiting for SOMETHING (frustration).

**Design rule:** If your feature reveals new content, ask: "Does the user know what's coming before it arrives?" If no, add a preview. If yes, ask: "Does the final second feel different from the first?" If no, add acceleration.

---

## 4. The Zeigarnik Effect

**Source:** Bluma Zeigarnik, 1927 — memory studies at the University of Berlin.

**The principle:** Incomplete tasks persist in memory more strongly than completed ones. A waiter remembers every open order perfectly but forgets them the instant the bill is paid. Your brain allocates working memory to unfinished business and releases it upon completion.

**The implication:** If a user leaves your page with something unfinished, they are more likely to return than if they leave with everything resolved. The unfinished task nags at them — not consciously, but at a level that influences their next "what should I do?" decision.

**Practical application:**

| Scenario                                         | Zeigarnik working                      | Zeigarnik wasted                         |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------- |
| User sees a countdown at 0:42 and closes the tab | "I almost saw the next city" → returns | —                                        |
| User sees a countdown at 7:14 and closes the tab | —                                      | "That's ages away" → no tension          |
| User fills 3 of 12 categories and leaves         | "I was building something" → returns   | —                                        |
| User browses a finished gallery and leaves       | —                                      | "I've seen it all" → no reason to return |

**The threshold:** The task must feel achievable but unfinished. If the remaining effort is too large ("7 minutes to wait"), the brain writes it off as a future task and releases the working memory. If the remaining effort is small ("42 seconds"), the brain keeps it active. The sweet spot is approximately 30–90 seconds of perceived remaining effort.

**Design rule:** Never let a user leave your product in a "complete" state. There should always be one more city they haven't seen, one more category they haven't filled, one more provider they haven't tried. Completion is the enemy of return visits.

---

## 5. Optimal Stimulation Theory

**Source:** Daniel Berlyne, University of Toronto, 1960 — arousal and aesthetics research.

**The principle:** Every human has an optimal level of stimulation — a sweet spot between boredom (too little novelty) and overwhelm (too much). Below the sweet spot, the brain seeks novelty. Above it, the brain retreats to safety. Products that hit the sweet spot feel "just right" — engaging without being exhausting.

**The inverted U:**

```
Engagement
    │
    │         ╭──────╮
    │        ╱        ╲
    │       ╱          ╲
    │      ╱            ╲
    │     ╱              ╲
    │    ╱                ╲
    │   ╱                  ╲
    └──╱────────────────────╲──── Stimulation
     Bored    Sweet Spot   Overwhelmed
```

**For content rotation:** If content changes too fast, the user cannot absorb it before it's gone — that's overwhelm. If it changes too slowly, the user has absorbed everything and is waiting with nothing to do — that's boredom. The sweet spot is long enough to explore but short enough to create "one more" pull.

**Measuring the sweet spot:** Watch session duration curves. If users leave within 30 seconds, you're probably underwhelming them (they saw everything instantly). If users leave after exploring one item in a rotating set, the rotation might be too fast (they couldn't finish exploring before the change). The ideal curve shows users staying through 2–3 rotation cycles, exploring each one, then leaving with the Zeigarnik effect active.

**Design rule:** For any feature with a refresh cycle, the cycle duration must be longer than the time needed to fully explore one item, but shorter than the time where the user runs out of things to do with that item.

---

## 6. Temporal Compression

**Source:** Cognitive psychology research on time perception, specifically Eagleman et al. (2005) and the "oddball effect."

**The principle:** Humans do not perceive time linearly. A countdown from 60 to 30 feels slower than a countdown from 30 to 0, even though both are 30 seconds. The brain compresses time when novelty increases and stretches time when waiting for a known event.

**Application to countdowns:** A uniform countdown (every second looks the same) feels longer than it is. A countdown that visually accelerates — shorter text, brighter colours, state changes — feels faster. The actual duration is identical. The perceived duration is dramatically different.

**The three-state pattern:**

| State  | Timer range          | Visual treatment                                  | Psychological effect                                 |
| ------ | -------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| Cruise | 100% → 17% remaining | Normal weight, standard brightness                | "Plenty of time, I'll explore"                       |
| Alert  | 17% → 3% remaining   | Increased brightness, shorter text, removed words | "Oh, it's happening soon" — attention focuses        |
| Impact | 3% → 0%              | Maximum brightness, single word                   | Dopamine spike. Anticipation peaks. Payoff imminent. |

**What kills it:** Any visual change that happens at a fixed, predictable point (e.g., text turns red at exactly 10 seconds every time). The brain learns the pattern and stops responding to it. The state changes should feel organic — driven by the approaching event, not by a hard-coded threshold.

**Design rule:** Any countdown or progress indicator should have at least two visual state changes, with the final state being distinctly different from all preceding states.

---

## 7. Spatial Framing

**Source:** Barbara Tversky, Stanford — spatial cognition research. Also Lakoff & Johnson, "Metaphors We Live By" (1980).

**The principle:** The brain processes spatial metaphors as if they were real physical experiences. "Moving forward" activates motor cortex areas. "Arriving in Tokyo" triggers the same spatial navigation circuits as physically approaching Tokyo. Language that implies movement creates a sense of journey. Language that implies waiting creates a sense of stagnation.

**The framing switch:**

| Static framing              | Spatial framing              | Brain response                                                 |
| --------------------------- | ---------------------------- | -------------------------------------------------------------- |
| "Next update in 2:47"       | "Arriving in Tokyo in 2:47"  | Navigation circuits activate. User feels motion.               |
| "Loading..."                | "Reaching for your data..."  | Agency implied. Active, not passive.                           |
| "Page 2 of 5"               | "Step 3 — almost there"      | Progress toward a destination, not position in a list.         |
| "Refreshes every 3 minutes" | "A new city every 3 minutes" | The content is coming TO them, not being mechanically swapped. |

**Design rule:** When describing anything that changes over time, frame it as a journey the user is on, not a process the system is running. The user should feel like they are going somewhere, not waiting for something.

---

## 8. Loss Aversion

**Source:** Daniel Kahneman & Amos Tversky, 1979 — Prospect Theory. Nobel Prize in Economics, 2002.

**The principle:** Losing something hurts approximately twice as much as gaining the same thing feels good. A user who loses access to a feature they've been using will feel twice the pain compared to the pleasure they felt when gaining it. This asymmetry is the most powerful force in conversion psychology.

**Application to freemium products:**

| Strategy                                                   | Mechanism                                                   | Effectiveness |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ------------- |
| "Upgrade to unlock X"                                      | Gain framing — user imagines having something new           | Moderate      |
| Let users experience X, then gate it                       | Loss framing — user imagines losing something they've used  | High          |
| Show users what X produced for them, then gate future uses | Personal loss — they lose THEIR work, not a generic feature | Very high     |

**The ethical boundary:** Loss aversion is the most manipulative tool in this document. Used honestly, it means letting users genuinely experience value before asking them to pay. Used dishonestly, it means engineering artificial losses to create panic. The line is simple: if the user would feel tricked after paying, you crossed it.

**Design rule:** Give users access to premium features in limited quantity before gating them. Let them build something with those features. The loss of what they built — not the loss of the feature — drives conversion.

---

## 9. Social Proof

**Source:** Robert Cialdini, Arizona State University, 1984 — "Influence: The Psychology of Persuasion."

**The principle:** Humans use other humans' behaviour as a shortcut for their own decisions. If 500 people are using something right now, it must be worth using. If nobody is using it, something might be wrong. This heuristic evolved because following the group was safer than scouting alone.

**The hierarchy of social proof (strongest to weakest):**

| Type               | Example                                    | Strength           | Why                                    |
| ------------------ | ------------------------------------------ | ------------------ | -------------------------------------- |
| Personal network   | "Your friend Martin uses this"             | Strongest          | Trust is transferred from known person |
| Specific authority | "Used by designers at Apple"               | Strong             | Aspiration + credibility               |
| Aggregate count    | "1,247 users online"                       | Medium             | Safety in numbers                      |
| Anonymous activity | "Someone in Tokyo just generated a prompt" | Weak but addictive | Creates FOMO + liveness                |

**The threshold trap:** Showing "3 users online" is worse than showing nothing. Low numbers trigger the opposite of social proof — they signal "this product is empty." Set a visibility threshold. Below it, silence is better than honesty. This is not deception — it is knowing when a number tells a useful story and when it doesn't.

**Design rule:** Only show social proof metrics when the numbers tell a story that makes the product look alive and valuable. Silence below the threshold. Celebrate above it.

---

## 10. The Peak-End Rule

**Source:** Daniel Kahneman, 1993 — cold water experiments and retrospective memory.

**The principle:** People judge an experience based on two moments: the peak (the most intense point) and the end (the final moment). Everything in between is largely forgotten. A 30-minute experience with a brilliant peak and a satisfying ending is remembered more fondly than a 30-minute experience that was consistently good throughout.

**The implication:** The morph animation when a new city arrives IS the peak. The cursor blinking on the countdown at "Now" IS the end of one cycle and the start of another. If these two moments are mediocre, the entire rotation experience feels mediocre — even if the prompt content between them is excellent.

**Design rule:** Identify the peak and the end of every user journey on your page. Invest disproportionate effort in those two moments. A page with one unforgettable moment and nine ordinary ones outperforms a page with ten "pretty good" moments.

---

## 11. Cognitive Load Theory

**Source:** John Sweller, University of New South Wales, 1988.

**The principle:** Working memory can hold approximately 4±1 items simultaneously (Miller's 7±2 has been revised downward). Every piece of information, every decision point, every visual element on screen occupies a slot. When all slots are full, the user stops processing new information and either leaves or makes poor decisions.

**The three types of cognitive load:**

| Type       | What causes it                                            | Can you reduce it?                                 |
| ---------- | --------------------------------------------------------- | -------------------------------------------------- |
| Intrinsic  | The actual complexity of the content                      | No — it's inherent to the domain                   |
| Extraneous | Bad design forcing the user to work harder than necessary | Yes — and you must                                 |
| Germane    | The effort of building mental models and understanding    | Yes, but you shouldn't — this is productive effort |

**Practical application:** A prompt builder with 12 categories has high intrinsic load — that's the domain, you can't simplify it without losing value. Your job is to eliminate extraneous load: consistent colours for the same concept everywhere, progressive disclosure (Scene Starters that pre-fill categories), cascading intelligence that reduces choices. And to support germane load: the colour-coded prompt anatomy teaches the user what each word does, building a mental model they carry to their next session.

**Design rule:** Before adding any new element to a page, ask: "Which of the user's 4 working memory slots does this occupy, and which one does it replace?" If you cannot answer that, you are adding clutter.

---

## 12. The Von Restorff Effect

**Source:** Hedwig von Restorff, 1933 — the isolation effect.

**The principle:** An item that is visually distinct from its surroundings is remembered better. One red item in a list of blue items is recalled first. This applies to colour, size, position, animation, and typography.

**Application:** The amber countdown text in a sea of white and slate text. The emerald pulsing dot. The tier accent colour underline. These are not decorative — they are memory anchors. The user's eye goes there first, and their brain stores that information first.

**The trap:** If everything is visually distinct, nothing is. A page with 6 different accent colours, 4 animated elements, and 3 font sizes has no Von Restorff effect — it's just visual noise. The effect requires restraint. One element stands out because the rest don't.

**Design rule:** Each page should have exactly one primary visual anchor (the thing you most want the user to notice) and at most two secondary anchors. Everything else should be visually consistent and unremarkable.

---

## 13. Fitts's Law

**Source:** Paul Fitts, 1954 — motor control research for the US Air Force.

**The principle:** The time to reach a target is a function of the distance to the target and the size of the target. Larger targets closer to the cursor are faster to click. This is mathematically expressed as `T = a + b × log₂(1 + D/W)` where D is distance and W is target width, but the practical implication is simple: important buttons must be big and near where the cursor already is.

**Common violations:**

| Violation                                          | Why it's bad                                                   | Fix                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Tiny "X" close buttons in top corners              | Maximum distance from centre of attention, minimum target size | Increase hit area with invisible padding, or use click-outside-to-close |
| Action buttons at the bottom of scrollable content | User must scroll past content to reach the action              | Float actions or place them in the user's current viewport              |
| Provider icons at 18px                             | Below comfortable click target (44px recommended for touch)    | Invisible click area of 44px with visible icon of 18px                  |

**Design rule:** Every clickable element must have a minimum tap target of 44×44px (Apple Human Interface Guidelines). If the visual design requires a smaller element, extend the hit area with invisible padding. Never make the user hunt for a click target.

---

## 14. The Aesthetic-Usability Effect

**Source:** Masaaki Kurosu & Kaori Kashimura, Hitachi Design Centre, 1995.

**The principle:** Users perceive aesthetically pleasing interfaces as easier to use, even when they are objectively identical in usability to less attractive alternatives. Beauty buys tolerance. A beautiful product gets more patience from users when something goes wrong, more willingness to learn its quirks, and more benefit of the doubt when a feature is confusing.

**The flip side:** An ugly product — even one that is functionally superior — is abandoned faster, trusted less, and forgiven less. Users interpret visual quality as a proxy for engineering quality. A polished UI signals "these people care about details." A rough UI signals "if the surface is sloppy, what's happening underneath?"

**Design rule:** Visual polish is not vanity. It is a measurable factor in user retention, error tolerance, and perceived reliability. Budget time for it as you would for testing or security — it is not optional.

---

## 15. Dwell Time and Bounce Psychology

**Source:** Nielsen Norman Group research, 2008–2024. Google Analytics behavioural benchmarks.

**The critical numbers:**

| Metric                                     | Value           | Source                                      |
| ------------------------------------------ | --------------- | ------------------------------------------- |
| Average page dwell time (content pages)    | 52 seconds      | Nielsen Norman Group                        |
| Median landing page dwell time             | 30–40 seconds   | Google Analytics benchmarks                 |
| "Willing to wait" ceiling (low-commitment) | 90–120 seconds  | Nah & Sheth, delayed gratification research |
| Time to form first impression              | 50 milliseconds | Lindgaard et al., 2006                      |
| Time to decide "is this for me?"           | 3–5 seconds     | Multiple UX studies                         |

**The three windows:**

| Window           | Duration      | User decision                                                            |
| ---------------- | ------------- | ------------------------------------------------------------------------ |
| Snap judgement   | 0–3 seconds   | "Is this legit? Does it look professional?" (Aesthetic-Usability Effect) |
| Value assessment | 3–15 seconds  | "What does this do? Is it for me?" (Curiosity Gap must open here)        |
| Engagement hook  | 15–60 seconds | "Should I click something?" (Variable Reward, Anticipatory Dopamine)     |

If you haven't hooked the user by 60 seconds, they're gone. No feature that requires 2+ minutes of passive observation will ever reach most users. This is why a 10-minute rotation cycle means 95% of users never see the prompt change, while a 3-minute cycle catches 40%.

**Design rule:** Every critical user journey must deliver its first moment of value within 15 seconds of page load. The first moment of delight must land within 60 seconds.

---

## 16. Audio and Voice Psychology

**Source:** Multiple — Nass & Brave (2005) on voice interfaces, Clifford Nass (Stanford) on voice personality.

**Key findings:**

**Voice gender:** Female voices are perceived as more trustworthy for informational content and more calming in novel situations. Male voices are perceived as more authoritative for commands and warnings. For a product walkthrough or feature description, a female voice produces higher recall and longer listening duration.

**Accent:** Familiarity with the accent increases trust. For an international audience, British RP (Received Pronunciation) is the most universally understood English accent and carries associations with intelligence, credibility, and competence across cultures. American accents carry associations with friendliness but lower perceived expertise.

**Duration thresholds:**

| Duration      | User response                                         |
| ------------- | ----------------------------------------------------- |
| 0–8 seconds   | "That was helpful" — high completion rate             |
| 8–15 seconds  | "That was interesting" — moderate completion rate     |
| 15–25 seconds | "When does this end?" — drop-off begins               |
| 25+ seconds   | Active disengagement — user mutes, scrolls, or leaves |

**The optimal voice delivery:** 8–12 seconds of content, British female voice, speech rate 0.90–0.95× (slightly slower than natural for clarity), pitch 1.0–1.1× (slightly elevated for warmth). Text written for the voice, not adapted from on-screen copy — spoken English has different rhythm, vocabulary, and sentence length than written English.

**Design rule:** Spoken text should be written separately from displayed text. Read it aloud before shipping. If it has hard consonant clusters, jargon, or sentences longer than 15 words, rewrite it.

---

## 17. Colour Psychology in Dark Interfaces

**Source:** Multiple — Elliot & Maier (2014) colour-in-context theory, UX research on dark mode interfaces.

**The core principle for dark UIs:** On a dark background, colour carries 3× more psychological weight than on a light background. A splash of emerald on dark slate is a beacon. The same emerald on white is furniture. Dark interfaces give you precision control over attention because colour contrast is your primary tool.

**Colour associations in dark UIs:**

| Colour           | Association                       | Best used for                                       | Avoid using for                       |
| ---------------- | --------------------------------- | --------------------------------------------------- | ------------------------------------- |
| Emerald/green    | Success, growth, "go"             | Confirmations, active states, positive metrics      | Errors, warnings, destructive actions |
| Amber/gold       | Warmth, anticipation, premium     | Countdown timers, Pro features, highlights          | Error messages, negative states       |
| Violet/purple    | Intelligence, creativity, premium | Brand accents, tier indicators, AI-related features | Success states, navigation            |
| Cyan/sky blue    | Clarity, information, technology  | Data display, links, informational highlights       | Warnings, destructive actions         |
| Soft red         | Danger, attention, negative       | Errors, negative feedback, destructive actions      | Success, calls-to-action, navigation  |
| White/near-white | Primary content, importance       | Body text, headings, primary data                   | Background, decoration                |
| Slate 400        | De-emphasis, secondary            | Timestamps, metadata, supporting text               | Primary content, calls-to-action      |

**The brightness rule:** On dark backgrounds, use brightness (not colour) to indicate hierarchy. The most important element is the brightest. The least important is the dimmest. Never use opacity to indicate importance — a 60% opacity element looks broken, not de-emphasised.

**Design rule:** In any dark interface, limit the active colour palette to 3 accent colours maximum on any single view. More than 3 creates visual noise that defeats the Von Restorff effect.

---

## 18. Animation as Communication

**Source:** Disney's 12 Principles of Animation (1981), adapted for UI by Rachel Nabors and Val Head.

**The principle:** Animation is not decoration. It is communication. Every animation should answer one of these questions for the user:

| Question                    | Animation type     | Example                                                 |
| --------------------------- | ------------------ | ------------------------------------------------------- |
| "Where did that come from?" | Origin animation   | New content sliding in from the direction of its source |
| "Where did that go?"        | Exit animation     | Deleted item shrinking into the bin icon                |
| "What just changed?"        | State transition   | Colour fade when a toggle switches                      |
| "What should I look at?"    | Attention director | Pulsing dot, glow cycle, breathing animation            |
| "Is something happening?"   | Progress indicator | Loading skeleton, spinner, shimmer                      |

**Duration guidelines:**

| Duration  | Perception           | Use for                                          |
| --------- | -------------------- | ------------------------------------------------ |
| 100–200ms | Instant, snappy      | Button clicks, toggles, micro-interactions       |
| 200–400ms | Smooth, natural      | Panel opens, card transitions, state changes     |
| 400–800ms | Deliberate, dramatic | Page transitions, content reveals, morph effects |
| 800ms+    | Slow, cinematic      | Only for peak moments (see Peak-End Rule)        |

**What kills animation value:** `transition-all`. It animates everything including things the user shouldn't notice (padding, margin, width), which creates perceived sluggishness. Animate only the properties that communicate: `opacity`, `transform`, `color`, `box-shadow`.

**The prefers-reduced-motion contract:** Some users have vestibular disorders. Respect `prefers-reduced-motion: reduce` by replacing motion-based animations with opacity-only alternatives. This is not optional — it is an accessibility requirement.

**Design rule:** Every animation must answer one of the five questions above. If it doesn't answer any of them, it is decoration and should be removed.

---

## 19. Quick Reference: The Decision Matrix

Before building any user-facing visual feature, find the matching row:

| Feature type               | Primary factor                                          | Secondary factor      | Key question to answer                                      |
| -------------------------- | ------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| Content rotation / refresh | Variable Reward + Optimal Stimulation                   | Anticipatory Dopamine | "Can the user predict the next item?"                       |
| Countdown / timer          | Temporal Compression + Anticipatory Dopamine            | Zeigarnik Effect      | "Does the final second feel different?"                     |
| Pricing / upgrade prompt   | Loss Aversion                                           | Social Proof          | "Has the user experienced value before being asked to pay?" |
| Loading state              | Animation as Communication                              | Cognitive Load        | "Does the user know WHAT is loading?"                       |
| Colour choice              | Dark Interface Colour Psychology                        | Von Restorff Effect   | "Is this the only element of this colour on screen?"        |
| Button placement           | Fitts's Law                                             | Cognitive Load        | "Is this near where the cursor already is?"                 |
| Audio / spoken text        | Voice Psychology + Curiosity Gap                        | Dwell Time            | "Would I finish listening if I heard this as a stranger?"   |
| Notification / alert       | Von Restorff + Peak-End Rule                            | Cognitive Load        | "Is this interruption worth a working memory slot?"         |
| Onboarding / tutorial      | Curiosity Gap + Cognitive Load                          | Zeigarnik Effect      | "Am I opening gaps or closing them?"                        |
| Visual polish / animation  | Aesthetic-Usability Effect + Animation as Communication | Optimal Stimulation   | "Does this animation answer one of the five questions?"     |

---

## 20. Applying This Document

**Before every user-facing build:**

1. State the feature in one sentence
2. Name the primary human factor from this document
3. Explain in one sentence why that factor applies
4. Identify what would kill the effect (the anti-pattern)
5. Build

**Example:**

- Feature: "Show the next city name in the countdown timer"
- Factor: Curiosity Gap (Loewenstein)
- Why: The user can imagine the city before seeing the prompt, creating a gap only the rotation can close
- Anti-pattern: Showing a preview of the actual prompt content (closes the gap too early)

This takes 30 seconds. It prevents hours of building features that are technically correct but psychologically invisible.

---

## Related Documents

| Document                   | Relevance                                                          |
| -------------------------- | ------------------------------------------------------------------ |
| `best-working-practice.md` | References this document in the Human Factors Gate section         |
| `code-standard.md`         | Technical implementation rules (clamp, colours, animations)        |
| `homepage.md`              | Homepage component specs — features designed with these principles |
| `scene-starters.md`        | Scene Starters UI — cascading glow exploits Variable Reward        |
| `buttons.md`               | Button sizing and placement — Fitts's Law compliance               |

---

## Changelog

- **7 Mar 2026 — v1.0.0:** Initial version. 18 principles covering curiosity, reward, anticipation, memory, stimulation, time perception, spatial framing, loss aversion, social proof, peak-end, cognitive load, isolation effect, motor control, aesthetics, dwell time, voice, colour, and animation. Decision matrix and application process. Written as a reusable cross-project reference.
