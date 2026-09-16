# Profile and nutrition report flow repair

Applied directly to the Desktop checkout containing Gemini's uncommitted refinements. Those refinements remain intact; this pass does not replace the three-stop locality UI or redesign Profile.

## Corrected behavior

- Completed users can visit Profile, planning settings, report history and the dashboard while acknowledgment is pending. Login and landing routing agree. Authentication, role, onboarding and consent gates remain enforced.
- Profile corrections no longer require acknowledging the report they invalidate. Profile saves update the session's report badge immediately.
- Planning settings no longer fetch unrelated progress history. Failure to fetch progress metrics cannot prevent profile fields from loading.
- Read-only progress history requires verification, onboarding and consent but not a current report. The progress router is mounted before the broad user router so the intended read policy actually executes. Weight mutations and meal actions retain their existing readiness gates.
- The saved-settings modal keeps OK primary. Regenerate Plan first opens `/profile/nutrition-report?next=regenerate` when necessary; successful current-version acknowledgment then continues to the existing plan-regeneration flow. Ordinary acknowledgment returns to Profile.
- Both report URLs use one shared `NutritionReportWorkspace`. Session-object updates no longer repeatedly fetch/generate reports. A failed report GET surfaces an error instead of triggering generation. An acknowledgment conflict offers regeneration; regenerated guidance reloads its profile context. PDF object URLs are released.
- Acknowledgment controls stay within the profile content and above mobile navigation. Existing typography, colors and report sections are retained.
- Corrected missing geography type, direct event-handler argument mismatch and unreachable landing-page role expression found by TypeScript.

## Verification

- Frontend: 158 tests across 40 files passed, including eight route-access regressions and five report-lifecycle regressions.
- Backend: 526 tests passed, zero failed, one existing clinical TODO.
- Both linters and TypeScript/script checks passed. Frontend production build and backend build passed.
- `backend/scripts/report-profile-acceptance.ts` passed against the guarded disposable database on loopback port 55465. It verifies profile save/staleness, repeat edits, history access, meal-generation rejection, stale/wrong-version acknowledgment rejection, current-version acknowledgment, and report-history acknowledgment persistence. Synthetic provider output is seeded; no Gemini request or real account mutation occurs. The test removes its synthetic user afterward.

Live Gemini generation and authenticated browser layout were not verified in this pass. Changes remain alongside the existing uncommitted Gemini work; no branch merge or push was performed.
