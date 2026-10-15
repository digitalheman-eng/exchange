/*
 * ISO 3166-1 alpha-2 country → ISO 4217 currency, grouped by currency.
 * Kept in the page so a location lookup needs one request, not two.
 * Countries that use a foreign currency are listed under that currency.
 */
(function () {
  'use strict';
  var byCurrency = {
    EUR: 'AD AT AX BE BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA XK YT',
    USD: 'AS BQ EC FM GU IO MH MP PR PW SV TC TL UM US VG VI ZW',
    GBP: 'GB GG GS IM JE', AUD: 'AU CC CX HM KI NF NR TV', NZD: 'CK NU NZ PN TK', CHF: 'CH LI',
    DKK: 'DK FO GL', NOK: 'BV NO SJ', XOF: 'BF BJ CI GW ML NE SN TG', XAF: 'CF CG CM GA GQ TD',
    XCD: 'AG AI DM GD KN LC MS VC', XPF: 'NC PF WF', ANG: 'CW SX', MAD: 'EH MA', ILS: 'IL PS',
    INR: 'BT IN', ZAR: 'LS NA ZA'
  };
  var single = {
    AE: 'AED', AF: 'AFN', AL: 'ALL', AM: 'AMD', AO: 'AOA', AR: 'ARS', AW: 'AWG', AZ: 'AZN',
    BA: 'BAM', BB: 'BBD', BD: 'BDT', BG: 'BGN', BH: 'BHD', BI: 'BIF', BM: 'BMD', BN: 'BND',
    BO: 'BOB', BR: 'BRL', BS: 'BSD', BW: 'BWP', BY: 'BYN', BZ: 'BZD', CA: 'CAD', CD: 'CDF',
    CL: 'CLP', CN: 'CNY', CO: 'COP', CR: 'CRC', CU: 'CUP', CV: 'CVE', CZ: 'CZK', DJ: 'DJF',
    DO: 'DOP', DZ: 'DZD', EG: 'EGP', ER: 'ERN', ET: 'ETB', FJ: 'FJD', FK: 'FKP', GE: 'GEL',
    GH: 'GHS', GI: 'GIP', GM: 'GMD', GN: 'GNF', GT: 'GTQ', GY: 'GYD', HK: 'HKD', HN: 'HNL',
    HT: 'HTG', HU: 'HUF', ID: 'IDR', IQ: 'IQD', IR: 'IRR', IS: 'ISK', JM: 'JMD', JO: 'JOD',
    JP: 'JPY', KE: 'KES', KG: 'KGS', KH: 'KHR', KM: 'KMF', KP: 'KPW', KR: 'KRW', KW: 'KWD',
    KY: 'KYD', KZ: 'KZT', LA: 'LAK', LB: 'LBP', LK: 'LKR', LR: 'LRD', LY: 'LYD', MD: 'MDL',
    MG: 'MGA', MK: 'MKD', MM: 'MMK', MN: 'MNT', MO: 'MOP', MR: 'MRU', MU: 'MUR', MV: 'MVR',
    MW: 'MWK', MX: 'MXN', MY: 'MYR', MZ: 'MZN', NG: 'NGN', NI: 'NIO', NP: 'NPR', OM: 'OMR',
    PA: 'PAB', PE: 'PEN', PG: 'PGK', PH: 'PHP', PK: 'PKR', PL: 'PLN', PY: 'PYG', QA: 'QAR',
    RO: 'RON', RS: 'RSD', RU: 'RUB', RW: 'RWF', SA: 'SAR', SB: 'SBD', SC: 'SCR', SD: 'SDG',
    SE: 'SEK', SG: 'SGD', SH: 'SHP', SL: 'SLE', SO: 'SOS', SR: 'SRD', SS: 'SSP', ST: 'STN',
    SY: 'SYP', SZ: 'SZL', TH: 'THB', TJ: 'TJS', TM: 'TMT', TN: 'TND', TO: 'TOP', TR: 'TRY',
    TT: 'TTD', TW: 'TWD', TZ: 'TZS', UA: 'UAH', UG: 'UGX', UY: 'UYU', UZ: 'UZS', VE: 'VES',
    VN: 'VND', VU: 'VUV', WS: 'WST', YE: 'YER', ZM: 'ZMW'
  };
  var map = {};
  Object.keys(byCurrency).forEach(function (cur) {
    byCurrency[cur].split(' ').forEach(function (cc) { map[cc] = cur; });
  });
  Object.keys(single).forEach(function (cc) { map[cc] = single[cc]; });
  window.COUNTRY_CURRENCY = map;
})();
