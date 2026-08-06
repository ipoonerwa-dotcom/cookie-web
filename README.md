# Cookie Web

Cookie 的前端:Landing 页 + 四标签 DApp(预售 / 销毁挖矿 / 邀请 / 领取)。

## 结构

```
index.html   页面 + 全部样式(单文件,无构建)
app.js       交互层,零依赖:window.ethereum + 手写 ABI 编解码
config.js    全站唯一配置 —— 部署完只改这一个文件
```

没有构建步骤、没有 npm 依赖、不引任何 CDN。丢到任何静态托管上就能跑。

## 部署到 Vercel

导入这个仓库,框架选 **Other**,Build Command 和 Output Directory 都留空(根目录就是站点)。

## 合约地址填在哪

`config.js`:

```js
mining:  "0x…",   // 销毁挖矿合约
presale: "0x…",   // 预售合约
token:   "0x…",   // Cookie 代币
```

留空时对应板块自动显示"尚未部署",不会报错。

官方链接也在这里:

```js
social: { qq: "", twitter: "", telegram: "", docs: "" }
```

留空的项不显示;全空则显示"官方渠道即将公布"。生态板块(预测体育赛事 / Polymarket / AI Agent 超级 NFT)的文案和标签同样在 `config.js` 里改。

## 数据来源

连上钱包后所有数字**一律以链上读数为准**,`config.js` 里的参数只用于未连钱包时的静态展示。

## 移动端

无横向溢出,四个标签页均单列自适应;标签栏吸顶,长页面滚动时随时可切;触摸目标 ≥44px。
