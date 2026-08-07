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
    { key: "community", label: "核心团队长", bnb: 1,   slots: 100,  badge: "限量席位" },
    { key: "retail",    label: "生态建设者", bnb: 0.2, slots: 2000, badge: "开放认购" }
  ],
  presaleRate: 40000,              // 1 BNB = 多少枚(1.5 倍之前的面值)
  presaleBonus: 1.5,               // 上线获得对应数量的几倍筹码 → 实得 60000/BNB
  presaleInstantPct: 50,           // 上线先释放百分之多少 → 30000/BNB
  presaleDailyPct: 2,              // 之后每日释放总额的百分比 → 1200/BNB/天,25 天放完
  presaleHardCap: 500,             // 募集上限(BNB)= 100×1 + 2000×0.2
  presaleTreasury: "0xD25d311Ee40F5d6B221748a78f04C6B0A6AEB5ad",  // 收款地址(部署后用 setTreasury 写进合约)
  presaleSweepMinutes: 3,          // 自动归集间隔,合约里可改(setSweep,下限 60 秒)

  // 合作伙伴墙(页面底部滚动展示)
  //
  // ⚠️ 这里每写一条,就是对外宣称"我们和它有关系"。只放真正谈成的合作,
  //    或者你们确实在其上构建的基础设施。摆一堆没关系的项目方 logo,
  //    社区一问对方就穿帮,代价比空着大得多。
  //
  // logo 填图片地址(建议白色或单色 PNG/SVG,高度 26px 以上);
  // 留空则只显示 name 文字。整面墙默认单色化,鼠标悬停才恢复原色。
  //
  // 目前只放了确实成立的两条 —— 谈下来一个加一个。
  partners: [
    { name: "BNB Chain",    logo: "logos/bnbchain.svg" },
    { name: "PancakeSwap",  logo: "logos/pancakeswap.png" },
    { name: "Flap",         logo: "logos/flap.svg" },
    { name: "TokenPocket",  logo: "logos/tokenpocket.png" },
    { name: "GoPlus",       logo: "logos/goplus.png" },
    { name: "AVE",          logo: "logos/ave.svg" },
    { name: "GMGN",         logo: "logos/gmgn.png" }
  ],

  // 生态板块
  ecosystem: [
    {
      icon: "🏆",
      title: "预测体育赛事",
      titleEn: "Sports prediction",
      desc: "把赛果变成可交易的筹码,赛事结束即时结算,人人都能下场。",
      descEn: "Turn match results into tradable chips, settled the moment the game ends.",
      tag: "开发中",
      tagEn: "In development"
    },
    {
      icon: "🌐",
      title: "Polymarket",
      titleEn: "Polymarket",
      desc: "接入全球最大的预测市场,选举、经济、体育——万事皆可预测。",
      descEn: "Plugging into the largest prediction market there is: elections, economics, sport.",
      tag: "接入中",
      tagEn: "Integrating"
    },
    {
      icon: "🤖",
      title: "AI Agent 超级 NFT",
      titleEn: "AI Agent NFT",
      desc: "会自己干活的 NFT:自动跟单、自动打新、自动收益归集。",
      descEn: "NFTs that work for you: copy trading, launch sniping, yield sweeping.",
      tag: "规划中",
      tagEn: "Planned"
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
