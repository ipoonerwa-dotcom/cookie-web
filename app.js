/* Cookie — 交互层
   零依赖:直接用 window.ethereum + 手写 ABI 编解码,不引入任何外部库。 */
(function () {
  "use strict";
  var C = window.COOKIE_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 函数选择器（预先算好,省掉 keccak 依赖） ---------------- */
  var SEL = {
    // 挖矿
    burn: "0xfcd3533c",           // burn(uint256,address)
    claim: "0x4e71d92d",          // claim()
    claimOwed: "0xf2652d9c",      // claimOwed()
    userInfo: "0x1959a002",       // userInfo(address)
    stats: "0xd80528ae",          // stats()
    minBurn: "0xa47c9a2d",        // minBurn()
    dailyRateBps: "0x812667d7",   // dailyRateBps()
    burnMulBps: "0x5e1b3f95",     // burnMultiplierBps()
    // 预售
    buyCommunity: "0xda7dfcaa",   // buyCommunity(uint256)
    buyRetail: "0xcd12445f",      // buyRetail(uint256)
    buyerInfo: "0xe2d3f423",      // buyerInfo(address)
    saleInfo: "0x8e3695b8",       // saleInfo()
    instantBps: "0x7d96cd64",     // instantBps()
    slotInfo: "0x52dec13d",       // slotInfo()
    // 代币
    approve: "0x095ea7b3",        // approve(address,uint256)
    allowance: "0xdd62ed3e",      // allowance(address,address)
    balanceOf: "0x70a08231"       // balanceOf(address)
  };
  var MAX_UINT = "f".repeat(64);
  var ZERO = "0x" + "0".repeat(40);

  /* ---------------- ABI 编解码 ---------------- */
  function padHex(h) { h = h.replace(/^0x/, "").toLowerCase(); return "0".repeat(64 - h.length) + h; }
  function encAddr(a) { return padHex(a); }
  function encUint(v) { return padHex(BigInt(v).toString(16)); }
  function words(hex) {
    hex = (hex || "0x").replace(/^0x/, "");
    var out = [];
    for (var i = 0; i + 64 <= hex.length; i += 64) out.push(hex.slice(i, i + 64));
    return out;
  }
  function toBig(w) { return w ? BigInt("0x" + w) : 0n; }

  /* ---------------- RPC ---------------- */
  var rpcId = 1;
  function rpc(method, params) {
    return fetch(C.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method: method, params: params })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw new Error(j.error.message || "rpc error");
      return j.result;
    });
  }
  function call(to, data) {
    if (!to) return Promise.resolve("0x");
    return rpc("eth_call", [{ to: to, data: data }, "latest"]).catch(function () { return "0x"; });
  }

  /* ---------------- 数字格式化 ---------------- */
  var DEC = BigInt(C.tokenDecimals != null ? C.tokenDecimals : 18);
  var UNIT = 10n ** DEC;
  var WEI = 10n ** 18n;
  function toNum(v, unit) { return Number(v * 10000n / (unit || UNIT)) / 10000; }
  function fmt(v, unit) {
    var n = typeof v === "bigint" ? toNum(v, unit) : Number(v || 0);
    if (!isFinite(n)) return "0";
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n / 1e8).toFixed(2).replace(/\.00$/, "") + " 亿";
    if (abs >= 1e4) return (n / 1e4).toFixed(2).replace(/\.00$/, "") + " 万";
    if (abs === 0) return "0";
    if (abs < 0.0001) return "<0.0001";
    return n.toFixed(abs < 1 ? 4 : 2).replace(/\.?0+$/, "");
  }
  function fmtBnb(v) {
    var n = Number(v * 100000n / WEI) / 100000;
    return (Math.round(n * 100000) / 100000).toString();
  }
  function parseAmt(s) {
    s = String(s || "").trim();
    if (!s || !/^\d*\.?\d*$/.test(s)) return 0n;
    var p = s.split(".");
    var frac = (p[1] || "").slice(0, Number(DEC));
    frac = frac + "0".repeat(Number(DEC) - frac.length);
    return BigInt(p[0] || "0") * UNIT + BigInt(frac || "0");
  }

  /* ---------------- 状态 ---------------- */
  var account = null;
  var st = {
    balance: 0n, allowance: 0n, minBurn: 0n, mulBps: 20000n, rateBps: 200n, levels: 0,
    // 预售
    tCommunity: 0n, tRetail: 0n, saleOpen: false, claiming: false,
    bonusBps: 15000n, instBps: 5000n, rate: 0n, maxTickets: 10n, ticketsLeft: 10n,
    pClaimable: 0n, pAlloc: 0n, pClaimed: 0n
  };

  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, ms || 3400);
  }
  function short(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : ""; }

  /* ---------------- 钱包 ---------------- */
  function connect() {
    if (!window.ethereum) { toast(t("toast.noWallet")); return; }
    window.ethereum.request({ method: "eth_requestAccounts" })
      .then(function (accs) { account = accs[0]; return ensureChain(); })
      .then(function () {
        $("connectBtn").textContent = short(account);
        $("refLink").value = location.origin + location.pathname + "?ref=" + account;
        refresh();
      })
      .catch(function (e) { toast(e.message || t("toast.rejected")); });
  }
  function ensureChain() {
    var want = "0x" + Number(C.chainId).toString(16);
    return window.ethereum.request({ method: "eth_chainId" }).then(function (cur) {
      if (cur === want) return;
      return window.ethereum.request({
        method: "wallet_switchEthereumChain", params: [{ chainId: want }]
      }).catch(function () { toast(t("toast.switchChain") + C.chainName); });
    });
  }
  function send(to, data, value) {
    if (!account) { connect(); return Promise.reject(new Error("未连接")); }
    var tx = { from: account, to: to, data: data };
    if (value && value > 0n) tx.value = "0x" + value.toString(16);
    return window.ethereum.request({ method: "eth_sendTransaction", params: [tx] });
  }
  function waitTx(hash) {
    return new Promise(function (res) {
      var tries = 0;
      (function poll() {
        rpc("eth_getTransactionReceipt", [hash]).then(function (r) {
          if (r) return res(r);
          if (++tries > 60) return res(null);
          setTimeout(poll, 2000);
        }).catch(function () { setTimeout(poll, 2500); });
      })();
    });
  }

  /* ---------------- 读链:挖矿 ---------------- */
  function refreshMining() {
    if (!C.mining) return;
    call(C.mining, SEL.stats).then(function (r) {
      var w = words(r);
      if (w.length < 5) return;
      countTo($("sPool"), fmt(toBig(w[0])));
      countTo($("sBurned"), fmt(toBig(w[1])));
      countTo($("sQuota"), fmt(toBig(w[2])));
      st.miningUsers = Number(toBig(w[4]));
      renderUsers();
    });
    call(C.mining, SEL.minBurn).then(function (r) { st.minBurn = toBig(words(r)[0]); });
    call(C.mining, SEL.burnMulBps).then(function (r) {
      var v = toBig(words(r)[0]); if (v > 0n) st.mulBps = v;
      updateTag(); updatePreview();
    });
    call(C.mining, SEL.dailyRateBps).then(function (r) {
      var v = toBig(words(r)[0]); if (v > 0n) st.rateBps = v; updateTag();
    });
    if (!account) return;

    call(C.mining, SEL.userInfo + encAddr(account)).then(function (r) {
      var w = words(r);
      if (w.length < 12) return;
      var quota = toBig(w[0]), unlocked = toBig(w[1]), claimable = toBig(w[2]),
          burned = toBig(w[3]), claimed = toBig(w[4]), refEarned = toBig(w[5]),
          owed = toBig(w[6]), perDay = toBig(w[7]), levels = Number(toBig(w[9]));

      $("claimable").textContent = fmt(claimable);
      $("claimable2").textContent = fmt(claimable);
      $("mQuota").textContent = fmt(quota);
      $("mBurned").textContent = fmt(burned);
      $("mClaimed").textContent = fmt(claimed);
      $("mRef").textContent = fmt(refEarned);
      $("perDay").textContent = fmt(perDay);

      var pct = quota > 0n ? Number(unlocked * 10000n / quota) / 100 : 0;
      $("progBar").style.width = Math.min(100, pct) + "%";
      $("unlockedPct").textContent = pct.toFixed(1) + "%";
      $("claimBtn").disabled = claimable === 0n;

      var has = owed > 0n;
      $("owedWrap").style.display = has ? "" : "none";
      $("claimOwedBtn").style.display = has ? "" : "none";
      if (has) $("owedAmt").textContent = fmt(owed);
      setLevels(levels);
    });

    if (C.token) {
      call(C.token, SEL.balanceOf + encAddr(account)).then(function (r) {
        st.balance = toBig(words(r)[0]);
        $("balHint").textContent = t("mine.balance") + " " + fmt(st.balance);
      });
      call(C.token, SEL.allowance + encAddr(account) + encAddr(C.mining)).then(function (r) {
        st.allowance = toBig(words(r)[0]);
        syncApprove();
      });
    }
  }

  /* ---------------- 读链:预售 ---------------- */
  function refreshPresale() {
    if (!C.presale) { $("pState").textContent = "预售合约尚未部署,敬请等待"; return; }

    call(C.presale, SEL.saleInfo).then(function (r) {
      var w = words(r);
      if (w.length < 10) return;
      // w[0] is the raised total. It stays public on chain and in saleInfo(); the landing
      // page simply does not lead with a fundraising counter.
      var people = toBig(w[3]);
      st.saleOpen = toBig(w[4]) === 1n;
      st.claiming = toBig(w[5]) === 1n;
      st.tCommunity = toBig(w[6]);
      st.tRetail = toBig(w[7]);
      st.rate = toBig(w[8]);
      st.bonusBps = toBig(w[9]);
      if (w.length > 10) st.maxTickets = toBig(w[10]) || 10n;
      st.presaleUsers = Number(people);

      renderUsers();
      renderTiers();
      renderSaleState();
    });
    // Slots left is the number buyers actually care about, and it is only meaningful once
    // the contract is live -- before that the page shows the configured totals.
    call(C.presale, SEL.slotInfo).then(function (r) {
      var w = words(r);
      if (w.length < 6) return;
      var put = function (id, v) { var el = $(id); if (el) el.textContent = Number(v).toLocaleString(); };
      put("t1Slots", toBig(w[2]));
      put("t2Slots", toBig(w[5]));
      var lab = document.querySelectorAll("[data-slotlabel]");
      for (var i = 0; i < lab.length; i++) lab[i].textContent = t("tier.left");
    });

    call(C.presale, SEL.instantBps).then(function (r) {
      var v = toBig(words(r)[0]); if (v > 0n) { st.instBps = v; renderTiers(); }
    });

    if (!account) return;
    call(C.presale, SEL.buyerInfo + encAddr(account)).then(function (r) {
      var w = words(r);
      if (w.length < 7) return;
      var paid = toBig(w[0]), alloc = toBig(w[1]), released = toBig(w[2]),
          claimed = toBig(w[3]), claimable = toBig(w[4]), perDay = toBig(w[5]);
      var tickets = w.length > 7 ? toBig(w[7]) : 0n;
      st.ticketsLeft = w.length > 8 ? toBig(w[8]) : st.maxTickets;
      $("pTickets").textContent = tickets.toString() + " / " + st.maxTickets.toString();
      st.pClaimable = claimable; st.pAlloc = alloc; st.pClaimed = claimed;

      $("pClaimable").textContent = fmt(claimable);
      $("pClaimable2").textContent = fmt(claimable);
      $("pPaid").textContent = fmtBnb(paid) + " BNB";
      $("pAlloc").textContent = fmt(alloc);
      $("pPerDay").textContent = fmt(perDay);
      $("pClaimed").textContent = fmt(claimed);
      $("pRatio").textContent = fmt(claimed) + " / " + fmt(alloc);

      var pct = alloc > 0n ? Number(released * 10000n / alloc) / 100 : 0;
      $("pProg").style.width = Math.min(100, pct) + "%";
      $("pPct").textContent = pct.toFixed(1) + "%";
      $("pClaimBtn").disabled = claimable === 0n;
      $("pClaimBtn2").disabled = claimable === 0n;
    });
  }

  function renderUsers() {
    var n = (st.miningUsers || 0) + (st.presaleUsers || 0);
    if (n) countTo($("sUsers"), String(n)); else $("sUsers").textContent = "—";
  }

  function renderTiers() {
    // Writes are guarded because the tier cards are edited by hand fairly often: dropping a
    // line from the markup should cost that one figure, not take the whole page down with it.
    function put(id, text) { var el = $(id); if (el) el.textContent = text; }

    function fill(i, ticket, fallbackBnb) {
      var bnb = ticket > 0n ? fmtBnb(ticket) : String(fallbackBnb);
      var price = $("t" + i + "Price");
      if (price) price.innerHTML = bnb + "<small>BNB</small>";
    }
    fill(1, st.tCommunity, (C.presaleTiers && C.presaleTiers[0] ? C.presaleTiers[0].bnb : 1));
    fill(2, st.tRetail, (C.presaleTiers && C.presaleTiers[1] ? C.presaleTiers[1].bnb : 0.2));
    [1, 2].forEach(function (i) {
      var cfg = C.presaleTiers && C.presaleTiers[i - 1];
      if (cfg && cfg.slots) put("t" + i + "Slots", Number(cfg.slots).toLocaleString());
      put("t" + i + "Max", st.maxTickets.toString());
    });
    syncAllQty();
  }

  /* ---------------- 数量选择器 ---------------- */
  function ticketWei(which) { return which === 1 ? st.tCommunity : st.tRetail; }

  function readQty(which) {
    var v = parseInt(($("t" + which + "Qty").value || "1").replace(/\D/g, ""), 10);
    if (!isFinite(v) || v < 1) v = 1;
    var cap = Number(st.ticketsLeft > 0n ? st.ticketsLeft : st.maxTickets);
    if (cap < 1) cap = 1;
    if (v > cap) v = cap;
    return v;
  }

  function syncQty(which) {
    var q = readQty(which);
    $("t" + which + "Qty").value = String(q);
    var tk = ticketWei(which);
    var fallback = which === 1
      ? (C.presaleTiers && C.presaleTiers[0] ? C.presaleTiers[0].bnb : 1)
      : (C.presaleTiers && C.presaleTiers[1] ? C.presaleTiers[1].bnb : 0.2);
    $("t" + which + "Total").textContent = tk > 0n
      ? fmtBnb(tk * BigInt(q))
      : (Math.round(fallback * q * 100000) / 100000).toString();
    var echo = $("t" + which + "QtyEcho");
    if (echo) echo.textContent = " · " + q + " " + t("tier.shares");
    var maxEl = $("t" + which + "Max");
    if (maxEl) maxEl.textContent = st.maxTickets.toString();
  }

  function syncAllQty() { syncQty(1); syncQty(2); }

  function initQty() {
    var btns = document.querySelectorAll("[data-step]");
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        var parts = b.dataset.step.split(":");
        var which = Number(parts[0]), delta = Number(parts[1]);
        b.onclick = function () {
          var el = $("t" + which + "Qty");
          el.value = String(Math.max(1, (parseInt(el.value, 10) || 1) + delta));
          syncQty(which);
        };
      })(btns[i]);
    }
    [1, 2].forEach(function (which) {
      var el = $("t" + which + "Qty");
      el.oninput = function () { syncQty(which); };
      el.onblur = function () { syncQty(which); };
    });
  }

  function renderSaleState() {
    var b1 = $("buyCommunityBtn"), b2 = $("buyRetailBtn"), s = $("pState");
    if (st.claiming) {
      b1.disabled = b2.disabled = true;
      b1.textContent = b2.textContent = t("sale.btnEnded");
      s.textContent = t("sale.ended");
    } else if (st.saleOpen) {
      b1.disabled = b2.disabled = false;
      b1.textContent = t("tier.buy1"); b2.textContent = t("tier.buy2");
      s.textContent = t("sale.open", { n: st.maxTickets });
    } else {
      b1.disabled = b2.disabled = true;
      b1.textContent = b2.textContent = t("sale.btnNotOpen");
      s.textContent = t("sale.notOpen");
    }
  }

  function refresh() { refreshMining(); refreshPresale(); }

  /* ---------------- 挖矿 UI 辅助 ---------------- */
  function setLevels(n) {
    st.levels = n;
    for (var i = 1; i <= 3; i++) $("gen" + i).classList.toggle("on", i <= n);
  }
  function updateTag() {
    var el = $("tagRate");
    if (el) el.textContent = t("mine.tagRate", { m: Number(st.mulBps) / 10000, r: Number(st.rateBps) / 100 });
  }
  function syncApprove() {
    var need = parseAmt($("burnAmt").value);
    var ok = st.allowance > 0n && st.allowance >= need && need > 0n;
    $("approveBtn").disabled = ok;
    $("approveBtn").textContent = ok ? "已授权" : "授权";
  }
  function updatePreview() {
    var amt = parseAmt($("burnAmt").value);
    $("quotaPreview").textContent = fmt(amt * st.mulBps / 10000n) + " " + (C.tokenSymbol || "COOKIE");
    syncApprove();
  }

  /* ---------------- 动作:挖矿 ---------------- */
  function tx(btn, label, run, okMsg, failMsg) {
    var b = $(btn), old = b.textContent;
    b.disabled = true; b.textContent = label;
    return run()
      .then(function (h) { toast(t("toast.submitted")); return waitTx(h); })
      .then(function (r) {
        if (r && r.status === "0x0") { toast(failMsg); return; }
        toast(okMsg); refresh();
      })
      .catch(function (e) { toast(e.message || failMsg); })
      .then(function () { b.disabled = false; b.textContent = old; });
  }

  function doApprove() {
    if (!C.token || !C.mining) { toast(t("toast.notDeployed")); return; }
    tx("approveBtn", "授权中…", function () {
      return send(C.token, SEL.approve + encAddr(C.mining) + MAX_UINT);
    }, t("toast.approveOk"), t("toast.approveFail"));
  }
  function doBurn() {
    if (!C.mining) { toast(t("toast.notDeployed")); return; }
    var amt = parseAmt($("burnAmt").value);
    if (amt <= 0n) { toast(t("toast.enterAmount")); return; }
    if (st.minBurn > 0n && amt < st.minBurn) { toast(t("toast.belowMin") + fmt(st.minBurn)); return; }
    if (amt > st.balance) { toast(t("toast.insufficient")); return; }
    var ref = ($("refInput").value || "").trim();
    if (ref && !/^0x[0-9a-fA-F]{40}$/.test(ref)) { toast(t("toast.badRef")); return; }
    if (!ref) ref = ZERO;

    tx("burnBtn", "销毁中…", function () {
      return send(C.mining, SEL.burn + encUint(amt) + encAddr(ref));
    }, t("toast.burnOk"), t("toast.burnFail"))
      .then(function () { $("burnAmt").value = ""; updatePreview(); });
  }
  function doClaim() {
    if (!C.mining) { toast(t("toast.notDeployed")); return; }
    tx("claimBtn", "领取中…", function () { return send(C.mining, SEL.claim); },
       t("toast.claimOk"), t("toast.claimFail"));
  }
  function doClaimOwed() {
    tx("claimOwedBtn", "领取中…", function () { return send(C.mining, SEL.claimOwed); },
       t("toast.claimOk"), t("toast.claimFail"));
  }

  /* ---------------- 动作:预售 ---------------- */
  function doBuy(which) {
    if (!C.presale) { toast(t("toast.presaleNotDeployed")); return; }
    if (!st.saleOpen) { toast(t("toast.saleClosed")); return; }
    var isCommunity = which === "community";
    var idx = isCommunity ? 1 : 2;
    var ticket = isCommunity ? st.tCommunity : st.tRetail;
    if (ticket <= 0n) { toast(t("toast.rateFail")); return; }
    if (account && st.ticketsLeft <= 0n) { toast(t("toast.ticketFull") + st.maxTickets); return; }

    var qty = readQty(idx);
    var total = ticket * BigInt(qty);
    tx(isCommunity ? "buyCommunityBtn" : "buyRetailBtn", "认购中…", function () {
      return send(C.presale, (isCommunity ? SEL.buyCommunity : SEL.buyRetail) + encUint(qty), total);
    }, t("toast.buyOk") + qty + t("toast.buyOk2"), t("toast.buyFail"));
  }
  function doPresaleClaim(btn) {
    if (!C.presale) { toast(t("toast.presaleNotDeployed")); return; }
    tx(btn, "领取中…", function () { return send(C.presale, SEL.claim); },
       "领取成功", "领取失败,可能暂无可领筹码");
  }

  /* ---------------- 倒计时（本地按时区算,不耗 RPC） ---------------- */
  function tick() {
    var off = (C.tzOffsetHours != null ? C.tzOffsetHours : 8) * 3600;
    var left = 86400 - ((Math.floor(Date.now() / 1000) + off) % 86400);
    $("cH").textContent = String(Math.floor(left / 3600)).padStart(2, "0");
    $("cM").textContent = String(Math.floor((left % 3600) / 60)).padStart(2, "0");
    $("cS").textContent = String(left % 60).padStart(2, "0");
    if (left <= 1) setTimeout(refresh, 4000);
  }

  /* ---------------- 标签页 ---------------- */
  function initTabs() {
    var tabs = document.querySelectorAll(".tab");
    function go(name) {
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle("on", tabs[i].dataset.tab === name);
      var ps = document.querySelectorAll(".panel");
      for (var j = 0; j < ps.length; j++) ps[j].classList.toggle("on", ps[j].id === "p-" + name);
    }
    for (var i = 0; i < tabs.length; i++) {
      (function (t) { t.onclick = function () { go(t.dataset.tab); }; })(tabs[i]);
    }
    var jumps = document.querySelectorAll("[data-go]");
    for (var k = 0; k < jumps.length; k++) {
      (function (b) { b.onclick = function () { location.hash = "#/" + b.dataset.go; }; })(jumps[k]);
    }
  }

  /* ---------------- 生态 & 官方链接 ---------------- */
  var ICONS = {
    qq: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c3 0 5 2.2 5 5.2 0 .9.4 1.5 1 2.4.9 1.3 1.7 2.6 1.7 4.4 0 1-.4 1.7-1 1.7-.6 0-1-.5-1.4-1.4-.2.9-.7 1.7-1.4 2.3.7.3 1.2.8 1.2 1.3 0 .9-1.8 1.6-4.1 1.6h-.1c-2.3 0-4.1-.7-4.1-1.6 0-.5.5-1 1.2-1.3-.7-.6-1.2-1.4-1.4-2.3-.4.9-.8 1.4-1.4 1.4-.6 0-1-.7-1-1.7 0-1.8.8-3.1 1.7-4.4.6-.9 1-1.5 1-2.4C7 4.2 9 2 12 2z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.5 7.5L22.2 22h-6l-4.7-6.2L6.1 22H3.3l7-8L2.1 2h6.2l4.3 5.7L18.2 2zm-1 18h1.7L7.9 3.7H6.1L17.2 20z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3 14.2c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.3-.5.5-1 .5l.3-4.6L18.2 6c.4-.3-.1-.5-.6-.2L7.3 12.3l-4.5-1.4c-1-.3-1-1 .2-1.4l17.6-6.8c.8-.3 1.5.2 1.3 1.6z"/></svg>',
    docs: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h8l6 6v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V9h5.5L13 3.5zM8 12h8v1.6H8V12zm0 3.4h8V17H8v-1.6z"/></svg>'
  };
  var LABELS = { qq: "官方 QQ 群", twitter: "官方推特", telegram: "官方 TG", docs: "白皮书" };

  function renderEco() {
    var list = C.ecosystem || [];
    var g = $("ecoGrid");
    g.innerHTML = "";
    list.forEach(function (e) {
      var d = document.createElement("div");
      d.className = "eco-card";
      var tag = e.tag ? '<span class="tag">' + esc(e.tag) + "</span>" : "";
      d.innerHTML = tag + '<span class="ico">' + esc(e.icon || "🍪") + "</span>" +
        "<h4>" + esc(e.title || "") + "</h4><p>" + esc(e.desc || "") + "</p>";
      g.appendChild(d);
    });
  }
  function renderSocial() {
    var s = C.social || {};
    var box = $("socialLinks");
    box.innerHTML = "";
    ["qq", "twitter", "telegram", "docs"].forEach(function (k) {
      var v = (s[k] || "").trim();
      if (!v) return;
      var isUrl = /^https?:\/\//i.test(v);
      var el = document.createElement(isUrl ? "a" : "div");
      el.className = "link";
      if (isUrl) { el.href = v; el.target = "_blank"; el.rel = "noopener"; }
      el.innerHTML = ICONS[k] + "<span>" + LABELS[k] + (isUrl ? "" : "：" + esc(v)) + "</span>";
      box.appendChild(el);
    });
    if (!box.children.length) {
      box.innerHTML = '<div class="link" style="opacity:.55">官方渠道即将公布</div>';
    }
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 滚动墙 ---------------- */
  function renderMarquee() {
    var list = (C.partners || []).filter(function (p) { return p && p.name; });
    var sec = $("partnerSec");
    // An empty wall is better than a padded one: nothing here should be filler.
    if (!list.length) { if (sec) sec.style.display = "none"; return; }

    // Too few entries and the track is shorter than the viewport, so the -50% loop shows a
    // gap. Repeat until it is comfortably wider, then duplicate once for the seamless wrap.
    var base = list.slice();
    while (base.length < 8) base = base.concat(list);

    function build(el, items) {
      el.innerHTML = "";
      items.concat(items).forEach(function (m) {
        var d = document.createElement("div");
        d.className = "chip";
        // No lazy loading: the track scrolls sideways, so a deferred logo would pop in
        // mid-travel and read as broken. Each file is only a few KB.
        // Icon plus name, always. Brand assets come in wildly different shapes -- some
        // wordmarks, some marks, some dark-on-light -- and pairing every one with the same
        // white label is what keeps the row looking like a wall instead of a scrapbook.
        d.innerHTML = (m.logo
          ? '<img src="' + esc(m.logo) + '" alt="">'
          : '<span class="dot"></span>') + "<span>" + esc(m.name) + "</span>";
        el.appendChild(d);
      });
    }
    build($("mqA"), base);
    build($("mqB"), base.slice().reverse());
  }

  /* ---------------- 滚动入场 ---------------- */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function showAll() {
      for (var i = 0; i < els.length; i++) els[i].classList.add("in");
    }

    // Only now is it safe to start from hidden: the observer below is what brings it back.
    document.documentElement.classList.add("reveal-ready");

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);

    // Backstops. Wallet in-app browsers throttle observers on hidden tabs, and a page that
    // was loaded in the background can come forward with everything still at zero opacity.
    setTimeout(showAll, 3500);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) setTimeout(showAll, 400);
    });
  }

  /* ---------------- 数字滚动 ---------------- */
  // Counts from the previous figure to the new one so a refresh reads as movement, not a jump.
  function countTo(el, text) {
    if (!el) return;
    var target = parseFloat(String(text).replace(/[^\d.]/g, ""));
    var suffix = String(text).replace(/^[\d.,]+/, "");
    if (!isFinite(target)) { el.textContent = text; return; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
    var from = parseFloat(String(el.textContent).replace(/[^\d.]/g, "")) || 0;
    if (from === target) { el.textContent = text; return; }
    var t0 = performance.now(), dur = 700;
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      var v = from + (target - from) * eased;
      el.textContent = (target >= 100 ? Math.round(v) : v.toFixed(2)) + suffix;
      if (k < 1) requestAnimationFrame(step); else el.textContent = text;
    })(t0);
  }


  /* ---------------- 中英文 ---------------- */
  var DICT = window.COOKIE_I18N || { zh: {}, en: {} };
  var lang = "zh";
  try { lang = localStorage.getItem("cookie_lang") || (navigator.language || "").slice(0, 2) === "zh" ? "zh" : "en"; } catch (e) {}
  if (lang !== "en") lang = "zh";

  // Missing keys fall back to Chinese rather than showing the raw key: a half-translated
  // page is survivable, a page full of "tier.badge1" is not.
  function t(key, vars) {
    var v = (DICT[lang] && DICT[lang][key]) || (DICT.zh && DICT.zh[key]) || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { v = v.split("{" + k + "}").join(vars[k]); });
    }
    return v;
  }

  function applyLang() {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    var els = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute("data-i18n");
      if (els[i].tagName === "INPUT") els[i].placeholder = t(k); else els[i].textContent = t(k);
    }
    var ph = $("refLink"); if (ph) ph.placeholder = t("inv.placeholder");
    var lb = $("langLabel"); if (lb) lb.textContent = lang === "zh" ? "中文" : "English";
    var ul = document.querySelectorAll("#lang li");
    for (var j = 0; j < ul.length; j++) ul[j].classList.toggle("on", ul[j].dataset.lang === lang);
    // Anything drawn from data has to be rebuilt, not just relabelled.
    renderTiers(); renderSaleState(); updateTag(); renderEco(); renderSocial();
    syncTitle();
  }

  function setLang(next) {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem("cookie_lang", lang); } catch (e) {}
    applyLang();
  }

  function initLang() {
    var box = $("lang");
    $("langBtn").onclick = function (e) { e.stopPropagation(); box.classList.toggle("open"); };
    document.addEventListener("click", function () { box.classList.remove("open"); });
    var items = document.querySelectorAll("#lang li");
    for (var i = 0; i < items.length; i++) {
      (function (li) { li.onclick = function () { setLang(li.dataset.lang); box.classList.remove("open"); }; })(items[i]);
    }
  }

  /* ---------------- 路由 ---------------- */
  var ROUTES = ["home", "presale", "mine", "invite", "claim"];

  function currentRoute() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    return ROUTES.indexOf(h) >= 0 ? h : "home";
  }

  function syncTitle() {
    var el = $("pageTitle");
    if (el) el.textContent = t("nav." + currentRoute());
  }

  function renderRoute() {
    var r = currentRoute();
    var pages = document.querySelectorAll(".route");
    for (var i = 0; i < pages.length; i++) pages[i].classList.toggle("on", pages[i].dataset.page === r);
    var links = document.querySelectorAll(".navlink");
    for (var j = 0; j < links.length; j++) links[j].classList.toggle("on", links[j].dataset.route === r);
    syncTitle();
    document.body.classList.remove("drawer");
    window.scrollTo(0, 0);
    // Reveal only observes what existed at startup; a freshly shown page needs a nudge.
    var fresh = document.querySelectorAll(".route.on .reveal:not(.in)");
    for (var k = 0; k < fresh.length; k++) fresh[k].classList.add("in");
  }

  function initRouter() {
    if (!location.hash) location.replace("#/home");
    addEventListener("hashchange", renderRoute);
    renderRoute();

    $("burger").onclick = function () { document.body.classList.toggle("drawer"); };
    $("scrim").onclick = function () { document.body.classList.remove("drawer"); };
    addEventListener("keydown", function (e) { if (e.key === "Escape") document.body.classList.remove("drawer"); });
  }

  /* ---------------- 火星 ---------------- */
  function embers() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var cv = $("embers"); if (!cv) return;
    var ctx = cv.getContext("2d"), ps = [], raf = 0, W = 0, H = 0;
    function size() {
      var r = cv.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      if (!W || !H) return false;
      var d = Math.min(devicePixelRatio || 1, 2);
      cv.width = W * d; cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      return true;
    }
    function spawn() {
      return {
        x: Math.random() * W, y: H + 10,
        vy: -(0.18 + Math.random() * 0.5), vx: (Math.random() - 0.5) * 0.28,
        r: 0.6 + Math.random() * 1.9, a: 0.35 + Math.random() * 0.65,
        // a minority are flat flakes that tumble, the rest are round motes
        flake: Math.random() < 0.28, rot: Math.random() * 6.283, spin: (Math.random() - 0.5) * 0.05
      };
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (ps.length < 34 && Math.random() < 0.42) ps.push(spawn());
      for (var i = ps.length - 1; i >= 0; i--) {
        var p = ps[i];
        p.x += p.vx; p.y += p.vy; p.a -= 0.0026; p.rot += p.spin;
        if (p.a <= 0 || p.y < -12) { ps.splice(i, 1); continue; }
        // The bloom is what makes these read as gold light rather than beige dots.
        ctx.shadowBlur = 10 + p.r * 4;
        ctx.shadowColor = "rgba(212,175,55," + (p.a * 0.8).toFixed(3) + ")";
        ctx.fillStyle = "rgba(250,232,170," + p.a.toFixed(3) + ")";
        if (p.flake) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          var w = p.r * 2.1, h = p.r * 1.1 * (0.4 + Math.abs(Math.cos(p.rot)));
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.283);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    }
    function start() { if (!size()) { setTimeout(start, 250); return; } cancelAnimationFrame(raf); draw(); }
    addEventListener("resize", size);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) cancelAnimationFrame(raf); else { cancelAnimationFrame(raf); draw(); }
    });
    start();
  }

  /* ---------------- 页脚地址 ---------------- */
  function initFooter() {
    function link(id, addr, path) {
      if (!addr) return;
      var a = $(id);
      a.textContent = short(addr);
      a.href = C.explorer + path + addr;
    }
    link("fPresale", C.presale, "/address/");
    link("fMining", C.mining, "/address/");
    link("fToken", C.token, "/token/");
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    // One broken selector should not take the whole page down with it.
    try {
    initLang();
    applyLang();
    initRouter();
    initQty();
    renderMarquee();
    renderEco();
    renderSocial();
    renderTiers();
    renderSaleState();
    updateTag();
    initFooter();
    embers();
    initReveal();
    tick(); setInterval(tick, 1000);

    var ref = new URLSearchParams(location.search).get("ref");
    if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) $("refInput").value = ref;

    $("connectBtn").onclick = connect;
    $("approveBtn").onclick = doApprove;
    $("burnBtn").onclick = doBurn;
    $("claimBtn").onclick = doClaim;
    $("claimOwedBtn").onclick = doClaimOwed;
    $("buyCommunityBtn").onclick = function () { doBuy("community"); };
    $("buyRetailBtn").onclick = function () { doBuy("retail"); };
    $("pClaimBtn").onclick = function () { doPresaleClaim("pClaimBtn"); };
    $("pClaimBtn2").onclick = function () { doPresaleClaim("pClaimBtn2"); };
    $("burnAmt").oninput = updatePreview;
    $("maxBtn").onclick = function () {
      if (st.balance > 0n) { $("burnAmt").value = String(toNum(st.balance)); updatePreview(); }
    };
    $("copyBtn").onclick = function () {
      var v = $("refLink").value;
      if (!v) { toast(t("toast.connectFirst")); return; }
      navigator.clipboard.writeText(v).then(function () { toast(t("toast.copied")); });
    };

    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(function (a) {
        if (a && a.length) {
          account = a[0];
          $("connectBtn").textContent = short(account);
          $("refLink").value = location.origin + location.pathname + "?ref=" + account;
        }
        refresh();
      });
      window.ethereum.on && window.ethereum.on("accountsChanged", function () { location.reload(); });
      window.ethereum.on && window.ethereum.on("chainChanged", function () { location.reload(); });
    } else {
      refresh();
    }
    setInterval(refresh, 20000);
    } catch (e) {
      console.error("init failed:", (e && e.stack) || e);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
