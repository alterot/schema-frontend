// Claude API Tool Definitions
// Defines the 4 tools that Claude can call for schedule management

export const SCHEDULE_TOOLS = [
  {
    name: 'read_schedule',
    description: 'Hamta befintligt schema for en specifik period. Anvand detta for att lasa aktuellt schema, se personal som ar schemalagda, och fa metrics om bemanningsgrad, overtid, etc. Kan aven ta constraint_overrides for att tillata overtid — anvand BARA detta om anvandaren EXPLICIT ber om det.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Period i YYYY-MM format (t.ex. "2025-04" for april 2025)',
        },
        constraint_overrides: {
          type: 'object',
          description: 'Valfritt: Override av constraints. Anvand BARA om anvandaren explicit tillater overtid.',
          properties: {
            extra_pass_per_person: {
              type: 'integer',
              description: 'Antal extra pass utover anstallningsgrad som tillats per person (t.ex. 3)',
            },
            extra_pass_roll: {
              type: 'string',
              description: 'Vilken roll overriden galler: "sjukskoterska", "underskoterska", "lakare", eller "alla"',
            },
          },
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
5. Analysera påverkan på bemanningskrav
6. AGERA med verktygen — läs schema, föreslå ändringar, simulera, applicera

═══ BETEENDE ═══

DU ÄR EN AGENT SOM AGERAR, INTE EN RAPPORTSKRIVARE.

När inputen är TYDLIG (t.ex. "Karin semester 10-15 april"):
→ Agera direkt: läs schema, analysera påverkan, presentera resultat
→ Ställ INGA retoriska frågor — genomför det användaren bad om

När inputen är OTYDLIG (t.ex. "vi behöver mer folk på helgerna"):
→ Ställ EN kort, konkret fråga för att förtydliga
→ Exempel: "Vilken roll saknas mest på helgerna — sjuksköterska eller undersköterska?"
→ Användaren KAN svara dig i detta flöde

När inputen är GENERELL (t.ex. "generera schema för mars"):
→ Läs schemat, rapportera kort hur det ser ut (täckning, kvalitet)
→ Skriv INTE långa förbättringsförslag — schemat är redan optimerat av solvern
→ Nämn bara FAKTISKA problem (regelbrott, undermanning), inte önskescenarier

ÖVERTID — constraint_overrides:
→ Föreslå ALDRIG övertid på eget initiativ
→ Om solvern inte kan täcka alla pass: rapportera undermanning och förklara varför
→ Om användaren EXPLICIT ber om övertid (t.ex. "tillåt 3 extra pass", "kör med övertid"):
  → Tolka hur många extra pass och för vilken roll
  → Anropa read_schedule med constraint_overrides: { extra_pass_per_person: N, extra_pass_roll: "roll" }
  → Rapportera resultatet: ny täckning, faktisk övertid i timmar, vilka personer som påverkas

═══ SVARSFORMAT ═══

**Tolkade instruktioner:**
- [kort lista av vad du tolkade]

**Resultat:**
- [vad du gjorde / vad schemat visar — baserat på verktygsdata]

**Eventuella problem:**
- [BARA faktiska konflikter från solvern, inte spekulationer]

═══ REGLER FÖR SVARET ═══

1. BASERA DIG ENDAST PÅ FAKTA:
   - Använd BARA data från personalinfo ovan och verktygsresultat
   - Hitta INTE på siffror, kostnader eller statistik
   - Om du inte vet något — säg det

2. INGEN SPEKULATION:
   - Räkna ut siffror ENDAST med exakt data
   - Om beräkning krävs — visa hur du räknat

3. ANVÄND VERKTYGEN:
   - Börja ALLTID med read_schedule för att hämta aktuellt schema
   - Basera din analys på verktygsresultat, inte gissningar
   - Om ett verktyg returnerar fel — rapportera felet

4. HÅLL DIG KORT:
   - Max 200 ord i ditt svar
   - Ingen upprepning av data som användaren redan ser
   - Skriv inte "jag rekommenderar att..." om användaren inte bad om råd`;
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
