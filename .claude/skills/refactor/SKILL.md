---
name: refactor
description: 'Mandatory coding standards (DRY, KISS, YAGNI, SOLID, Clean Code) with strict performance and error-handling rules. Use whenever planning, implementing, fixing, or refactoring code — trigger on "plan", "implement", "viết code", "refactor", "clean up", "optimize", or any coding task.'
license: MIT
---

# Refactor

## Overview

Improve code structure and readability without changing external behavior. Refactoring is gradual evolution, not revolution.

**Two non-negotiable requirements govern every refactoring done with this skill:**

1. **Simplicity first (KISS).** The refactored code must be SIMPLER than the original — fewer concepts, fewer layers, easier to read. If a "clean" version is harder to follow than the original, it is not an improvement.
2. **Performance is mandatory.** Every refactoring must preserve or improve performance. Never trade performance for aesthetics. Always check: loop count, redundant parsing/casting, algorithmic complexity, unnecessary allocations.

## MUST INTERNALIZE before any plan / code / refactor

Before writing a plan, writing code, or suggesting a change under this skill, the AI MUST read and apply **all five** core principles below. Skipping any of them, treating them as optional, or summarizing them away is a failure to follow this skill.

| Principle | One-line meaning the AI must keep active |
| --- | --- |
| **KISS** | Prefer the simplest form that works (plain function → lookup map → pattern only if needed). Result must be easier to read than before. |
| **DRY** | One source of truth for the same knowledge/logic; do **not** abstract things that only *look* similar. |
| **YAGNI** | No speculative interfaces, configs, or "for later" abstractions — only real, current requirements. |
| **SOLID** | SRP / pragmatic OCP (lookup maps) / LSP / ISP / DIP at real boundaries — never as an excuse to add layers. |
| **Clean Code** | Intention-revealing names, small single-purpose functions, named constants, guard clauses, no dead code, comments only for WHY. |

**Enforcement:** every plan phase, every implementation step, and every refactor PR description must show how KISS, DRY, YAGNI, SOLID, and Clean Code were applied (or why a principle did not apply). Vague "followed best practices" is not enough.

Also mandatory alongside the five: **Performance Rules** and **Error-Handling Rules** in this skill.

## When to Use

- Creating an implementation plan or technical design for a coding task — bake these principles into the plan from the start
- Implementing or writing new code (features, modules, scripts)
- Fixing or modifying existing code
- Code is hard to understand or maintain; functions/classes are too large; code smells need addressing
- User asks "clean up this code", "refactor this", "simplify this", "improve this"

When PLANNING: each plan step must already respect these rules (single-pass loops, safe parsing/API wrappers, no speculative abstractions) — don't plan complex code and refactor later. The plan's "Nguyên tắc refactor áp dụng" (or equivalent) MUST list all five: KISS, DRY, YAGNI, SOLID, Clean Code — plus performance and error handling.
When IMPLEMENTING: write code that passes the final checklist on the first attempt.
When REFACTORING: follow the safe process below and never change behavior.

---

## Core Principles (apply in this order — DO NOT SKIP)

### 1. KISS — Keep It Simple, Stupid

The simplest solution that works is the best solution.

- Prefer plain functions over classes, classes over hierarchies, hierarchies over frameworks.
- Prefer a small `if/else` or a lookup object over a design pattern.
- A junior developer should understand the refactored code in one read.

```diff
# BAD: Over-engineered for 3 cases
- interface ShippingStrategy { calculate(order: Order): number; }
- class StandardShipping implements ShippingStrategy { ... }
- class ExpressShipping implements ShippingStrategy { ... }
- class OvernightShipping implements ShippingStrategy { ... }
- class ShippingStrategyFactory { ... }

# GOOD: Simple lookup — same behavior, 6 lines, zero indirection
+ const SHIPPING_RATES = {
+   standard:  (o: Order) => (o.total > 50 ? 0 : 5.99),
+   express:   (o: Order) => (o.total > 100 ? 9.99 : 14.99),
+   overnight: () => 29.99,
+ } as const;
+
+ const calculateShipping = (order: Order, method: keyof typeof SHIPPING_RATES) =>
+   SHIPPING_RATES[method](order);
```

Only reach for a full design pattern (Strategy classes, Chain of Responsibility, etc.) when the simple version genuinely can't handle real, existing requirements — never "for flexibility later" (see YAGNI).

### 2. DRY — Don't Repeat Yourself

Every piece of knowledge should exist in exactly one place.

- Same logic in 2+ places → extract one function.
- Same value parsed/computed 2+ times → compute once, store in a variable.
- But: don't DRY two things that merely *look* similar today — duplication is cheaper than the wrong abstraction. Extract only when the logic is genuinely the same concept.

```diff
# BAD: Same discount logic duplicated
- function calculateUserDiscount(user) {
-   if (user.membership === 'gold') return user.total * 0.2;
-   if (user.membership === 'silver') return user.total * 0.1;
-   return 0;
- }
- function calculateOrderDiscount(order) {
-   if (order.user.membership === 'gold') return order.total * 0.2;
-   if (order.user.membership === 'silver') return order.total * 0.1;
-   return 0;
- }

# GOOD: One source of truth
+ const DISCOUNT_RATES = { gold: 0.2, silver: 0.1 } as const;
+ const getDiscountRate = (membership) => DISCOUNT_RATES[membership] ?? 0;
+
+ const calculateUserDiscount  = (user)  => user.total  * getDiscountRate(user.membership);
+ const calculateOrderDiscount = (order) => order.total * getDiscountRate(order.user.membership);
```

### 3. YAGNI — You Aren't Gonna Need It

Never add structure for hypothetical future needs.

- No interfaces with a single implementation "in case we swap it later".
- No config options nobody asked for.
- No generic abstractions until there are ≥2–3 real, current use cases.
- Delete dead code, unused parameters, and speculative extension points. Git history keeps them.

### 4. SOLID

Apply SOLID pragmatically — as a lens for spotting problems, not an excuse to add layers:

- **S — Single Responsibility**: A function/class does one thing. A 200-line `processOrder` doing fetch + validate + price + ship + notify → split into focused functions.
- **O — Open/Closed**: New behavior shouldn't require editing a growing `switch`. Simplest compliant form: a lookup map of handlers (see KISS example above) — not a class hierarchy.
- **L — Liskov Substitution**: Subtypes must be drop-in replacements. If a subclass throws on inherited methods, replace inheritance with composition.
- **I — Interface Segregation**: Small, focused interfaces. Don't force callers to depend on methods they don't use.
- **D — Dependency Inversion**: Depend on abstractions at real boundaries (DB, HTTP, filesystem) so code is testable. Do NOT wrap everything in interfaces internally (YAGNI).

```diff
# S in practice: god class → focused services
- class UserManager {
-   createUser() {} updateUser() {} sendEmail() {}
-   generateReport() {} handlePayment() {} // 50 more methods...
- }
+ class UserService    { create() {} update() {} delete() {} }
+ class EmailService   { send() {} }
+ class PaymentService { process() {} }
```

### 5. Clean Code

- **Names reveal intent**: `elapsedDays` not `d`; `isEligibleForDiscount()` not `check()`.
- **Small functions** (< 50 lines) that do one thing, at one level of abstraction.
- **No magic numbers/strings** — named constants (`const ONE_DAY_MS = 86_400_000`).
- **Guard clauses over nesting** — return early instead of arrow-shaped code.
- **No comments explaining WHAT** — code should be self-explanatory; comments explain WHY only.
- **No dead code** — delete unused functions, imports, commented-out blocks.

```diff
# Guard clauses instead of nested conditionals
- function process(order) {
-   if (order) {
-     if (order.user) {
-       if (order.user.isActive) {
-         if (order.total > 0) return processOrder(order);
-         else return { error: 'Invalid total' };
-       } else return { error: 'User inactive' };
-     } else return { error: 'No user' };
-   } else return { error: 'No order' };
- }
+ function process(order) {
+   if (!order)               return { error: 'No order' };
+   if (!order.user)          return { error: 'No user' };
+   if (!order.user.isActive) return { error: 'User inactive' };
+   if (order.total <= 0)     return { error: 'Invalid total' };
+   return processOrder(order);
+ }
```

---

## MANDATORY Performance Rules

Performance is a hard requirement of every refactoring, not an afterthought. Before finishing, verify all of the following.

### Rule 1: Consolidate multiple loops into ONE pass

If the code iterates the same collection multiple times, merge into a single loop. This applies to explicit `for` loops AND chained array methods (`filter().map().reduce()`, multiple `.filter()` calls over the same array).

```diff
# BAD: 3 passes over the same array — O(3n)
- const active   = users.filter(u => u.isActive);
- const inactive = users.filter(u => !u.isActive);
- const total    = users.reduce((sum, u) => sum + u.balance, 0);

# GOOD: 1 pass — O(n)
+ const active = [], inactive = [];
+ let total = 0;
+ for (const user of users) {
+   (user.isActive ? active : inactive).push(user);
+   total += user.balance;
+ }
```

```diff
# BAD: Separate loops to compute stats
- let min = Infinity, max = -Infinity, sum = 0;
- for (const n of numbers) if (n < min) min = n;
- for (const n of numbers) if (n > max) max = n;
- for (const n of numbers) sum += n;

# GOOD: One loop computes everything
+ let min = Infinity, max = -Infinity, sum = 0;
+ for (const n of numbers) {
+   if (n < min) min = n;
+   if (n > max) max = n;
+   sum += n;
+ }
```

Exception: keep separate passes only when merging genuinely hurts readability AND the collection is provably tiny — and say so explicitly.

### Rule 2: Parse/cast ONCE, reuse the result

If a value is parsed, cast, or converted more than once, store it in a variable — or extract a function if the same conversion appears across the codebase.

```diff
# BAD: Parses the same JSON / date / number repeatedly
- if (JSON.parse(payload).type === 'order') {
-   handleOrder(JSON.parse(payload).data);
-   log(JSON.parse(payload).id);
- }
- if (new Date(row.created_at).getFullYear() === 2026 &&
-     new Date(row.created_at).getMonth() === 0) { ... }

# GOOD: Parse once, reuse
+ const message = JSON.parse(payload);
+ if (message.type === 'order') {
+   handleOrder(message.data);
+   log(message.id);
+ }
+
+ const createdAt = new Date(row.created_at);
+ if (createdAt.getFullYear() === 2026 && createdAt.getMonth() === 0) { ... }
```

```diff
# BAD: Same conversion logic scattered everywhere
- const price1 = parseFloat(item.price.replace('$', '').trim());
- // ...elsewhere...
- const price2 = parseFloat(other.price.replace('$', '').trim());

# GOOD: One reusable function
+ const parsePrice = (raw: string): number => parseFloat(raw.replace('$', '').trim());
+ const price1 = parsePrice(item.price);
+ const price2 = parsePrice(other.price);
```

Same rule applies to repeated expensive property access, regex compilation inside loops (hoist the regex out), and repeated `.toLowerCase()`/`.trim()` on the same value.

### Rule 3: Watch algorithmic complexity

- Nested loop doing lookups → build a `Map`/`Set` first: O(n×m) → O(n+m).
- Never call I/O, `JSON.parse`, or heavy computation inside a loop when it can be hoisted or batched.
- `array.includes()`/`indexOf` inside a loop over another array → convert to a `Set`.

```diff
# BAD: O(n×m) nested lookup
- const enriched = orders.map(order =>
-   ({ ...order, user: users.find(u => u.id === order.userId) }));

# GOOD: O(n+m) with a Map
+ const userById = new Map(users.map(u => [u.id, u]));
+ const enriched = orders.map(order =>
+   ({ ...order, user: userById.get(order.userId) }));
```

### Rule 4: Avoid unnecessary allocations

- Don't create intermediate arrays/objects that are immediately thrown away.
- Don't spread (`...`) large objects/arrays inside loops.
- Reuse buffers/results where it's simple to do so (but never sacrifice correctness or clarity for micro-optimization — KISS still applies).

## MANDATORY Error-Handling Rules (parsing & API calls)

Any operation that can throw at runtime because of data you don't control MUST be guarded so a failure never crashes the program. This applies to:

- `JSON.parse` on any external input (API responses, request bodies, files, localStorage, message queues)
- Type conversion of external values (`parseInt`/`parseFloat`/`Number()`, `new Date()`, decoding)
- Every network/API call (`fetch`, axios, DB queries, SDK calls)

### Rule 1: Wrap JSON parsing — never let bad data crash the app

Combine with Performance Rule 2: parse ONCE inside a safe helper, then reuse the result.

```diff
# BAD: One malformed payload crashes the program
- const message = JSON.parse(payload);
- handleOrder(message.data);

# GOOD: Safe parse helper — parse once, fail gracefully
+ function safeJsonParse<T>(raw: string, fallback: T | null = null): T | null {
+   try {
+     return JSON.parse(raw) as T;
+   } catch {
+     logger.warn('Invalid JSON payload', { raw: raw.slice(0, 200) });
+     return fallback;
+   }
+ }
+
+ const message = safeJsonParse<OrderMessage>(payload);
+ if (!message) return { error: 'Invalid payload' };  // guard clause, no crash
+ handleOrder(message.data);
```

### Rule 2: Wrap every API call — handle network AND HTTP errors

`fetch` does NOT throw on HTTP 4xx/5xx — check `response.ok` explicitly. Network failures, timeouts, and invalid JSON bodies must all be caught.

```diff
# BAD: No error handling — network failure or 500 crashes the flow;
# also assumes the body is always valid JSON
- async function getUser(id) {
-   const res = await fetch(`/api/users/${id}`);
-   return res.json();
- }

# GOOD: One safe wrapper, reused everywhere (DRY) — returns a result, never throws
+ type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };
+
+ async function apiGet<T>(url: string): Promise<ApiResult<T>> {
+   try {
+     const res = await fetch(url);
+     if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
+     return { ok: true, data: (await res.json()) as T };
+   } catch (err) {
+     logger.error('API call failed', { url, err });
+     return { ok: false, error: 'Network error' };
+   }
+ }
+
+ // Caller handles both outcomes explicitly — program never crashes
+ const result = await apiGet<User>(`/api/users/${id}`);
+ if (!result.ok) return showError(result.error);
+ render(result.data);
```

### Rule 3: Validate converted values from external sources

`parseInt`/`Number`/`new Date` don't throw — they return `NaN`/`Invalid Date` that explode later. Validate at the boundary, once.

```diff
# BAD: NaN/Invalid Date silently propagates and breaks logic far away
- const qty = parseInt(req.query.qty);
- const from = new Date(req.query.from);
- total = price * qty;  // NaN

# GOOD: Validate once at the boundary, fail fast with a clear error
+ const qty = Number(req.query.qty);
+ if (!Number.isInteger(qty) || qty <= 0) return badRequest('Invalid qty');
+
+ const from = new Date(req.query.from);
+ if (Number.isNaN(from.getTime())) return badRequest('Invalid date');
```

### Error-handling principles (Clean Code applies here too)

- **Guard at the boundary, trust inside**: validate/parse external data once at the entry point; internal functions receive already-safe typed values — don't scatter try/catch everywhere (KISS).
- **Never swallow errors silently**: an empty `catch {}` hides bugs. Log the error and return a meaningful fallback or error result.
- **One safe wrapper, reused** (DRY): `safeJsonParse`, `apiGet` — don't repeat try/catch boilerplate at every call site.
- **Keep try blocks small**: wrap only the operation that can fail, not 50 lines of logic.

---

## Refactoring Golden Rules

1. **Behavior is preserved** — refactoring changes how, never what.
2. **Simpler than before** — if the result is more complex, revert.
3. **Small steps** — one tiny change, run tests, commit, repeat.
4. **Tests are essential** — without tests you're editing, not refactoring. Add tests first if missing.
5. **One thing at a time** — never mix refactoring with feature changes.
6. **Performance preserved or improved** — verify with the Final Checklist.

### When NOT to Refactor

- Code that works and won't change again
- Critical production code without tests (add tests first)
- Under a tight deadline
- "Just because" — every refactoring needs a clear purpose (YAGNI applies to refactoring itself)

---

## Common Code Smells & Simple Fixes

| Smell | Fix (simplest that works) |
| --- | --- |
| Long function (>50 lines) | Extract focused functions, one level of abstraction each |
| Duplicated logic | Extract ONE function (DRY) |
| God class | Split by single responsibility (SOLID-S) |
| Long parameter list (>3–4) | Group into a parameter object |
| Magic numbers/strings | Named constants |
| Nested conditionals | Guard clauses / early returns |
| Repeated parse/cast | Variable or shared parse function (Performance Rule 2) |
| Unguarded `JSON.parse` / API call | Safe wrapper with try/catch (Error-Handling Rules) |
| Unvalidated `Number`/`Date` conversion | Validate once at the boundary |
| Multiple loops over same data | One consolidated loop (Performance Rule 1) |
| Nested-loop lookups | Map/Set index (Performance Rule 3) |
| Growing switch/if-else chains | Lookup map of handlers first; pattern only if truly needed |
| Dead code | Delete it |
| Speculative abstraction | Delete it (YAGNI) |
| Primitive obsession | Domain type — only if validation/behavior justifies it (KISS) |
| Feature envy | Move logic to the object that owns the data |

### Extract Method example

```diff
# Before: one long function mixing levels of abstraction
- function printReport(users) {
-   console.log('USER REPORT');
-   console.log('============\n');
-   console.log(`Total users: ${users.length}\n`);
-   console.log('ACTIVE USERS');
-   console.log('------------');
-   const active = users.filter(u => u.isActive);
-   active.forEach(u => console.log(`- ${u.name} (${u.email})`));
-   console.log(`\nActive: ${active.length}\n`);
-   console.log('INACTIVE USERS');
-   console.log('--------------');
-   const inactive = users.filter(u => !u.isActive);
-   inactive.forEach(u => console.log(`- ${u.name} (${u.email})`));
-   console.log(`\nInactive: ${inactive.length}`);
- }

# After: single pass to partition (Perf Rule 1) + extracted helpers
+ function printReport(users) {
+   const active = [], inactive = [];
+   for (const u of users) (u.isActive ? active : inactive).push(u);
+
+   printHeader('USER REPORT');
+   console.log(`Total users: ${users.length}\n`);
+   printUserSection('ACTIVE USERS', active);
+   printUserSection('INACTIVE USERS', inactive);
+ }
+
+ function printHeader(title) {
+   console.log(`${title}\n${'='.repeat(title.length)}\n`);
+ }
+
+ function printUserSection(title, users) {
+   console.log(`${title}\n${'-'.repeat(title.length)}`);
+   users.forEach(u => console.log(`- ${u.name} (${u.email})`));
+   console.log(`\n${title.split(' ')[0]}: ${users.length}\n`);
+ }
```

### Type safety example

```diff
# Before: untyped, magic values
- function calculateDiscount(user, total, membership, date) {
-   if (membership === 'gold' && date.getDay() === 5) return total * 0.25;
-   if (membership === 'gold') return total * 0.2;
-   return total * 0.1;
- }

# After: typed, constants, still simple
+ type Membership = 'bronze' | 'silver' | 'gold';
+ const FRIDAY = 5;
+ const RATES = { bronze: 0.1, silver: 0.15, gold: 0.2, goldFriday: 0.25 } as const;
+
+ function calculateDiscount(membership: Membership, total: number, date = new Date()): number {
+   if (total < 0) throw new Error('Total cannot be negative');
+   const rate = membership === 'gold' && date.getDay() === FRIDAY
+     ? RATES.goldFriday
+     : RATES[membership];
+   return total * rate;
+ }
```

---

## On Design Patterns: use them LAST, not first

Patterns (Strategy, Chain of Responsibility, Builder, Factory...) add indirection. Indirection is a cost. Escalate complexity only when the simpler form breaks down:

1. **First**: plain function + `if`/guard clauses
2. **Then**: lookup map / object of handlers
3. **Then**: small focused functions composed together
4. **Only then**: a formal design pattern — when there are many variants, they carry state, or third parties must plug in new ones

If asked to "apply pattern X", first check whether a lookup map or a plain function achieves the same with less code — and propose the simpler option.

---

## Safe Refactoring Process

```
1. PREPARE   – ensure tests exist (write if missing); commit current state
2. IDENTIFY  – find the smell; understand behavior; plan the smallest change
3. REFACTOR  – one small change → run tests → commit → repeat
4. VERIFY    – all tests pass; run the Final Checklist below; result is SIMPLER
5. CLEAN UP  – remove dead code; update comments/docs; final commit
```

## Final Checklist (run before finishing — the ONLY checklist)

Every item below maps to a named principle. The AI must verify each explicitly — do not collapse into a vague "code looks good".

- [ ] **Behavior unchanged**; all tests pass
- [ ] **KISS**: simpler than before; no pattern where a plain function / lookup map would suffice
- [ ] **YAGNI**: no speculative abstractions, unused params, or "flexibility later" hooks
- [ ] **DRY**: logic and parse/cast each exist in one place; no wrong abstractions of look-alike code
- [ ] **SOLID**: single responsibility per unit; open for extension via lookup maps where needed; no fat interfaces / god classes; DIP only at real boundaries
- [ ] **Clean Code**: intention-revealing names, small single-purpose functions, named constants, guard clauses, no dead code, comments only for WHY
- [ ] **Performance**: one pass per collection; parse/cast once and reuse; Map/Set over nested lookups; nothing heavy inside loops
- [ ] **Error handling**: JSON parse + API calls wrapped in try/catch (incl. non-2xx); external conversions validated; no empty catch; no failure path can crash the program