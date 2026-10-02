/* Lectura del PDF con pdf.js: reconstruye las seis columnas del extracto
   por coordenadas y agrupa las líneas en operaciones. */
import { buildStatement } from "../domain/statement.js";

var pdfjsLib = globalThis.pdfjsLib;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdf.worker.min.js", import.meta.url).href;
}

var DEFAULT_COLS = { F: 51.7, R: 117.2, O: 188.5, P: 419.9, I: 467.3, S: 537.9 };
var HEADER_COLS = { "Fec.Contable": "F", "Ref.Origin": "R", "Observaciones": "O", "Oper": "P", "Importe": "I", "Saldo": "S" };

function bounds(h) {
  return {
    fr: (h.F + h.R) / 2,
    ro: h.O - 3,
    op: h.P - 6,
    pi: h.P + (h.I - h.P) * 0.5,
    is: h.S - 30
  };
}

function cellOf(x, b) {
  if (x < b.fr) return "F";
  if (x < b.ro) return "R";
  if (x < b.op) return "O";
  if (x < b.pi) return "P";
  if (x < b.is) return "I";
  return "S";
}

function pageLines(items, b) {
  var buckets = {};
  items.forEach(function (it) {
    var key = Math.round(it.y * 2) / 2;
    (buckets[key] = buckets[key] || []).push(it);
  });
  var keys = Object.keys(buckets).map(Number).sort(function (a, c) { return c - a; });
  return keys.map(function (k) {
    var line = buckets[k].sort(function (a, c) { return a.x - c.x; });
    var cells = { F: "", R: "", O: "", P: "", I: "", S: "" };
    var lastEnd = {}, lastCol = null;
    line.forEach(function (it) {
      var col = cellOf(it.x, b);
      if (cells[col] && lastCol === col && it.x - lastEnd[col] > 1) cells[col] += " ";
      cells[col] += it.s;
      lastEnd[col] = it.x + it.w;
      lastCol = col;
    });
    Object.keys(cells).forEach(function (c) { cells[c] = cells[c].replace(/\s+/g, " ").trim(); });
    cells._raw = line.map(function (i) { return i.s; }).join(" ");
    return cells;
  });
}

export function pdfReady() { return !!pdfjsLib; }

export function openPdf(buf) {
  return pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
}

export function parseDoc(pdf, onProgress) {
  var meta = { cuenta: "", periodo: "", paginas: pdf.numPages };
  var txs = [], cur = null;
  var chain = Promise.resolve();

  for (var p = 1; p <= pdf.numPages; p++) {
    (function (pageNo) {
      chain = chain.then(function () {
        onProgress(pageNo, pdf.numPages);
        return pdf.getPage(pageNo).then(function (page) {
          return page.getTextContent();
        }).then(function (tc) {
          var items = tc.items.filter(function (i) { return i.str && i.str.trim(); })
            .map(function (i) {
              return { x: i.transform[4], y: i.transform[5], w: i.width || 0, s: i.str.trim() };
            });
          if (!items.length) return;

          if (!meta.cuenta || !meta.periodo) {
            var flat = items.map(function (i) { return i.s; }).join(" ");
            var mc0 = flat.match(/Cuenta:\s*([\d\s]{8,})/);
            if (mc0 && !meta.cuenta) meta.cuenta = mc0[1].replace(/\s/g, "");
            var mp0 = flat.match(/(\d{2}\/\d{2}\/\d{4})\s*hasta\s*(\d{2}\/\d{2}\/\d{4})/);
            if (mp0 && !meta.periodo) meta.periodo = mp0[1] + " – " + mp0[2];
          }

          var h = {}, found = 0;
          items.forEach(function (i) {
            var m = HEADER_COLS[i.s];
            if (m && h[m] === undefined) { h[m] = i.x; found++; }
          });
          if (found < 6) h = DEFAULT_COLS;
          var b = bounds(h);

          pageLines(items, b).forEach(function (L) {
            var raw = L._raw;
            if (/bancaremota\.bpa\.cu|Banca Remota|Fec\.Contable/.test(raw)) return;
            if (/CCuueennttaa|EEssttaaddoo/.test(raw)) return;
            var mc = raw.match(/Cuenta:\s*(\d[\d\s]*)/);
            if (mc) { meta.cuenta = mc[1].replace(/\s/g, ""); return; }
            var mp = raw.match(/(\d{2}\/\d{2}\/\d{4})\s*hasta\s*(\d{2}\/\d{2}\/\d{4})/);
            if (mp) { meta.periodo = mp[1] + " – " + mp[2]; return; }
            if (/^Periodo:?$/i.test(raw.trim())) return;
            if (!L.F && !L.R && !L.O && !L.P && !L.I && !L.S) return;

            var isStart = /^(CR|DB)$/.test(L.P) || /Saldo\s*Inicial/i.test(L.O);
            if (isStart) {
              cur = { pagina: pageNo, fecha: L.F, ref: [L.R], obs: [L.O], oper: L.P, imp: [L.I], saldo: [L.S] };
              txs.push(cur);
            } else if (cur) {
              cur.ref.push(L.R); cur.obs.push(L.O); cur.imp.push(L.I); cur.saldo.push(L.S);
            }
          });
        });
      });
    })(p);
  }

  return chain.then(function () { return buildStatement(txs, meta); });
}
