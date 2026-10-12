const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "src");
const dist = path.join(__dirname, "dist");
const files = ["foods-1.js", "foods-2.js", "foods-3.js", "dishes.js", "app.js"];

if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

const js = files.map((f) => fs.readFileSync(path.join(src, f), "utf8")).join("\n");
const tpl = fs.readFileSync(path.join(src, "template.html"), "utf8");
const html = tpl.replace("<!--APP-->", "<script>\n" + js + "\n</script>");
fs.writeFileSync(path.join(dist, "index.html"), html);

const count = (js.match(/\{n:"/g) || []).length;
console.log("built dist/index.html", (html.length / 1024).toFixed(1) + " KB", "| foods:", count, "| cats:", (js.match(/\n\{k:"/g) || []).length);
