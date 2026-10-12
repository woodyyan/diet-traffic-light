// 冒烟测试：用最小 DOM 桩跑一遍完整渲染路径，确认无运行时报错
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "src");
const files = ["foods-1.js", "foods-2.js", "foods-3.js", "foods-4.js", "dishes.js", "app.js"];
const js = files.map((f) => fs.readFileSync(path.join(src, f), "utf8")).join("\n");

function el(id) {
  return {
    id, innerHTML: "", value: "", onclick: null, onchange: null,
    classList: { toggle() {}, remove() {}, add() {} },
    addEventListener() {}, blur() {},
    querySelectorAll: () => [],
  };
}
const els = { q: el("q"), out: el("out"), setbtn: el("setbtn"), closebtn: el("closebtn"), sheet: el("sheet"), modesel: el("modesel") };
const store = {};
global.window = { addEventListener() {}, scrollTo() {}, FOODS: [], CATS: [] };
global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.document = { getElementById: (id) => els[id] || null, querySelectorAll: () => [] };
global.navigator = {};

eval(js);
const HF = global.window.__HF;

let err = 0;
function run(q) {
  try {
    HF.renderQuery(q);
    const h = els.out.innerHTML;
    const ok = h.length > 100 && /card/.test(h);
    console.log(`  ${q.padEnd(8)} 渲染 ${h.length} 字符 ${ok ? "OK" : "内容异常"}`);
    if (!ok) err++;
    return h;
  } catch (e) {
    console.log(`  ${q.padEnd(8)} 报错: ${e.message}`);
    err++;
    return "";
  }
}

try { HF.init(); console.log("  init()  OK"); } catch (e) { console.log("  init() 报错: " + e.message); err++; }

const hotpot = run("火锅");
const latiao = run("辣条");
run("牛肉面");
run("xyz不存在的东西");
run("");

// 关键片段检查
const checks = [
  ["火锅拆解", hotpot.includes("锅底汤") && hotpot.includes("蘸料")],
  ["火锅结论", hotpot.includes("能吃，限量")],
  ["辣条红灯", latiao.includes("不建议吃") && latiao.includes("实在要吃的话")],
  ["辣条原因", latiao.includes("油") && latiao.includes("钠")],
  ["三轴渲染", latiao.includes("血尿酸") && latiao.includes("甘油三酯")],
];
checks.forEach(([n, ok]) => { console.log(`  ${ok ? "OK  " : "FAIL"} ${n}`); if (!ok) err++; });

console.log(err ? `\n${err} 项异常` : "\n冒烟测试全部通过");
process.exit(err ? 1 : 0);
