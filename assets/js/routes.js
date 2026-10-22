    // Short hops are walked; anything longer uses public transport (JR/train).
    const WALK_MAX_KM = 2.5;
    const ROUTE_SERVERS = {
      walking: ['https://routing.openstreetmap.de/routed-foot/route/v1/walking/'],
      driving: ['https://router.project-osrm.org/route/v1/driving/']
    };
    const VALHALLA_ROUTE_URL = 'https://valhalla1.openstreetmap.de/route';
    const TRANSIT_API_URL = 'https://api.transit.ls8h.com/api/v1/guidance/plan';
    // Klook coach-tour days: hops are by tour bus/car, so they use the
    // OSRM driving profile instead of the public-transport planner.
    const TOUR_DAYS = new Set([4, 5]);

    // Public routing services rate-limit bursts and sometimes hang. Walking and
    // coach legs use Valhalla with OSRM as backup; longer hops use the public
    // transport planner. Cap each request and give each render a total budget,
    // then fall back to a dashed connector rather than leaving the map stuck.
    const ROUTE_MAX_CONCURRENT = 4;
    const ROUTE_FETCH_TIMEOUT_MS = 8000;
    // The transit planner answers in 5-13 s when it answers at all, and
    // occasionally hangs outright, so the old 8 s cap aborted most requests
    // mid-flight. Give it room, retry with a backoff, and keep its
    // concurrency lower than the road services so the queue does not turn
    // into a pile of simultaneous slow queries.
    const TRANSIT_FETCH_TIMEOUT_MS = 18000;
    const TRANSIT_MAX_CONCURRENT = 3;
    const TRANSIT_RETRY_DELAYS_MS = [600, 1500];
    let routeDeadline = 0;
    let routeActive = 0;
    const routeQueue = [];

    // Dedicated limiter for the transit planner - it is far slower than the
    // road routers and falls over when hit with parallel requests.
    let transitActive = 0;
    const transitQueue = [];

    async function withTransitSlot(task) {
      if (transitActive >= TRANSIT_MAX_CONCURRENT) {
        await new Promise(resolve => transitQueue.push(resolve));
      }
      transitActive++;
      try {
        return await task();
      } finally {
        transitActive--;
        const next = transitQueue.shift();
        if (next) next();
      }
    }

    // Background warm-up gets its own single slot so it never queues ahead
    // of a day the user is actually waiting for.
    let prefetchActive = 0;
    const prefetchQueue = [];

    async function withPrefetchSlot(task) {
      if (prefetchActive >= 1) {
        await new Promise(resolve => prefetchQueue.push(resolve));
      }
      prefetchActive++;
      try {
        return await task();
      } finally {
        prefetchActive--;
        const next = prefetchQueue.shift();
        if (next) next();
      }
    }

    function beginRouteBudget(ms) {
      routeDeadline = Date.now() + ms;
    }

    function directRoute(coordinates) {
      return coordinates.map(c => [c[1], c[0]]);
    }
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function decodePolyline6(encoded) {
      let index = 0, lat = 0, lng = 0;
      const points = [];
      while (index < encoded.length) {
        let result = 0, shift = 0, byte;
        do {
          byte = encoded.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        lat += (result & 1) ? ~(result >> 1) : (result >> 1);

        result = 0; shift = 0;
        do {
          byte = encoded.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        lng += (result & 1) ? ~(result >> 1) : (result >> 1);

        points.push([
          Math.round((lat / 1000000) * 100000) / 100000,
          Math.round((lng / 1000000) * 100000) / 100000
        ]);
      }
      return points;
    }

    async function fetchValhallaRoute(coordinates, mode) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), ROUTE_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(VALHALLA_ROUTE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locations: coordinates.map(c => ({ lon: c[0], lat: c[1] })),
            costing: mode === 'walking' ? 'pedestrian' : 'auto'
          }),
          signal: controller.signal
        });
        if (!response.ok) return null;
        const data = await response.json();
        const legs = data.trip && data.trip.legs;
        if (!legs || !legs.length) return null;
        const path = [];
        for (const leg of legs) {
          const points = decodePolyline6(leg.shape || '');
          if (!points.length) continue;
          if (path.length) points.shift();
          path.push(...points);
        }
        return path.length > 1 ? path : null;
      } catch (e) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    const MONTH_NUMBER = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

    function serviceDateForDay(day) {
      const match = /^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})/.exec(day.date || '');
      if (!match) return '';
      const month = MONTH_NUMBER[match[1]];
      if (!month) return '';
      return `${match[3]}${String(month).padStart(2, '0')}${String(match[2]).padStart(2, '0')}`;
    }

    function parseStopTime(value) {
      const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(value || '').trim());
      if (!match) return '';
      let hours = parseInt(match[1], 10);
      const suffix = (match[3] || '').toUpperCase();
      if (suffix === 'PM' && hours < 12) hours += 12;
      if (suffix === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${match[2]}`;
    }

    function compactRouteStops(stops) {
      const compact = [];
      stops.forEach(stop => {
        const last = compact[compact.length - 1];
        if (!last || calculateHaversineDistance(last.lat, last.lng, stop.lat, stop.lng) > 0.03) {
          compact.push(stop);
        }
      });
      return compact;
    }

    function polylineLengthKm(points) {
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        total += parseFloat(calculateHaversineDistance(
          points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]
        ));
      }
      return total;
    }

    // A transit itinerary far longer than the straight-line hop is not a
    // real route. The planner's Japan dataset sometimes links two cities
    // through a completely unrelated rail corridor - Kobe -> Namba comes back
    // as 180 km via Kyoto and Nara for a 28 km hop. Anything past this
    // multiple of the direct distance is treated as a broken itinerary and
    // replaced with the road corridor.
    function transitDetourLimit(straightKm) {
      // Metro and loop lines genuinely double back on short hops - Namba to
      // Umeda is 4.6 km as the crow flies but 12 km of Midosuji Line - so
      // only apply the tight limit to long hops where a detour is implausible.
      return straightKm >= 15 ? 2 : 3;
    }

    async function requestTransitPlan(params) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TRANSIT_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(`${TRANSIT_API_URL}?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) return null;
        return await response.json();
      } catch (e) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    async function fetchTransitRoute(fromStop, toStop, day) {
      const date = serviceDateForDay(day);
      const time = parseStopTime(fromStop.time);
      if (!date || !time) return null;

      const cacheKey = `transit:${date}:${time}:${fromStop.lat},${fromStop.lng};${toStop.lat},${toStop.lng}`;
      if (Object.prototype.hasOwnProperty.call(transitCache, cacheKey)) return transitCache[cacheKey];

      const params = new URLSearchParams({
        from: `geo:${fromStop.lat},${fromStop.lng}`,
        to: `geo:${toStop.lat},${toStop.lng}`,
        date,
        time,
        type: 'departure',
        numItineraries: '4'
      });
      // The planner is slow and flaky: it routinely needs 5-8 s and sometimes
      // never answers at all. Try again with a short backoff before giving up,
      // and respect the render budget so a retry cannot outlive the map view.
      let data = null;
      for (let attempt = 0; attempt <= TRANSIT_RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) await sleep(TRANSIT_RETRY_DELAYS_MS[attempt - 1]);
        if (routeDeadline && Date.now() > routeDeadline) break;
        const attemptData = await requestTransitPlan(params);
        if (attemptData && attemptData.options && attemptData.options.length) {
          data = attemptData;
          break;
        }
      }
      if (!data) {
        transitCache[cacheKey] = null;
        persistRouteCache();
        return null;
      }

      try {
        // Build every candidate path, then keep the shortest one.

        const candidates = [];
        for (const option of data.options || []) {
          const path = [];
          (option.map?.segments || []).forEach(segment => {
            (segment.polyline || []).forEach(point => {
              const next = [point.lat, point.lon];
              const last = path[path.length - 1];
              if (!last || last[0] !== next[0] || last[1] !== next[1]) path.push(next);
            });
          });
          if (path.length < 2) continue;

          const transitLegs = (option.journey?.legs || []).filter(leg => leg.kind === 'transit');
          const last = path[path.length - 1];
          const detour = calculateHaversineDistance(last[0], last[1], toStop.lat, toStop.lng);
          const duration = typeof option.duration === 'number' ? option.duration : Infinity;
          candidates.push({
            path,
            transitLegs: transitLegs.length,
            modes: [...new Set(transitLegs.map(leg => leg.mode).filter(Boolean))],
            routes: [...new Set(transitLegs.map(leg => leg.routeName).filter(Boolean))].slice(0, 3),
            _length: polylineLengthKm(path),
            _detour: detour,
            _duration: duration
          });
        }

        // Rank by how long the path really is. The previous score measured
        // the gap between the polyline's last point and the destination - every
        // candidate ends AT the destination, so that score was always ~0 and
        // the sort did nothing. The planner's first option then won, which
        // for Kobe -> Namba is the itinerary that runs north through Kyoto.
        //
        // The "walk only" pseudo-option is a bare straight line with no
        // transit legs; on length alone it would always win, so drop it
        // whenever a real transit itinerary exists.
        const withTransit = candidates.filter(candidate => candidate.transitLegs > 0);
        const pool = withTransit.length ? withTransit : candidates;
        pool.sort((a, b) =>
          (a._length - b._length) || (a._detour - b._detour) || (a._duration - b._duration));
        const best = pool[0];
        if (!best) {
          transitCache[cacheKey] = null;
          persistRouteCache();
          return null;
        }

        // Even the shortest candidate can still be nonsense - flag it so the
        // caller can swap in the road corridor instead of drawing a detour.
        // Short hops and flight legs are left alone: a metro loop is allowed
        // to wander, and a road route makes no sense across the sea.
        const directKm = parseFloat(calculateHaversineDistance(
          fromStop.lat, fromStop.lng, toStop.lat, toStop.lng
        ));
        const detourRatio = directKm > 1 ? best._length / directKm : 1;
        const detoured = best.transitLegs > 0 && directKm >= 8 && directKm <= 200
          && detourRatio > transitDetourLimit(directKm);

        const result = {
          path: best.path,
          transitLegs: best.transitLegs,
          modes: best.modes,
          routes: best.routes,
          detoured
        };
        transitCache[cacheKey] = result;
        persistRouteCache();
        return result;
      } catch (e) {
         transitCache[cacheKey] = null;
         persistRouteCache();
         return null;
      }
    }


    async function withRouteSlot(task) {
      if (routeActive >= ROUTE_MAX_CONCURRENT) {
        await new Promise(resolve => routeQueue.push(resolve));
      }
      routeActive++;
      try {
        return await task();
      } finally {
        routeActive--;
        const next = routeQueue.shift();
        if (next) next();
      }
    }

    // The transit planner's first request for a given pair is slow (5-8 s)
    // but later ones answer in well under a second, and the answers are
    // cached. Warming every leg in the background means opening a day is
    // instant instead of waiting on a cold planner.
    async function prefetchTransitRoutes() {
      const legs = [];
      daysData.forEach(day => {
        if (TOUR_DAYS.has(day.id)) return;
        const stops = compactRouteStops(day.stops);
        for (let i = 0; i < stops.length - 1; i++) {
          const a = stops[i];
          const b = stops[i + 1];
          const straight = parseFloat(calculateHaversineDistance(a.lat, a.lng, b.lat, b.lng));
          if (straight <= WALK_MAX_KM) continue;
          if (straight > 200) continue;   // flight leg - drawn as an arc
          legs.push([a, b, day]);
        }
      });

      beginRouteBudget(300000);
      for (const [a, b, day] of legs) {
        const result = await withPrefetchSlot(() => fetchTransitRoute(a, b, day));
        if (!result) {
          // A transient failure must not poison the cache - drop the entry so
          // a later click retries it.
          const date = serviceDateForDay(day);
          const time = parseStopTime(a.time);
          if (date && time) {
            delete transitCache[`transit:${date}:${time}:${a.lat},${a.lng};${b.lat},${b.lng}`];
          }
        }
        await sleep(250);
      }
    }

    async function fetchOSRMRoute(coordinates, mode = 'walking') {
      const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
      const cacheKey = `${mode}:${coordString}`;
      if (routeCache[cacheKey]) return routeCache[cacheKey];
      if (routeDeadline && Date.now() > routeDeadline) return directRoute(coordinates);

      const valhallaCoords = await withRouteSlot(async () => {
        await sleep(120);
        return fetchValhallaRoute(coordinates, mode);
      });
      if (valhallaCoords) {
        routeCache[cacheKey] = valhallaCoords;
        persistRouteCache();
        return valhallaCoords;
      }
      if (routeDeadline && Date.now() > routeDeadline) return directRoute(coordinates);

      for (const base of ROUTE_SERVERS[mode] || ROUTE_SERVERS.walking) {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (routeDeadline && Date.now() > routeDeadline) return directRoute(coordinates);
          let data = null;
          try {
            data = await withRouteSlot(async () => {
              await sleep(120);
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), ROUTE_FETCH_TIMEOUT_MS);
              try {
                const response = await fetch(`${base}${coordString}?overview=full&geometries=geojson`, { signal: controller.signal });
                if (response.status === 429) return { rateLimited: true };
                return await response.json();
              } finally {
                clearTimeout(timer);
              }
            });
          } catch (err) {
            console.warn('OSRM route fallback:', err);
            break;
          }

          if (data.rateLimited) {
            await sleep(1200 + Math.random() * 800);
            continue;
          }
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const leafletCoords = data.routes[0].geometry.coordinates.map(c => [
              Math.round(c[1] * 100000) / 100000,
              Math.round(c[0] * 100000) / 100000
            ]);
            routeCache[cacheKey] = leafletCoords;
            persistRouteCache();
            return leafletCoords;
          }
          break;
        }
      }
      return directRoute(coordinates);
    }

    function segmentMode(a, b, day) {
      const distance = parseFloat(calculateHaversineDistance(a.lat, a.lng, b.lat, b.lng));
      if (distance <= WALK_MAX_KM) return 'walking';
      if (TOUR_DAYS.has(day?.id)) return 'tour';
      return 'transit';
    }

    async function fetchRouteForStops(inputStops, day, onSegment) {
      const stops = compactRouteStops(inputStops);
      if (stops.length < 2) return { segments: [], transitLegs: 0, tourLegs: 0, modes: [] };

      // Merge consecutive walking or coach hops into one request. Transit hops
      // stay separate because each one has its own departure time and route.
      const groups = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const mode = segmentMode(stops[i], stops[i + 1], day);
        const last = groups[groups.length - 1];
        if (last && last.mode === mode && mode !== 'transit') {
          last.stops.push(stops[i + 1]);
          last.coords.push([stops[i + 1].lng, stops[i + 1].lat]);
        } else {
          groups.push({
            mode,
            stops: [stops[i], stops[i + 1]],
            coords: [[stops[i].lng, stops[i].lat], [stops[i + 1].lng, stops[i + 1].lat]]
          });
        }
      }

      const results = await Promise.all(groups.map(async group => {
        let segment;
        if (group.mode === 'transit') {
          const transit = await withTransitSlot(() => fetchTransitRoute(group.stops[0], group.stops[1], day));
          if (transit) {
            if (transit.detoured) {
              // The planner linked the two stops through the wrong rail
              // corridor (Kobe -> Namba via Kyoto). Draw the road corridor
              // instead: the expressway runs beside the railway, so the line
              // stays geographically honest instead of detouring north.
              const path = await fetchOSRMRoute(group.coords, 'driving');
              segment = { mode: 'transit', path, transitLegs: transit.transitLegs, modes: transit.modes, fallback: true };
            } else {
              segment = { mode: 'transit', path: transit.path, transitLegs: transit.transitLegs, modes: transit.modes };
            }
          } else {
            // The planner gave up. Fall back to the road corridor rather than
            // a straight line - the expressway runs beside the railway, so
            // the drawn line stays geographically honest.
            const path = await fetchOSRMRoute(group.coords, 'driving');
            segment = { mode: 'transit', path, transitLegs: 0, fallback: true, modes: [] };
          }
        } else if (group.mode === 'tour') {
          const path = await withRouteSlot(() => fetchOSRMRoute(group.coords, 'driving'));
          segment = { mode: 'tour', path, transitLegs: 0, modes: [] };
        } else {
          const path = await withRouteSlot(() => fetchOSRMRoute(group.coords, group.mode));
          segment = { mode: group.mode, path, transitLegs: 0, modes: [] };
        }
        // Hand the finished leg over straight away instead of waiting for the
        // slowest leg in the day - the map fills in progressively.
        if (onSegment && segment.path.length > 1) onSegment(segment);
        return segment;
      }));

      const modes = [...new Set(results.flatMap(result => result.modes || []))];
      return {
        segments: results.filter(result => result.path.length > 1),
        transitLegs: results.reduce((sum, result) => sum + (result.transitLegs || 0), 0),
        tourLegs: results.filter(result => result.mode === 'tour').length,
        modes
      };
    }
