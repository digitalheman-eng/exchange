# DHM Exchange

One page: the euro against the currency of wherever you are, both ways
(€1 = X local, 1 local = € Y), plus a two-way calculator. No sign-in, no
server, no build step — static HTML, CSS and JS styled with the DHM design
tokens (`styles/tokens.css`, copied from DHM Budget; the names are the DHM
contract).

## How it works

1. **Location** — the browser's geolocation, reverse-geocoded to a country by
   BigDataCloud's free client endpoint. If permission is declined or fails,
   the country of the connection's IP address (geojs.io), labelled as
   approximate.
2. **Currency** — country → currency from the table in `js/countries.js`.
   The person can pick another currency; that choice is remembered in the
   browser until "Use my location again".
3. **Rate** — the ECB reference rate via Frankfurter where it covers the
   currency; otherwise open.er-api.com, then the fawazahmed0 currency-api on
   jsDelivr. The last rate per currency is kept in `localStorage`, so the page
   still answers offline (and says so).

The CSP in `index.html` allows only those hosts to be fetched; no inline
scripts or styles.

## Run locally

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Geolocation needs HTTPS or `localhost`.

## Deploy

Everything is relative-pathed, so it works at a domain root or under a
sub-path.

- **GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main`,
  `/ (root)`. Every push to `main` then publishes.
- **DHM VPS (nginx):** check out the repo and serve it as static files, e.g.
  `location /exchange/ { alias /var/www/dhm-exchange/app/; }`.
