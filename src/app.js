(function () {
  "use strict";

  var LV_NAME = ["低", "中", "高"];
  var LV_COLOR = ["#3B6D11", "#BA7517", "#A32D2D"];
  var LV_FILL = ["#639922", "#EF9F27", "#E24B4A"];
  var VERDICT = [
    { t: "放心吃", c: "#0F6E56", b: "#E1F5EE", tip: "四个指标都不构成负担，按正常份量吃" },
    { t: "能吃，限量", c: "#854F0B", b: "#FAEEDA", tip: "可以吃，但必须按份量来，别放开吃" },
    { t: "不建议吃", c: "#791F1F", b: "#FCEBEB", tip: "对你的指标有明显负担，忍一下" }
  ];

  // 默认用通用上限值，不含任何个人数据；用户可在设置里填自己的数值，只存本机
  var LIMIT = { ua: 420, ldl: 3.4, tg: 1.7, glu: 6.1 };
  var PROFILE_DEFAULT = { ua: LIMIT.ua, ldl: LIMIT.ldl, tg: LIMIT.tg, glu: LIMIT.glu, mode: "standard", custom: false, gluOn: true };
  var stored = load("hf-profile", {});
  var profile = {
    ua: stored.ua || PROFILE_DEFAULT.ua,
    ldl: stored.ldl || PROFILE_DEFAULT.ldl,
    tg: stored.tg || PROFILE_DEFAULT.tg,
    glu: stored.glu || PROFILE_DEFAULT.glu,
    mode: stored.mode || "standard",
    custom: !!stored.custom,
    gluOn: stored.gluOn === undefined ? true : !!stored.gluOn
  };
  var custom = load("hf-custom", {});

  function load(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : d; } catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------- 判定引擎 ----------
  function flags(f) { return (f.f || "").split(/\s+/); }

  // 库里没标 GI、但明显是精制主食的（阳春面、凉面、饭团、白粥配小菜…），默认按高 GI 处理
  var STAPLE_RE = /面|米线|河粉|粉丝|粉条|羊肉粉|牛肉粉|肥肠粉|花甲粉|肠旺粉|酸辣粉|饭|粥|馒头|花卷|饼|糕|粽|汤圆|元宵|包子|烧麦|面包|吐司|点心|土豆|红薯|披萨|比萨|汉堡/;
  var NO_GI_CATS = { veg: 1, fruit: 1, nut: 1, meat: 1, organ: 1, egg: 1, fish: 1, shellfish: 1, bean: 1, dairy: 1, drink: 1, oil: 1 };
  function giOf(f) {
    if (typeof f.gi === "number") return f.gi;
    // 新增菜式没有逐菜 GI 检测值；只用淀粉标签评估，不虚构 GI 75。
    if (f.estimated) return 0;
    if (f.c === "grain") return 75;
    if (NO_GI_CATS[f.c]) return 0;
    return STAPLE_RE.test(f.n || "") ? 75 : 0;
  }

  // 血糖轴：升糖速度由「添加糖」和「GI」共同决定
  // 低 GI（< 56）食物即便含天然糖也不冲血糖，所以降级处理
  function gluOf(lv, gi, fl) {
    var sug = lv[3] || 0, g = 0;
    if (sug >= 2) g = 2;
    else if (sug === 1) g = (gi > 0 && gi < 56) ? 0 : 1;
    if (gi >= 85) g = Math.max(g, 2);
    else if (gi >= 70) g = Math.max(g, 1);
    if (fl.indexOf("sweet") >= 0) g = Math.max(g, 2);
    if (fl.indexOf("alcohol") >= 0) g = Math.max(g, 1); // 酒类本身带碳水，且打乱血糖调节
    return g;
  }

  function axesOf(f) {
    var lv = f.lv || [0, 0, 0, 0, 0];
    var fl = flags(f);
    var alcohol = fl.indexOf("alcohol") >= 0;
    var meatSoup = fl.indexOf("soup_meat") >= 0;
    // LDL 受饱和脂肪的影响大于膳食胆固醇，所以胆固醇这一级权重降一档
    var ua = lv[0], chol = Math.max(lv[2], Math.max(0, lv[1] - 1)), tg = lv[3];
    var gi = giOf(f);
    if (alcohol) { ua = 2; tg = 2; }
    if (meatSoup) { ua = Math.max(ua, 2); chol = Math.max(chol, 1); }
    if (!alcohol && gi >= 75 && tg === 0) tg = 1;
    var glu = gluOf(lv, gi, fl);
    if (f.starchy) glu = Math.max(glu, 1);
    return { ua: ua, chol: chol, tg: tg, glu: glu, na: lv[4], gi: gi, giKnown: typeof f.gi === "number" && f.gi > 0 };
  }

  function levelOf(a) {
    var g = profile.gluOn === false ? 0 : (a.glu || 0);
    return Math.max(a.ua, a.chol, a.tg, g);
  }

  function reasons(f, a) {
    var r = [], fl = flags(f), lv = f.lv || [0, 0, 0, 0, 0];
    if (fl.indexOf("alcohol") >= 0) r.push("酒精在肾脏和尿酸抢排泄通道，血尿酸立刻升高，同时直接推高甘油三酯");
    else if (a.ua === 2) r.push(f.estimated ? "按原料提示较高尿酸风险，尤其肝肾等内脏应谨慎选择；这是保守分级，不是该菜实测嘌呤含量" : "嘌呤高（> 150 mg/100 g），是尿酸最直接的食物来源");
    else if (a.ua === 1) r.push(f.estimated ? (f.c === "veg" || f.c === "bean" ? "植物来源含有嘌呤，但不能等同动物内脏；按建议份量正常搭配，避免因分级盲目禁食" : "按常见原料估算有一定尿酸负担，份量计入同餐肉类或蛋白质食物总量") : "嘌呤中等（50–150 mg/100 g），可以吃但要称重算量");
    if (a.chol === 2) r.push(f.estimated ? "按常见部位和做法估算脂肪负担较高；实际饱和脂肪取决于肥瘦比例、油种和用量" : "饱和脂肪高，是推高 LDL 的主因");
    else if (a.chol === 1 && (f.lv || [])[1] === 2) r.push("膳食胆固醇很高（> 200 mg/100 g），影响虽不如饱和脂肪，仍要数着个数吃");
    else if (a.chol === 1) r.push(f.estimated ? (f.c === "dairy" ? "按普通乳脂或常见奶制品配方给出饱和脂肪提醒；无糖、无乳糖不等于低脂，实际以脂肪标签和份量为准" : "按常见用料给出保守脂肪提醒，重点控制肥肉及总用油；少量植物油不等于实测饱和脂肪偏高") : "有一定饱和脂肪，放开吃会累到 LDL");
    if (a.tg === 2) r.push(f.estimated ? "按常见含糖配方给出较高糖负担提醒，具体糖量以配方或包装为准；注意全天糖和总能量摄入" : "糖或酒精很高，甘油三酯对这两样最敏感");
    else if (a.tg === 1) r.push(f.estimated ? "糖档是配方参考，不是实测含量；核对是否添加糖及总碳水，避免大份量和叠加甜饮" : "精制碳水或糖偏多，多余糖分会在肝脏转成甘油三酯");
    if (a.glu === 2) {
      if (a.giKnown && a.gi >= 85) r.push("升糖极快（GI 约 " + a.gi + "），餐后血糖会冲上去，胰岛素跟着大起大落");
      else if (lv[3] >= 2) r.push(f.estimated ? "按常见加糖配方提示控糖风险，未提供实测 GI；餐后血糖还取决于摄入份量、整餐碳水及个体情况" : "添加糖很多，餐后血糖会冲得很快，胰岛素跟着大起大落");
      else r.push("精制主食 + 大量糖，血糖和甘油三酯一起被顶上去");
    } else if (a.glu === 1) {
      if (a.giKnown && a.gi >= 70) r.push("GI 约 " + a.gi + "，升糖偏快：配着蛋白和蔬菜吃、份量减半就稳得多");
      else if (a.gi >= 70) r.push("精制主食升糖偏快：按主食算进这一餐的量，别再叠加第二份");
      else r.push(f.starchy ? "含淀粉，控糖要计入这一餐的碳水总量；低糖或不加糖不等于没有升糖影响，未提供实测 GI" : "按常见配方含糖，控糖期注意份量；实际血糖反应还取决于整餐碳水量及个体情况");
    }
    if (fl.indexOf("soup_meat") >= 0) r.push("嘌呤和浮油都溶进了汤里，越熬越浓");
    if (fl.indexOf("fried") >= 0) r.push("油炸额外带来大量油脂和反复加热的油");
    if (fl.indexOf("processed") >= 0 || fl.indexOf("organ") >= 0) r.push("加工或内脏类食物，钠、嘌呤、胆固醇往往同时偏高");
    if (a.na === 2) r.push(f.estimated ? "按常见调味提示较高钠负担，应少用酱汁、核对包装，并控制全天盐摄入；钠单独提示，不直接决定四轴总灯色" : "钠很高，伤血管也伤肾，间接影响尿酸排出");
    return r;
  }

  function axisLabel(a) {
    return [
      { k: "血尿酸", v: a.ua, sub: fmt("ua"), w: "UA" },
      { k: "坏胆固醇 LDL", v: a.chol, sub: fmt("ldl"), w: "LDL" },
      { k: "甘油三酯", v: a.tg, sub: fmt("tg"), w: "TG" },
      { k: "血糖", v: profile.gluOn === false ? -1 : a.glu, sub: fmt("glu"), w: "GLU" }
    ];
  }

  var UNIT = { ua: " μmol/L", ldl: " mmol/L", tg: " mmol/L", glu: " mmol/L" };
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
      it.keys.forEach(function (k, ki) {
        k = k.toLowerCase().replace(/\s+/g, "");
        if (k === q) best = Math.max(best, ki === 0 ? 120 : 100);
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
  // 做法词取最长命中，"粉蒸"不会被"蒸"抢走
  function cookOf(q) {
    if (!window.COOKS) return null;
    var best = null, bw = "";
    window.COOKS.forEach(function (c) {
      c.k.split(",").forEach(function (w) {
        if (w && q.indexOf(w) >= 0 && w.length > bw.length) { best = c; bw = w; }
      });
    });
    return best ? { cook: best, word: bw } : null;
  }

  function compose(q) {
    if (!window.COOKS || !window.MAINS) return null;
    var hit = cookOf(q);
    var cook = hit ? hit.cook : null;
    var rest = hit ? q.split(hit.word).join("") : q;
    if (!window.MAINS_SORTED) {
      window.MAINS_SORTED = window.MAINS.slice().sort(function (a, b) { return b.length - a.length; });
    }
    var found = [], pool = rest, i;
    for (i = 0; i < window.MAINS_SORTED.length && found.length < 3; i++) {
      var w = window.MAINS_SORTED[i];
      if (pool.indexOf(w) >= 0) { found.push(w); pool = pool.split(w).join(""); }
    }
    // 主料词被做法词吃掉的情况（如"回锅肉"只剩"肉"）
    if (!found.length) { pool = q; for (i = 0; i < window.MAINS_SORTED.length && found.length < 3; i++) {
      var w2 = window.MAINS_SORTED[i];
      if (pool.indexOf(w2) >= 0) { found.push(w2); pool = pool.split(w2).join(""); }
    } }
    if (!found.length) return null;

    var base = [0, 0, 0, 0, 0], parts = [], gi = 0, starchy = false;
    found.forEach(function (word) {
      var candidates = search(word);
      var r = exactHit(candidates, word) || candidates[0];
      if (!r) return;
      parts.push({ n: r.n, c: r.c, lv: r.lv, s: r.s, t: r.t, gi: r.gi, starchy: r.starchy, estimated: r.estimated });
      for (var k = 0; k < 5; k++) base[k] = Math.max(base[k], r.lv[k] || 0);
      if (r.gi) gi = Math.max(gi, r.gi);
      if (r.starchy) starchy = true;
    });
    if (!parts.length) return null;

    var meaty = base[0] >= 1; // 主料里有没有中高嘌呤的东西
    var tip = "按下面每一项分别控制";
    if (cook) {
      var clv = window.cookLv(cook).slice();
      var ct = cook.t;
      if (cook.soup) {
        if (meaty) { clv[0] = 2; ct = "肉可以吃，汤一口别碰——嘌呤和浮油都溶进汤里了"; }
        else { ct = "素汤可以喝，少放盐和油"; }
      }
      parts.push({ n: "做法：" + cook.n, lv: clv, s: "", t: ct });
      for (var k2 = 0; k2 < 5; k2++) base[k2] = Math.max(base[k2], clv[k2] || 0);
      tip = ct;
    }
    return { n: q, c: "做法 + 食材自动拆解", lv: base, gi: gi, starchy: starchy, estimated: true, s: "按下面每一项分别控制", t: tip, parts: parts };
  }

  function brandHit(q) {
    if (!window.BRANDS) return null;
    for (var i = 0; i < window.BRANDS.length; i++) {
      var ks = window.BRANDS[i].k.split(",");
      for (var j = 0; j < ks.length; j++) {
        if (q.indexOf(ks[j]) >= 0) {
          var b = window.BRANDS[i];
          return { n: q, c: b.n, lv: b.lv, f: b.f, gi: b.gi, s: b.s, t: b.t, alt: b.alt, pack: true };
        }
      }
    }
    return null;
  }

  function catFallback(q) {
    q = (q || "").trim();
    for (var i = 0; i < window.CATS.length; i++) {
      var ks = window.CATS[i].k.split(",");
      for (var j = 0; j < ks.length; j++) {
        if (q.indexOf(ks[j]) >= 0) {
          var c = window.CATS[i];
          return { n: q, c: c.n, lv: c.lv, f: c.f, gi: c.gi, s: c.s, t: c.t, approx: c.n };
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
      if (x.v < 0) {
        out += '<div class="axe off"><div class="axe-top"><span class="axe-k">' + x.k + '</span>' +
          '<span class="axe-v" style="color:#86868B">未计入</span></div>' +
          '<div class="bar"></div><div class="axe-sub">设置里可以打开这一轴</div></div>';
        return;
      }
      out += '<div class="axe"><div class="axe-top"><span class="axe-k">' + x.k + '</span>' +
        '<span class="axe-v" style="color:' + LV_COLOR[x.v] + '">' + LV_NAME[x.v] + '负担</span></div>' +
        bar(x.v) + '<div class="axe-sub">你的' + x.w + '：' + x.sub + (x.w === "GLU" ? "（空腹）" : "") + '</div></div>';
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

    if (f.estimated) html += '<div class="approx">常见做法参考分级 · 不是逐菜营养检测值；实际用料、油盐糖和份量可能改变结果</div>';
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
    if (f.pack) html += '<button class="chip" id="packbtn" style="margin-top:12px">手边有包装？翻背面三个数算得更准</button>';
    html += '</div>';
    return html;
  }

  // ---------- 包装食品：按营养成分表判定 ----------
  function bindPack(q) {
    var pb = $("packbtn");
    if (pb) pb.onclick = function () { openPack(q); };
  }

  function openPack(q) {
    var body = $("packbody");
    if (!body) return;
    body.style.display = "block";
    var lbl = $("packname");
    if (lbl && q) lbl.textContent = "正在看：" + q;
    var sat = $("satIn");
    if (sat && !sat.value) sat.focus();
    renderPack();
    if (body.scrollIntoView) body.scrollIntoView({ block: "center" });
  }

  function renderPack() {
    var out = $("packout");
    if (!out) return;
    var sat = parseFloat($("satIn").value), sug = parseFloat($("sugIn").value), na = parseFloat($("naIn").value);
    var meaty = $("meatIn") && $("meatIn").checked;
    var starchy = $("starchIn") && $("starchIn").checked;
    if (isNaN(sat) && isNaN(sug) && isNaN(na)) {
      out.innerHTML = '<div class="note">填任意一项就能算。拿不准就填饱和脂肪和糖这两项。</div>';
      return;
    }
    sat = isNaN(sat) ? 0 : sat; sug = isNaN(sug) ? 0 : sug; na = isNaN(na) ? 0 : na;
    var a = window.packAxes(sat, sug, na, meaty, starchy);
    var l = levelOf(a);
    var v = VERDICT[l];
    var why = [];
    if (a.chol === 2) why.push("饱和脂肪 " + sat + " g/100 g，超过上限（> 5 g）");
    else if (a.chol === 1) why.push("饱和脂肪 " + sat + " g/100 g，中等偏高（> 1.5 g）");
    if (a.tg === 2) why.push("糖 " + sug + " g/100 g，超过上限（> 15 g）：甘油三酯和血糖一起被顶上去");
    else if (a.tg === 1) why.push("糖 " + sug + " g/100 g，中等偏高（> 5 g）");
    if (a.glu === 2 || a.glu === 1) {
      if (sug > 15) why.push("血糖轴：一份就吃进去 " + Math.round(sug) + " g 糖，餐后血糖会冲一下");
      else if (starchy) why.push("血糖轴：是淀粉类主食，精制碳水升糖快，按主食算进这一餐的量");
      else why.push("血糖轴：糖不算低，控糖期要把份量压住");
    }
    if (a.na === 2) why.push("钠 " + na + " mg/100 g，超过上限（> 800 mg）");
    else if (a.na === 1) why.push("钠 " + na + " mg/100 g，中等偏高（> 400 mg）");
    if (meaty) why.push("配料里有肉粉 / 海鲜 / 酵母提取物，嘌呤要按中等算");
    if (!why.length) why.push("三项都在安全区，可以放心吃");
    var amount = l === 2 ? "实在要吃 ≤ 20 g" : l === 1 ? "一次 30 g 以内" : "一次 50 g 以内";
    out.innerHTML = '<div class="verdict" style="background:' + v.b + ';margin-bottom:10px">' +
      '<span class="dot big" style="background:' + LV_FILL[l] + '"></span><div>' +
      '<div class="verdict-t" style="color:' + v.c + '">' + v.t + '　·　' + amount + '</div>' +
      '<div class="verdict-s" style="color:' + v.c + '">' + why[0] + '</div></div></div>' +
      '<ul class="why">' + why.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + '</ul>';
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
    var norm = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, ""); };
    q = norm(q);
    // 所有完整主名先找完，再找别名，避免早加载的别名抢走独立菜名。
    for (var i = 0; i < res.length; i++) if (norm(res[i].n) === q) return res[i];
    for (var k = 0; k < res.length; k++) {
      var al = (res[k].al || "").split(",");
      for (var j = 0; j < al.length; j++) if (norm(al[j]) === q) return res[k];
    }
    return null;
  }

  function renderQuery(q) {
    var box = $("out");
    if (!q) { box.innerHTML = emptyState(); return; }
    var res = search(q);
    if (custom[q]) {
      var c = window.CATS[custom[q]];
      res = [{ n: q, c: c.n, lv: c.lv, f: c.f, gi: c.gi, s: c.s, t: c.t }].concat(res);
    }
    if (res.length === 0) {
      var comp = compose(q);
      if (comp) { box.innerHTML = card(comp, { approx: true, approxName: q, approxLabel: "做法 + 食材自动拆解" }); bindCatPick(q); return; }
      var br = brandHit(q);
      if (br) { box.innerHTML = card(br, { approx: true, approxName: q, approxLabel: br.c }); bindPack(q); return; }
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

  function metric(label, k) {
    var v = profile[k];
    var o = over(k);
    return '<div class="metric"><div class="m-l">' + label + '</div>' +
      '<div class="m-v">' + v + '</div>' +
      '<div class="m-s" style="color:' + (o ? "#A32D2D" : "#3B6D11") + '">' +
      (profile.custom ? (o ? "偏高" : "达标") : "上限") + '，上限 ' + LIMIT[k] + '</div></div>';
  }

  function summary() {
    if (!profile.custom) return "填上自己的数值后，这里会显示达标情况，每条食物的四条轴也会标上你的实测值。";
    var overs = [];
    if (over("ua")) overs.push("尿酸");
    if (over("ldl")) overs.push("LDL");
    if (over("tg")) overs.push("甘油三酯");
    if (over("glu")) overs.push("血糖");
    if (!overs.length) return "四项都在标准内，继续保持：少酒、少糖、少精制主食、少内脏和浓汤。";
    return overs.join("、") + " 偏高，饮食控制是最直接有效的手段。" +
      (over("ua") ? "尿酸偏高时，酒、内脏、贝类和浓汤是优先级最高的禁区。" : "") +
      (over("glu") ? "血糖偏高时，先把白米白面和含糖饮料换掉，见效最快。" : "");
  }

  function updateHeader() {
    var el = $("hdr");
    if (!el) return;
    el.textContent = "UA " + profile.ua + " · LDL " + profile.ldl + " · TG " + profile.tg + " · GLU " + profile.glu + "　" +
      (profile.custom ? "能不能吃、吃多少、为什么" : "点 ≡ 填入你的体检数值");
  }

  function emptyState() {
    return '<div class="card result empty">' +
      '<div class="verdict" style="background:#E6F1FB"><span class="dot big" style="background:#378ADD"></span><div>' +
      '<div class="verdict-t" style="color:#0C447C">输入食物名，立刻告诉你能不能吃</div>' +
      '<div class="verdict-s" style="color:#185FA5">支持中文名、别名、拼音首字母，比如「nrM」也能搜到牛肉面</div></div></div>' +
      (profile.custom ? '' :
        '<div class="guide">可在右上角 ≡ 里填入体检四项数值，用于显示达标情况；食物灯色仍按通用参考规则给出，不自动随化验值调整。不填也能用，数值只存在这台设备上。</div>') +
      '<div class="sec-t">' + (profile.custom ? "你的指标" : "通用参考上限") + '</div><div class="metrics">' +
      metric("血尿酸 UA", "ua") + metric("坏胆固醇 LDL", "ldl") + metric("甘油三酯 TG", "tg") + metric("血糖 GLU", "glu") +
      '</div><div class="note">' + summary() + '</div></div>';
  }

  // ---------- 启动 ----------
  function init() {
    buildIndex();
    var stats = $("libraryStats");
    if (stats) {
      var aliases = {};
      INDEX.forEach(function (it) { it.keys.slice(1).forEach(function (k) { aliases[k] = true; }); });
      stats.textContent = "奶类·麻薯·魔芋扩充版 2026.10.18 · " + INDEX.length + " 条预置食物 · " + Object.keys(aliases).length + " 个别名";
    }
    $("out").innerHTML = emptyState();
    var qi = $("q");
    qi.addEventListener("input", function () { renderQuery(qi.value.trim()); });
    qi.addEventListener("keydown", function (e) { if (e.key === "Enter") { qi.blur(); renderQuery(qi.value.trim()); } });
    $("setbtn").onclick = function () { $("sheet").classList.toggle("show"); };
    $("closebtn").onclick = function () { $("sheet").classList.remove("show"); };
    $("modesel").value = profile.mode;
    $("modesel").onchange = function () { profile.mode = this.value; save("hf-profile", profile); renderQuery($("q").value.trim()); };
    var go = $("gluOnIn");
    if (go) {
      go.checked = profile.gluOn !== false;
      go.onchange = function () {
        profile.gluOn = this.checked;
        save("hf-profile", profile);
        renderQuery($("q").value.trim());
      };
    }
    ["ua", "ldl", "tg", "glu"].forEach(function (k) {
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
    var pt = $("packtoggle");
    if (pt) pt.onclick = function () {
      var b = $("packbody");
      if (b) b.style.display = b.style.display === "block" ? "none" : "block";
    };
    ["satIn", "sugIn", "naIn"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("input", renderPack);
    });
    ["meatIn", "starchIn"].forEach(function (id) {
      var el = $(id);
      if (el) el.onchange = renderPack;
    });
    renderPack();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
    }
  }

  window.__HF = { search: search, catFallback: catFallback, compose: compose, brandHit: brandHit, cookOf: cookOf, exactHit: exactHit, axesOf: axesOf, levelOf: levelOf, buildIndex: buildIndex, card: card, renderQuery: renderQuery, renderPack: renderPack, init: init, VERDICT: VERDICT };

  window.addEventListener("DOMContentLoaded", init);
})();
