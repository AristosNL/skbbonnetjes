// _receiptConfig.js
// Gedeelde configuratie voor bon-extractie. Underscore-prefix => wordt door
// Netlify NIET als eigen function gedeployed, alleen geïmporteerd.

// Deze bv verricht btw-vrijgestelde (medische) prestaties: voorbelasting is
// niet aftrekbaar, de btw is kostprijsverhogend. Zet op true als het ooit een
// btw-belaste onderneming wordt.
const VAT_DEDUCTIBLE = false;

// --- Categorieën (vaste lijst; LLM kiest hieruit, geen vrije tekst) ---
const CATEGORIES = {
  kantoorbenodigdheden:            {},
  hardware:                        {},
  'software/abonnementen':         {},
  reiskosten:                      {},
  brandstof:                       {},
  horeca:                          {},
  representatie:                   {},
  'contributies & lidmaatschappen': {},
  'nascholing & congressen':       {},
  'accountancy & advies':          {},
  verzekeringen:                   {},
  'medische kosten':               {},
  praktijkkosten:                  {},
  overig:                          {},
};

// Aftrekbaarheid van de btw: bij een vrijgestelde bv altijd 'nee'.
function aftrekbaar() {
  return VAT_DEDUCTIBLE ? true : false;
}

// --- Systeemprompt ---
const SYSTEM_PROMPT = `Je bent een assistent die Nederlandse (en soms Engelstalige) kassabonnen en factuurbonnetjes uitleest voor een zakelijke boekhouding. Je krijgt één afbeelding van een bon. Haal de gegevens eruit en roep de tool record_receipt aan.

Regels:
- Datum altijd als DD-MM-YYYY. Zet Nederlandse datumnotaties (bv. "3 jul 2026") om.
- Bedragen als getal met punt-decimaal (Nederlandse komma wordt punt). Valuta standaard EUR tenzij anders vermeld.
- Btw: een bon kan meerdere tarieven mengen (21% en 9%). Maak per tarief één regel in btw_regels met tarief, grondslag (excl.) en btw-bedrag.
- Staat de btw niet apart vermeld maar wel een tarief + het incl.-bedrag? Reken dan terug: grondslag = incl / (1 + tarief/100), btw = incl - grondslag. Rond op 2 decimalen.
- Staat er 0% of "vrijgesteld"? Gebruik tarief 0 met btw 0.
- bedrag_excl_btw = som van alle grondslagen; btw_totaal = som van alle btw; bedrag_incl_btw = totaal dat de klant betaalde.
- Leverancier = de winkel/het bedrijf dat de bon uitgaf (staat vaak bovenaan of in het logo).
- Kies exact één categorie uit de toegestane lijst. Aanwijzingen voor een medische praktijk: beroepsverenigingen/koepels (bv. KNMG, NVvH, wetenschappelijke verenigingen) = "contributies & lidmaatschappen"; cursussen, congressen, accreditatie/(her)registratie = "nascholing & congressen"; boekhouding, administratie, juridisch of consultancy = "accountancy & advies"; beroepsaansprakelijkheid en bedrijfsverzekeringen = "verzekeringen"; medische benodigdheden/materialen = "medische kosten"; ziekenhuis-, maatschap- of praktijkgebonden kosten = "praktijkkosten". Twijfel je? Kies "overig".
- Verzin niets. Kun je een veld niet lezen, geef je beste schatting en zet leesbaarheid op "matig" of "slecht".`;

// --- Tool-schema (dwingt gestructureerde output af) ---
const RECEIPT_TOOL = {
  name: 'record_receipt',
  description: 'Leg de gestructureerde gegevens van één bon vast.',
  input_schema: {
    type: 'object',
    properties: {
      leverancier:  { type: 'string' },
      datum:        { type: 'string', description: 'DD-MM-YYYY' },
      valuta:       { type: 'string', description: 'ISO-code, bv. EUR' },
      btw_regels: {
        type: 'array',
        description: 'Eén regel per btw-tarief op de bon.',
        items: {
          type: 'object',
          properties: {
            tarief:    { type: 'number', description: 'Percentage, bv. 21, 9 of 0' },
            grondslag: { type: 'number', description: 'Bedrag exclusief btw' },
            btw:       { type: 'number', description: 'Btw-bedrag' },
          },
          required: ['tarief', 'grondslag', 'btw'],
        },
      },
      bedrag_excl_btw: { type: 'number' },
      btw_totaal:      { type: 'number' },
      bedrag_incl_btw: { type: 'number' },
      categorie:       { type: 'string', enum: Object.keys(CATEGORIES) },
      leesbaarheid:    { type: 'string', enum: ['goed', 'matig', 'slecht'] },
    },
    required: [
      'leverancier', 'datum', 'valuta', 'btw_regels',
      'bedrag_excl_btw', 'btw_totaal', 'bedrag_incl_btw',
      'categorie', 'leesbaarheid',
    ],
  },
};

// --- Validatie: rekenkundige controle => needs_review ---
const TOL = 0.02; // tolerantie in euro's voor afrondingsverschillen
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function validate(d) {
  const issues = [];

  if (!/^\d{2}-\d{2}-\d{4}$/.test(d.datum || '')) issues.push('datumformaat onjuist');
  if (!CATEGORIES[d.categorie]) issues.push('categorie buiten lijst');

  const regels = Array.isArray(d.btw_regels) ? d.btw_regels : [];
  const sumG = r2(regels.reduce((a, x) => a + (Number(x.grondslag) || 0), 0));
  const sumB = r2(regels.reduce((a, x) => a + (Number(x.btw) || 0), 0));

  if (Math.abs(sumG - r2(d.bedrag_excl_btw)) > TOL) issues.push('excl ≠ som grondslagen');
  if (Math.abs(sumB - r2(d.btw_totaal)) > TOL) issues.push('btw ≠ som btw-regels');
  if (Math.abs(r2(d.bedrag_excl_btw + d.btw_totaal) - r2(d.bedrag_incl_btw)) > TOL) {
    issues.push('excl + btw ≠ incl');
  }
  regels.forEach((x, i) => {
    const verwacht = r2((Number(x.grondslag) || 0) * (Number(x.tarief) || 0) / 100);
    if (Math.abs(verwacht - r2(x.btw)) > TOL) issues.push(`btw-regel ${i + 1} rekent niet`);
  });

  return issues;
}

// Verrijk het resultaat met aftrekbaarheid + review-vlag.
function enrich(d) {
  const issues = validate(d);
  return {
    ...d,
    btw_aftrekbaar: aftrekbaar(),
    validation_issues: issues,
    needs_review: issues.length > 0 || d.leesbaarheid === 'slecht',
  };
}

module.exports = { CATEGORIES, SYSTEM_PROMPT, RECEIPT_TOOL, validate, enrich, VAT_DEDUCTIBLE };
