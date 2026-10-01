# Adaptive S&C agent: investment memo (draft 1, 2026-10-01)

Status legend: **[sourced]** has a link in the Sources section, **[estimate]** my arithmetic on sourced inputs, **[hypothesis]** untested, **[open]** needs an answer from the cofounder or from data.

## 1. One line
A coach-in-the-loop agent that reads each athlete's readiness inputs (session RPE, wellness check-in, sleep and HRV from wearables) and proposes specific, reasoned edits to the coach's planned session. The coach approves in one tap and the athlete sees the adjusted session.

## 2. Team
- Founder 1: builder. Ships full products with an LLM co-pilot. Employed, about 10–15 hours a week. [sourced: studio records]
- Founder 2: PhD in sports science, University of Salford. Supplies the domain authority: the adjustment rules, the evidence base, credibility with coaches. [open: publications, coaching or club experience, weekly hours]
- Gap to close before any pitch: what each founder has built or achieved that is unusual. YC calls this the most important application question.

## 3. Problem
Team S&C coaches plan programs weeks ahead, then athletes arrive with different sleep, soreness and load than the plan assumed. Adjusting by hand for every athlete every day does not scale past a handful of athletes.

Evidence that the current tools fall short [sourced, excerpts only; the review sites blocked direct reads]:
- TeamBuildr: coach side is "cumbersome and counter-intuitive", and editing, copying and pasting movements in an athlete's program is "far too difficult". Repeating programs weekly still needs manual modification.
- TeamBuildr iOS app: 3.2 out of 5 from 260 ratings. Its release notes list repeated fixes for crashes, unexpected sign-outs, offline mode and messaging disconnects.
- TrainHeroic: reviews report crashes, slow loading, and entries that sometimes do not save.
- Kitman: rigid setup and slow feature delivery (6 reviews, all June 2023, thin).

What is not evidenced: that coaches want automatic adjustment, or will pay for it. This is the central hypothesis.

## 4. Insight and why now
- Adaptation from wearable readiness exists for individuals: WHOOP Coach, Athletica, Humango, SensAI, JuggernautAI, Fitbod. Monitoring platforms for teams (Kitman, Smartabase, CoachMePlus) show data but did not, in my searches, change the program. [sourced; limited search]
- LLM agents can now read a program plus readiness data and produce an edit with a reason in plain language.
- Wearable aggregator APIs remove per-device integration work. [sourced]
- The team-coach slot (many athletes, one accountable coach) looks open. The accountable coach is why approval-by-coach is the right design.

## 5. Evidence base and its limits
- HRV-guided training shows a small positive effect in endurance athletes (VO2max effect size about 0.40, varying by athlete level and sex). [sourced]
- I found no strength-specific equivalent. [open: cofounder to supply strength-relevant literature]
- Consequence for claims: sell time saved and earlier visibility of overload. Do not claim better performance or injury prevention until the cofounder can cite strength-relevant evidence.

## 6. Market (bottom-up, unfinished)
Inputs [sourced]: TeamBuildr claims 5,500 organizations and lists $90–280/month. UKSCA has over 2,600 members, about 800 accredited. About 25,000 UK personal training businesses.

- TeamBuildr-scale revenue if all customers paid list price: 5,500 × $1,080 to $3,360 per year, about $6M to $18M. [estimate]
- Reading: team S&C software alone is a good small business, not obviously venture scale. A venture case needs an expansion path: personal trainers and general adaptive coaching for any coach, then pro and academy clubs. [hypothesis]
- UK SAM and SOM: [open] count UK schools, colleges, clubs and gyms with a paid S&C coach.

## 7. Competition
| Segment | Examples | Adapts from wearables | Sold to teams |
|---|---|---|---|
| Individual lifters | JuggernautAI, Fitbod, SensAI, WHOOP Coach | yes (varies) | no |
| Endurance | Athletica, Humango, Garmin Coach | yes | no |
| Team programming | TeamBuildr, TrainHeroic, Bridge | no | yes |
| Team monitoring | Kitman, Smartabase, CoachMePlus | shows data | yes |
| Budget monitoring | Coach ID App, Mingle, Fractall, Metrifit | shows data | yes |

Kitman is the Premier League and EFL academy platform. Do not target that tier.

## 8. Product and wedge
See SPEC.md. Wedge: the coach-side program editor plus the adjustment agent, for school, college and lower-league club S&C. Expansion: personal trainers, then clubs.

## 9. Business model [hypothesis]
Per-athlete-band pricing as the incumbents do, placed between Volt and TeamBuildr. First price to test: GBP 79/month for up to 50 athletes. Unit costs to measure: LLM cost per athlete-day, and wearable aggregator cost (Terra $399/month, or Junction about $0.50 per user per month with a $300 minimum). Aggregator cost starts only when a paying pilot exists.

## 10. Go-to-market [hypothesis]
Content from the cofounder: evidence-based posts on auto-regulation for S&C coaches, on LinkedIn and in UK S&C communities, each linking to a landing page with a payment link. Public posts, not cold outreach.

## 11. Legal and data
HRV and sleep data are health data. Under UK GDPR that is special-category data, which normally needs explicit consent and a data protection impact assessment. [open: confirm with the ICO guidance or a lawyer] Incorporation and IP ownership between the two founders need a written agreement before any funding conversation.

## 12. Risks
1. Coaches may not trust automatic adjustments. Mitigation: coach approves every change, every change shows its reason and inputs.
2. Wearable readiness scores may add little beyond RPE and wellness questions for strength work. Mitigation: measure it (SPEC.md § Evaluation).
3. Market is small unless the wedge expands.
4. Two part-time founders against funded competitors.

## 13. Kill criteria
- The cofounder cannot write at least 10 distinct, evidence-backed adjustment rules for strength sessions in one sitting.
- The agent agrees with the cofounder's decisions on less than 80% of the 30-scenario test set after two prompt iterations.
- The landing page with a payment link gets no paid deposit or pre-order after 30 days of live content distribution.

## Sources
- TeamBuildr: https://www.teambuildr.com/pricing, https://www.teambuildr.com/features, https://apps.apple.com/us/app/teambuildr-training/id1588729407
- Reviews and roundups: https://www.softwareadvice.com/fitness/trainheroic-profile/, https://softwarefinder.com/analytics-software/kitman-labs/reviews, https://strengthandconditioning.com/best-strength-and-conditioning-software/, https://fractall.fit/blog/posts/best-budget-athlete-monitoring-app-coaches
- Kitman in UK: https://www.premierleague.com/en/news/3750826
- Adaptive apps: https://www.sensai.fit/blog/workout-app-adjusts-for-fatigue, https://alphaprogression.com/en/blog/best-ai-strength-training-apps
- HRV evidence: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7663087/, https://www.jsams.org/article/S1440-2440(21)00108-0/fulltext
- Aggregators: https://sahha.ai/compare/terra-alternatives/, https://www.tryvital.com/pricing, https://www.spikeapi.com/pricing
- UK market: https://create.fit/how-many-personal-trainers-are-there-in-the-uk/, https://www.researchgate.net/publication/332242423_The_future_development_pathway_of_strength_and_conditioning_a_proposed_model_from_the_UKSCA
- Investor criteria: https://www.ycombinator.com/howtoapply, https://www.antler.co/blog/what-antler-looks-for-in-a-founder, https://microventures.com/checklist-for-vc-due-diligence
