/* ============================================================
   Cookie — 全站唯一配置
   合约部署后回来改这里,前端无需改动
   ============================================================ */
window.COOKIE_CONFIG = {
  // 链
  chainId: 56,                     // BSC 主网 56 / 测试网 97
  chainName: "BNB Smart Chain",
  rpc: "https://bsc-dataseed.binance.org",
  explorer: "https://bscscan.com",

  // 合约(部署后填)
  mining: "",                      // 销毁挖矿合约
  presale: "",                     // 预售合约(部署后填)
  token: "",                       // Cookie 代币
  tokenSymbol: "COOKIE",
  tokenDecimals: 18,

  // 挖矿参数(仅未连钱包时展示;连上后一律以链上读数为准)
  burnMultiplier: 2,               // 销毁得几倍额度
  dailyRatePct: 2,                 // 每日释放百分比
  tzOffsetHours: 8,                // 零点按哪个时区(默认北京 +8)
  levels: [
    { gen: "一代", pct: 10, hold: 1000000 },
    { gen: "二代", pct: 5,  hold: 2000000 },
    { gen: "三代", pct: 5,  hold: 3000000 }
  ],

  // 预售参数(同样仅作未连钱包时的展示)
  presaleTiers: [
    { key: "community", label: "社区额度", bnb: 1,   badge: "团队长优选" },
    { key: "retail",    label: "散户额度", bnb: 0.2, badge: "人人可参与" }
  ],
  presaleRate: 10000,              // 1 BNB = 多少枚(1.5 倍之前的面值)
  presaleBonus: 1.5,               // 上线获得对应数量的几倍筹码 → 实得 15000/BNB
  presaleInstantPct: 50,           // 上线先释放百分之多少 → 7500/BNB
  presaleDailyPct: 2,              // 之后每日释放总额的百分比 → 300/BNB/天,25 天放完
  presaleHardCap: 2000,            // 募集上限(BNB)
  presaleTreasury: "0xD25d311Ee40F5d6B221748a78f04C6B0A6AEB5ad",  // 收款地址(部署后用 setTreasury 写进合约)
  presaleSweepMinutes: 3,          // 自动归集间隔,合约里可改(setSweep,下限 60 秒)

  // 首屏滚动墙。
  // ⚠️ 这里放的每一条都是对外声明 —— 只写你们真正在用或真正谈成的,
  //    别把没有关系的项目方 logo 摆上去,社区一查就穿帮。
  //    tag 留空则不显示右侧小标签。
  marquee: [
    { name: "BNB Chain",     tag: "部署链" },
    { name: "PancakeSwap",   tag: "流动性" },
    { name: "销毁挖矿",       tag: "上线" },
    { name: "三代邀请",       tag: "上线" },
    { name: "每日零点释放",    tag: "" },
    { name: "预测体育赛事",    tag: "开发中" },
    { name: "Polymarket",    tag: "接入中" },
    { name: "AI Agent NFT",  tag: "规划中" },
    { name: "合约开源可查",    tag: "" },
    { name: "1.5× 预售筹码",  tag: "" }
  ],

  // 生态板块
  ecosystem: [
    {
      icon: "🏆",
      title: "预测体育赛事",
      desc: "把赛果变成可交易的筹码,赛事结束即时结算,人人都能下场。",
      tag: "开发中"
    },
    {
      icon: "🌐",
      title: "Polymarket",
      desc: "接入全球最大的预测市场,选举、经济、体育——万事皆可预测。",
      tag: "接入中"
    },
    {
      icon: "🤖",
      title: "AI Agent 超级 NFT",
      desc: "会自己干活的 NFT:自动跟单、自动打新、自动收益归集。",
      tag: "规划中"
    }
  ],

  // 官方链接(留空则该项不显示)
  social: {
    qq: "",                        // QQ 群号或群链接
    twitter: "",                   // 推特主页
    telegram: "",                  // TG 群链接
    docs: ""                       // 白皮书 / 文档
  }
};
