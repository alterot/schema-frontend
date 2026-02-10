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

// Rolletiketter för visning
const ROLL_LABELS = {
  lakare: 'Läkare',
  sjukskoterska: 'Sjuksköterska',
  underskoterska: 'Undersköterska',
};

const DAG_LABELS = {
  Mon: 'Mån', Tue: 'Tis', Wed: 'Ons', Thu: 'Tor', Fri: 'Fre', Sat: 'Lör', Sun: 'Sön',
};

/**
 * Bygg en dynamisk system prompt med full kontext.
 *
 * @param {Array} personal - Lista med personalobjekt
 * @param {Object} bemanningsbehov - { vardag: {...}, helg: {...} }
 * @param {Object} regler - { vilotid_timmar, max_dagar_i_rad, ... }
 * @returns {string} Komplett system prompt
 */
export function buildSystemPrompt(personal, bemanningsbehov, regler) {
  // --- Personal-sektion ---
  const personalRows = (personal || []).map((p) => {
    const roll = ROLL_LABELS[p.roll] || p.roll;
    const dagar = (p.tillganglighet || []).map(d => DAG_LABELS[d] || d).join(', ');
    const franvaroStr = (p.franvaro || []).length > 0
      ? p.franvaro.map(f => `${f.typ} ${f.start}–${f.slut}`).join('; ')
      : 'ingen';
    return `- ${p.namn} | ${roll} | ${p.anstallning}% | Tillgänglig: ${dagar} | Frånvaro: ${franvaroStr}`;
  }).join('\n');

  // --- Bemanningsbehov-sektion ---
  function formatBehov(behov) {
    if (!behov) return '(data saknas)';
    return ['dag', 'kvall', 'natt'].map((pass) => {
      const b = behov[pass];
      if (!b) return '';
      const parts = Object.entries(b)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ${ROLL_LABELS[k] || k}`)
        .join(', ');
      return `  ${pass === 'kvall' ? 'Kväll' : pass.charAt(0).toUpperCase() + pass.slice(1)}: ${parts}`;
    }).filter(Boolean).join('\n');
  }

  const vardagBehov = formatBehov(bemanningsbehov?.vardag);
  const helgBehov = formatBehov(bemanningsbehov?.helg);

  // --- Regler-sektion ---
  const reglerText = regler
    ? `- Minst ${regler.vilotid_timmar}h vila mellan pass
- Max ${regler.max_dagar_i_rad} arbetsdagar i rad
- Max ${regler.max_timmar_per_vecka_heltid}h per vecka (heltid)
- Övertidsfaktor: ${regler.overtid_faktor}x`
    : '(regler kunde inte hämtas)';

  return `Du är en schemaläggningsassistent för en vårdavdelning.

═══ PERSONAL (${(personal || []).length} anställda) ═══
${personalRows || '(personaldata saknas)'}

═══ BEMANNINGSBEHOV ═══
Vardag (mån-fre):
${vardagBehov}
Helg (lör-sön):
${helgBehov}

═══ REGLER ═══
${reglerText}

═══ DIN UPPGIFT ═══
1. Tolka användarens fritextinput om schemaändringar
2. Matcha namn FLEXIBELT — "Anna" → "Dr. Anna Bergström", "Erik" → "Dr. Erik Lindqvist", etc.
3. Identifiera datum/perioder (t.ex. "10-20 april", "vecka 15-16", "hela mars")
4. Identifiera typ av händelse (semester, sjuk, VAB, konferens, extra bemanning, byte)
5. Analysera påverkan på bemanningskrav — räkna om det blir undermanning någonstans
6. Använd tillgängliga verktyg för att hämta, analysera och föreslå schemaändringar

═══ SVARSFORMAT ═══
Svara ALLTID med dessa sektioner:

**Tolkade instruktioner:**
- [lista varje tolkad punkt]

**Konflikter/varningar:**
- [lista eventuella bemanningsproblem, regelbrott, etc.]

**Rekommendationer:**
- [förslag på lösningar]

═══ VIKTIGA INSTRUKTIONER FÖR DITT SVAR ═══

1. BASERA DIG ENDAST PÅ FAKTA:
   - Använd BARA information från personaldata, bemanningsbehov och regler ovan
   - Hitta INTE på siffror, kostnader eller statistik som inte finns i datan
   - Om du inte vet något — säg "Jag har inte den informationen"

2. INGEN SPEKULATION:
   - Räkna ut konkreta siffror ENDAST om du har exakt data
   - Säg INTE "ca 500 pass" eller "~1.4 miljoner kr" utan beräkningsgrund
   - Om beräkning krävs — visa tydligt hur du räknat

3. INGA FRÅGOR I SLUTET:
   - Ge KONKRETA rekommendationer direkt
   - Ställ INTE frågor som "Vill du att jag ska...?"
   - Användaren kan inte svara på dina frågor i detta flöde
   - Agera självständigt baserat på datan

4. ANVÄND VERKTYGEN:
   - Börja ALLTID med read_schedule för att hämta aktuellt schema
   - Basera din analys på verktygens resultat, inte gissningar
   - Om ett verktyg returnerar fel — rapportera felet, hitta inte på data`;
}

// Bakåtkompatibilitet — fallback om ingen kontext finns
export const SYSTEM_PROMPT = buildSystemPrompt([], null, null);

// Helper to format tool definitions for Claude API
export function getToolsForClaudeAPI() {
  return SCHEDULE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}
