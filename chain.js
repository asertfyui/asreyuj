/* =========================================================
   ElyFluff on-chain helpers (no external libraries)
   keccak256, Merkle proofs, wallet connect, mint and claim
   ========================================================= */
(function () {
  'use strict';

  /* ---------- keccak256 ---------- */
  var RC = [1, 0, 0x8082, 0, 0x808A, 0x80000000, 0x80008000, 0x80000000, 0x808B, 0, 0x80000001, 0, 0x80008081, 0x80000000, 0x8009, 0x80000000,
    0x8A, 0, 0x88, 0, 0x80008009, 0, 0x8000000A, 0, 0x8000808B, 0, 0x8B, 0x80000000, 0x8089, 0x80000000, 0x8003, 0x80000000,
    0x8002, 0x80000000, 0x80, 0x80000000, 0x800A, 0, 0x8000000A, 0x80000000, 0x80008081, 0x80000000, 0x8080, 0x80000000, 0x80000001, 0, 0x80008008, 0x80000000];
  var ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
  var PI = [];
  for (var x0 = 0; x0 < 5; x0++) for (var y0 = 0; y0 < 5; y0++) PI[x0 + 5 * y0] = y0 + 5 * ((2 * x0 + 3 * y0) % 5);
  function f1600(s) {
    var c = new Array(10), b = new Array(50), x, y, i, lo, hi, n, r;
    for (r = 0; r < 24; r++) {
      for (x = 0; x < 5; x++) {
        c[2 * x] = s[2 * x] ^ s[2 * x + 10] ^ s[2 * x + 20] ^ s[2 * x + 30] ^ s[2 * x + 40];
        c[2 * x + 1] = s[2 * x + 1] ^ s[2 * x + 11] ^ s[2 * x + 21] ^ s[2 * x + 31] ^ s[2 * x + 41];
      }
      for (x = 0; x < 5; x++) {
        var p = (x + 4) % 5, q = (x + 1) % 5;
        var dl = c[2 * p] ^ ((c[2 * q] << 1) | (c[2 * q + 1] >>> 31));
        var dh = c[2 * p + 1] ^ ((c[2 * q + 1] << 1) | (c[2 * q] >>> 31));
        for (y = 0; y < 25; y += 5) { s[2 * (x + y)] ^= dl; s[2 * (x + y) + 1] ^= dh; }
      }
      for (i = 0; i < 25; i++) {
        lo = s[2 * i]; hi = s[2 * i + 1]; n = ROT[i];
        if (n >= 32) { var t = lo; lo = hi; hi = t; n -= 32; }
        if (n) { var nl = (lo << n) | (hi >>> (32 - n)); hi = (hi << n) | (lo >>> (32 - n)); lo = nl; }
        b[2 * PI[i]] = lo; b[2 * PI[i] + 1] = hi;
      }
      for (y = 0; y < 25; y += 5) {
        for (x = 0; x < 5; x++) {
          var a1 = x + y, a2 = (x + 1) % 5 + y, a3 = (x + 2) % 5 + y;
          s[2 * a1] = b[2 * a1] ^ (~b[2 * a2] & b[2 * a3]);
          s[2 * a1 + 1] = b[2 * a1 + 1] ^ (~b[2 * a2 + 1] & b[2 * a3 + 1]);
        }
      }
      s[0] ^= RC[2 * r]; s[1] ^= RC[2 * r + 1];
    }
  }
  function keccak(bytes) {
    var rate = 136, s = new Array(50), i, j;
    for (i = 0; i < 50; i++) s[i] = 0;
    var len = bytes.length, padLen = rate - (len % rate);
    var m = new Uint8Array(len + padLen);
    m.set(bytes); m[len] |= 0x01; m[m.length - 1] |= 0x80;
    for (i = 0; i < m.length; i += rate) {
      for (j = 0; j < rate; j += 4) {
        var w = m[i + j] | (m[i + j + 1] << 8) | (m[i + j + 2] << 16) | (m[i + j + 3] << 24);
        s[j >> 2] ^= w;
      }
      f1600(s);
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 32; i++) out[i] = (s[i >> 2] >>> ((i & 3) * 8)) & 0xff;
    return out;
  }

  /* ---------- bytes ---------- */
  function hexToBytes(h) {
    h = String(h).replace(/^0x/i, ''); if (h.length % 2) h = '0' + h;
    var out = new Uint8Array(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(b) { var s = '0x'; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function utf8(str) { return new TextEncoder().encode(str); }
  function concat(a, b) { var o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }
  function word(bytes) { var o = new Uint8Array(32); o.set(bytes, 32 - bytes.length); return o; }
  function decToWord(dec) {
    var o = new Uint8Array(32), d = String(dec).replace(/\D/g, '') || '0';
    for (var k = 0; k < d.length; k++) {
      var carry = d.charCodeAt(k) - 48;
      for (var i = 31; i >= 0; i--) { var v = o[i] * 10 + carry; o[i] = v & 0xff; carry = v >> 8; }
    }
    return o;
  }
  function wordToDec(bytes) {
    var digits = [0];
    for (var i = 0; i < bytes.length; i++) {
      var carry = bytes[i];
      for (var j = 0; j < digits.length; j++) { var v = digits[j] * 256 + carry; digits[j] = v % 10; carry = Math.floor(v / 10); }
      while (carry) { digits.push(carry % 10); carry = Math.floor(carry / 10); }
    }
    return digits.reverse().join('').replace(/^0+(?=\d)/, '');
  }
  function weiToTokens(dec) { dec = String(dec).padStart(19, '0'); var w = dec.slice(0, -18).replace(/^0+(?=\d)/, ''); var f = dec.slice(-18).replace(/0+$/, ''); return f ? w + '.' + f.slice(0, 4) : w; }
  function keccakHex(bytes) { return bytesToHex(keccak(bytes)); }
  function selector(sig) { return bytesToHex(keccak(utf8(sig)).slice(0, 4)); }

  /* ---------- Merkle (OpenZeppelin MerkleProof, sorted pairs) ---------- */
  function leafAddress(addr) { return keccak(keccak(word(hexToBytes(addr)))); }
  function leafClaim(addr, wei) { return keccak(keccak(concat(word(hexToBytes(addr)), decToWord(wei)))); }
  function cmp(a, b) { for (var i = 0; i < 32; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; }
  function hashPair(a, b) { return cmp(a, b) <= 0 ? keccak(concat(a, b)) : keccak(concat(b, a)); }
  function buildTree(leaves) {
    var layers = [leaves.slice().sort(cmp)];
    while (layers[layers.length - 1].length > 1) {
      var cur = layers[layers.length - 1], nxt = [];
      for (var i = 0; i < cur.length; i += 2) nxt.push(i + 1 < cur.length ? hashPair(cur[i], cur[i + 1]) : cur[i]);
      layers.push(nxt);
    }
    return layers;
  }
  function root(layers) { var top = layers[layers.length - 1]; return top.length ? bytesToHex(top[0]) : '0x' + '0'.repeat(64); }
  function proof(layers, leaf) {
    var idx = -1, L = layers[0];
    for (var i = 0; i < L.length; i++) if (cmp(L[i], leaf) === 0) { idx = i; break; }
    if (idx < 0) return null;
    var out = [];
    for (var l = 0; l < layers.length - 1; l++) {
      var sib = idx ^ 1;
      if (sib < layers[l].length) out.push(bytesToHex(layers[l][sib]));
      idx = idx >> 1;
    }
    return out;
  }
  function verify(pr, rootHex, leaf) {
    var h = leaf;
    for (var i = 0; i < pr.length; i++) h = hashPair(h, hexToBytes(pr[i]));
    return bytesToHex(h).toLowerCase() === String(rootHex).toLowerCase();
  }

  /* ---------- ABI ---------- */
  function encBytes32Array(arr) {
    var s = word(hexToBytes(arr.length.toString(16)));
    var h = bytesToHex(s).slice(2);
    arr.forEach(function (p) { h += String(p).replace(/^0x/, '').padStart(64, '0'); });
    return h;
  }
  function u256(n) { return bytesToHex(decToWord(n)).slice(2); }
  var SEL = {};
  function sel(sig) { return SEL[sig] || (SEL[sig] = selector(sig)); }
  function dataMintGTD(pr) { return sel('mintGTD(bytes32[])') + u256(32) + encBytes32Array(pr); }
  function dataMintPublic(qty) { return sel('mintPublic(uint256)') + u256(qty); }
  function dataClaim(wei, pr) { return sel('claim(uint256,bytes32[])') + u256(wei) + u256(64) + encBytes32Array(pr); }
  function dataAddr(sig, addr) { return sel(sig) + bytesToHex(word(hexToBytes(addr))).slice(2); }
  function dataNoArgs(sig) { return sel(sig); }

  /* ---------- wallet ---------- */
  var C = window.ELYFLUFF_CONFIG || {};
  var CHAIN = Number(C.CHAIN_ID) || 998;
  function eth() { return window.ethereum || null; }
  async function rpcCall(to, data) {
    var url = C.HYPEREVM_TESTNET_RPC;
    var body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: to, data: data }, 'latest'] });
    try {
      var r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body });
      var j = await r.json(); if (j && j.result) return j.result;
    } catch (e) {}
    if (eth()) { try { return await eth().request({ method: 'eth_call', params: [{ to: to, data: data }, 'latest'] }); } catch (e2) {} }
    return null;
  }
  async function readUint(to, data) { var r = await rpcCall(to, data); return r && r !== '0x' ? wordToDec(hexToBytes(r)) : null; }
  async function readBytes32(to, sig) { var r = await rpcCall(to, sel(sig)); return r && r.length >= 66 ? r.slice(0, 66).toLowerCase() : null; }
  async function connect() {
    var p = eth();
    if (!p) throw new Error('No wallet found. Open this site in your wallet app (MetaMask, Rabby, OKX) or install a wallet extension.');
    var acc = await p.request({ method: 'eth_requestAccounts' });
    if (!acc || !acc[0]) throw new Error('No account selected.');
    await ensureChain();
    return acc[0].toLowerCase();
  }
  async function ensureChain() {
    var p = eth(), hex = '0x' + CHAIN.toString(16);
    var cur = await p.request({ method: 'eth_chainId' });
    if (String(cur).toLowerCase() === hex) return;
    try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] }); }
    catch (e) {
      if (e && (e.code === 4902 || /unrecognized|not added|unknown chain/i.test(e.message || ''))) {
        await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: C.CHAIN_NAME || 'HyperEVM Testnet', nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 }, rpcUrls: [C.HYPEREVM_TESTNET_RPC], blockExplorerUrls: C.EXPLORER_URL ? [C.EXPLORER_URL] : undefined }] });
      } else throw e;
    }
  }
  function hypeToWeiHex(str) {
    var m = String(str || '').match(/[\d.]+/), v = m ? m[0] : '0';
    var parts = v.split('.'), w = (parts[0] || '0') + ((parts[1] || '') + '0'.repeat(18)).slice(0, 18);
    var b = decToWord(w), h = bytesToHex(b).slice(2).replace(/^0+/, '');
    return '0x' + (h || '0');
  }
  async function send(from, to, data, valueHex) {
    await ensureChain();
    var tx = { from: from, to: to, data: data };
    if (valueHex) tx.value = valueHex;
    return eth().request({ method: 'eth_sendTransaction', params: [tx] });
  }
  async function waitReceipt(hash, maxMs) {
    var t0 = Date.now();
    while (Date.now() - t0 < (maxMs || 120000)) {
      try {
        var r = await fetch(C.HYPEREVM_TESTNET_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [hash] }) });
        var j = await r.json();
        if (j && j.result) return j.result;
      } catch (e) {}
      await new Promise(function (res) { setTimeout(res, 2500); });
    }
    return null;
  }

  window.FluffChain = {
    keccakHex: keccakHex, selector: selector, hexToBytes: hexToBytes, bytesToHex: bytesToHex, decToWord: decToWord, wordToDec: wordToDec, weiToTokens: weiToTokens,
    leafAddress: leafAddress, leafClaim: leafClaim, buildTree: buildTree, root: root, proof: proof, verify: verify,
    dataMintGTD: dataMintGTD, dataMintPublic: dataMintPublic, dataClaim: dataClaim, dataAddr: dataAddr, dataNoArgs: dataNoArgs,
    connect: connect, ensureChain: ensureChain, send: send, waitReceipt: waitReceipt, readUint: readUint, readBytes32: readBytes32, rpcCall: rpcCall,
    hypeToWeiHex: hypeToWeiHex, hasWallet: function () { return !!eth(); }, chainId: CHAIN
  };
})();
