/*
 * DHM Exchange — the euro against the currency where you are.
 *
 * Location: the browser's geolocation, reverse-geocoded to a country; if that
 * is refused or fails, the country of the connection's IP address. Country →
 * currency is a table in the page (countries.js). Rates: the ECB reference
 * rate via Frankfurter where it covers the currency, otherwise a wider free
 * source. The last rate fetched is kept so the page still answers offline.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'dhm-exchange';
  var TIMEOUT_MS = 8000;

  var state = { currency: null, rate: null, country: null, lastEdited: 'eur' };

  // ---- Storage (per-browser convenience only; the page works without it) ----
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    try {
      var s = load();
      Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) { /* private window or blocked storage */ }
  }

  // ---- Names and formatting ----
  var locale = navigator.language || 'en';
  // Names in English, as the rest of the page is; numbers in the reader's own notation.
  var currencyNames = safeDisplayNames('currency');
  var regionNames = safeDisplayNames('region');
  function safeDisplayNames(type) {
    try { return new Intl.DisplayNames(['en'], { type: type }); } catch (e) { return null; }
  }
  function currencyName(code) {
    try { return (currencyNames && currencyNames.of(code)) || code; } catch (e) { return code; }
  }
  function countryName(cc) {
    try { return (regionNames && regionNames.of(cc)) || cc; } catch (e) { return cc; }
  }

  // Rates span 0.00005 (IDR) to 400,000 (IRR): significant digits, not decimals.
  function formatRate(value, code) {
    var digits = value >= 1000 ? 0 : value >= 1 ? 4 : null;
    var opts = { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' };
    if (digits === null) opts.maximumSignificantDigits = 4;
    else { opts.minimumFractionDigits = Math.min(digits, 2); opts.maximumFractionDigits = digits; }
    return formatCurrency(value, code, opts);
  }
  function formatMoney(value, code) {
    return formatCurrency(value, code, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' });
  }
  function formatCurrency(value, code, opts) {
    try { return new Intl.NumberFormat(locale, opts).format(value); }
    catch (e) { return code + ' ' + value.toFixed(2); }
  }
  function formatPlain(value) {
    var abs = Math.abs(value);
    var max = abs >= 1000 ? 2 : abs >= 1 ? 2 : 6;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: max, useGrouping: false }).format(value);
  }

  // Accepts "12,5", "12.5", "1.234,56", "1,234.56", "1 000". A lone separator
  // is the decimal point, whichever it is. Blank is null, not zero.
  function parseAmount(text) {
    var s = String(text || '').replace(/[\s\u00a0\u202f'€$£¥]/g, '');
    if (!s) return null;
    var lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
    var commas = s.split(',').length - 1, dots = s.split('.').length - 1;
    var decimal = null;
    if (commas && dots) decimal = lastComma > lastDot ? ',' : '.';
    else if (commas === 1) decimal = ',';
    else if (dots === 1) decimal = '.';
    var thousands = decimal === ',' ? '.' : decimal === '.' ? ',' : null;
    s = thousands ? s.split(thousands).join('') : s.replace(/[.,]/g, '');
    if (decimal === ',') s = s.replace(',', '.');
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  // ---- Network ----
  function getJSON(url) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT_MS);
    return fetch(url, { signal: ctrl ? ctrl.signal : undefined, referrerPolicy: 'no-referrer', credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  // Each source returns { rate, date, source } for 1 EUR → code, or throws.
  var SOURCES = [
    function frankfurter(code) {
      return getJSON('https://api.frankfurter.app/latest?from=EUR&to=' + code).then(function (d) {
        var r = d && d.rates && d.rates[code];
        if (!(r > 0)) throw new Error('not covered');
        return { rate: r, date: d.date, source: 'European Central Bank reference rate (via Frankfurter)' };
      });
    },
    function erApi(code) {
      return getJSON('https://open.er-api.com/v6/latest/EUR').then(function (d) {
        var r = d && d.rates && d.rates[code];
        if (d.result !== 'success' || !(r > 0)) throw new Error('not covered');
        var date = d.time_last_update_unix ? new Date(d.time_last_update_unix * 1000).toISOString().slice(0, 10) : null;
        return { rate: r, date: date, source: 'ExchangeRate-API open rates' };
      });
    },
    function currencyApi(code) {
      return getJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json').then(function (d) {
        var r = d && d.eur && d.eur[code.toLowerCase()];
        if (!(r > 0)) throw new Error('not covered');
        return { rate: r, date: d.date, source: 'fawazahmed0 currency-api' };
      });
    }
  ];

  function fetchRate(code) {
    var i = 0;
    function next() {
      if (i >= SOURCES.length) return Promise.reject(new Error('no source'));
      return SOURCES[i++](code).catch(next);
    }
    return next();
  }

  // ---- Location ----
  function browserPosition() {
    return new Promise(function (resolve, reject) {
      if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000
      });
    });
  }
  function countryFromPosition(pos) {
    var lat = pos.coords.latitude.toFixed(3), lon = pos.coords.longitude.toFixed(3);
    return getJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat +
      '&longitude=' + lon + '&localityLanguage=en').then(function (d) {
      if (!d || !/^[A-Z]{2}$/.test(d.countryCode || '')) throw new Error('no country');
      return { cc: d.countryCode, place: d.city || d.locality || '', how: 'gps' };
    });
  }
  function countryFromIp() {
    return getJSON('https://get.geojs.io/v1/ip/country.json').then(function (d) {
      var cc = d && String(d.country || '').toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) throw new Error('no country');
      return { cc: cc, place: '', how: 'ip' };
    });
  }
  function locate() {
    return browserPosition().then(countryFromPosition, function (err) {
      var e = new Error('denied');
      e.geo = err;
      throw e;
    }).catch(function (err) {
      return countryFromIp().then(function (r) {
        r.fallbackReason = err && err.geo && err.geo.code === 1 ? 'denied' : 'unavailable';
        return r;
      });
    });
  }

  // ---- Rendering ----
  function setStatus(text, kind) {
    var el = $('status');
    if (!text) { el.hidden = true; return; }
    el.hidden = false;
    el.className = 'notice notice--' + (kind || 'info');
    el.textContent = text;
  }

  function renderWhere() {
    var c = state.country;
    var where = $('where');
    if (!c) { where.textContent = 'Location unknown'; return; }
    var name = countryName(c.cc);
    var bits = [c.place, name].filter(Boolean).join(', ');
    where.textContent = (c.how === 'ip' ? 'Approximately in ' : 'You are in ') + bits;
  }

  function renderRate(result, stale) {
    var code = state.currency;
    state.rate = result.rate;
    var inverse = 1 / result.rate;
    var name = currencyName(code);

    $('title').textContent = code === 'EUR' ? 'You are paying in euros' : 'Euro to ' + name;
    $('eur-to-local').textContent = formatRate(result.rate, code);
    $('one-local-title').textContent = 'One ' + name;
    $('local-one').textContent = formatMoney(1, code);
    $('local-to-eur').textContent = formatRate(inverse, 'EUR');
    $('local-name').textContent = name;
    $('local-code').textContent = code;
    $('rates').hidden = false;
    $('calc').hidden = false;

    var dateText = result.date ? formatDate(result.date) : 'unknown date';
    var fixed = code === 'EUR';
    $('updated').textContent = fixed ? '' : 'Rate of ' + dateText;
    $('source').textContent = fixed ? '' : 'Rate: ' + result.source + ', ' + dateText +
      '. Reference rates are mid-market; your bank or card will charge a margin on top.';

    if (stale) setStatus('Offline — showing the last rate fetched, from ' + dateText + '.', 'warning');
    else if (code === 'EUR') setStatus('This country uses the euro, so there is nothing to convert. Pick another currency below to compare.', 'ok');
    else setStatus('');

    renderQuick();
    recalc();
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    if (isNaN(d)) return iso;
    try { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); }
    catch (e) { return iso; }
  }

  // Quick amounts in the local currency, sized so they are amounts people actually pay.
  function renderQuick() {
    var box = $('quick');
    box.textContent = '';
    if (!state.rate) return;
    var base = Math.pow(10, Math.max(0, Math.round(Math.log10(state.rate))));
    [1, 5, 10, 20, 50, 100].forEach(function (m) {
      var local = m * base;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = formatMoney(local, state.currency).replace(/[.,]00(?=\D*$)/, '');
      b.addEventListener('click', function () {
        $('amount-local').value = formatPlain(local);
        state.lastEdited = 'local';
        recalc();
        $('amount-local').focus();
      });
      box.appendChild(b);
    });
  }

  function recalc() {
    if (!state.rate) return;
    var eur = $('amount-eur'), local = $('amount-local');
    if (state.lastEdited === 'eur') {
      var e = parseAmount(eur.value);
      local.value = e === null ? '' : formatPlain(e * state.rate);
    } else {
      var l = parseAmount(local.value);
      eur.value = l === null ? '' : formatPlain(l / state.rate);
    }
  }

  function fillCurrencySelect() {
    var seen = {};
    var codes = [];
    var map = window.COUNTRY_CURRENCY || {};
    Object.keys(map).forEach(function (cc) {
      var c = map[cc];
      if (!seen[c]) { seen[c] = true; codes.push(c); }
    });
    codes.sort(function (a, b) { return currencyName(a).localeCompare(currencyName(b), 'en'); });
    var sel = $('currency');
    sel.textContent = '';
    codes.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = currencyName(c) + ' (' + c + ')';
      sel.appendChild(o);
    });
  }

  // ---- Flow ----
  function showCurrency(code) {
    state.currency = code;
    $('currency').value = code;
    if (code === 'EUR') { renderRate({ rate: 1, date: null, source: '' }); return Promise.resolve(); }
    setStatus('Fetching today’s rate for ' + currencyName(code) + '…', 'info');
    return fetchRate(code).then(function (r) {
      var cache = load().rates || {};
      cache[code] = r;
      save({ rates: cache });
      renderRate(r);
    }).catch(function () {
      var cached = (load().rates || {})[code];
      if (cached) { renderRate(cached, true); return; }
      $('rates').hidden = true;
      $('calc').hidden = true;
      setStatus('Could not fetch a rate for ' + currencyName(code) + '. Check your connection and try again.', 'error');
    });
  }

  function start() {
    setStatus('Asking your browser for your location…', 'info');
    $('where').textContent = 'Finding where you are…';
    return locate().then(function (c) {
      state.country = c;
      save({ country: c });
      renderWhere();
      var code = (window.COUNTRY_CURRENCY || {})[c.cc];
      var override = load().override;
      if (!code) {
        setStatus('No currency on file for ' + countryName(c.cc) + '. Pick one below.', 'warning');
        return override ? showCurrency(override) : null;
      }
      return showCurrency(override || code).then(function () {
        if (c.how === 'ip' && !$('status').classList.contains('notice--error')) {
          var why = c.fallbackReason === 'denied' ? 'Location permission was declined' : 'Precise location was unavailable';
          if ($('status').hidden) setStatus(why + ', so this is based on your internet connection and may be off near a border.', 'info');
        }
      });
    }).catch(function () {
      var saved = load();
      state.country = saved.country || null;
      renderWhere();
      var code = saved.override || (saved.country && (window.COUNTRY_CURRENCY || {})[saved.country.cc]);
      if (code) return showCurrency(code);
      setStatus('Could not work out where you are. Pick a currency below.', 'warning');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillCurrencySelect();

    $('amount-eur').addEventListener('input', function () { state.lastEdited = 'eur'; recalc(); });
    $('amount-local').addEventListener('input', function () { state.lastEdited = 'local'; recalc(); });
    $('clear').addEventListener('click', function () {
      $('amount-eur').value = '';
      $('amount-local').value = '';
      $('amount-eur').focus();
    });
    $('currency').addEventListener('change', function (e) {
      var code = e.target.value;
      var detected = state.country && (window.COUNTRY_CURRENCY || {})[state.country.cc];
      save({ override: code === detected ? null : code });
      showCurrency(code);
    });
    $('relocate').addEventListener('click', function () {
      save({ override: null });
      start();
    });

    start();
  });

  // Exposed for tests only.
  window.__exchange = { parseAmount: parseAmount };
})();
