import { TRANSITO } from "../config.js";
import { conceptoMatch, fechaDesc, comercioMatch, fields, fmtFecha, fechasCandidatas, conceptosCandidatos } from "./classify.js";

/* Drain (He et al., 2017): agrupa textos parecidos en plantillas con un árbol de profundidad fija.
   Raíz → nº de tokens → primeros (depth-2) tokens → hoja con grupos; en la hoja gana el grupo
   más parecido si supera "sim". Los tokens que difieren pasan a "<*>". */
var WILD = "<*>";

export function drain(opts) {
  var o = opts || {};
  var depth = Math.max(3, o.depth || 4), sim = o.sim == null ? 0.5 : o.sim, maxChildren = o.maxChildren || 100;
  var root = {}, clusters = [];

  var hasDigit = function (t) { return /\d/.test(t); };

  function seqDist(tpl, toks) {
    var same = 0, wild = 0;
    for (var i = 0; i < tpl.length; i++) {
      if (tpl[i] === WILD) wild++;
      else if (tpl[i] === toks[i]) same++;
    }
    return { sim: same / tpl.length, wild: wild };
  }

  function leafFor(toks, create) {
    var node = root[toks.length];
    if (!node) { if (!create) return null; node = root[toks.length] = { kids: {} }; }
    var n = Math.min(depth - 2, toks.length);
    for (var i = 0; i < n; i++) {
      var key = hasDigit(toks[i]) ? WILD : toks[i], next = node.kids[key];
      if (!next) {
        if (!create) return null;
        if (!node.kids[key] && Object.keys(node.kids).length >= maxChildren) key = WILD;
        next = node.kids[key] || (node.kids[key] = { kids: {} });
      }
      node = next;
    }
    return node;
  }

  function add(toks, id) {
    var leaf = leafFor(toks, true), best = null, bs = -1, bw = -1;
    leaf.list = leaf.list || [];
    leaf.list.forEach(function (c) {
      var d = seqDist(c.tpl, toks);
      if (d.sim > bs || (d.sim === bs && d.wild > bw)) { best = c; bs = d.sim; bw = d.wild; }
    });
    if (best && bs >= sim) {
      for (var i = 0; i < toks.length; i++) if (best.tpl[i] !== toks[i]) best.tpl[i] = WILD;
      best.ids.push(id);
      return best;
    }
    var c = { tpl: toks.slice(), ids: [id] };
    leaf.list.push(c); clusters.push(c);
    return c;
  }

  /* Segunda pasada: Drain no vuelve a juntar grupos ya creados, y el orden de las filas decide qué
     se generaliza antes. Primero se comprimen los "<*>" seguidos de cada plantilla (multi[i] = ese
     "<*>" cubre uno o más tokens). Después se funden los grupos:
     a) de igual longitud, parecidos (sim) y sin contradicción: donde los dos tienen texto, es el mismo;
     b) cuando el patrón de uno cubre al otro (sus "<*>" absorben el texto del otro), si ese patrón
        tiene al menos la mitad de tokens fijos. */
  function fusiona(list) {
    var cs = list.map(function (c) {
      var tpl = [], multi = [];
      c.tpl.forEach(function (t) {
        if (t === WILD && tpl.length && tpl[tpl.length - 1] === WILD) multi[multi.length - 1] = true;
        else { tpl.push(t); multi.push(false); }
      });
      return { tpl: tpl, multi: multi, ids: c.ids.slice() };
    });
    var contradice = function (a, b) {
      return a.some(function (t, i) { return t !== WILD && b[i] !== WILD && t !== b[i]; });
    };
    var absorbe = function (a, b, tpl, multi) {
      a.tpl = tpl; a.multi = multi;
      a.ids = a.ids.concat(b.ids).sort(function (x, y) { return x - y; });
    };
    for (;;) {
      var best = null, bs = -1, i, j;
      for (i = 0; i < cs.length; i++) {
        for (j = i + 1; j < cs.length; j++) {
          if (cs[i].tpl.length !== cs[j].tpl.length || contradice(cs[i].tpl, cs[j].tpl)) continue;
          var sm = similitud(cs[i].tpl, cs[j].tpl);
          if (sm >= sim && sm > bs) { best = [i, j]; bs = sm; }
        }
      }
      if (best) {
        var x = cs[best[0]], y = cs[best[1]];
        absorbe(x, y, x.tpl.map(function (t, k) { return t === y.tpl[k] ? t : WILD; }),
          x.multi.map(function (m, k) { return m || y.multi[k]; }));
        cs.splice(best[1], 1);
        continue;
      }
      for (i = 0; i < cs.length && !best; i++) {
        for (j = 0; j < cs.length && !best; j++) {
          if (i !== j && cubre(cs[i], cs[j].tpl)) best = [i, j];
        }
      }
      if (!best) return cs;
      absorbe(cs[best[0]], cs[best[1]], cs[best[0]].tpl, cs[best[0]].multi);
      cs.splice(best[1], 1);
    }
  }

  return { add: add, clusters: function () { return fusiona(clusters); } };
}

/* Enmascara lo variable (fechas, tarjetas, referencias, importes) y parte en tokens.
   Cada token lleva su tramo [s, e) en el texto original, para poder resaltarlo. */
export function tokensPos(texto) {
  var t = String(texto || ""), ps = [];
  /* El nombre del comercio (COMERCIO: ... .DATOS BENEFI) es un solo campo variable, tenga las palabras que tenga. */
  var nm = t.match(/(?<=COMERCIO:)\s*.*?(?=\s*\.DATOS BENEFI)/), a = -1, b = -1;
  if (nm && nm[0].trim()) { a = nm.index + nm[0].length - nm[0].trimStart().length; b = nm.index + nm[0].trimEnd().length; }
  if (a < 0) escanea(t, 0, t.length, ps);
  else {
    escanea(t, 0, a, ps);
    ps.push({ ws: true }, { t: WILD, s: a, e: b, wild: true }, { ws: true });
    escanea(t, b, t.length, ps);
  }
  var toks = [], cur = null;
  ps.forEach(function (p) {
    if (p.ws) { cur = null; return; }
    if (cur) { cur.t += p.t; cur.e = p.e; } else { cur = { t: p.t, s: p.s, e: p.e }; toks.push(cur); }
  });
  /* Varios "<*>" seguidos son uno solo: así un nombre de 2 palabras y otro de 3 dan la misma plantilla. */
  var out = [];
  toks.forEach(function (k) {
    var prev = out[out.length - 1];
    if (prev && prev.t === WILD && k.t === WILD) prev.e = k.e; else out.push(k);
  });
  return out;
}

/* Parte [desde, hasta) del texto en trozos para tokensPos; los tramos quedan en coordenadas del texto completo. */
function escanea(t, desde, hasta, ps) {
  var re = /(\d[\dXx.\/,-]*)|([:=])|(\s+)|([^\s:=\d]+)/g, m, seg = t.slice(desde, hasta);
  while ((m = re.exec(seg))) {
    var s = desde + m.index, e = s + m[0].length;
    if (m[1]) {
      var n = ps.length;
      while (n > 0 && ps[n - 1].ws) n--;
      if (n > 0 && n < ps.length && ps[n - 1].wild && !ps[ps.length - 1].sep) { ps[n - 1].e = e; ps.length = n; }
      else ps.push({ t: WILD, s: s, e: e, wild: true });
    } else if (m[2]) { ps.push({ t: m[0], s: s, e: e }); ps.push({ ws: true, sep: true }); }
    else if (m[3]) ps.push({ ws: true });
    else ps.push({ t: m[0], s: s, e: e });
  }
}

export function tokeniza(texto) { return tokensPos(texto).map(function (k) { return k.t; }); }

/* Índices de token (de la plantilla) que tocan el tramo [index, index+len) del texto. */
function tokensEn(toks, index, len) {
  var r = [];
  toks.forEach(function (k, i) { if (k.s < index + len && k.e > index) r.push(i); });
  return r;
}

/* Qué se extrae de un texto y de dónde: tramos a resaltar + valores resultantes.
   "alt": otras fechas del texto y conceptos distintos al elegido que el algoritmo no usó;
   "dif" = su valor cambiaría el resultado. */
function extrae(r) {
  var texto = r.obs || r.desc, oper = r.debito != null ? "DB" : "CR";
  var cm = conceptoMatch(texto, oper), fd = fechaDesc(texto), cc = comercioMatch(texto), spans = [], alt = [];
  if (cm) spans.push({ s: cm.index, e: cm.index + cm.len, c: "con" });
  if (fd) spans.push({ s: fd.index, e: fd.index + fd.len, c: "fec" });
  if (cc) spans.push({ s: cc.index, e: cc.index + cc.len, c: "com" });
  var fecha = fd ? fmtFecha(fd) : "", com = fields(texto, oper).comercio;
  var put = function (tipo, x, valor, dif, nota) {
    spans.push({ s: x.index, e: x.index + x.len, c: "alt-" + tipo });
    alt.push({ tipo: tipo, texto: texto.substr(x.index, x.len), src: x.src || "", valor: valor, dif: dif, nota: nota || "" });
  };
  fechasCandidatas(texto).forEach(function (x) {
    if (!x.usada) put("fec", x, x.valor, x.valor !== fecha, x.src === "SIN_PATRON" ? "sin regla" : "");
  });
  conceptosCandidatos(texto, oper).forEach(function (x) {
    if (!x.usada && x.cat !== (cm ? cm.cat : "Otro")) put("con", x, x.cat, true, x.descartada ? "no aplica a " + oper : "regla de menor prioridad");
  });
  return {
    texto: texto, spans: spans, alt: alt, fechaFila: r.fecha || "",
    concepto: cm ? cm.cat : "Otro", conceptoTxt: cm ? texto.substr(cm.index, cm.len) : "",
    fechaTxt: fd ? texto.substr(fd.index, fd.len) : "", fechaSrc: fd ? fd.src : "", fecha: fecha,
    comercio: com, comercioTxt: cc ? texto.substr(cc.index, cc.len) : "", comercioSrc: cc ? cc.src : ""
  };
}

/* Cosas que un humano debería mirar: "sin-concepto", "sin-fecha", "sin-comercio", "mixto". */
function avisos(ex, mixto) {
  var a = [];
  if (ex.every(function (e) { return !e.conceptoTxt; })) a.push("sin-concepto");
  if (ex.every(function (e) { return !e.fecha; })) a.push("sin-fecha");
  if (ex.every(function (e) { return !e.comercio; })) a.push("sin-comercio");
  if (mixto) a.push("mixto");
  ["fec", "con"].forEach(function (t) {
    if (ex.some(function (e) { return e.alt.some(function (x) { return x.tipo === t && x.dif; }); })) a.push("alt-" + t);
  });
  return a;
}

/* Plantillas de las observaciones de las filas, de más a menos frecuentes.
   "marcas": por token (lista), "con" si decide el concepto, "fec" si de ahí sale la fecha, "com" el comercio (según el primer ejemplo). */
export function plantillas(rows, opts) {
  var d = drain(opts);
  rows.forEach(function (r, i) { d.add(tokeniza(r.obs || r.desc), i); });
  return d.clusters().map(function (c) {
    var cr = 0, db = 0, porConcepto = {}, porOper = { DB: {}, CR: {} };
    var top = function (m) { return Object.keys(m).sort(function (a, b) { return m[a] - m[b]; }).pop(); };
    c.ids.forEach(function (i) {
      cr += rows[i].credito || 0; db += rows[i].debito || 0;
      /* Siempre el concepto por reglas, aunque ya se haya aplicado uno elegido. */
      var k = (rows[i].conceptoAuto || rows[i].concepto || "Otro").replace(TRANSITO, ""), o = rows[i].debito != null ? "DB" : "CR";
      porConcepto[k] = (porConcepto[k] || 0) + 1;
      porOper[o][k] = (porOper[o][k] || 0) + 1;
    });
    /* Concepto de la plantilla = el más frecuente de sus filas, sin el prefijo de Tránsito. */
    var conceptos = Object.keys(porConcepto).sort(function (a, b) { return porConcepto[b] - porConcepto[a]; });
    var todosEx = c.ids.map(function (i) { return extrae(rows[i]); }), ex0 = todosEx[0];
    var texto = ex0.texto, toks = tokensPos(texto), marcas = c.tpl.map(function () { return []; });
    /* Una plantilla comprimida no tiene tantos tokens como la fila: cada token de la fila va a un puesto de la plantilla. */
    var puesto = alinea(c.tpl, c.multi, toks.map(function (k) { return k.t; }));
    ex0.spans.forEach(function (sp) {
      tokensEn(toks, sp.s, sp.e - sp.s).forEach(function (i) {
        var q = puesto ? puesto[i] : i;
        if (marcas[q] && marcas[q].indexOf(sp.c) < 0) marcas[q].push(sp.c);
      });
    });
    return {
      plantilla: c.tpl.join(" "), tokens: c.tpl, multi: c.multi, marcas: marcas, n: c.ids.length, cr: cr, db: db,
      concepto: conceptos[0], ids: c.ids,
      /* Concepto por reglas en cada sentido ("" si la plantilla no tiene filas de ese sentido). */
      auto: { DB: top(porOper.DB) || "", CR: top(porOper.CR) || "" },
      fechaSrc: ex0.fechaSrc, comercioSrc: ex0.comercioSrc,
      ejemplo: texto,
      ejemplos: todosEx.slice(0, 5),
      avisos: avisos(todosEx, conceptos.length > 1)
    };
  }).sort(function (a, b) { return b.n - a.n; });
}

/* Parecido entre dos plantillas (listas de tokens): fracción de posiciones iguales, contando
   "<*>" con "<*>". 0 si no tienen el mismo número de tokens. */
export function similitud(a, b) {
  if (a.length !== b.length || !a.length) return 0;
  var same = 0;
  for (var i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

/* Casa una lista de tokens con un patrón de plantilla: un token fijo casa solo consigo mismo, un "<*>"
   con un token cualquiera y un "<*>" multi con uno o más. Devuelve, por token, el índice del patrón
   al que va, o null si no casa. Prefiere que cada "<*>" tome los menos tokens posibles. */
export function alinea(tpl, multi, toks) {
  var n = tpl.length, m = toks.length, memo = {};
  function ir(i, j) {
    if (i === n) return j === m ? [] : null;
    var key = i * (m + 1) + j;
    if (key in memo) return memo[key];
    var r = null;
    if (tpl[i] !== WILD) {
      if (j < m && toks[j] === tpl[i]) { var rest = ir(i + 1, j + 1); if (rest) r = [i].concat(rest); }
    } else {
      for (var k = 1; j + k <= m && !r; k++) {
        var rest2 = ir(i + 1, j + k);
        if (rest2) { r = []; for (var q = 0; q < k; q++) r.push(i); r = r.concat(rest2); }
        if (!multi[i]) break;
      }
    }
    return memo[key] = r;
  }
  return ir(0, 0);
}

/* ¿El patrón de "a" cubre a la plantilla "tpl"? Solo si "a" tiene al menos la mitad de tokens fijos. */
function cubre(a, tpl) {
  var fijos = a.tpl.filter(function (t) { return t !== WILD; }).length;
  return fijos * 2 >= a.tpl.length && !!alinea(a.tpl, a.multi, tpl);
}
