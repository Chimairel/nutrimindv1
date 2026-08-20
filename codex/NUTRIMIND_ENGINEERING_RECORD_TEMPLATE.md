# NutriMind Engineering Record

Document status: Living project evidence record  
Project: NutriMind  
Owner: Chimairel Pacaldo  
Started: [DATE]  
Current architecture baseline: Next.js frontend + Express API + Prisma/PostgreSQL  

---

## 1. Purpose and maintenance rules

This is the primary chronological and traceability record for NutriMind engineering work. It supports the Software Project Management Plan (SPMP), Software Requirements Specification (SRS), Software Design Description (SDD), and Software Test Documentation (STD).

Rules:

- Update this file during the same task as a code, schema, configuration, test, or documentation change.
- Record verified facts separately from requirements, proposals, and uncertainties.
- Do not delete old decisions or defects. Mark them resolved, rejected, or superseded and link the replacement ID.
- Do not record secret values, tokens, passwords, private health information, or raw production data.
- “Implemented” does not automatically mean integration-tested, E2E-tested, deployed, or clinically reviewed.

---

## 2. Identifier register

| Prefix | Meaning | Next ID |
| --- | --- | --- |
| REQ | Functional or non-functional requirement | REQ-001 |
| ADR | Architecture/design decision | ADR-001 |
| RISK | Technical, project, security, clinical, privacy, or operational risk | RISK-001 |
| DEF | Defect, inconsistency, or documentation mismatch | DEF-001 |
| CHG | Implemented change set, formatted CHG-YYYYMMDD-## | CHG-[DATE]-01 |
| TEST | Test case or verification procedure | TEST-001 |
| UNC | Unresolved uncertainty | UNC-001 |
| DOC | Documentation correction or addition | DOC-001 |

---

## 3. Current system baseline

### 3.1 Product summary

[Describe what NutriMind currently does in evidence-based language.]

### 3.2 Current architecture

| Area | Current implementation | Evidence | Verification level |
| --- | --- | --- | --- |
| Frontend | Next.js 14 App Router, React, TypeScript, Tailwind, Radix | [files] | [level] |
| Backend | Express/TypeScript REST API | [files] | [level] |
| Database | Prisma/PostgreSQL | [files] | [level] |
| Authentication | Custom JWT access/refresh flow | [files] | [level] |
| AI | Google Gemini with validation/fallback behavior | [files] | [level] |
| Food data | FNRI/database lookup plus labelled estimates | [files] | [level] |

### 3.3 Verification-level vocabulary

- Planned
- Designed
- Partially implemented
- Implemented but unverified
- Statically verified
- Integration tested
- End-to-end tested
- Deployed
- Clinically reviewed

---

## 4. Requirements register

| ID | Requirement | Type | Actor/source | Priority | Acceptance criteria | Verification | Status | Related IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | [Requirement] | Functional / Non-functional | [source] | Must / Should / Could | [criteria] | [TEST IDs] | Proposed / Approved / Implemented / Verified | [IDs] |

Detailed requirement entry:

### REQ-### — [Title]

- Statement:
- Rationale:
- Actor/source:
- Preconditions:
- Main behavior:
- Alternative/error behavior:
- Data and validation rules:
- Authorization rules:
- Acceptance criteria:
- Related API/UI/schema components:
- Related `ADR`, `RISK`, `DEF`, `TEST`, and `CHG` IDs:
- Status and verification level:
- SRS destination:

---

## 5. Architecture decision records

| ID | Decision | Status | Date | Consequences | Related IDs |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | [Decision summary] | Proposed / Accepted / Rejected / Superseded | [date] | [summary] | [IDs] |

### ADR-### — [Decision title]

- Date:
- Status:
- Context/current problem:
- Conflicting sources or constraints:
- Options considered:
- Decision:
- Reasoning:
- Positive consequences:
- Negative consequences/tradeoffs:
- Security/privacy/clinical impact:
- Migration and compatibility impact:
- Supersedes/superseded by:
- Related requirements, risks, defects, changes, and tests:
- SDD destination:

---

## 6. Risk register

| ID | Risk | Category | Likelihood | Impact | Rating | Mitigation | Trigger/owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RISK-001 | [Risk] | Project / Technical / Security / Privacy / Clinical / Operational | Low/Medium/High | Low/Medium/High/Critical | [rating] | [action] | [trigger/owner] | Open/Monitoring/Mitigated/Accepted |

### RISK-### — [Title]

- Description:
- Cause:
- Possible consequence:
- Affected actors/data/components:
- Likelihood and impact rationale:
- Preventive controls:
- Detection/monitoring:
- Contingency or rollback:
- Owner and review date:
- Related IDs:
- SPMP destination:

---

## 7. Defect and contradiction register

| ID | Defect/contradiction | Severity | Evidence | Expected behavior | Status | Related IDs |
| --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | [Defect] | Low/Medium/High/Critical | [files/tests] | [expected] | Open/In progress/Resolved/Deferred | [IDs] |

### DEF-### — [Title]

- Date found:
- Current behavior:
- Expected behavior:
- Reproduction or evidence:
- Root cause:
- User/security/clinical/data impact:
- Resolution decision:
- Fixed by:
- Verified by:
- Remaining limitation:
- SRS/SDD/STD destinations:

---

## 8. Uncertainty and open-question register

| ID | Uncertainty/question | Why it matters | Evidence needed | Decision owner | Status |
| --- | --- | --- | --- | --- | --- |
| UNC-001 | [Question] | [impact] | [needed evidence] | [owner] | Open/Resolved |

---

## 9. API and interface register

| Method | Route/interface | Actor | Purpose | Request validation | Response | Auth/policy | Status | Related REQ/TEST |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [method] | [route] | [role] | [purpose] | [schema] | [shape/status] | [rules] | [level] | [IDs] |

External interfaces:

| Interface | Purpose | Data exchanged | Failure behavior | Secret/config names | Verification level |
| --- | --- | --- | --- | --- | --- |
| Gemini | [purpose] | [non-sensitive description] | [fallback/error] | GEMINI_API_KEY | [level] |
| SMTP | [purpose] | [description] | [behavior] | SMTP_* | [level] |
| Google OAuth | [purpose] | [description] | [behavior] | GOOGLE_CLIENT_ID | [level] |

---

## 10. Data design and migration register

| Model/table | Purpose | Key relationships | Constraints/indexes | Known issues | Related ADR/REQ |
| --- | --- | --- | --- | --- | --- |
| [model] | [purpose] | [relations] | [constraints] | [issues] | [IDs] |

Migration entry:

### MIGRATION — [Title/date]

- Schema change:
- Reason:
- Existing-data inspection:
- Duplicate/null handling:
- Backfill:
- Application compatibility:
- Apply procedure:
- Recovery/rollback approach:
- Verification:
- Related IDs:

---

## 11. Test register

| ID | Test title | Level | Related requirement/defect/risk | Preconditions/fixture | Expected result | Latest result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TEST-001 | [Test] | Unit/Integration/E2E/Static/Manual/Security/Accessibility | [IDs] | [fixture] | [expected] | Pass/Fail/Blocked/Not run | [file/command/date] |

### TEST-### — [Title]

- Objective:
- Related IDs:
- Test level:
- Environment/mocks:
- Preconditions and data:
- Steps or automated test path:
- Expected result:
- Actual result:
- Date and command:
- Status:
- Defects opened:
- Regression notes:
- STD destination:

---

## 12. Chronological change log

### CHG-YYYYMMDD-## — [Task title]

- Date:
- Request/source:
- Objective:
- Final status: Completed / Partial / Analysis only / Blocked
- Risk classification:
- Clinical-safety-impacting: Yes/No
- Security-impacting: Yes/No
- Schema/migration-impacting: Yes/No

Before:

- [Previous behavior and problem]

Changes:

| File/object | Change | Reason |
| --- | --- | --- |
| [path/object] | [summary] | [reason] |

Traceability:

- Requirements:
- Decisions:
- Defects:
- Risks:
- Tests:
- Documentation:

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| [command] | Static/Unit/Integration/E2E/Manual | Pass/Fail/Blocked | [notes] |

Not verified:

- [Item and reason]

Known limitations/follow-up:

- [Limitation]

Documentation extraction notes:

- SPMP:
- SRS:
- SDD:
- STD:

---

## 13. Feature implementation status

| Feature | Actor | Requirement IDs | Implementation evidence | Verification level | Gaps/risks | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| [feature] | [role] | [IDs] | [files] | [level] | [gaps] | [action] |

---

## 14. SPMP extraction index

| SPMP topic | Source record IDs/sections | Current summary | Last updated |
| --- | --- | --- | --- |
| Scope and objectives | [IDs] | [summary] | [date] |
| Work breakdown/phases | [IDs] | [summary] | [date] |
| Schedule/status | [CHG IDs] | [summary] | [date] |
| Risk management | [RISK IDs] | [summary] | [date] |
| Configuration/change control | [ADR/CHG IDs] | [summary] | [date] |
| Quality assurance | [TEST IDs] | [summary] | [date] |

---

## 15. SRS traceability matrix

| Requirement ID | Requirement summary | Actor | Design components | Test IDs | Implementation/verification status |
| --- | --- | --- | --- | --- | --- |
| REQ-### | [summary] | [actor] | [components] | [tests] | [status] |

---

## 16. SDD extraction index

| SDD topic | ADR/data/API/change IDs | Current design summary | Diagrams/evidence needed |
| --- | --- | --- | --- |
| System architecture | [IDs] | [summary] | [items] |
| Component design | [IDs] | [summary] | [items] |
| Database design | [IDs] | [summary] | [items] |
| API/interface design | [IDs] | [summary] | [items] |
| Security design | [IDs] | [summary] | [items] |
| State transitions/algorithms | [IDs] | [summary] | [items] |

---

## 17. STD execution summary

| Test cycle/date | Scope | Environment | Passed | Failed | Blocked/not run | Defects | Acceptance status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [cycle] | [scope] | [environment] | [count] | [count] | [count] | [IDs] | [status] |

---

## 18. Current known limitations and next priorities

1. [Highest-priority verified limitation]
2. [Next limitation]
3. [Next limitation]

Recommended next bounded task:

[One task with acceptance criteria.]

