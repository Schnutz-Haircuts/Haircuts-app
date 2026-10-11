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
  document.getElementById('globe-title').textContent =
    "Schnutz' " + nEvents + ' international haircuts';
  document.getElementById('n-haircut').textContent = 'in ' + countries.length + ' countries';
  document.getElementById('n-visited').textContent = window.VISITED.length + ' countries visited';

  // Globe

  var features = topojson.feature(window.WORLD, window.WORLD.objects.countries).features;
  var visitedMap = {};
  window.VISITED.forEach(function (v) { visitedMap[v.map] = v.name; });
  features.forEach(function (f) {
    f.haircuts = byMapName[f.properties.name] || null;
    f.visited = !!visitedMap[f.properties.name];
    f.label = f.haircuts ? f.haircuts.name : visitedMap[f.properties.name] || unabbreviate(f.properties.name);
  });

  // The map data shortens some names ("Dem. Rep. Congo", "Solomon Is.").
  function unabbreviate(name) {
    var words = {
      'Is.': 'Islands', 'I.': 'Island', 'Rep.': 'Republic', 'Dem.': 'Democratic',
      'Eq.': 'Equatorial', 'Fr.': 'French', 'Br.': 'British', 'Ter.': 'Territory',
      'St.': 'Saint', 'S.': 'South', 'N.': 'North', 'W.': 'Western', 'Geo.': 'Georgia',
      'Herz.': 'Herzegovina', 'Barb.': 'Barbuda', 'Vin.': 'Vincent', 'Gren.': 'the Grenadines'
    };
    return name.split(' ').map(function (w) { return words[w] || w; }).join(' ');
  }

  // Same colours as the countries-visited map.
  var HAIRCUT = '#e08a0b';
  var HAIRCUT_HOVER = '#ffb340';
  var VISITED = '#f6cf8a';
  var OTHER = '#55636f';
  var hovered = null;

  var globeEl = document.getElementById('globe');
  var tooltip = document.getElementById('tooltip');

  var globe = Globe({ animateIn: false })(globeEl)
    .onGlobeReady(function () {
      // Give the countries a moment to draw before removing the message.
      setTimeout(function () { document.getElementById('loading').hidden = true; }, 600);
    })
    .backgroundColor('#000814')
    .showAtmosphere(true)
    .atmosphereColor('#7fb4ff')
    .polygonsData(features)
    .polygonCapColor(function (f) {
      if (!f.haircuts) return f.visited ? VISITED : OTHER;
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
      showTooltip(f);
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
    .labelColor(function (d) { return d.country ? HAIRCUT_HOVER : VISITED; })
    .labelResolution(2)
    .onLabelClick(function (d) { if (d.country) openCountry(d.country); })
    .pointOfView({ lat: 35, lng: 15, altitude: 2.3 });

  globe.globeMaterial().color.set('#0d2f52');
  globe.controls().autoRotate = true;
  globe.controls().autoRotateSpeed = 0.35;
  globe.controls().addEventListener('start', function () {
    globe.controls().autoRotate = false;
  });

  function smallCountryLabels() {
    return features.filter(function (f) { return f.haircuts || f.visited; }).map(function (f) {
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

  // Name of the country under the cursor, shown next to it.
  // Haircut countries also show the last photo of their oldest haircut.
  var tooltipImg = document.createElement('img');
  var tooltipText = document.createElement('div');
  tooltip.appendChild(tooltipImg);
  tooltip.appendChild(tooltipText);
  var mouse = { x: 0, y: 0 };

  function showTooltip(f) {
    if (!f) { tooltip.hidden = true; return; }
    var c = f.haircuts;
    tooltipText.textContent = c
      ? c.name + ' (' + c.events.length + (c.events.length === 1 ? ' haircut)' : ' haircuts)')
      : f.label + (f.visited ? ' (visited)' : '');
    if (c && c.thumb) {
      tooltipImg.src = 'thumbs/' + c.thumb;
      tooltipImg.hidden = false;
    } else {
      tooltipImg.removeAttribute('src');
      tooltipImg.hidden = true;
    }
    tooltip.hidden = false;
    placeTooltip();
  }

  // Next to the cursor, flipped to the other side near the window's edges.
  function placeTooltip() {
    var w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    var x = mouse.x + 14, y = mouse.y + 14;
    if (x + w > window.innerWidth - 4) x = mouse.x - 14 - w;
    if (y + h > window.innerHeight - 4) y = mouse.y - 14 - h;
    tooltip.style.left = Math.max(4, x) + 'px';
    tooltip.style.top = Math.max(4, y) + 'px';
  }
  tooltipImg.addEventListener('load', placeTooltip);
  globeEl.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!tooltip.hidden) placeTooltip();
  });
  globeEl.addEventListener('mouseleave', function () { showTooltip(null); });

  function resize() {
    globe.width(window.innerWidth).height(window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // Pages

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
      if (e.photos.length) page.appendChild(photoTable(e.photos, c.name));
    });
  }

  function photoTable(photos, alt) {
    var table = document.createElement('div');
    table.className = 'rTable';
    photos.forEach(function (src) {
      var img = document.createElement('img');
      img.src = 'photos/' + src;
      img.alt = alt;
      img.loading = 'lazy';
      img.addEventListener('click', function () { openViewer(img.src); });
      table.appendChild(img);
    });
    return table;
  }

  // Mirrors bydate.html: a numbered contents list of every haircut, oldest
  // first, as "year country - event", followed by each event with its photos.
  var bydateDone = false;
  function renderByDate() {
    if (bydateDone) return;
    bydateDone = true;
    var all = [];
    countries.forEach(function (c) {
      c.events.forEach(function (e) { all.push({ country: c, event: e }); });
    });
    all.sort(function (a, b) { return a.event.date < b.event.date ? -1 : a.event.date > b.event.date ? 1 : 0; });

    var toc = document.getElementById('bydate-toc');
    var contents = document.getElementById('bydate-contents');
    all.forEach(function (x) {
      var title = x.event.date.slice(0, 4) + ' ' + x.country.name + ' - ' + x.event.text;
      var h = document.createElement('h3');
      h.textContent = title;
      contents.appendChild(h);
      if (x.event.photos.length) contents.appendChild(photoTable(x.event.photos, x.country.name));

      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#bydate';
      a.textContent = title;
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        h.scrollIntoView();
        window.scrollBy(0, -60);
      });
      li.appendChild(a);
      toc.appendChild(li);
    });
  }

  // Mirrors index_footer.html: an Equal Earth map of every country visited,
  // then the list of their names.
  var visitedDone = false;
  function renderVisited() {
    if (visitedDone) return;
    visitedDone = true;
    var visited = window.VISITED;

    document.getElementById('visited-title').textContent =
      'Map of all ' + visited.length + ' countries / territories visited';
    document.getElementById('visited-list').textContent =
      visited.map(function (v) { return v.name; }).join(', ');

    var W = 960, H = 470;
    var projection = d3.geoEqualEarth().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });
    var path = d3.geoPath(projection);
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'World map of the countries visited');

    function add(tag, attrs) {
      var el = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      svg.appendChild(el);
      return el;
    }

    add('path', { d: path({ type: 'Sphere' }), class: 'ocean' });
    var dots = [];
    features.forEach(function (f) {
      var cls = f.haircuts ? 'haircut' : f.visited ? 'visited' : '';
      var el = add('path', { d: path(f), class: 'country ' + cls });
      if (f.haircuts) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function () { openCountry(f.haircuts); });
      }
      // Countries too small to see get a dot.
      if (cls && path.area(f) < 8) dots.push({ f: f, cls: cls });
    });
    dots.forEach(function (d) {
      var c = path.centroid(d.f);
      var el = add('circle', { cx: c[0], cy: c[1], r: 2.6, class: d.cls });
      if (d.f.haircuts) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function () { openCountry(d.f.haircuts); });
      }
    });

    document.getElementById('visited-map').appendChild(svg);
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
    visited: document.getElementById('visited-view'),
    bydate: document.getElementById('bydate-view'),
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
    } else if (hash === 'visited') {
      renderVisited();
      show('visited');
    } else if (hash === 'bydate') {
      renderByDate();
      show('bydate');
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
