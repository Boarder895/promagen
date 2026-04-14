# Phase A — Doctrine Lock for Call 2

**Project:** Promagen API Call 2  
**Date:** 13 April 2026  
**Status:** Ready to adopt  
**Scope:** Production doctrine for T1, T3 and T4  

---

## 1. Decision summary

This document locks the operating doctrine for API Call 2.

It formalises five decisions:

1. **Active production scope is T1, T3 and T4 only.**  
2. **T2 is deferred and excluded from the main production priority lane.**  
3. **Call 2 is a translation, compression and formatting engine, not an authoring engine.**  
4. **Stage D is product truth and the primary review standard.**  
5. **GPT owns semantic translation work; code owns deterministic enforcement.**

These decisions are now the basis for all future Call 2 fixes, harness interpretation, and engineering prioritisation.

---

## 2. Production scope lock

### 2.1 Active production scope

The active production scope for Call 2 is:

- **T1**
- **T3**
- **T4**

These are the only tiers that should drive production engineering priorities, success criteria, and regression decisions.

### 2.2 Deferred scope

**T2 is deferred.**

T2 is currently not a real native generation lane and must not distort the main production priority board.

T2 may remain visible for tracking, but it must be treated as:

- deferred work
- non-blocking for Call 2 production success
- outside the main quality judgement for the active translation engine

### 2.3 Operational consequence

No production review should describe Call 2 as if all four tiers are equally live today.

Until T2 is implemented as a real native path, production judgement is based on **T1, T3 and T4**.

---

## 3. Identity of Call 2

### 3.1 What Call 2 is

Call 2 is a **translation, compression and formatting engine**.

It takes approved user content and expresses that content natively for each active tier family.

### 3.2 What Call 2 is not

Call 2 is **not** an authoring engine.

It must not be judged or designed as if its purpose is to invent, embellish, or creatively expand beyond the user’s approved content.

### 3.3 Positive duties

Call 2 must:

- preserve approved user content
- convert content into tier-native prompt language
- compress when constraints require it
- obey hard structural limits
- hand off clean material to Call 3

### 3.4 Prohibited behaviours

Call 2 must not:

- invent new positive scene content
- silently discard approved content without justified compression pressure
- rely on prompt wording for deterministic work that code can enforce
- over-polish weak user input into fabricated strength

---

## 4. Review truth standard

### 4.1 Stage D is product truth

The primary review standard for Call 2 is **Stage D**, the final returned output.

Stage A, Stage B and Stage C remain diagnostically important, but they are not the final product truth.

### 4.2 Review rule

All production quality decisions must be anchored to the question:

**Is Stage D correct, clean, and fit for product use?**

Not:

**Did GPT produce a beautiful raw Stage A output on its own?**

### 4.3 Interpretation rules

- **Stage A fail → Stage D pass** means the system succeeded through deterministic rescue.
- **Stage A pass → Stage D fail** means code or later processing damaged the output.
- **Stage D pass → manual fail** means the harness is missing something important.
- **Stage D fail → manual pass** means the harness is likely measuring the wrong thing.

### 4.4 Engineering implication

The target is not a beautiful Stage A.

The target is a reliable Stage D.

Call 2 should therefore be optimised for final-output reliability, not raw-model elegance.

---

## 5. Ownership split

### 5.1 GPT owns semantic translation work

GPT is responsible for the parts of Call 2 that require semantic judgement.

This includes:

- semantic preservation
- native restructuring into T1, T3 and T4 voice
- compression choices under budget pressure
- mood-to-visual conversion
- interaction preservation
- spatial relationship preservation
- avoidance of invention and semantic drift
- opening freshness where semantic judgement is required

### 5.2 Code owns deterministic enforcement

Code is responsible for the parts of Call 2 that are countable, parseable, reorderable, deduplicable, or lookup-convertible.

This includes:

- syntax enforcement
- ordering normalisation
- deduplication
- wrapper-length enforcement
- required prefix/suffix presence
- punctuation cleanup
- banned phrase cleanup where safe
- camera jargon stripping
- numeric measurement conversion
- tier-specific technical cleanup

### 5.3 Decision rule

If a behaviour can be enforced deterministically and safely in code, it should not remain primarily dependent on prompt wording.

### 5.4 Review consequence

A weak raw GPT output does not automatically indicate a production failure if the deterministic layers make the final output correct.

Conversely, a strong raw GPT output does not count as success if deterministic layers later damage or degrade the final result.

---

## 6. Root-cause discipline

### 6.1 Principle

Future Call 2 work must follow root cause, not symptom noise.

### 6.2 Required classification

Every weak lamp or meaningful failure must be classified before a fix is chosen.

The working fault classes are:

- `prompt_failure`
- `code_enforcement_gap`
- `code_enforcement_failure`
- `measurement_failure`
- `measurement_gap`
- `scene_definition_failure`
- `accepted_constraint_loss`
- `run_variance`
- `input_quality_limit`

### 6.3 Rule

No engineering change should be proposed without stating:

- the fault class
- the root cause
- the owner
- the fix type
- the intended layer of correction

This prevents prompt churn when the true issue belongs to code, harness logic, or scene setup.

---

## 7. Priority doctrine

### 7.1 Immediate production priorities

The highest-leverage production priorities are:

1. **Aim 3 — hard structural constraints**
2. **Aim 12 — measurement truth**
3. **Aim 6 — technical conversion**
4. **Aim 1 — content preservation**
5. **Aim 2 — native format**

### 7.2 Deferred priority

Aim 15 must remain outside the main production priority lane until T2 becomes a genuine native generation path.

### 7.3 Review culture

After each harness run, the first questions should be:

1. Which Stage D outputs are weak?
2. Which aims are weak at the final product layer?
3. Is the root cause prompt, code, harness, scene definition, or accepted constraint?
4. What is the smallest high-leverage fix batch?

---

## 8. Adoption statement

From this point onward, Call 2 engineering decisions should be made under this doctrine.

Any fix proposal that conflicts with these rules must justify why.

The default assumptions are now:

- production scope = **T1, T3, T4**
- T2 = **deferred**
- review standard = **Stage D**
- GPT = **semantic translation owner**
- code = **deterministic enforcement owner**
- fixes = **root-cause-led**

---

## 9. Existing features preserved: Yes

This doctrine lock changes decision-making, priority, and documentation discipline. It does not remove the current route stages, harness architecture, or enforcement baseline.

