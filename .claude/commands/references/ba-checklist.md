# BA Checklist — seconder.ai

> **Reference for `/01-create-raw-specs` (Step 2).** The BA Agent walks a feature idea through the 10 categories below, marks each item as *clear* or *gap*, and turns every gap into a question for the user. Don't re-ask anything the idea already answered.

## 1. Context
- What problem/trigger motivates this feature? Why now?
- Which existing feature does it extend, replace, or conflict with?
- Any related feature already shipped that this should stay consistent with?

## 2. Actors
- Who can use this feature? (guest, registered user, admin, system/cron...)
- Does behavior or permission differ per actor/role?
- Is there an actor the idea never mentions but the flow implies (e.g. an approver, a support agent)?

## 3. Main flow
- What is the happy-path, step by step, from trigger to outcome?
- What is the entry point (where does the user start) and the exit point (what confirms success)?

## 4. Alternate & error flows
- What happens on invalid input, timeout, or a failed dependency (network, 3rd-party API, payment)?
- Is there a retry, fallback, or manual-recovery path — or does it just fail?
- Concurrent/duplicate action (double submit, two tabs, race condition)?

## 5. Business rules
- What constraints, thresholds, or limits apply (max length, rate limit, expiry, quota)?
- Any rule that varies by plan/tier, region, or feature flag?
- Numeric values in the idea ("a few", "soon", "large") that need a concrete number?

## 6. Data
- What data is read and what is written? Any new field/entity needed?
- For each field: where does its value come from — user input, computed, defaulted, copied from another entity, or fetched externally?
- What is the source of truth if the same value could live in more than one place?

## 7. Integrations
- Does this call another internal service, 3rd-party API, or webhook?
- What's the contract (request/response shape) and who owns it?
- What happens if the integration is slow, down, or returns unexpected data?

## 8. Non-functional requirements
- Performance/latency expectations under normal and peak load?
- Security/privacy: sensitive data involved, auth required, audit trail needed?
- Accessibility, i18n/l10n, device/browser support?

## 9. Scope
- What is explicitly out of scope for this iteration (so it doesn't get silently assumed)?
- Any related feature the user might expect but isn't part of this request?

## 10. Acceptance criteria
- What observable outcome proves each requirement is done? Each one must be testable, not vague ("the system responds quickly" is not an AC — give it a number).
- What's the minimum set of scenarios (happy path + key edge cases) that should pass before calling this done?

---

## Technique: state-transition walkthrough

Categories 2 (Actors) and 6 (Data) are the two most likely to hide gaps, because an idea is usually described as a single flow ("user does X") while in reality the actor moves through several **states** over time, and each state can read or depend on data set during an *earlier* state. The idea rarely says what happens outside the one state it's written for. To find these gaps, trace the actor across their full state timeline and ask, for every step: *what state/setting does this step need, and did an earlier step actually set it?*

**How to apply:**
1. List every relevant state the actor can be in (not just the one the idea describes) — e.g. anonymous, mid-registration, first login, returning login, upgraded plan, deactivated, deleted.
2. For each transition between states, ask:
   - What does the UI/system show *before* this transition happens (does the idea define the "not yet" state)?
   - What new state/setting/default gets created *at* this transition, and where does its value come from (system default vs. user input vs. copied from a previous state)?
   - On the *next* occurrence of a similar transition (e.g. a second login, a repeat purchase), is anything from the first time missing, reset, or stale?
3. Turn each unanswered step into a scoped question rather than leaving it implicit.

**Worked example — auth-adjacent feature:**
- Not logged in: how does this feature/area render? Fully hidden, shown but locked, or redirect to login?
- Just registered: which state/setting gets initialized right at this moment (e.g. default locale, default notification setting, onboarding flag)? Where does that value come from — a hard-coded default, inferred from IP/browser, or a choice the user made during registration?
- Returning login (2nd time onward): does everything created at registration load back correctly, or is some field missing/reset to default because it was never persisted in the right place?

This same three-question pattern generalizes beyond auth to any entity with a lifecycle (order: created → paid → shipped; chat session: new → active → archived; subscription: trial → active → expired) — always check the "before it exists," "at creation," and "on subsequent access" states.
