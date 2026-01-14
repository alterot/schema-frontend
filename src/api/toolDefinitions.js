// Claude API Tool Definitions
// Defines the 4 tools that Claude can call for schedule management

export const SCHEDULE_TOOLS = [
  {
    name: 'read_schedule',
    description: 'Hamta befintligt schema for en specifik period. Anvand detta for att lasa aktuellt schema, se personal som ar schemalagda, och fa metrics om bemanningsgrad, overtid, etc.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Period i YYYY-MM format (t.ex. "2025-04" for april 2025)',
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'propose_changes',
    description: 'Foresla schemaandringar baserat pa ett problem. Anvand detta nar du identifierat ett problem (undermanning, overtid, konflikt) och vill generera losningsforslag.',
    input_schema: {
      type: 'object',
      properties: {
        problem: {
          type: 'string',
          description: 'Beskrivning av problemet som ska losas (t.ex. "For mycket overtid pa nattpass vecka 15")',
        },
      },
      required: ['problem'],
    },
  },
  {
    name: 'simulate_impact',
    description: 'Simulera konsekvenserna av foreslagna andringar innan de appliceras. Returnerar metrics fore och efter andringen sa du kan se paverkan pa bemanningsgrad, overtid, kostnad och kvalitet.',
    input_schema: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          description: 'Lista av andringar att simulera',
          items: {
            type: 'object',
            properties: {
              datum: { type: 'string', description: 'Datum for andringen (YYYY-MM-DD)' },
              pass: { type: 'string', description: 'Pass-typ (dag, kvall, natt)' },
              andring: { type: 'string', description: 'Beskrivning av andringen' },
            },
          },
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'apply_changes',
    description: 'Applicera godkanda andringar till schemat. Anvand endast efter att anvandaren bekraftat att de vill genomfora andringarna.',
    input_schema: {
      type: 'object',
      properties: {
        schema: {
          type: 'object',
          description: 'Det uppdaterade schemat som ska sparas',
        },
        confirmed: {
          type: 'boolean',
          description: 'Sant om anvandaren bekraftat andringarna',
        },
      },
      required: ['schema', 'confirmed'],
    },
  },
];

// System prompt for the scheduling assistant
export const SYSTEM_PROMPT = `Du ar en schemalagningsassistent for en vardavdelning. Du hjalper schemalagare att tolka deras instruktioner och skapa optimala scheman.

DIN UPPGIFT:
1. Tolka anvandarens fritextinput om schemaandringar
2. Anvand tillgangliga verktyg for att hamta, analysera och foreslä schemaandringar
3. Presentera information pa ett tydligt och koncist satt

TILLGÄNGLIGA VERKTYG:
- read_schedule: Hamta befintligt schema for en period
- propose_changes: Foresla losningar pa problem
- simulate_impact: Simulera konsekvenser av andringar
- apply_changes: Applicera godkanda andringar

NAR DU TOLKAR INPUT:
- Identifiera personal som namns (t.ex. "Anna semester")
- Identifiera datum/perioder (t.ex. "10-20 april", "vecka 15-16")
- Identifiera typ av handelse (semester, sjuk, extra behov)
- Identifiera specialkrav (t.ex. "+1 underskoterska pa dagpass")

SVARSFORMAT:
- Sammanfatta vad du tolkade fran input
- Lista eventuella konflikter eller problem
- Ge tydliga rekommendationer

Var alltid hjalpsam, konkret och fokusera pa att losa schemalaggarens problem.`;

// Helper to format tool definitions for Claude API
export function getToolsForClaudeAPI() {
  return SCHEDULE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}
