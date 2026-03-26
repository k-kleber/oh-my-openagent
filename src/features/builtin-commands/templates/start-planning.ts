export const START_PLANNING_TEMPLATE = `You are transitioning from fast brainstorming into deep planning with Prometheus.

## ARGUMENTS

- /start-planning [topic-or-note]
  - topic-or-note (optional): idea/topic to deep-plan

## WHAT TO DO

1. Ensure planning draft location exists under .sisyphus/drafts/.
2. If user supplied arguments, write a concise planning intake note to:
   - .sisyphus/drafts/start-planning-{timestamp}.md
3. Set active agent to Prometheus for this session.
4. Handoff to Prometheus with explicit deep-planning request and any draft file path.
5. Produce the first complete plan draft immediately under .sisyphus/plans/.
6. Keep output concise and planning-focused.

## PLANNING POLICY (MANDATORY)

- Treat all handoff context (topic, draft, brainstorm source) as valid input and begin analysis immediately.
- Clarifying questions are allowed only when they materially change architecture/scope decisions and cannot be reasonably assumed.
- Do not stall waiting for answers; draft the first complete plan using explicit assumptions.
- Capture unresolved items in an "Assumptions and Open Questions" section in the plan.
- If a brainstorm file exists, treat it as primary input and convert it into executable plan tasks.

## HANDOFF REQUIREMENTS

- Agent to use: Prometheus (Plan Builder)
- Include:
  - topic/idea summary
  - constraints and assumptions
  - assumptions and open questions
  - draft path under .sisyphus (if created)

## OUTPUT

Return:
- chosen planning topic
- any created draft path
- explicit confirmation that Prometheus should continue with deep plan generation.`
