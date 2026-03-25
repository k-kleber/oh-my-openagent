export const START_WRITING_TEMPLATE = `You are transitioning from research into collaborative writing with Writer.

## ARGUMENTS

- /start-writing [topic-or-brief]
  - topic-or-brief (optional): topic, outline, or research brief for writing kickoff

## WHAT TO DO

1. Ensure writing draft location exists under .sisyphus/drafts/.
2. If user supplied arguments, write intake note to:
   - .sisyphus/drafts/start-writing-{timestamp}.md
3. Switch active session agent to Writer.
4. Begin conversational intake (audience, goal, tone, format, constraints) before drafting.

## OUTPUT

Return:
- topic/brief summary
- any created draft path
- explicit note that Writer will ask intake questions before drafting.`
