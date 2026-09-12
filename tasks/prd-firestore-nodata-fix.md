# PRD: Firestore No-Data Fix (Admin + Team, Both Apps)

## Introduction/Overview

After the secure-rules cutover, authenticated admins/agents see empty screens: every Firestore `list` query denies with `Missing or insufficient permissions`, while single-doc reads pass. Token claims are verified correct (email + scope present). This PRD fixes data visibility with a simplified-rules rollout: open reads to authenticated users first, keep writes scoped, verify on both apps, then tighten later.

## Goals

- Admin sees their full team + all team data within one session
- Agents can vehicle-search and see dossier data
- Same verified working on web AND Android app
- Diagnostics panel shows 5/5 PASS for admin and agent accounts
- No user data loss or re-migration during the fix

## User Stories

### US-001: Publish simplified Firestore rules
**Description:** As a super-admin, I want rules that allow reads to any authenticated user while keeping writes role-scoped, so data comes back immediately.

**Acceptance Criteria:**
- [ ] New `firestore.rules.simple` staged in web repo with `allow get, list: if signedIn()` on users, vehicles, uploaded_files, search_histories, field_permissions, subscriptions
- [ ] All write rules stay scoped (super/admin-only as today, no open writes)
- [ ] `tsc` clean (rules file does not break web build)
- [ ] Publish checklist written (paste file, publish, wait 2 min)

### US-002: Verify admin team list + data on web
**Description:** As an admin, I want my team accounts and vehicle data visible so I can manage operations.

**Acceptance Criteria:**
- [ ] Admin logout + fresh login works
- [ ] Users tab shows full team (no empty list, no console permission errors)
- [ ] Vehicle search returns results
- [ ] Dashboard counts load (live total)
- [ ] Diagnostics panel: 5/5 PASS
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Verify agent search on web
**Description:** As a field agent, I want vehicle search + dossier so I can work in the field.

**Acceptance Criteria:**
- [ ] Agent logout + fresh login works
- [ ] Plate search returns matching vehicles
- [ ] Dossier opens with masked/unmasked fields per permissions
- [ ] Recent searches log without permission errors
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Verify Android app end-to-end
**Description:** As an Android user (admin + agent), I want login, team visibility, search and recharge UI working.

**Acceptance Criteria:**
- [ ] CI build green on pushed branch
- [ ] Fresh APK installs as update (no uninstall, data preserved)
- [ ] Admin login shows team + subscription overview + recharge works
- [ ] Agent login + vehicle search works (server-side, Kota-first)
- [ ] No permission-denied toasts on core flows

### US-005: Relogin rollout + final confirmation
**Description:** As super-admin, I want every user on a fresh session so stale tokens stop causing denies.

**Acceptance Criteria:**
- [ ] All admins + agents logged out + logged in fresh (web + Android)
- [ ] No `Missing or insufficient permissions` errors in console for 1 full workflow (login → search → dossier → logout)
- [ ] Confirm message from super-admin that team + data visible

### US-006 (follow-up): Tighten user-doc reads
**Description:** As a security owner, I want per-doc scoping re-applied step-by-step after stability, so agent passwords are not listable.

**Acceptance Criteria:**
- [ ] Proposed rule change reviewed against diagnostics (small list probe must stay PASS)
- [ ] Rolled out behind the same verify loop (US-002/US-003 re-run green)
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Simplified rules must allow `get` and `list` to any Firebase-authenticated user on all 6 collections
- FR-2: Simplified rules must keep every existing write scope unchanged (no new open writes)
- FR-3: Web app must work with simplified rules with zero code changes
- FR-4: Android app must work with simplified rules with zero code changes
- FR-5: Diagnostics panel (web dashboard) must report 5/5 PASS for admin and agent sessions
- FR-6: Relogin must be sufficient to pick up the fix (no app reinstall beyond normal APK update)

## Non-Goals (Out of Scope)

- No data migration or re-import of vehicles/users
- No new features (no UI redesign, no new roles, no new collections)
- No per-document password hiding in this phase (tracked as US-006 follow-up)
- No Firebase console project/database restructuring

## Design Considerations

- Reuse existing Diagnostics panel (`Run Diagnostics` on web dashboard) as the verifier
- Keep `firestore.rules.secure` (v3 token-claim design) in repo untouched for the later tightening phase
- Android verification needs a fresh CI-built APK installed as update

## Technical Considerations

- Firestore rules publish takes ~1-2 min to propagate; verification must wait
- Auth ID tokens refresh hourly; fresh logout+login guarantees current claims
- Known good baseline: original open rules ran the full app; simplified rules are open-reads + scoped-writes (strictly safer than baseline)

## Success Metrics

- Admin team list loads with correct count (matches Firestore console user count for that tree)
- Agent plate search returns expected vehicle in <3s
- Zero `Missing or insufficient permissions` errors across login → search → dossier → logout on both apps
- Diagnostics 5/5 PASS for one admin and one agent account

## Open Questions

- Should US-006 (tightening) reuse token-scope design or switch to split-credential docs? (Decide after stability, not blocking this fix)
