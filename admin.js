/* =========================================================
   ElyFluff admin page: deploy and manage the contracts
   Open admin.html inside your wallet app's browser.
   ========================================================= */
(function () {
  'use strict';
  var C = window.ELYFLUFF_CONFIG || {}, F = window.FluffChain, BC = window.ELYFLUFF_BYTECODE || {};
  var KEY = 'ef_admin_v1';
  var A = {};
  try { A = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { A = {}; }
  A.token = A.token || C.TOKEN_CONTRACT || '';
  A.claim = A.claim || C.CLAIM_CONTRACT || '';
  A.nft = A.nft || C.NFT_CONTRACT || '';
  function saveA() { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch (e) {} }
  var ME = '';
  var root = document.getElementById('adm');

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, cls, fn) { var b = el('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function input(ph, val, label) {
    var wrap = el('label', 'adm-in');
    if (label) wrap.appendChild(el('span', 'adm-lab', label));
    var box = el('span', 'inbox'); var i = el('input'); i.type = 'text'; i.placeholder = ph; i.value = val || ''; i.spellcheck = false; i.setAttribute('autocapitalize', 'off'); i.setAttribute('autocomplete', 'off');
    box.appendChild(i); wrap.appendChild(box); wrap.input = i; return wrap;
  }
  function short(a) { return a ? a.slice(0, 6) + '...' + a.slice(-4) : '—'; }
  function isAddr(a) { return /^0x[a-fA-F0-9]{40}$/.test(String(a || '').trim()); }
  function isRoot(r) { return /^0x[a-fA-F0-9]{64}$/.test(String(r || '').trim()); }
  function wholeTokens(v) { return String(v || '').replace(/[,\s_]/g, ''); }

  /* ---------- abi ---------- */
  function hex(b) { return F.bytesToHex(b).slice(2); }
  function u256(dec) { return hex(F.decToWord(dec)); }
  function addrW(a) { return String(a).toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
  function b32(r) { return String(r).toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
  function strArg(s) {
    var b = new TextEncoder().encode(String(s || ''));
    var h = hex(b); while (h.length % 64) h += '0';
    return u256(32) + u256(b.length) + h;
  }
  function call(sig, argsHex) { return F.selector(sig) + (argsHex || ''); }

  /* ---------- wallet ---------- */
  async function req(method, params) { return window.ethereum.request({ method: method, params: params || [] }); }
  async function receipt(hash) {
    var t0 = Date.now();
    while (Date.now() - t0 < 180000) {
      try { var r = await req('eth_getTransactionReceipt', [hash]); if (r) return r; } catch (e) {}
      await new Promise(function (res) { setTimeout(res, 2000); });
    }
    return null;
  }
  function errText(e) {
    if (e && e.code === 4001) return 'you cancelled it in the wallet';
    var m = (e && ((e.data && e.data.message) || e.message)) || String(e || 'error');
    return String(m).replace(/^execution reverted:?\s*/i, '').slice(0, 200);
  }
  async function needWallet(out) {
    if (ME) { await F.ensureChain(); return true; }
    try { ME = await F.connect(); paintTop(); return true; }
    catch (e) { say(out, '✗ ' + errText(e), 'err'); return false; }
  }
  async function sendTx(out, tx, label) {
    tx.from = ME;
    say(out, '> preparing...', 'dim');
    var est = await req('eth_estimateGas', [tx]);
    tx.gas = '0x' + Math.ceil(parseInt(est, 16) * 1.25).toString(16);
    say(out, '> confirm "' + label + '" in your wallet...', 'dim');
    var hash = await req('eth_sendTransaction', [tx]);
    say(out, '> sent. waiting for the block...', 'dim', hash);
    var r = await receipt(hash);
    if (!r) { say(out, '… still pending. check the explorer.', 'dim', hash); return null; }
    if (r.status !== '0x1') { say(out, '✗ the transaction failed.', 'err', hash); return null; }
    return { hash: hash, r: r };
  }
  function say(out, text, cls, hash) {
    out.textContent = ''; out.className = 'adm-out ' + (cls || '');
    out.appendChild(document.createTextNode(text));
    if (hash && C.EXPLORER_URL) { var a = el('a', 'sky', ' view tx ↗'); a.href = String(C.EXPLORER_URL).replace(/\/+$/, '') + '/tx/' + hash; a.target = '_blank'; a.rel = 'noopener noreferrer'; out.appendChild(a); }
  }
  function lock(b, on) { b.disabled = on; }

  /* ---------- ui ---------- */
  function card(n, title, text) {
    var w = el('div', 'win adm-card');
    var bar = el('div', 'win-bar'); var d = el('span', 'dots'); d.appendChild(el('i', 'd1')); d.appendChild(el('i')); d.appendChild(el('i'));
    bar.appendChild(d); bar.appendChild(el('span', 'win-title', 'step ' + n)); bar.appendChild(el('span'));
    var body = el('div', 'win-body');
    body.appendChild(el('h3', 'adm-h', title));
    if (text) body.appendChild(el('p', 'adm-p', text));
    w.appendChild(bar); w.appendChild(body); root.appendChild(w);
    return body;
  }
  var topLine;
  function paintTop() {
    topLine.textContent = '';
    if (!ME) { topLine.appendChild(el('span', 'dim', 'wallet: not connected')); return; }
    topLine.appendChild(el('span', 'ok', '● ')); topLine.appendChild(document.createTextNode(short(ME) + ' · ' + (C.CHAIN_NAME || 'HyperEVM Testnet') + ' (' + (C.CHAIN_ID || 998) + ')'));
  }
  function addrRow(body, label, key) {
    var r = el('div', 'adm-addr');
    r.appendChild(el('span', 'dim', label));
    var v = el('b', null, A[key] || 'not deployed yet'); v.id = 'adm_' + key; r.appendChild(v);
    body.appendChild(r);
  }
  function refreshAddrs() {
    ['token', 'claim', 'nft'].forEach(function (k) { var e = document.getElementById('adm_' + k); if (e) e.textContent = A[k] || 'not deployed yet'; });
    var cfg = document.getElementById('admCfg');
    if (cfg) cfg.textContent = 'NFT_CONTRACT: "' + (A.nft || '') + '",\nTOKEN_CONTRACT: "' + (A.token || '') + '",\nCLAIM_CONTRACT: "' + (A.claim || '') + '",';
    if (claimTok) claimTok.input.value = A.token || '';
  }
  var claimTok;

  function build() {
    if (!F || !BC.token) { root.appendChild(el('div', 'ln err', '✗ chain.js or bytecode.js is missing. upload them next to admin.html.')); return; }
    var head = el('div', 'adm-top');
    head.appendChild(el('h1', 'adm-title', 'ElyFluff contracts'));
    head.appendChild(el('p', 'adm-p', 'Open this page in your wallet app browser (MetaMask, Rabby or OKX). Use the wallet that will own the project. You need a little test HYPE for gas.'));
    topLine = el('div', 'adm-wallet'); head.appendChild(topLine); paintTop();
    var cb = btn('connect wallet', 'btn-big', async function () { try { ME = await F.connect(); paintTop(); cb.textContent = 'connected ✓'; } catch (e) { topLine.textContent = '✗ ' + errText(e); } });
    head.appendChild(cb);
    root.appendChild(head);

    /* step 1: token */
    var b1 = card(1, 'Deploy the $FLUFF token', 'Creates the testnet $FLUFF token. All tokens go to your wallet.');
    var sup = input('1000000000', '1000000000', 'total supply (whole tokens)'); b1.appendChild(sup);
    var o1 = el('div', 'adm-out');
    var d1 = btn('deploy $FLUFF token', '', async function () {
      var n = wholeTokens(sup.input.value);
      if (!/^\d+$/.test(n) || n === '0') return say(o1, '✗ type a whole number, for example 1000000000', 'err');
      if (A.token && !confirm2(d1)) return say(o1, 'a token is already deployed: ' + A.token + '. press again to deploy a new one.', 'dim');
      lock(d1, true);
      try {
        if (!(await needWallet(o1))) return;
        var res = await sendTx(o1, { data: BC.token + u256(n) }, 'deploy $FLUFF token');
        if (res) { A.token = res.r.contractAddress; saveA(); refreshAddrs(); say(o1, '✓ token deployed: ' + A.token, 'ok', res.hash); }
      } catch (e) { say(o1, '✗ ' + errText(e), 'err'); } finally { lock(d1, false); }
    });
    b1.appendChild(d1); b1.appendChild(o1);

    /* step 2: claim */
    var b2 = card(2, 'Deploy the claim contract', 'Players claim their $FLUFF from this contract. It uses the token from step 1.');
    claimTok = input('0x...', A.token, 'token address (filled in automatically)'); b2.appendChild(claimTok);
    var o2 = el('div', 'adm-out');
    var d2 = btn('deploy claim contract', '', async function () {
      var t = claimTok.input.value.trim();
      if (!isAddr(t)) return say(o2, '✗ finish step 1 first (token address is missing)', 'err');
      if (A.claim && !confirm2(d2)) return say(o2, 'a claim contract is already deployed: ' + A.claim + '. press again to deploy a new one.', 'dim');
      lock(d2, true);
      try {
        if (!(await needWallet(o2))) return;
        var res = await sendTx(o2, { data: BC.claim + addrW(t) }, 'deploy claim contract');
        if (res) { A.claim = res.r.contractAddress; saveA(); refreshAddrs(); say(o2, '✓ claim contract deployed: ' + A.claim, 'ok', res.hash); }
      } catch (e) { say(o2, '✗ ' + errText(e), 'err'); } finally { lock(d2, false); }
    });
    b2.appendChild(d2); b2.appendChild(o2);

    /* step 3: nft */
    var b3 = card(3, 'Deploy the ElyFluff NFT', '3,000 supply, 0.33 HYPE, GTD then public. The mint starts closed.');
    var uri = input('leave empty for now', '', 'metadata link (optional, can be set later)'); b3.appendChild(uri);
    var o3 = el('div', 'adm-out');
    var d3 = btn('deploy NFT contract', '', async function () {
      if (A.nft && !confirm2(d3)) return say(o3, 'an NFT contract is already deployed: ' + A.nft + '. press again to deploy a new one.', 'dim');
      lock(d3, true);
      try {
        if (!(await needWallet(o3))) return;
        var res = await sendTx(o3, { data: BC.nft + strArg(uri.input.value.trim()) }, 'deploy NFT contract');
        if (res) { A.nft = res.r.contractAddress; saveA(); refreshAddrs(); say(o3, '✓ NFT deployed: ' + A.nft, 'ok', res.hash); }
      } catch (e) { say(o3, '✗ ' + errText(e), 'err'); } finally { lock(d3, false); }
    });
    b3.appendChild(d3); b3.appendChild(o3);

    /* step 4: addresses */
    var b4 = card(4, 'Your contract addresses', 'Copy these 3 lines and replace the same 3 lines in config.js.');
    addrRow(b4, 'NFT', 'nft'); addrRow(b4, 'token', 'token'); addrRow(b4, 'claim', 'claim');
    var pre = el('pre', 'adm-cfg'); pre.id = 'admCfg'; b4.appendChild(pre);
    var cp = btn('copy the 3 lines', 'btn-ghost', async function () { try { await navigator.clipboard.writeText(document.getElementById('admCfg').textContent); cp.textContent = 'copied ✓'; } catch (e) { cp.textContent = 'select the text and copy'; } setTimeout(function () { cp.textContent = 'copy the 3 lines'; }, 2000); });
    b4.appendChild(cp);
    var ed = btn('edit addresses', 'btn-ghost btn-sm', function () {
      ['nft', 'token', 'claim'].forEach(function (k) { var v = prompt2(k); if (v === null) return; if (v === '' || isAddr(v)) A[k] = v.trim(); });
      saveA(); refreshAddrs();
    });
    b4.appendChild(ed);

    /* step 5: gtd mint */
    var b5 = card(5, 'Open the GTD mint', 'After the selection: paste the GTD root from the sheet (Final Lists, cell B1), save it, then open the mint.');
    var gr = input('0x... (66 characters)', '', 'GTD root'); b5.appendChild(gr);
    var o5 = el('div', 'adm-out');
    var row5 = el('div', 'btn-row');
    row5.appendChild(btn('save GTD root', '', function () {
      var r = gr.input.value.trim();
      if (!isRoot(r)) return say(o5, '✗ the root starts with 0x and has 66 characters', 'err');
      owner(o5, A.nft, call('setGtdRoot(bytes32)', b32(r)), 'save GTD root', '✓ GTD root saved');
    }));
    row5.appendChild(btn('open GTD mint', 'btn-ghost', function () { owner(o5, A.nft, call('setPhase(uint8)', u256(1)), 'open GTD mint', '✓ GTD mint is open'); }));
    row5.appendChild(btn('open public mint', 'btn-ghost', function () { owner(o5, A.nft, call('setPhase(uint8)', u256(2)), 'open public mint', '✓ public mint is open'); }));
    row5.appendChild(btn('close mint', 'btn-ghost', function () { owner(o5, A.nft, call('setPhase(uint8)', u256(0)), 'close mint', '✓ mint closed'); }));
    b5.appendChild(row5); b5.appendChild(o5);

    /* step 6: claim */
    var b6 = card(6, 'Open the $FLUFF claim', 'First send $FLUFF to the claim contract (the sheet shows the total). Then paste the claim root (Final Lists, cell B2).');
    var amt = input('example: 2000000', '', '$FLUFF to send (whole tokens)'); b6.appendChild(amt);
    var o6 = el('div', 'adm-out');
    var fund = btn('send $FLUFF to claim contract', '', function () {
      var n = wholeTokens(amt.input.value);
      if (!/^\d+$/.test(n) || n === '0') return say(o6, '✗ type a whole number', 'err');
      if (!isAddr(A.claim)) return say(o6, '✗ deploy the claim contract first (step 2)', 'err');
      owner(o6, A.token, call('transfer(address,uint256)', addrW(A.claim) + u256(n + '000000000000000000')), 'send ' + n + ' $FLUFF', '✓ sent ' + n + ' $FLUFF to the claim contract');
    });
    b6.appendChild(fund);
    var cr = input('0x... (66 characters)', '', 'claim root'); b6.appendChild(cr);
    b6.appendChild(btn('save claim root', 'btn-ghost', function () {
      var r = cr.input.value.trim();
      if (!isRoot(r)) return say(o6, '✗ the root starts with 0x and has 66 characters', 'err');
      owner(o6, A.claim, call('setMerkleRoot(bytes32)', b32(r)), 'save claim root', '✓ claim root saved. players can claim now.');
    }));
    b6.appendChild(o6);

    /* step 7: money + status */
    var b7 = card(7, 'Status and mint income', 'Check everything, and move the mint HYPE to your wallet.');
    var o7 = el('div', 'adm-out');
    var st = el('pre', 'adm-cfg'); b7.appendChild(st);
    var row7 = el('div', 'btn-row');
    row7.appendChild(btn('refresh status', '', async function () { st.textContent = 'loading...'; st.textContent = await status(); }));
    row7.appendChild(btn('withdraw mint HYPE', 'btn-ghost', function () { owner(o7, A.nft, call('withdraw()'), 'withdraw mint HYPE', '✓ HYPE sent to your wallet'); }));
    b7.appendChild(row7); b7.appendChild(o7);

    refreshAddrs();
  }
  var armed = {};
  function confirm2(b) { if (armed[b.textContent]) { armed[b.textContent] = false; return true; } armed[b.textContent] = true; setTimeout(function () { armed[b.textContent] = false; }, 5000); return false; }
  function prompt2(k) { try { return window.prompt(k + ' address (empty = clear)', A[k] || ''); } catch (e) { return null; } }
  async function owner(out, to, data, label, okText) {
    if (!isAddr(to)) return say(out, '✗ that contract is not deployed yet', 'err');
    try {
      if (!(await needWallet(out))) return;
      var res = await sendTx(out, { to: to, data: data }, label);
      if (res) say(out, okText, 'ok', res.hash);
    } catch (e) { say(out, '✗ ' + errText(e) + (/owner/i.test(errText(e)) ? ' (use the wallet that deployed it)' : ''), 'err'); }
  }
  async function read(to, data) {
    try { var r = await req('eth_call', [{ to: to, data: data }, 'latest']); return r; } catch (e) { return F.rpcCall(to, data); }
  }
  function dec(h) { return h && h !== '0x' ? F.wordToDec(F.hexToBytes(h.slice(0, 66))) : '—'; }
  async function status() {
    var L = [];
    if (isAddr(A.nft)) {
      var ph = dec(await read(A.nft, call('phase()')));
      L.push('NFT minted: ' + dec(await read(A.nft, call('totalSupply()'))) + ' / 3000');
      L.push('NFT phase: ' + ({ '0': 'closed', '1': 'GTD', '2': 'public' }[ph] || ph));
      L.push('GTD root: ' + ((await read(A.nft, call('gtdRoot()'))) || '—').slice(0, 66));
      try { var bal = await req('eth_getBalance', [A.nft, 'latest']); L.push('mint HYPE waiting: ' + F.weiToTokens(F.wordToDec(F.hexToBytes(bal)))); } catch (e) {}
    } else L.push('NFT: not deployed');
    if (isAddr(A.token) && isAddr(A.claim)) {
      L.push('$FLUFF in claim contract: ' + F.weiToTokens(dec(await read(A.token, call('balanceOf(address)', addrW(A.claim))))));
      L.push('claimed so far: ' + F.weiToTokens(dec(await read(A.claim, call('totalClaimed()')))));
      L.push('claim root: ' + ((await read(A.claim, call('merkleRoot()'))) || '—').slice(0, 66));
    } else L.push('claim: not deployed');
    if (ME && isAddr(A.token)) L.push('$FLUFF in your wallet: ' + F.weiToTokens(dec(await read(A.token, call('balanceOf(address)', addrW(ME))))));
    return L.join('\n');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
