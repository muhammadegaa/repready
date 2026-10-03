# What "agentic" means for RepReady, and where we stand (DRAFT)

Sources read in full on 2026-10-03: Biswas, *Building Agentic AI Systems* (Packt, 2025) and Soh, Tidwell, Singh, *Building and Distributing Agentic AI Solutions* (Apress, 2026). Both are LLM-centric surveys. They are strong on safety and architecture, thin on UX, autonomy levels and small-team SaaS. Where they are silent, this document says so and the choice is ours.

## Our definition
RepReady is a **rules-driven agent with high operational autonomy and low hierarchical autonomy**: it perceives (check-ins, calendar, minutes), decides inside limits enforced in code, prepares the work, and defers every consequential decision to the coach. A language model is used in exactly one slot: turning messy text into structure, which the coach reviews. (Biswas Ch 2: agency and autonomy are satisfied without an LLM; Soh Ch 6/8: deterministic workflows with human approval are a production pattern.)

## Autonomy ladder (ours, using the books' "progressive autonomy", Biswas Ch 9)
0. **Suggest.** The agent proposes, the coach decides. *(today)*
1. **One-click for routine.** Low-risk proposals approved in one action, with the reason shown.
2. **Auto-apply low-risk, coach opt-in.** Per rule and per group, only after the coach has accepted that rule at a stated rate for a stated period, with a daily summary and an off switch per player.
3. Never autonomous: pain or illness notes, anything over the 25 percent cut, anything raising load above plan.

## Where we already match
Hard limits in code; coach approval; pain stops automation; model output validated against a strict schema; the model has no tools or write access; reactive (check-in) and proactive (next week, who played, calendar) behaviour; evidence on every proposal (rule, inputs); per-player baseline instead of a league table.

## Gaps and what to build (ordered)
1. Acceptance and override rate **per rule**, override reasons, and **corrections per import** as the reader's error rate. (Biswas Ch 4/9; Soh Ch 9)
2. **Golden sets**: scenario tests for the rules engine with property checks (never above plan, never cut over 25 percent, pain gives no proposal), and a set of real programs for the reader. (Soh Ch 3)
3. **Redact known player names before any model call**, restoring them after. The squad list is known, so this is deterministic. Health information still must not be pasted. (Biswas Ch 1/9)
4. Autonomy ladder rung 1 and 2, built with the controls above.
5. A public one-page **intended use and limits** statement: what it does, what it never does. (Soh Ch 3 step 7)
6. Rule-based **proactive nudges**: trending down, quiet for three days, shown on Today. (Biswas Ch 11)
7. A **pilot health view** for us: Week 1 program confirmed, Week 2 players checking in, Week 4 coach deciding most days; "coach only, no players" as a churn signal. (Soh Ch 9)
8. Bounded, coach-approved **rule tuning suggestions** ("you overrode R1 for 6 of 8 days; raise the threshold?"), never self-modifying. (Biswas Ch 4 warns against model-chosen weights)

## Not covered by either book (our own judgement)
Autonomy levels and approval fatigue, explanation UX, mobile check-in friction, under-18 players, sport-specific liability, selling "no outside AI" as a feature. Legal advice is needed on the last three.

## Positioning risk
Some buyers and investors equate "agentic" with LLM autonomy and multi-agent systems. The answer is the definition above and the autonomy ladder, shown honestly.
