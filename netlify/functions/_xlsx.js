// _xlsx.js
// buildWorkbook(rows, year) -> ExcelJS.Workbook
// rows = [Datum, Leverancier, Categorie, Excl, Btw, Incl, Aftrekbaar, Review, Bon, Vastgelegd]

const ExcelJS = require('exceljs');
const { CATEGORIES } = require('./_receiptConfig');

const HEADER = ['Datum', 'Leverancier', 'Categorie', 'Excl. btw', 'Btw', 'Incl. btw', 'Btw aftrekbaar', 'Review nodig', 'Bon', 'Vastgelegd op'];
const WIDTHS = [12, 24, 20, 12, 10, 12, 14, 12, 30, 18];
const EUR = '\u20ac #,##0.00;-\u20ac #,##0.00;"-"';
const FONT = { name: 'Arial', size: 10 };
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7F1' } };
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const num = (x) => (typeof x === 'number' ? x : Number(String(x == null ? '' : x).replace(',', '.')) || 0);

function styleHeader(row) {
  row.font = { ...FONT, bold: true };
  row.eachCell((c) => { c.fill = HEAD_FILL; });
}
const money = (sheet, cell) => { sheet.getCell(cell).numFmt = EUR; sheet.getCell(cell).font = FONT; };

function buildWorkbook(rows, year) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bonnen-app';

  // ---------- Detail ----------
  const detName = `Detail ${year}`;
  const det = wb.addWorksheet(detName);
  det.columns = HEADER.map((h, i) => ({ header: h, width: WIDTHS[i] }));
  styleHeader(det.getRow(1));
  rows.forEach((r) => det.addRow([r[0], r[1], r[2], num(r[3]), num(r[4]), num(r[5]), r[6], r[7], r[8], r[9]]));
  ['D', 'E', 'F'].forEach((c) => { det.getColumn(c).numFmt = EUR; det.getColumn(c).font = FONT; });
  det.getColumn('A').font = FONT; det.getColumn('B').font = FONT; det.getColumn('C').font = FONT;
  det.views = [{ state: 'frozen', ySplit: 1 }];

  const DET = `'${detName}'`;
  const C = `${DET}!$C$2:$C$1000`;
  const D = `${DET}!$D$2:$D$1000`;
  const E = `${DET}!$E$2:$E$1000`;
  const F = `${DET}!$F$2:$F$1000`;
  const G = `${DET}!$G$2:$G$1000`;
  const A = `${DET}!$A$2:$A$1000`;

  // ---------- Samenvatting ----------
  const sum = wb.addWorksheet('Samenvatting');
  sum.getColumn('A').width = 24;
  ['B', 'C', 'D', 'E'].forEach((c) => { sum.getColumn(c).width = 14; sum.getColumn(c).font = FONT; });
  sum.getColumn('A').font = FONT;
  sum.getCell('A1').value = `Samenvatting bonnen ${year}`;
  sum.getCell('A1').font = { ...FONT, bold: true, size: 12 };

  // Per categorie
  let r = 3;
  sum.getRow(r).values = ['Per categorie', 'Aantal', 'Excl. btw', 'Btw', 'Incl. btw'];
  styleHeader(sum.getRow(r));
  const catStart = r + 1;
  Object.keys(CATEGORIES).forEach((cat) => {
    r += 1;
    sum.getCell(`A${r}`).value = cat;
    sum.getCell(`B${r}`).value = { formula: `COUNTIF(${C},A${r})` };
    sum.getCell(`C${r}`).value = { formula: `SUMIF(${C},A${r},${D})` };
    sum.getCell(`D${r}`).value = { formula: `SUMIF(${C},A${r},${E})` };
    sum.getCell(`E${r}`).value = { formula: `SUMIF(${C},A${r},${F})` };
    ['C', 'D', 'E'].forEach((c) => money(sum, `${c}${r}`));
  });
  const catEnd = r;
  r += 1;
  sum.getCell(`A${r}`).value = 'Totaal';
  ['B', 'C', 'D', 'E'].forEach((c) => { sum.getCell(`${c}${r}`).value = { formula: `SUM(${c}${catStart}:${c}${catEnd})` }; });
  ['C', 'D', 'E'].forEach((c) => money(sum, `${c}${r}`));
  sum.getRow(r).font = { ...FONT, bold: true };

  // Btw-aftrekbaarheid
  r += 2;
  sum.getRow(r).values = ['Btw-aftrekbaarheid', 'Btw'];
  styleHeader(sum.getRow(r));
  const aStart = r + 1;
  [['Aftrekbaar', 'ja'], ['Niet aftrekbaar', 'nee'], ['Beperkt (BUA)', 'beperkt']].forEach(([label, key]) => {
    r += 1;
    sum.getCell(`A${r}`).value = label;
    sum.getCell(`B${r}`).value = { formula: `SUMIF(${G},"${key}",${E})` };
    money(sum, `B${r}`);
  });
  r += 1;
  sum.getCell(`A${r}`).value = 'Controle (= totaal btw)';
  sum.getCell(`B${r}`).value = { formula: `SUM(B${aStart}:B${r - 1})` };
  money(sum, `B${r}`);
  sum.getRow(r).font = { ...FONT, italic: true };

  // Per maand (SUMPRODUCT op de datumtekst, geen hulpkolom)
  r += 2;
  sum.getRow(r).values = ['Per maand', 'Aantal', 'Excl. btw', 'Btw', 'Incl. btw'];
  styleHeader(sum.getRow(r));
  MONTHS.forEach((m, i) => {
    r += 1;
    const cond = `(MID(${A},4,2)="${String(i + 1).padStart(2, '0')}")`;
    sum.getCell(`A${r}`).value = m;
    sum.getCell(`B${r}`).value = { formula: `SUMPRODUCT(${cond}*1)` };
    sum.getCell(`C${r}`).value = { formula: `SUMPRODUCT(${cond}*(${D}))` };
    sum.getCell(`D${r}`).value = { formula: `SUMPRODUCT(${cond}*(${E}))` };
    sum.getCell(`E${r}`).value = { formula: `SUMPRODUCT(${cond}*(${F}))` };
    ['C', 'D', 'E'].forEach((c) => money(sum, `${c}${r}`));
  });

  return wb;
}

module.exports = { buildWorkbook };
