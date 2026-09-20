# House Hunter

A static web app for collecting addresses, running a public-records report on each
one, and reviewing them on a shared map with one trusted editor.

No server. The page runs entirely in the browser and Google Drive is the database.
Nothing in this repo is secret, so the repo can be public.

Full design in `house-hunter-plan-v1.md`.

## Run it

```bash
git clone <your-repo-url>
cd house-hunter
python3 -m http.server -d docs 8080
```

Open http://localhost:8080. Pick which of the two of you is using it, and the
map appears.

Without a Google Maps key the app falls back to OpenStreetMap and a plain text
address box, with a banner saying so, which keeps it runnable before the Cloud
setup. Addresses are held in memory until M1 connects Drive.

## Deploy to GitHub Pages

1. Push to GitHub.
2. Settings, Pages, Source: *Deploy from a branch*.
3. Branch `main`, folder `/docs`. Save.

`docs/.nojekyll` is present so Jekyll does not swallow anything.

Once Pages is live, note the URL. You will need it for the Google Cloud setup,
because both the Maps key and the OAuth client are restricted to it.

## Google Maps setup

Google is the chosen provider. Leaflet stays in the repo behind the adapter as
a no-setup fallback. Until the key below exists the app uses that fallback and
Places autocomplete is off.

1. Create a Google Cloud project and enable billing. At two users the cost is
   zero, but a card on file is required.
2. Enable **Maps JavaScript API**, **Places API**, **Geocoding API**.
3. Create an API key. Restrict it to *HTTP referrers* and add your Pages URL and
   `http://localhost:8080/*`.
4. Create a **Map ID** (vector) under Map Management. `AdvancedMarkerElement`
   requires one.
5. Fill in `docs/js/config.js`:

```js
GOOGLE_MAPS_API_KEY: 'AIza…',
GOOGLE_MAPS_MAP_ID: '…',
```

`MAP_PROVIDER` is already `'google'`. Both providers render the same marker
DOM, so the pins look identical either way.

Autocomplete uses `PlaceAutocompleteElement` and the `gmp-select` event, biased
to a South Bay box set in `config.js`. Every address picked from autocomplete
carries a `placeId`, which is the first layer of the dedup check.

## The two people

The app opens on a chooser: **绝世大帅哥** in pink, **睿智大机智** in blue. The
pick is stored in `localStorage` and the header chip switches it back.

This persona is only a label. It is not a credential, and either person can pick
either name — the Google account behind Drive is what actually controls access.

Likes are per persona and shown by colour:

- One person likes it, the pin fills with that person's colour.
- Both like it, the pin splits down the middle, pink left and blue right.
- List rows carry both hearts, yours first, and say who liked it.

Either person can remove either person's like, and either can delete an address
for both. Every one of those gets an undo in the toast rather than a permission
check.

## Layout

```
docs/
  index.html      page shell
  style.css       tokens and layout, light and dark
  js/
    config.js     provider switch, keys, ids. All public by design.
    personas.js   the two identities, their colours, localStorage
    model.js      place records, canonical key, dedup, likes, merge. Pure.
    store.js      owns the document, notifies the app. Drive lands here in M1.
    map.js        adapter, Leaflet and Google implementations, marker rendering,
                  Places autocomplete
    analyzer.js   the report interface and its placeholder engine
    ui.js         entry screen, list drawer, report panel, toast
    app.js        wiring
```

`model.js` has no DOM and no network, so the dedup and merge rules can be tested
directly.

## Milestones

- [x] **M0** Repo, Pages deploy, map renders, add and remove addresses, list drawer,
      report panel, placeholder analyzer
- [x] **M0.5** Google Maps and Places, persona entry screen, per-persona likes and
      colours, either person can undo anything
- [ ] **M1** Google sign-in, create and read and write the Drive JSON, single user
- [ ] **M2** Autocomplete-sourced `placeId` carried through dedup end to end
- [ ] **M3** Polish on the drawer and report, keyboard paths, empty states
- [ ] **M4** Share via `permissions.create`, Picker flow for the second editor,
      merge protocol, polling
- [ ] **M5** Real analysis engine behind the `analyzeAddress` interface

## What is deliberately missing in M0

- **Drive.** `store.js` holds the document in memory. A refresh loses it. The
  interface it exposes is already the one M1 needs.
- **Autocomplete without a key.** The fallback text box drops the pin near the
  default centre. Fill in the Maps key to get real geocoding.
- **Who added an address.** Still not shown. `addedBy` and `updatedBy` are
  recorded because the merge needs a writer identity. Who *liked* an address is
  shown, through the persona colours.
- **A real analyzer.** Every report section returns a stated gap rather than
  invented content. A browser page cannot hold a search API key, so the engine
  needs either a key pasted into settings or a small proxy. Open decision.
