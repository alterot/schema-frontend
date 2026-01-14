export const mockPersonal = [
  { id: 1, namn: "Anna Berg", kompetens: "sjuksköterska", anstallning: 100, ledigt: ["2025-04-10"] },
  { id: 2, namn: "Bengt Svensson", kompetens: "sjuksköterska", anstallning: 75, ledigt: [] },
  { id: 3, namn: "Cecilia Holm", kompetens: "undersköterska", anstallning: 100, ledigt: ["2025-04-15", "2025-04-16"] },
  { id: 4, namn: "David Eriksson", kompetens: "undersköterska", anstallning: 100, ledigt: [] },
  { id: 5, namn: "Eva Andersson", kompetens: "undersköterska", anstallning: 100, ledigt: ["2025-04-20"] },
  { id: 6, namn: "Fredrik Nilsson", kompetens: "sjuksköterska", anstallning: 100, ledigt: [] },
  { id: 7, namn: "Gunilla Larsson", kompetens: "undersköterska", anstallning: 75, ledigt: [] },
  { id: 8, namn: "Henrik Johansson", kompetens: "undersköterska", anstallning: 100, ledigt: ["2025-04-05", "2025-04-06"] },
  { id: 9, namn: "Ingrid Karlsson", kompetens: "sjuksköterska", anstallning: 100, ledigt: [] },
  { id: 10, namn: "Johan Pettersson", kompetens: "undersköterska", anstallning: 100, ledigt: [] }
];

export const mockSchema = {
  period: "2025-04",
  tolkadInput: [
    "Anna Berg: Semester 10-20 april",
    "David Eriksson: Sjukskriven hela april",
    "Extra undersköterska dagpass vecka 15-16"
  ],
  konflikter: [
    {
      datum: "2025-04-15",
      pass: "natt",
      beskrivning: "Saknar 1 undersköterska",
      typ: "undermanning"
    },
    {
      datum: "2025-04-22",
      pass: "kväll",
      beskrivning: "Inga sjuksköterskor tillgängliga",
      typ: "kompetens"
    }
  ],
  schema: [
    { datum: "2025-04-01", dag: [1, 2, 3, 4, 5], kvall: [6, 7, 8], natt: [9, 10, 3], status: "ok" },
    { datum: "2025-04-02", dag: [2, 6, 4, 7, 10], kvall: [1, 3, 5], natt: [9, 8, 4], status: "ok" },
    // ... fler dagar kan vi lägga till senare
  ]
};