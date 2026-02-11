// Claude API Tool Definitions
// Defines the 4 tools that Claude can call for schedule management

export const SCHEDULE_TOOLS = [
  {
    name: 'read_schedule',
    description: 'Hämta eller generera schema för en period. Skicka personal_overrides för att ändra personalförutsättningar (frånvaro, övertid, vikarier, tillgänglighet) innan solvern kör.',
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Period i YYYY-MM format (t.ex. "2026-06" för juni 2026)',
        },
        personal_overrides: {
          type: 'array',
          description: 'Valfritt: Lista av personaländringar att applicera innan schemat genereras. Varje objekt riktar sig mot en person via namn.',
          items: {
            type: 'object',
            properties: {
              namn: {
                type: 'string',
                description: 'Personens fulla namn. Måste matcha personalregistret. Vid action "add" är detta den nya personens namn.',
              },
              action: {
                type: 'string',
                description: 'Typ av ändring: "add" för ny vikarie. Utelämna för att modifiera befintlig person.',
              },
              add_franvaro: {
                type: 'object',
                description: 'Lägg till frånvaro (semester, sjuk, vab, konferens, tjänstledighet).',
                properties: {
                  typ: { type: 'string', description: 'Typ av frånvaro' },
                  start: { type: 'string', description: 'Startdatum YYYY-MM-DD' },
                  slut: { type: 'string', description: 'Slutdatum YYYY-MM-DD (inklusive)' },
                },
                required: ['typ', 'start', 'slut'],
              },
              extra_pass: {
                type: 'integer',
                description: 'Antal extra pass utöver anställningsgrad (övertid). T.ex. 3.',
              },
              tillganglighet: {
                type: 'array',
                description: 'Ny tillgänglighet för personen. T.ex. ["Mon","Tue","Wed"] för att begränsa till mån-ons.',
                items: { type: 'string' },
              },
              roll: {
                type: 'string',
                description: 'Roll (vid action "add"): "sjukskoterska", "underskoterska", "lakare".',
              },
              anstallning: {
                type: 'integer',
                description: 'Anställningsgrad i procent (vid action "add"). T.ex. 100.',
              },
              exclude_pass_typer: {
                type: 'array',
                description: 'Passtyper personen INTE ska jobba. T.ex. ["natt"] eller ["kväll", "natt"]. Värden: "dag", "kväll", "natt".',
                items: { type: 'string' },
              },
              lasta_pass: {
                type: 'array',
                description: 'Pass som personen MÅSTE jobba (låsta i schemat).',
                items: {
                  type: 'object',
                  properties: {
                    datum: { type: 'string', description: 'Datum YYYY-MM-DD' },
                    pass_typ: { type: 'string', description: 'Passtyp: "dag", "kväll", eller "natt"' },
                  },
                  required: ['datum', 'pass_typ'],
                },
              },
            },
            required: ['namn'],
          },
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'propose_changes',
    description: 'Föreslå schemaändringar baserat på ett problem. Använd detta när du identifierat ett problem (undermanning, övertid, konflikt) och vill generera lösningsförslag.',
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
    description: 'Simulera konsekvenserna av föreslagna ändringar innan de appliceras. Returnerar metrics före och efter ändringen så du kan se påverkan på bemanningsgrad, övertid, kostnad och kvalitet.',
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
    description: 'Applicera godkända ändringar till schemat. Använd ENDAST efter att användaren explicit bekräftat att de vill genomföra ändringarna. Bekräfta alltid med användaren innan du sätter confirmed=true.',
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
    ? `- Minst ${regler.vilotid_timmar}h vila mellan pass (dygnsvila enl. ATL 13§)
- Max ${regler.max_dagar_i_rad} arbetsdagar i rad
- Max ${regler.max_timmar_per_vecka_heltid}h per vecka (heltid, enl. ATL 5§)
- Övertidsfaktor: ${regler.overtid_faktor}x
OBS: Dessa regler baseras på Arbetstidslagen (ATL) och kollektivavtal (AB). De är HÅRDA gränser som inte får överskridas — varken av dig eller av solvern.`
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

═══ VIKTIG KONTEXTINFO ═══
Personaldata ovan visar FAST registrerad data. Användaren kan ange TEMPORÄRA ändringar
(semester, sjukdom, vikarie, ändrad tillgänglighet, övertid) som du skickar via personal_overrides
i read_schedule. Lita på användarens input — frånvarofältet ovan kan vara inaktuellt.

Användare refererar ofta till veckonummer (t.ex. "vecka 25"). Konvertera till YYYY-MM-DD-datum innan du agerar.

═══ DIN UPPGIFT ═══
1. Tolka användarens fritextinput om schemaändringar
2. Matcha namn FLEXIBELT — "Anna" → "Dr. Anna Bergström", etc.
   ⚠ Om ett namn matchar FLER ÄN EN person — fråga vilken som avses innan du agerar
3. Identifiera datum/perioder (t.ex. "10-20 april", "vecka 15-16", "hela mars")
4. Identifiera typ av händelse (semester, sjuk, VAB, konferens, extra bemanning, byte)
5. Analysera påverkan på bemanningskrav
6. AGERA med verktygen — läs schema, föreslå ändringar, simulera, applicera

═══ PRIORITETSORDNING ═══
Vid konflikt mellan bemanningsbehov och arbetsregler gäller ALLTID reglerna.
Bättre med undermanning än regelbrott. Ordning:
1. Lagkrav (ATL: vilotid, max arbetstid) — bryts ALDRIG
2. Kollektivavtal (AB: max dagar i rad etc.) — bryts ALDRIG
3. Bemanningskrav — uppfylls SÅ LÅNGT möjligt inom ovanstående ramar
Undantag: Om användaren EXPLICIT begär övertid → se nedan

═══ BETEENDE ═══

DU ÄR EN AGENT SOM AGERAR, INTE EN RAPPORTSKRIVARE.

När inputen är TYDLIG (t.ex. "Karin semester 10-15 april"):
→ Agera direkt: läs schema med personal_overrides, presentera resultat
→ Ställ INGA retoriska frågor — genomför det användaren bad om

När inputen är OTYDLIG (t.ex. "vi behöver mer folk på helgerna"):
→ Ställ EN kort, konkret fråga för att förtydliga
→ Exempel: "Vilken roll saknas mest på helgerna — sjuksköterska eller undersköterska?"
→ Användaren KAN svara dig i detta flöde

När inputen är GENERELL (t.ex. "generera schema för mars"):
→ Läs schemat, rapportera kort hur det ser ut (täckning, kvalitet)
→ Skriv INTE långa förbättringsförslag — schemat är redan optimerat av solvern
→ Nämn bara FAKTISKA problem (regelbrott, undermanning), inte önskescenarier

OBS om röda dagar: Helgdagar/röda dagar (midsommar, jul, nyår etc.) som infaller på vardagar ska behandlas som HELG vad gäller bemanningsbehov. Om du är osäker på vilka dagar som är röda — fråga användaren.

═══ ESKALERING VID OMÖJLIGT SCHEMA ═══
Om solvern returnerar "ingen giltig lösning" (INFEASIBLE):
1. FÖRKLARA i klartext varför: vilken roll saknas, vilka dagar, hur många fattas
   Exempel: "Det saknas 1 SSK för dagpass mån-fre vecka 25 — bara 2 tillgängliga men 3 krävs"
2. FÖRESLÅ åtgärder i denna ordning:
   a) Vikarie — "Finns det en vikarie som kan hoppa in? Ange namn och roll så lägger jag in hen"
   b) Övertid — "Ska någon befintlig SSK ta extra pass?" (kräver användarens godkännande)
   c) Reducerat bemanningskrav — "Alternativt kan kravet sänkas tillfälligt, men det kräver chefsbeslut"
3. AGERA INTE automatiskt — vänta på användarens svar i uppföljningsfältet
4. Vid KRITISK undermanning (patientsäkerhet hotad): nämn att detta bör rapporteras till skyddsombud/arbetsmiljöombud (AML 6 kap 6a§)

Användaren kan svara direkt i uppföljningsfältet, t.ex.:
- "Vi har en vikarie Lisa Strand som är SSK" → du lägger till henne med action: "add"
- "Ge Erik och Anna 2 extra pass var" → du skickar extra_pass overrides
- "Sänk kravet till 2 SSK på dag" → du informerar att detta kräver ändring i bemanningsbehov

═══ PERSONAL_OVERRIDES — alla personaländringar ═══
Använd personal_overrides i read_schedule för ALLA ändringar av personalförutsättningar.
Solvern genererar då ett NYTT schema med ändringarna applicerade.

Frånvaro (semester, sjuk, VAB, konferens):
→ personal_overrides: [{ namn: "Elin Forsberg", add_franvaro: { typ: "semester", start: "2026-06-01", slut: "2026-06-30" } }]
→ Hitta INTE PÅ att frånvaro "redan är hanterad" — om du inte skickat personal_overrides har solvern inte fått informationen

Övertid (extra pass utöver anställningsgrad):
→ Föreslå ALDRIG övertid på eget initiativ
→ Om solvern inte kan täcka alla pass: rapportera undermanning och förklara varför
→ Om användaren EXPLICIT ber om övertid:
  → personal_overrides: [{ namn: "...", extra_pass: 3 }]
  → Eller för ALLA i en roll: skicka en override per person med den rollen

Vikarie (tillfällig personal):
→ personal_overrides: [{ namn: "Sara Ek", action: "add", roll: "sjukskoterska", anstallning: 100, tillganglighet: ["Mon","Tue","Wed","Thu","Fri"] }]

Ändrad tillgänglighet:
→ personal_overrides: [{ namn: "Karin Nilsson", tillganglighet: ["Mon","Tue","Wed"] }]

Passrestriktion (blockera passtyp):
→ personal_overrides: [{ namn: "Erik Holm", exclude_pass_typer: ["natt"] }]
→ Flera passtyper: [{ namn: "Erik Holm", exclude_pass_typer: ["kväll", "natt"] }]

Låst pass (tvinga specifikt pass):
→ personal_overrides: [{ namn: "Anna Berg", lasta_pass: [{ datum: "2026-06-22", pass_typ: "dag" }] }]
→ Flera låsta pass: [{ namn: "Anna Berg", lasta_pass: [{ datum: "2026-06-22", pass_typ: "dag" }, { datum: "2026-06-25", pass_typ: "dag" }] }]

Du kan kombinera FLERA overrides i samma anrop, även på SAMMA person:
→ [{ namn: "Erik Holm", exclude_pass_typer: ["natt"], extra_pass: 2 }]

═══ SVARSFORMAT ═══

**Tolkade instruktioner:**
- [kort lista av vad du tolkade]

**Resultat:**
- [vad du gjorde / vad schemat visar — baserat på verktygsdata]
- [kort motivering till varför denna lösning valdes, om en ändring gjordes]

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
   - Skriv inte "jag rekommenderar att..." om användaren inte bad om råd

5. SEKRETESS OCH PERSONUPPGIFTER:
   - Nämn ALDRIG orsak till frånvaro (sjukdom, VAB etc.) i ditt svar — skriv bara "frånvarande"
   - Personaldata är sekretesskyddad enligt GDPR/OSL
   - Visa inte mer personinformation än vad som behövs för den aktuella frågan

6. MOTIVERA ÄNDRINGAR:
   - När du föreslår eller gör en schemaändring, ange kort VARFÖR (t.ex. "för att täcka nattpass som saknar SSK")
   - I offentlig sektor finns krav på transparens — beslut ska kunna motiveras`;
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
