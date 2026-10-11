# Haircuts app

An Android app showing Schnutz' international haircuts on a globe. Tap an
orange country (or a labelled dot for very small ones) to see its haircut
events, newest first, with photos, laid out like
[schnutz-haircuts.github.io/Haircuts](https://schnutz-haircuts.github.io/Haircuts/).
"All countries" lists every country alphabetically. Everything works offline:
the photos are bundled in the app.

## Getting the app

Every push to `main` builds the APK on GitHub Actions and publishes it as the
[latest release](../../releases/tag/latest). Open that page on your phone,
download `Haircuts.apk` and allow installing from your browser when Android asks.

The data comes from `hair-list.csv` and the photos in
[Schnutz-Haircuts/Haircuts](https://github.com/Schnutz-Haircuts/Haircuts). After
changing them there, rebuild here: Actions → Build APK → Run workflow.

## How it is built

- `web/` is the app itself: a [globe.gl](https://github.com/vasturiano/globe.gl)
  globe with Natural Earth country shapes (`data/world.js`, from
  [world-atlas](https://github.com/topojson/world-atlas)) and plain HTML pages.
- `tools/build_data.py path/to/Haircuts` turns `hair-list.csv` into
  `web/data/events.js` and copies the photos into `web/photos/` (shrinking any
  larger than 1600 px). Country names that differ from the map's are listed in
  `MAP_NAMES` there.
- `android/` is a small Kotlin app that shows `web/` full screen in a WebView.

To preview without a phone: run the build script, then
`python3 -m http.server -d web` and open http://localhost:8000.
