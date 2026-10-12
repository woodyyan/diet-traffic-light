(function () {
  "use strict";

  var LV_NAME = ["低", "中", "高"];
  var LV_COLOR = ["#3B6D11", "#BA7517", "#A32D2D"];
  var LV_FILL = ["#639922", "#EF9F27", "#E24B4A"];
  var VERDICT = [
    { t: "放心吃", c: "#0F6E56", b: "#E1F5EE", tip: "三个指标都不构成负担，按正常份量吃" },
    { t: "能吃，限量", c: "#854F0B", b: "#FAEEDA", tip: "可以吃，但必须按份量来，别放开吃" },
    { t: "不建议吃", c: "#791F1F", b: "#FCEBEB", tip: "对你的三项指标有明显负担，忍一下" }
  ];

  // 默认用通用上限值，不含任何个人数据；用户可在设置里填自己的数值，只存本机
  var LIMIT = { ua: 420, ldl: 3.4, tg: 1.7 };
  var PROFILE_DEFAULT = { ua: LIMIT.ua, ldl: LIMIT.ldl, tg: LIMIT.tg, mode: "standard", custom: false };
  var stored = load("hf-profile", {});
  var profile = { ua: stored.ua || PROFILE_DEFAULT.ua, ldl: stored.ldl || PROFILE_DEFAULT.ldl, tg: stored.tg || PROFILE_DEFAULT.tg, mode: stored.mode || "standard", custom: !!stored.custom };
  var custom = load("hf-custom", {});

  function load(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : d; } catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- 判定引擎 ----------
  function flags(f) { return (f.f || "").split(/\s+/); }

  function axesOf(f) {
    var lv = f.lv || [0, 0, 0, 0, 0];
    var fl = flags(f);
    var alcohol = fl.indexOf("alcohol") >= 0;
    var meatSoup = fl.indexOf("soup_meat") >= 0;
    // LDL 受饱和脂肪的影响大于膳食胆固醇，所以胆固醇这一级权重降一档
    var ua = lv[0], chol = Math.max(lv[2], Math.max(0, lv[1] - 1)), tg = lv[3];
    if (alcohol) { ua = 2; tg = 2; }
    if (meatSoup) { ua = Math.max(ua, 2); chol = Math.max(chol, 1); }
    if (!alcohol && (f.gi || 0) >= 75 && tg === 0) tg = 1;
    return { ua: ua, chol: chol, tg: tg, na: lv[4] };
  }

  function levelOf(a) { return Math.max(a.ua, a.chol, a.tg); }

  function reasons(f, a) {
    var r = [], fl = flags(f);
    if (fl.indexOf("alcohol") >= 0) r.push("酒精在肾脏和尿酸抢排泄通道，血尿酸立刻升高，同时直接推高甘油三酯");
    else if (a.ua === 2) r.push("嘌呤高（> 150 mg/100 g），是尿酸最直接的食物来源");
    else if (a.ua === 1) r.push("嘌呤中等（50–150 mg/100 g），可以吃但要称重算量");
    if (a.chol === 2) r.push("饱和脂肪高，是推高 LDL 的主因");
    else if (a.chol === 1 && (f.lv || [])[1] === 2) r.push("膳食胆固醇很高（> 200 mg/100 g），影响虽不如饱和脂肪，仍要数着个数吃");
    else if (a.chol === 1) r.push("有一定饱和脂肪，放开吃会累到 LDL");
    if (a.tg === 2) r.push("糖或酒精很高，甘油三酯对这两样最敏感");
    else if (a.tg === 1) r.push("精制碳水或糖偏多，多余糖分会在肝脏转成甘油三酯");
    if (fl.indexOf("soup_meat") >= 0) r.push("嘌呤和浮油都溶进了汤里，越熬越浓");
    if (fl.indexOf("fried") >= 0) r.push("油炸额外带来大量油脂和反复加热的油");
    if (fl.indexOf("processed") >= 0 || fl.indexOf("organ") >= 0) r.push("加工或内脏类食物，钠、嘌呤、胆固醇往往同时偏高");
    if (a.na === 2) r.push("钠很高，伤血管也伤肾，间接影响尿酸排出");
    return r;
  }

  function axisLabel(a) {
    return [
      { k: "血尿酸", v: a.ua, sub: fmt("ua"), w: "UA" },
      { k: "坏胆固醇 LDL", v: a.chol, sub: fmt("ldl"), w: "LDL" },
      { k: "甘油三酯", v: a.tg, sub: fmt("tg"), w: "TG" }
    ];
  }

  var UNIT = { ua: " μmol/L", ldl: " mmol/L", tg: " mmol/L" };
  function fmt(k) {
    var v = profile[k];
    return (profile.custom ? "你 " : "上限 ") + v + UNIT[k];
  }
  function over(k) { return profile[k] >= LIMIT[k]; }

  // ---------- 搜索 ----------
  var INDEX = [];
  function initials(py) {
    return (py || "").split(/\s+/).map(function (s) { return s.charAt(0); }).join("");
  }
  function buildIndex() {
    INDEX = [];
    window.FOODS.forEach(function (f, i) {
      var keys = [f.n].concat((f.al || "").split(",").filter(Boolean));
      var py = (f.py || "").replace(/\s+/g, "");
      var ini = initials(f.py);
      INDEX.push({ i: i, n: f.n, keys: keys, py: py, ini: ini });
    });
  }

  function search(q) {
    q = (q || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return [];
    var hits = [];
    INDEX.forEach(function (it) {
      var best = -1;
      it.keys.forEach(function (k) {
        k = k.toLowerCase();
        if (k === q) best = best < 0 ? 100 : best;
        else if (k.indexOf(q) === 0) best = Math.max(best, 80 - k.length * 0.1);
        else if (k.indexOf(q) > 0) best = Math.max(best, 50);
      });
      if (best < 0 && it.py && it.py.indexOf(q) === 0) best = 70;
      if (best < 0 && it.ini && it.ini.indexOf(q) === 0) best = 60;
      if (best >= 0) hits.push({ i: it.i, s: best });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    return hits.map(function (h) { return window.FOODS[h.i]; });
  }

  // 「做法 + 食材」自动拆解：莴笋炒肉 → 莴笋 + 猪肉 + 炒制
  function compose(q) {
    if (!window.COOKS || !window.MAINS) return null;
    var cook = null, rest = q, i, j;
    for (i = 0; i < window.COOKS.length && !cook; i++) {
      var ks = window.COOKS[i].k.split(",");
      for (j = 0; j < ks.length; j++) {
        if (q.indexOf(ks[j]) >= 0) { cook = window.COOKS[i]; rest = q.split(ks[j]).join(""); break; }
      }
    }
    if (!window.MAINS_SORTED) {
      window.MAINS_SORTED = window.MAINS.slice().sort(function (a, b) { return b.length - a.length; });
    }
    var found = [], pool = rest;
    for (i = 0; i < window.MAINS_SORTED.length && found.length < 3; i++) {
      var w = window.MAINS_SORTED[i];
      if (pool.indexOf(w) >= 0) { found.push(w); pool = pool.split(w).join(""); }
    }
    if (!found.length) return null;
    var base = [0, 0, 0, 0, 0], parts = [];
    found.forEach(function (word) {
      var r = search(word)[0];
      if (!r) return;
      parts.push({ n: r.n, lv: r.lv, s: r.s, t: r.t });
      for (var k = 0; k < 5; k++) base[k] = Math.max(base[k], r.lv[k] || 0);
    });
    if (!parts.length) return null;
    if (cook) {
      parts.push({ n: "做法：" + cook.n, lv: cook.lv, s: "", t: cook.t });
      for (var k2 = 0; k2 < 5; k2++) base[k2] = Math.max(base[k2], cook.lv[k2] || 0);
    }
    return { n: q, c: "做法 + 食材自动拆解", lv: base, s: "按下面每一项分别控制", t: cook ? cook.t : "按食材分别看份量", parts: parts };
  }

  function catFallback(q) {
    q = (q || "").trim();
    for (var i = 0; i < window.CATS.length; i++) {
      var ks = window.CATS[i].k.split(",");
      for (var j = 0; j < ks.length; j++) {
        if (q.indexOf(ks[j]) >= 0) {
          var c = window.CATS[i];
          return { n: q, c: c.n, lv: c.lv, f: c.f, s: c.s, t: c.t, approx: c.n };
        }
      }
    }
    return null;
  }

  // ---------- 渲染 ----------
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };

  function bar(v) {
    return '<div class="bar"><div class="bar-fill" style="width:' + (v === 0 ? 8 : v === 1 ? 52 : 100) + '%;background:' + LV_FILL[v] + '"></div></div>';
  }

  function axisHtml(a) {
    var out = '<div class="axes">';
    axisLabel(a).forEach(function (x) {
      out += '<div class="axe"><div class="axe-top"><span class="axe-k">' + x.k + '</span>' +
        '<span class="axe-v" style="color:' + LV_COLOR[x.v] + '">' + LV_NAME[x.v] + '负担</span></div>' +
        bar(x.v) + '<div class="axe-sub">你的' + x.w + '：' + x.sub + '</div></div>';
    });
    return out + '</div>';
  }

  function partRow(p) {
    var a = axesOf(p);
    var l = levelOf(a);
    return '<div class="part"><span class="dot" style="background:' + LV_FILL[l] + '"></span>' +
      '<div class="part-main"><div class="part-n">' + esc(p.n) + '</div>' +
      (p.t ? '<div class="part-t">' + esc(p.t) + '</div>' : '') + '</div>' +
      '<div class="part-s">' + esc(p.s || (l === 2 ? "不吃" : l === 1 ? "限量" : "可以")) + '</div></div>';
  }

  function card(f, opts) {
    opts = opts || {};
    var a = axesOf(f);
    var l = levelOf(a);
    var v = VERDICT[l];
    var rs = reasons(f, a);
    var html = '<div class="card result">';

    if (opts.approx) {
      html += '<div class="approx">库里没有「' + esc(opts.approxName || f.n) + '」，按「' + esc(opts.approxLabel || f.c) + '」给你建议</div>';
    }

    html += '<div class="verdict" style="background:' + v.b + '">' +
      '<span class="dot big" style="background:' + LV_FILL[l] + '"></span>' +
      '<div><div class="verdict-t" style="color:' + v.c + '">' + v.t + '</div>' +
      '<div class="verdict-s" style="color:' + v.c + '">' + esc(f.n) + ' · ' + v.tip + '</div></div></div>';

    html += axisHtml(a);

    if (f.parts && f.parts.length) {
      html += '<div class="sec-t">拆开看，每一部分分别怎么对待</div><div class="parts">' +
        f.parts.map(partRow).join("") + '</div>';
    }

    html += '<div class="sec-t">' + (l === 2 ? "实在要吃的话" : "能吃多少") + '</div><div class="portion">' + esc(f.s || (l === 2 ? "不吃" : "正常份量")) + '</div>';
    if (profile.mode === "strict" && l >= 1) {
      html += '<div class="strict">严格模式：上述份量减半，频次也减半；黄灯食物按红灯对待</div>';
    }

    if (rs.length) {
      html += '<div class="sec-t">为什么</div><ul class="why">' + rs.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul>';
    }
    if (f.t) html += '<div class="sec-t">关键提醒</div><div class="note">' + esc(f.t) + '</div>';
    if (f.alt) html += '<div class="sec-t">换成什么</div><div class="note alt">' + esc(f.alt) + '</div>';
    html += '</div>';
    return html;
  }

  function noHit(q) {
    return '<div class="card result"><div class="verdict" style="background:#F1EFE8">' +
      '<span class="dot big" style="background:#888780"></span><div>' +
      '<div class="verdict-t" style="color:#2C2C2A">库里没有这个</div>' +
      '<div class="verdict-s" style="color:#444441">按保守原则处理，或者直接告诉我它属于哪一类</div></div></div>' +
      '<div class="sec-t">没收录时，按这四条保守原则判断</div><ul class="why">' +
      '<li>熬久的汤、内脏、贝类：一律不吃</li>' +
      '<li>任何酒：一律不喝</li>' +
      '<li>油炸 + 精制碳水（油条、薯片、甜点）：一律不吃</li>' +
      '<li>甜饮料和果汁：一律不喝，果糖是甘油三酯和尿酸的双杀</li></ul>' +
      '<div class="sec-t">它不是上面几类的话，通常这么办</div>' +
      '<div class="note">瘦肉和鱼虾每餐 50–100 g 称重吃；蔬菜放开吃；主食一小碗；水果一天 200–350 g。拿不准就按「能吃，限量」处理。</div>' +
      '<div class="catpick" id="catpick"><span class="catpick-l">把它归到某一类：</span>' +
      window.CATS.slice(0, 12).map(function (c, i) { return '<button class="chip sm" data-cat="' + i + '">' + esc(c.n) + '</button>'; }).join("") +
      '</div></div>';
  }

  function exactHit(res, q) {
    for (var i = 0; i < res.length; i++) {
      var f = res[i];
      if (f.n === q) return f;
      var al = (f.al || "").split(",");
      for (var j = 0; j < al.length; j++) if (al[j] === q) return f;
    }
    return null;
  }

  function renderQuery(q) {
    var box = $("out");
    if (!q) { box.innerHTML = emptyState(); return; }
    var res = search(q);
    if (custom[q]) {
      var c = window.CATS[custom[q]];
      res = [{ n: q, c: c.n, lv: c.lv, f: c.f, s: c.s, t: c.t }].concat(res);
    }
    if (res.length === 0) {
      var comp = compose(q);
      if (comp) { box.innerHTML = card(comp, { approx: true, approxName: q, approxLabel: "做法 + 食材自动拆解" }); bindCatPick(q); return; }
      var cf = catFallback(q);
      if (cf) { box.innerHTML = card(cf, { approx: true, approxName: q }); bindCatPick(q); return; }
      box.innerHTML = noHit(q); bindCatPick(q); return;
    }
    var ex = res.length > 1 ? exactHit(res, q) : null;
    if (ex) {
      box.innerHTML = card(ex, ex.n === q ? {} : { approx: true, approxName: q, approxLabel: ex.n });
      bindCatPick(q);
      return;
    }
    if (res.length === 1) {
      var f0 = res[0];
      var same = f0.n === q || f0.n.indexOf(q) >= 0 || q.indexOf(f0.n) >= 0;
      box.innerHTML = card(f0, same ? {} : { approx: true, approxName: q, approxLabel: f0.n });
      bindCatPick(q);
      return;
    }
    var html = '<div class="card result"><div class="sec-t">找到 ' + res.length + ' 个，点一个看结论</div><div class="pick">';
    res.slice(0, 12).forEach(function (f) {
      var a = axesOf(f), l = levelOf(a);
      html += '<div class="pick-row" data-n="' + esc(f.n) + '"><span class="dot" style="background:' + LV_FILL[l] + '"></span>' +
        '<span class="pick-n">' + esc(f.n) + '</span><span class="pick-c">' + esc(f.c ? CAT_CN[f.c] || f.c : "") + '</span></div>';
    });
    html += '</div></div>';
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll(".pick-row"), function (el) {
      el.onclick = function () {
        var name = el.getAttribute("data-n");
        var f = window.FOODS.filter(function (x) { return x.n === name; })[0];
        $("q").value = name;
        $("out").innerHTML = card(f);
        window.scrollTo(0, 0);
      };
    });
  }

  function bindCatPick(q) {
    var el = $("catpick");
    if (!el) return;
    Array.prototype.forEach.call(el.querySelectorAll("[data-cat]"), function (b) {
      b.onclick = function () {
        custom[q] = parseInt(b.getAttribute("data-cat"), 10);
        save("hf-custom", custom);
        renderQuery(q);
      };
    });
  }

  var CAT_CN = { grain: "主食", meat: "肉", organ: "内脏", egg: "蛋", fish: "鱼", shellfish: "海鲜", bean: "豆制品", veg: "蔬菜", fruit: "水果", dairy: "奶", nut: "坚果", drink: "饮料", snack: "零食", oil: "调味油脂", soup: "汤", dish: "菜式", processed: "加工食品" };

  var QUICK = ["牛肉面", "火锅", "辣条", "鸡蛋", "啤酒", "水果", "米饭", "炒菜", "豆腐", "虾", "牛奶", "串串"];

  function metric(label, k) {
    var v = profile[k];
    var o = over(k);
    return '<div class="metric"><div class="m-l">' + label + '</div>' +
      '<div class="m-v">' + v + '</div>' +
      '<div class="m-s" style="color:' + (o ? "#A32D2D" : "#3B6D11") + '">' +
      (profile.custom ? (o ? "偏高" : "达标") : "上限") + '，上限 ' + LIMIT[k] + '</div></div>';
  }

  function summary() {
    if (!profile.custom) return "填上自己的数值后，这里会显示达标情况，每条食物的三条轴也会标上你的实测值。";
    var overs = [];
    if (over("ua")) overs.push("尿酸");
    if (over("ldl")) overs.push("LDL");
    if (over("tg")) overs.push("甘油三酯");
    if (!overs.length) return "三项都在标准内，继续保持：少酒、少糖、少内脏和浓汤。";
    return overs.join("、") + " 偏高，饮食控制是最直接有效的手段。尿酸偏高时，酒、内脏、贝类和浓汤是优先级最高的禁区。";
  }

  function updateHeader() {
    var el = $("hdr");
    if (!el) return;
    el.textContent = "UA " + profile.ua + " · LDL " + profile.ldl + " · TG " + profile.tg + "　" +
      (profile.custom ? "能不能吃、吃多少、为什么" : "点 ≡ 填入你的体检数值");
  }

  function emptyState() {
    return '<div class="card result empty">' +
      '<div class="verdict" style="background:#E6F1FB"><span class="dot big" style="background:#378ADD"></span><div>' +
      '<div class="verdict-t" style="color:#0C447C">输入食物名，立刻告诉你能不能吃</div>' +
      '<div class="verdict-s" style="color:#185FA5">支持中文名、别名、拼音首字母，比如「nrM」也能搜到牛肉面</div></div></div>' +
      (profile.custom ? '' :
        '<div class="guide">先在右上角 ≡ 里填入你的体检三项数值，判定会按你的实际情况显示。不填也能用，默认按通用上限值判断。数值只存在你这台设备上。</div>') +
      '<div class="sec-t">' + (profile.custom ? "你的指标" : "通用参考上限") + '</div><div class="metrics">' +
      metric("血尿酸 UA", "ua") + metric("坏胆固醇 LDL", "ldl") + metric("甘油三酯 TG", "tg") +
      '</div><div class="note">' + summary() + '</div>' +
      '<div class="sec-t">点一下试试</div><div class="quick">' +
      QUICK.map(function (q) { return '<button class="chip" data-q="' + q + '">' + q + '</button>'; }).join("") +
      '</div></div>';
  }

  // ---------- 启动 ----------
  function init() {
    buildIndex();
    $("out").innerHTML = emptyState();
    bindQuick();
    var qi = $("q");
    qi.addEventListener("input", function () { renderQuery(qi.value.trim()); });
    qi.addEventListener("keydown", function (e) { if (e.key === "Enter") { qi.blur(); renderQuery(qi.value.trim()); } });
    $("setbtn").onclick = function () { $("sheet").classList.toggle("show"); };
    $("closebtn").onclick = function () { $("sheet").classList.remove("show"); };
    $("modesel").value = profile.mode;
    $("modesel").onchange = function () { profile.mode = this.value; save("hf-profile", profile); renderQuery($("q").value.trim()); };
    ["ua", "ldl", "tg"].forEach(function (k) {
      var el = $(k + "In");
      if (!el) return;
      el.value = profile[k];
      el.onchange = function () {
        var v = parseFloat(this.value);
        if (isNaN(v)) { this.value = profile[k]; return; }
        profile[k] = v;
        profile.custom = true;
        save("hf-profile", profile);
        updateHeader();
        renderQuery($("q").value.trim());
      };
    });
    updateHeader();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    }
  }

  function bindQuick() {
    Array.prototype.forEach.call(document.querySelectorAll(".chip[data-q]"), function (b) {
      b.onclick = function () { $("q").value = b.getAttribute("data-q"); renderQuery($("q").value); };
    });
  }

  window.__HF = { search: search, catFallback: catFallback, compose: compose, axesOf: axesOf, levelOf: levelOf, buildIndex: buildIndex, card: card, renderQuery: renderQuery, init: init, VERDICT: VERDICT };

  window.addEventListener("DOMContentLoaded", init);
})();
