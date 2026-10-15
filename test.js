const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "src");
const files = ["foods-1.js", "foods-2.js", "foods-3.js", "foods-4.js", "foods-5.js", "foods-6.js", "foods-7.js", "foods-8.js", "dishes.js", "packs.js", "app.js"];
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

// 与 app 判定顺序一致：库 → 做法+食材拆解 → 类别兜底
function resolve(q) {
  const res = HF.search(q);
  if (res.length) return { f: HF.exactHit(res, q) || res[0], src: "库" };
  const comp = HF.compose(q);
  if (comp) return { f: comp, src: "拆解" };
  const br = HF.brandHit(q);
  if (br) return { f: br, src: "品牌" };
  const cf = HF.catFallback(q);
  if (cf) return { f: cf, src: "兜底" };
  return null;
}

const cases = ["辣条", "牛肉面", "啤酒", "猪肝", "鸡蛋", "米饭", "火锅", "水果", "豆腐", "牛奶", "果汁", "虾", "炒菜", "串串", "白粥", "三文鱼", "nrM", "huoguo", "辣子鸡丁", "水", "生蚝", "瓜子", "油条", "鸡肉", "葡萄",
  "莴笋汤", "鸡汤", "水煮肉片", "莴笋炒肉", "回锅肉", "酸辣粉", "华夫饼", "莴笋排骨汤", "清蒸鲈鱼", "干煸四季豆", "番茄炒蛋", "日式拉面", "关东煮", "寿司", "白切鸡", "麻婆豆腐", "地三鲜", "炒年糕", "皮蛋瘦肉粥", "鸡蛋灌饼", "三明治", "鱼香肉丝",
  "粉蒸排骨", "脆脆鲨", "奥利奥", "乐事", "士力架", "每日坚果", "养乐多", "可乐", "猪肉脯", "苏打饼干", "溜溜梅", "腊肠煲仔饭", "腌笃鲜", "白灼虾",
  "雪碧", "营养快线", "加多宝", "红牛", "鲜橙多", "脉动", "冰红茶", "元气森林", "东方树叶", "三得利乌龙茶", "豆浆", "甜豆浆", "矿泉水", "无糖奶茶", "外星人电解质水", "星冰乐", "速溶三合一咖啡", "椰奶", "巴黎水", "维他柠檬茶", "蜜雪冰城"];
let fails = 0;
for (const q of cases) {
  const r = resolve(q);
  if (!r) { console.log(`  ${q.padEnd(10)} → 无命中，走保守原则`); continue; }
  const axes = HF.axesOf(r.f), lvl = HF.levelOf(axes);
  console.log(`  ${q.padEnd(10)} → ${String(r.f.n).padEnd(8)} [${r.src}] ${V[lvl]}灯  UA${axes.ua} LDL${axes.chol} TG${axes.tg} GLU${axes.glu}  ${HF.VERDICT[lvl].t}`);
}

// 全员自检：每条都必须能算出等级、且含中文名
const bad = [];
window.FOODS.forEach((f) => {
  if (!f.n || !f.lv || f.lv.length !== 5) bad.push(f.n + " lv异常");
  const a = HF.axesOf(f);
  if (![a.ua, a.chol, a.tg, a.glu, a.na].every((v) => Number.isInteger(v) && v >= 0 && v <= 2)) bad.push(f.n + " 轴越界");
  if (!f.lv.every((v) => Number.isInteger(v) && v >= 0 && v <= 2)) bad.push(f.n + " 原始分级越界");
});
console.log("\n条目总数:", window.FOODS.length, "| 类别兜底:", window.CATS.length, "| 异常:", bad.length ? bad.join(", ") : "无");

// 关键预期
const expect = { 辣条: 2, 啤酒: 2, 猪肝: 2, 生蚝: 2, 果汁: 2, 米饭: 1, 豆腐: 0, 水: 0, 牛奶: 1, 牛肉面: 1, 鸡蛋: 1, 火锅: 1, 鸡胸肉: 1, 蛋黄: 2, 黄油: 2, 苹果: 1, 西兰花: 0,
  鸡汤: 2, 水煮肉片: 2, 回锅肉: 2, 华夫饼: 2, 酸辣粉: 1, 莴笋炒肉: 1, 莴笋汤: 0, 清蒸鲈鱼: 1, 番茄炒蛋: 1, 地三鲜: 2,
  粉蒸排骨: 1, 脆脆鲨: 2, 奥利奥: 2, 乐事: 2, 士力架: 2, 每日坚果: 1, 养乐多: 2, 可乐: 2, 猪肉脯: 2, 苏打饼干: 1, 溜溜梅: 2, 腌笃鲜: 2, 白灼虾: 1, 鱼香肉丝: 1,
  // 血糖轴专项：精制主食黄/红、杂粮豆类绿、含糖饮料红
  白粥: 2, 馒头: 2, 年糕: 2, 阳春面: 1, 西瓜: 1, 荔枝: 2, 杂粮饭: 0, 荞麦面: 0, 意大利面: 0, 糙米饭: 0, 米粉: 0,
  雪碧: 2, 营养快线: 2, 加多宝: 2, 红牛: 2, 鲜橙多: 2, 脉动: 2, 冰红茶: 2, 元气森林: 0, 东方树叶: 0, 三得利乌龙茶: 0, 豆浆: 0, 甜豆浆: 2, 矿泉水: 0, 无糖奶茶: 1, 外星人电解质水: 0, 星冰乐: 2, 速溶三合一咖啡: 2, 椰奶: 2, 巴黎水: 0, 维他柠檬茶: 2, 蜜雪冰城: 2 };
for (const [k, want] of Object.entries(expect)) {
  const r = resolve(k);
  if (!r) { console.log(`  ✗ ${k} 无命中`); fails++; continue; }
  const got = HF.levelOf(HF.axesOf(r.f));
  if (got !== want) { console.log(`  ✗ ${k} 期望${V[want]}灯 实际${V[got]}灯`); fails++; }
}
// 覆盖库质量门禁：主名唯一、别名唯一、所有完整主名和别名精确命中。
const names = new Map(), aliases = new Map();
for (const f of window.FOODS) {
  if (names.has(f.n)) bad.push("主名重复：" + f.n);
  names.set(f.n, f);
  for (const al of (f.al || "").split(",").filter(Boolean)) {
    if (aliases.has(al)) bad.push("别名重复：" + al);
    aliases.set(al, f);
  }
  if (HF.search(f.n)[0] !== f || HF.exactHit(HF.search(f.n), f.n) !== f) bad.push("完整主名被抢：" + f.n);
  const html = HF.card(f);
  if ((html.match(/class="axe"/g) || []).length !== 4 || html.includes("undefined") || html.includes("NaN")) bad.push("渲染异常：" + f.n);
}
for (const [al, f] of aliases) {
  const want = names.get(al) || f;
  if (HF.exactHit(HF.search(al), al) !== want) bad.push("别名命中异常：" + al);
}
const newCases = { 卤肉: 2, 卤菜: 1, 猪头肉: 2, 猪耳朵: 1, 香菜: 0, 牛筋: 1, 毛肚: 2, 火腿肠: 1, 鸭头: 1,
  卤牛筋: 1, 卤猪耳朵: 1, 猪舌: 1, 牛百叶: 2, 鸡胗: 2, 蒜苔: 0, 蒸芋头: 1, 芹菜炒百合: 1, 鸭肠: 2 };
for (const [q, want] of Object.entries(newCases)) {
  const f = names.get(q);
  if (!f || resolve(q).f !== f || HF.levelOf(HF.axesOf(f)) !== want) bad.push("新增菜名判定：" + q);
}
for (const [q, name] of Object.entries({ 卤味: "卤菜", 口条: "猪舌", 卤猪耳: "卤猪耳朵", 牛腱子: "牛腱肉", 芫荽: "香菜", 牛蹄筋: "牛筋", 百叶: "豆腐皮" })) {
  if (resolve(q).f.n !== name) bad.push("跨食材别名：" + q);
}
for (const q of ["卤肉", "卤菜", "猪头肉", "猪耳朵", "香菜", "牛筋", "毛肚", "火腿肠", "鸭头"]) {
  const f = names.get(q), a = HF.axesOf(f);
  console.log("新增精确命中:", q, "|", V[HF.levelOf(a)] + "灯", "|四轴", JSON.stringify(a), "|", f.s);
}
const comp = HF.compose("蒜苗炒牛筋");
if (!comp || !comp.parts.some((p) => p.n === "牛筋") || !comp.parts.some((p) => p.n === "蒜苗")) bad.push("新主料拆解缺失");
if (HF.axesOf(names.get("卤肉")).gi !== 0) bad.push("卤肉误套米饭GI");
if (HF.axesOf(names.get("火腿肠")).glu < 1 || HF.axesOf(names.get("芹菜炒百合")).glu < 1) bad.push("淀粉控糖标签缺失");
const extra = window.FOODS.filter((f) => f.estimated);
console.log("\n独立食物:", names.size, "|唯一别名:", aliases.size, "|新增及更新参考分级:", extra.length);
if (bad.length) console.log("质量门禁错误：", bad.join("；"));
console.log(fails || bad.length ? `\n${fails + bad.length} 项检查未通过` : "\n关键判定与全库质量门禁全部通过");
process.exitCode = fails || bad.length ? 1 : 0;
