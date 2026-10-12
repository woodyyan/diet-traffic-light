# 三高饮食红绿灯

输入食物名，立刻告诉你能不能吃、吃多少、为什么。面向**高胆固醇 / 高甘油三酯 / 高尿酸**人群的日常饮食自查工具。

纯静态单文件应用，零依赖、零后端、可离线，数据只存在本机。

## 在线地址

https://diet-traffic-light.app-tencent.workbuddy.host/

手机浏览器打开后「添加到主屏幕」，即可像 App 一样使用。

## 判定逻辑

每种食物按五个维度分级：`lv = [嘌呤, 胆固醇, 饱和脂肪, 糖, 钠]`，取值 `0=低 / 1=中 / 2=高`，阈值参考《中国食物成分表》及高尿酸血症、血脂异常相关膳食共识的通用分类（嘌呤低 <50、中 50–150、高 >150 mg/100g）。

再归到三个轴，取最严的一档决定灯色：

| 轴 | 看什么 | 红灯情形 |
|---|---|---|
| 血尿酸 UA | 嘌呤、果糖、酒精 | 高嘌呤、任何酒、浓肉汤 |
| 坏胆固醇 LDL | 饱和脂肪（权重高）、膳食胆固醇（权重低一档） | 饱和脂肪高、内脏、油炸 |
| 甘油三酯 TG | 糖、精制碳水、酒精、GI | 含糖饮料、果汁、甜点、油炸 + 精制碳水 |

特殊标签：`alcohol`（酒）、`soup_meat`（肉汤骨汤，嘌呤和油脂都溶进汤里）、`fried`、`processed`、`organ`。

## 目录结构

```
src/foods-1.js   主食、肉蛋
src/foods-2.js   水产、豆制品、蔬菜、水果
src/foods-3.js   奶制品、坚果、饮料、零食、调味油脂
src/dishes.js    复合菜式（拆到配料分别判定）+ 22 条类别兜底规则
src/app.js       判定引擎与界面渲染
src/template.html 页面骨架与样式
build.js         把上面全部内联成单文件 dist/index.html
gen_icon.py      生成 PWA 图标
test.js          判定自检（关键食物是否符合预期灯色）
smoke.js         渲染冒烟测试
dist/            构建产物，可直接静态托管
```

## 本地开发

```bash
node build.js    # 生成 dist/index.html（约 50 KB 单文件）
node test.js     # 判定自检
node smoke.js    # 渲染冒烟
```

改食物库：编辑 `src/foods-*.js` 或 `src/dishes.js`，然后重新 `node build.js`。
`dist/index.html` 是自包含的单文件，双击也能直接用。

## 部署

项目根目录已带 `vercel.json`（`buildCommand: node build.js`，`outputDirectory: dist`）。
在 Vercel 导入仓库后无需额外配置；任何静态托管（GitHub Pages、Netlify、对象存储）直接托管 `dist/` 也可。

## 免责

本工具只做日常膳食参考，不替代医嘱。痛风急性发作期、甘油三酯超过 5.6 mmol/L 时请遵医嘱，常规建议不适用。
