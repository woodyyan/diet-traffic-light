const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const src = path.join(__dirname, "src");
const dist = path.join(__dirname, "dist");
const files = ["foods-1.js", "foods-2.js", "foods-3.js", "foods-4.js", "foods-5.js", "foods-6.js", "foods-7.js", "foods-8.js", "dishes.js", "packs.js", "app.js"];

if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

const js = files.map((f) => fs.readFileSync(path.join(src, f), "utf8")).join("\n");
const tpl = fs.readFileSync(path.join(src, "template.html"), "utf8");
const html = tpl.replace("<!--APP-->", "<script>\n" + js + "\n</script>");
fs.writeFileSync(path.join(dist, "index.html"), html);

// 使用实际数据统计，避免把拆解子项、品牌规则误计为独立菜名。
const context = { window: {} };
vm.createContext(context);
for (const file of files.filter((f) => f !== "app.js")) vm.runInContext(fs.readFileSync(path.join(src, file), "utf8"), context);
const aliases = new Set(context.window.FOODS.flatMap((f) => (f.al || "").split(",").filter(Boolean)));
// 内容变化自动变更缓存键；以后无需手工改 v5/v6，避免旧页面持续挡住新菜库。
const swPath = path.join(dist, "sw.js");
if (fs.existsSync(swPath)) {
  const version = crypto.createHash("sha256").update(html).digest("hex").slice(0, 12);
  const worker = fs.readFileSync(swPath, "utf8").replace(/var CACHE = "diet-light-[^"]+";/, "var CACHE = \"diet-light-" + version + "\";");
  fs.writeFileSync(swPath, worker);
}
console.log("built dist/index.html", (Buffer.byteLength(html) / 1024).toFixed(1) + " KB", "| foods:", context.window.FOODS.length, "| aliases:", aliases.size, "| cats:", context.window.CATS.length);
