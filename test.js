const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "src");
const files = ["foods-1.js", "foods-2.js", "foods-3.js", "dishes.js", "app.js"];
const js = files.map((f) => fs.readFileSync(path.join(src, f), "utf8")).join("\n");

const store = {};
global.window = { addEventListener() {}, FOODS: [], CATS: [] };
global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.document = { getElementById: () => null, querySelectorAll: () => [] };
global.navigator = {};

eval(js);
const HF = global.window.__HF;
HF.buildIndex();

const V = ["绿", "黄", "红"];
const cases = ["辣条", "牛肉面", "啤酒", "猪肝", "鸡蛋", "米饭", "火锅", "水果", "豆腐", "牛奶", "果汁", "虾", "炒菜", "串串", "白粥", "三文鱼", "nrM", "huoguo", "辣子鸡丁", "水", "生蚝", "瓜子", "油条", "鸡肉", "葡萄"];
let fails = 0;
for (const q of cases) {
  const res = HF.search(q);
  let name, axes, lvl, src2 = "库";
  if (res.length) { const f = res[0]; name = f.n; axes = HF.axesOf(f); lvl = HF.levelOf(axes); }
  else {
    const cf = HF.catFallback(q);
    if (!cf) { console.log(`  ${q.padEnd(10)} → 无命中，无兜底（会走保守原则）`); continue; }
    name = cf.c; axes = HF.axesOf(cf); lvl = HF.levelOf(axes); src2 = "兜底";
  }
  console.log(`  ${q.padEnd(10)} → ${name.padEnd(8)} [${src2}] ${V[lvl]}灯  UA${axes.ua} LDL${axes.chol} TG${axes.tg}  ${HF.VERDICT[lvl].t}`);
}

// 全员自检：每条都必须能算出等级、且含中文名
const bad = [];
window.FOODS.forEach((f) => {
  if (!f.n || !f.lv || f.lv.length !== 5) bad.push(f.n + " lv异常");
  const a = HF.axesOf(f);
  if (!(a.ua >= 0 && a.ua <= 2 && a.chol <= 2 && a.tg <= 2)) bad.push(f.n + " 轴越界");
});
console.log("\n条目总数:", window.FOODS.length, "| 类别兜底:", window.CATS.length, "| 异常:", bad.length ? bad.join(", ") : "无");

// 关键预期
const expect = { 辣条: 2, 啤酒: 2, 猪肝: 2, 生蚝: 2, 果汁: 2, 米饭: 1, 豆腐: 0, 水: 0, 牛奶: 0, 牛肉面: 1, 鸡蛋: 1, 火锅: 1, 鸡胸肉: 1, 蛋黄: 2, 黄油: 2, 苹果: 1, 西兰花: 0 };
for (const [k, want] of Object.entries(expect)) {
  const r = HF.search(k);
  const got = HF.levelOf(HF.axesOf(r[0]));
  if (got !== want) { console.log(`  ✗ ${k} 期望${V[want]}灯 实际${V[got]}灯`); fails++; }
}
console.log(fails ? `\n${fails} 项判定与预期不符` : "\n关键判定全部符合预期");
