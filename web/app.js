(function () {
  'use strict';

  var countries = window.HAIRCUTS;
  var byMapName = {};
  var bySlug = {};
  countries.forEach(function (c) {
    c.slug = c.name.replace(/ /g, '_');
    byMapName[c.map] = c;
    bySlug[c.slug] = c;
  });

  var nEvents = countries.reduce(function (n, c) { return n + c.events.length; }, 0);
  document.getElementById('summary').textContent =
    nEvents + ' haircuts in ' + countries.length + ' countries. Tap a country.';

  // Globe

  var features = topojson.feature(window.WORLD, window.WORLD.objects.countries).features;
  features.forEach(function (f) { f.haircuts = byMapName[f.properties.name] || null; });

  var HAIRCUT = '#f4a62a';
  var HAIRCUT_HOVER = '#ffd27a';
  var OTHER = '#55636f';
  var hovered = null;

  var globeEl = document.getElementById('globe');
  var tooltip = document.getElementById('tooltip');

  var globe = Globe({ animateIn: false })(globeEl)
    .backgroundColor('#000814')
    .showAtmosphere(true)
    .atmosphereColor('#7fb4ff')
    .polygonsData(features)
    .polygonCapColor(function (f) {
      if (!f.haircuts) return OTHER;
      return f === hovered ? HAIRCUT_HOVER : HAIRCUT;
    })
    .polygonSideColor(function () { return 'rgba(0, 0, 0, 0.25)'; })
    .polygonStrokeColor(function () { return '#1d2731'; })
    .polygonAltitude(function (f) {
      if (!f.haircuts) return 0.004;
      return f === hovered ? 0.03 : 0.01;
    })
    .polygonsTransitionDuration(200)
    .onPolygonHover(function (f) {
      hovered = f && f.haircuts ? f : null;
      globe.polygonCapColor(globe.polygonCapColor()).polygonAltitude(globe.polygonAltitude());
      showTooltip(hovered && hovered.haircuts);
    })
    .onPolygonClick(function (f) {
      if (f.haircuts) openCountry(f.haircuts);
    })
    // Countries too small to tap get a labelled dot.
    .labelsData(smallCountryLabels())
    .labelLat(function (d) { return d.lat; })
    .labelLng(function (d) { return d.lng; })
    .labelText(function (d) { return d.name; })
    .labelSize(0.7)
    .labelDotRadius(0.45)
    .labelColor(function () { return HAIRCUT_HOVER; })
    .labelResolution(2)
    .onLabelClick(function (d) { openCountry(d.country); })
    .pointOfView({ lat: 35, lng: 15, altitude: 2.3 });

  globe.globeMaterial().color.set('#0d2f52');
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.35;
  globe.controls().addEventListener('start', function () {
    globe.controls().autoRotate = false;
  });

  function smallCountryLabels() {
    return features.filter(function (f) { return f.haircuts; }).map(function (f) {
      var b = bounds(f.geometry);
      return { country: f.haircuts, name: f.properties.name, lat: (b[1] + b[3]) / 2, lng: (b[0] + b[2]) / 2,
               size: Math.max(b[2] - b[0], b[3] - b[1]) };
    }).filter(function (d) { return d.size < 1.6; });
  }

  // Bounds of the largest polygon, so far-flung islands don't move the dot.
  function bounds(geometry) {
    var polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    var best = null;
    polys.forEach(function (poly) {
      var b = [180, 90, -180, -90];
      poly[0].forEach(function (p) {
        b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]);
        b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]);
      });
      var area = (b[2] - b[0]) * (b[3] - b[1]);
      if (!best || area > best.area) best = { b: b, area: area };
    });
    return best.b;
  }

  function showTooltip(c) {
    if (!c) { tooltip.hidden = true; return; }
    tooltip.textContent = c.name + ' (' + c.events.length +
      (c.events.length === 1 ? ' haircut)' : ' haircuts)');
    tooltip.hidden = false;
  }

  function resize() {
    globe.width(window.innerWidth).height(window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // Pages

  document.getElementById('list-button').addEventListener('click', function () {
    location.hash = 'list';
  });

  var list = document.getElementById('country-list');
  countries.forEach(function (c) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + c.slug;
    a.textContent = c.name;
    var n = document.createElement('span');
    n.textContent = ' (' + c.events.length + ')';
    li.appendChild(a);
    li.appendChild(n);
    list.appendChild(li);
  });

  function openCountry(c) {
    location.hash = c.slug;
  }

  // Mirrors one country section of schnutz-haircuts.github.io/Haircuts:
  // the country as a heading, then each event's text followed by its photos.
  function renderCountry(c) {
    var page = document.getElementById('country-page');
    page.textContent = '';
    var h = document.createElement('h3');
    h.textContent = c.name;
    page.appendChild(h);
    c.events.forEach(function (e) {
      var p = document.createElement('p');
      p.textContent = e.text;
      page.appendChild(p);
      if (!e.photos.length) return;
      var table = document.createElement('div');
      table.className = 'rTable';
      e.photos.forEach(function (src) {
        var img = document.createElement('img');
        img.src = 'photos/' + src;
        img.alt = c.name;
        img.loading = 'lazy';
        img.addEventListener('click', function () { openViewer(img.src); });
        table.appendChild(img);
      });
      page.appendChild(table);
    });
  }

  var viewer = document.getElementById('viewer');
  function openViewer(src) {
    viewer.querySelector('img').src = src;
    viewer.hidden = false;
  }
  viewer.addEventListener('click', function () { viewer.hidden = true; });

  var views = {
    globe: document.getElementById('globe-view'),
    list: document.getElementById('list-view'),
    country: document.getElementById('country-view')
  };

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    if (name === 'globe') {
      globe.resumeAnimation();
      resize();
    } else {
      globe.pauseAnimation();
      window.scrollTo(0, 0);
    }
  }

  function route() {
    viewer.hidden = true;
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash === 'list') {
      show('list');
    } else if (bySlug[hash]) {
      renderCountry(bySlug[hash]);
      show('country');
    } else {
      showTooltip(null);
      show('globe');
    }
  }
  window.addEventListener('hashchange', route);
  route();

  // Called by the Android back button: close the photo first, then go back.
  window.haircutsBack = function () {
    if (!viewer.hidden) { viewer.hidden = true; return true; }
    if (location.hash && location.hash !== '#') { history.back(); return true; }
    return false;
  };
})();
