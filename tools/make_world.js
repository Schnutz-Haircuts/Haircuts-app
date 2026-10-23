// Writes web/data/world.js from world-atlas's countries-50m.json (Natural
// Earth), with Crimea moved from Russia to Ukraine.
//
// Usage: node tools/make_world.js path/to/countries-50m.json path/to/topojson-client.js
const fs = require('fs');
const path = require('path');

const [src, topojsonPath] = process.argv.slice(2);
const topojson = require(path.resolve(topojsonPath));
const topology = JSON.parse(fs.readFileSync(src, 'utf8'));
const countries = topology.objects.countries.geometries;
const russia = countries.find((g) => g.properties.name === 'Russia');
const ukraine = countries.find((g) => g.properties.name === 'Ukraine');

// Crimea is the Russian polygon lying within the peninsula's bounding box.
function bounds(arcs) {
  const ring = topojson.feature(topology, { type: 'Polygon', arcs }).geometry.coordinates[0];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
const crimea = russia.arcs.filter((poly) => {
  const b = bounds(poly);
  return b[0] > 32 && b[2] < 37 && b[1] > 44 && b[3] < 46.5;
});
if (crimea.length !== 1) throw new Error('Expected one Crimea polygon, found ' + crimea.length);

russia.arcs = russia.arcs.filter((poly) => poly !== crimea[0]);
// mergeArcs dissolves the border between Ukraine and Crimea.
const merged = topojson.mergeArcs(topology, [ukraine, { type: 'Polygon', arcs: crimea[0] }]);
ukraine.type = merged.type;
ukraine.arcs = merged.arcs;

const out = path.join(__dirname, '..', 'web', 'data', 'world.js');
fs.writeFileSync(out, 'window.WORLD = ' + JSON.stringify(topology) + ';\n');
console.log('Wrote', out);
