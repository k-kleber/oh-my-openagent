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
5. After handoff, continue with Prometheus planning behavior only.
4. Keep output concise and planning-focused.

## HANDOFF REQUIREMENTS

- Agent to use: Prometheus (Plan Builder)
- Include:
  - topic/idea summary
  - constraints and assumptions
  - open questions
  - draft path under .sisyphus (if created)

## OUTPUT

Return:
- chosen planning topic
- any created draft path
- explicit confirmation that Prometheus should continue with deep plan generation.`
