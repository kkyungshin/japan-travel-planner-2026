    // Initialize Leaflet Map
    const map = L.map('map', { zoomControl: false }).setView([38.0, 137.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);

    let currentLayerGroup = L.layerGroup().addTo(map);
    let selectedDayId = null;
    const routeCache = {};
    const ROUTE_CACHE_KEY = 'plannerRouteCache_v3';
    const transitCache = {};
    // v2: the old cache holds itineraries picked with the broken
    // endpoint-detour ranking (Kobe -> Namba via Kyoto).
    const TRANSIT_CACHE_KEY = 'plannerTransitCache_v2';
    const LEGACY_TRANSIT_CACHE_KEYS = ['plannerTransitCache_v1'];
    try {
      LEGACY_TRANSIT_CACHE_KEYS.forEach(key => localStorage.removeItem(key));
      const savedRoutes = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
      if (savedRoutes && typeof savedRoutes === 'object') Object.assign(routeCache, savedRoutes);
      const savedTransit = JSON.parse(localStorage.getItem(TRANSIT_CACHE_KEY) || '{}');
      if (savedTransit && typeof savedTransit === 'object') Object.assign(transitCache, savedTransit);
    } catch (e) {}
    let routeCacheSaveTimer = null;
    function persistRouteCache() {
      clearTimeout(routeCacheSaveTimer);
      routeCacheSaveTimer = setTimeout(() => {
        try {
          localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(routeCache));
          const persistedTransit = {};
          for (const key in transitCache) {
            if (transitCache[key]) persistedTransit[key] = transitCache[key];
          }
          localStorage.setItem(TRANSIT_CACHE_KEY, JSON.stringify(persistedTransit));
        } catch (e) {
          try {
            localStorage.removeItem(ROUTE_CACHE_KEY);
            localStorage.removeItem(TRANSIT_CACHE_KEY);
          } catch (_) {}
        }
      }, 800);
    }

    function createCustomMarker(number, color) {
      return L.divIcon({
        className: 'custom-pin',
        html: `<div class="custom-number-marker" style="background-color: ${color}; width: 26px; height: 26px;">${number}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }

    // Distance Calculation Formula (Haversine in km)
    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return (R * c).toFixed(1);
    }

    function locMsg(en, zh) { return currentLang === 'en' ? en : zh; }

    // ---- Today (JST) ----

    function getJstNow() {
      const now = new Date();
      return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 9 * 3600000);
    }

    function parseTimeToMinutes(str) {
      const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(str).trim());
      if (!m) return null;
      let h = parseInt(m[1], 10) % 12;
      if (m[3].toUpperCase() === 'PM') h += 12;
      return h * 60 + parseInt(m[2], 10);
    }

    function computeTodayState() {
      const jst = getJstNow();
      const today = new Date(jst.getFullYear(), jst.getMonth(), jst.getDate());
      const start = new Date(2026, 9, 23);
      const diff = Math.round((today - start) / 86400000);
      const dayId = diff >= 0 && diff <= 9 ? diff + 1 : null;

      let nextIdx = null;
      if (dayId) {
        const day = daysData.find(d => d.id === dayId);
        const nowMin = jst.getHours() * 60 + jst.getMinutes();
        const idx = day.stops.findIndex(s => {
          const t = parseTimeToMinutes(s.time);
          return t !== null && t >= nowMin;
        });
        nextIdx = idx >= 0 ? idx : null;
      }
      return { dayId, nextIdx };
    }

    function applyNextStopBadges() {
      const nextKey = todayState.dayId !== null && todayState.nextIdx !== null
        ? `${todayState.dayId}-${todayState.nextIdx}`
        : null;

      document.querySelectorAll('.next-stop-badge').forEach(el => {
        el.classList.toggle('hidden', el.dataset.stop !== nextKey);
      });
      document.querySelectorAll('.stop-row').forEach(el => {
        el.classList.toggle('next-stop-row', el.dataset.row === nextKey);
      });
    }

    function refreshToday() {
      const prevDay = todayState.dayId;
      todayState = computeTodayState();

      if (todayState.dayId !== prevDay) {
        if (todayState.dayId) {
          selectDay(todayState.dayId, { scroll: false });
        } else if (selectedDayId !== null) {
          selectedDayId = null;
          renderItinerary(getCurrentFilter());
          renderAllRoutesOnMap();
        }
        return;
      }
      applyNextStopBadges();
    }

    // ---- Weather per day (Open-Meteo, no key) ----

    const WMO_CODES = {
      0: ['Clear sky', 'fa-sun', '#fbbf24'],
      1: ['Mainly clear', 'fa-sun', '#fbbf24'],
      2: ['Partly cloudy', 'fa-cloud-sun', '#e2e8f0'],
      3: ['Overcast', 'fa-cloud', '#94a3b8'],
      45: ['Fog', 'fa-smog', '#94a3b8'],
      48: ['Fog', 'fa-smog', '#94a3b8'],
      51: ['Drizzle', 'fa-cloud-rain', '#7dd3fc'],
      53: ['Drizzle', 'fa-cloud-rain', '#7dd3fc'],
      55: ['Drizzle', 'fa-cloud-rain', '#7dd3fc'],
      56: ['Freezing drizzle', 'fa-cloud-rain', '#7dd3fc'],
      57: ['Freezing drizzle', 'fa-cloud-rain', '#7dd3fc'],
      61: ['Light rain', 'fa-cloud-rain', '#60a5fa'],
      63: ['Rain', 'fa-cloud-rain', '#60a5fa'],
      65: ['Heavy rain', 'fa-cloud-showers-heavy', '#3b82f6'],
      66: ['Freezing rain', 'fa-cloud-rain', '#60a5fa'],
      67: ['Freezing rain', 'fa-cloud-rain', '#60a5fa'],
      71: ['Light snow', 'fa-snowflake', '#bae6fd'],
      73: ['Snow', 'fa-snowflake', '#bae6fd'],
      75: ['Heavy snow', 'fa-snowflake', '#e0f2fe'],
      77: ['Snow grains', 'fa-snowflake', '#bae6fd'],
      80: ['Showers', 'fa-cloud-showers-heavy', '#60a5fa'],
      81: ['Showers', 'fa-cloud-showers-heavy', '#3b82f6'],
      82: ['Heavy showers', 'fa-cloud-showers-heavy', '#3b82f6'],
      85: ['Snow showers', 'fa-snowflake', '#bae6fd'],
      86: ['Snow showers', 'fa-snowflake', '#e0f2fe'],
      95: ['Thunderstorm', 'fa-cloud-bolt', '#f59e0b'],
      96: ['Thunderstorm', 'fa-cloud-bolt', '#f59e0b'],
      99: ['Thunderstorm', 'fa-cloud-bolt', '#f59e0b']
    };

    const WEATHER_TTL_MS = 30 * 60 * 1000;

    function weatherDateForDayId(id) {
      const d = new Date(2026, 9, 23 + (id - 1));
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    async function loadWeather() {
      try {
        const cached = JSON.parse(localStorage.getItem('wxCache_v2') || 'null');
        if (cached && Date.now() - cached.at < WEATHER_TTL_MS) {
          weatherByDay = cached.data || {};
          applyWeatherUI();
          return;
        }
      } catch (e) {}

      try {
        // Anchor each day's forecast to the stop where the day is actually
        // spent (mid-itinerary), not the departure point - Day 7 starts in
        // Sapporo but is an Osaka/Kobe day.
        const anchors = daysData.map(d => d.stops[Math.floor((d.stops.length - 1) / 2)] || d.stops[0]);
        const lats = anchors.map(s => s.lat).join(',');
        const lngs = anchors.map(s => s.lng).join(',');
        const url = 'https://api.open-meteo.com/v1/forecast' +
          `?latitude=${lats}&longitude=${lngs}` +
          '&daily=weather_code,temperature_2m_max,temperature_2m_min,' +
          'apparent_temperature_max,apparent_temperature_min,precipitation_probability_max' +
          '&timezone=Asia%2FTokyo&start_date=2026-10-23&end_date=2026-11-01';
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [data];
        const next = {};

        daysData.forEach((day, i) => {
          const series = list[i];
          if (!series || !series.daily || !Array.isArray(series.daily.time)) return;
          const idx = series.daily.time.indexOf(weatherDateForDayId(day.id));
          if (idx === -1) return;
          const tmax = series.daily.temperature_2m_max[idx];
          const tmin = series.daily.temperature_2m_min[idx];
          if (tmax === null || tmin === null) return;
          next[day.id] = {
            code: series.daily.weather_code[idx],
            tmax,
            tmin,
            tmaxApp: series.daily.apparent_temperature_max ? series.daily.apparent_temperature_max[idx] : null,
            tminApp: series.daily.apparent_temperature_min ? series.daily.apparent_temperature_min[idx] : null,
            pop: series.daily.precipitation_probability_max[idx]
          };
        });

        if (Object.keys(next).length === 0) return;
        weatherByDay = next;
        try {
          localStorage.setItem('wxCache_v2', JSON.stringify({ at: Date.now(), data: weatherByDay }));
        } catch (e) {}
        applyWeatherUI();
        // The per-day model data feeds the weather panel for dates beyond
        // JMA's 7-day window, so refresh the panel now that it has landed.
        if (weatherSelectedCode) selectWeatherFor(null, null, weatherSelectedCode, weatherSelectedDay);
      } catch (e) {
        console.warn('Weather fetch failed:', e);
      }
    }

    function applyWeatherUI() {
      daysData.forEach(day => {
        const el = document.getElementById(`wx-${day.id}`);
        if (!el) return;
        const w = weatherByDay[day.id];
        if (!w) {
          el.className = 'hidden';
          el.innerHTML = '';
          return;
        }
        const meta = WMO_CODES[w.code] || WMO_CODES[3];
        el.className = 'text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono flex items-center gap-1 flex-shrink-0';
        const feels = w.tminApp != null && w.tmaxApp != null
          ? ` · feels ${Math.round(w.tminApp)}°C to ${Math.round(w.tmaxApp)}°C` : '';
        el.title = `${meta[0]} · ${Math.round(w.tmin)}°C to ${Math.round(w.tmax)}°C${feels}` +
          (w.pop != null ? ` · ${Math.round(w.pop)}% precipitation` : '');
        el.innerHTML = `<i class="fa-solid ${meta[1]}" style="color:${meta[2]}"></i>` +
          `${Math.round(w.tmin)}°–${Math.round(w.tmax)}°` +
          (w.pop != null ? ` <span class="text-blue-300">${Math.round(w.pop)}%</span>` : '');
      });
    }

    function resetLocateBtn() {
      document.getElementById('locateBtnIcon').classList.remove('animate-spin');
      const btn = document.getElementById('locateBtn');
      const located = !!userLocation && locationInterval !== 0;
      btn.classList.toggle('bg-blue-600/90', located);
      btn.classList.toggle('hover:bg-blue-500', located);
      btn.classList.toggle('border-blue-500/50', located);
      btn.classList.toggle('bg-white', !located);
      btn.classList.toggle('hover:bg-slate-100', !located);
      btn.classList.toggle('border-slate-300', !located);
      document.getElementById('locateBtnIcon').classList.toggle('text-white', located);
      document.getElementById('locateBtnIcon').classList.toggle('text-blue-600', !located);
    }

    // Patch every per-stop "x km" badge in the sidebar from the latest fix.
    // renderItinerary() only rebuilds cards on day/filter changes, so live
    // tracking must update the badges in place - otherwise they go stale
    // after the first fix.
    function refreshStopDistances() {
      if (!userLocation) return;
      const badges = document.querySelectorAll('.stop-dist[data-stop-lat]');
      if (!badges.length) {
        renderItinerary(getCurrentFilter());
        return;
      }
      badges.forEach(el => {
        const lat = parseFloat(el.dataset.stopLat);
        const lng = parseFloat(el.dataset.stopLng);
        const dist = calculateHaversineDistance(userLocation.lat, userLocation.lng, lat, lng);
        el.innerHTML = `<i class="fa-solid fa-location-arrow text-[8px] mr-1"></i>${dist} km`;
      });
    }

    function renderUserLocationUI(center) {
      resetLocateBtn();

      const banner = document.getElementById('locationBanner');
      banner.classList.remove('hidden');
      const coordsEl = document.getElementById('userCoordsText');
      coordsEl.style.color = '';
      const acc = userLocation.accuracy > 0 ? ` ±${Math.round(userLocation.accuracy)}m` : '';
      coordsEl.innerText = `GPS: ${userLocation.lat.toFixed(3)}, ${userLocation.lng.toFixed(3)}${acc}`;

      const target = [userLocation.lat, userLocation.lng];
      if (userMarker) {
        userMarker.setLatLng(target);
      } else {
        const userIcon = L.divIcon({
          className: 'custom-pin',
          html: `<div class="user-location-marker"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        userMarker = L.marker(target, { icon: userIcon }).addTo(map)
          .bindPopup(`<b>${locMsg('Your Current Location', '您的当前位置')}</b>`);
      }

      // Every accepted fix refreshes the sidebar distances, not just the
      // deliberate recenter press.
      refreshStopDistances();

      let nearest = Infinity;
      daysData.forEach(d => d.stops.forEach(s => {
        nearest = Math.min(nearest, parseFloat(calculateHaversineDistance(userLocation.lat, userLocation.lng, s.lat, s.lng)));
      }));
      document.getElementById('locationDistanceSummary').innerText =
        locMsg(`Nearest stop: ${nearest.toFixed(1)} km`, `最近行程点：${nearest.toFixed(1)} 公里`);

      // Follow the fix: always recentre on a deliberate press; otherwise pan
      // when the new pin has left the visible map (simulator jump / walking
      // off-screen). Never zoom out below city level on the first fix.
      const inView = map.getBounds().pad(-0.15).contains(L.latLng(target[0], target[1]));
      if (center || !inView) {
        map.setView(target, center ? Math.max(map.getZoom(), 12) : Math.max(map.getZoom(), 11));
      }
    }

    function flushPendingPosition() {
      if (!pendingCoords) return;

      // First fix: accept any GPS-grade reading within 300 m immediately.
      // Coarser readings (cell/wi-fi triangulation) get at most 6 s to be
      // beaten by the antenna - long enough to lock, short enough that the
      // button never feels stuck.
      const accuracyLimit = 300; // metres
      if (userLocation === null && pendingCoords.accuracy > accuracyLimit &&
          Date.now() - locationWatchStartedAt < 6000) {
        if (!flushTimer) {
          flushTimer = setTimeout(() => { flushTimer = null; flushPendingPosition(); }, 700);
        }
        return;
      }

      // Once the dot is on the map, a materially better fix may jump the
      // update queue (at most every 3 s) so the marker sharpens quickly
      // instead of waiting for the next scheduled interval.
      const sharpened = userLocation !== null &&
        pendingCoords.accuracy < userLocation.accuracy * 0.5 &&
        Date.now() - lastLocationApplied >= 3000;

      const wait = locationInterval * 1000 - (Date.now() - lastLocationApplied);
      if (wait > 0 && !sharpened) {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(() => { flushTimer = null; flushPendingPosition(); }, wait);
        return;
      }
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      userLocation = pendingCoords;
      pendingCoords = null;
      lastLocationApplied = Date.now();
      renderUserLocationUI(firstLocationFix);
      firstLocationFix = false;
    }

    function handleGeoPosition(position) {
      if (locationInterval === 0) return;
      // Hold the newest reading and apply it as soon as the interval
      // allows, so a throttled fix is deferred rather than dropped.
      pendingCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      flushPendingPosition();
    }

    function handleGeoFailure(error) {
      console.error('Geolocation failed:', error);

      if (error.code === error.PERMISSION_DENIED) {
        if (locationWatcher !== null) {
          navigator.geolocation.clearWatch(locationWatcher);
          locationWatcher = null;
        }
        stopLocationPolling();
        showLocationError(locMsg(
          'Location permission denied.',
          '定位权限被拒绝。请在浏览器设置中开启权限。'
        ));
        return;
      }

      let errMsg = locMsg('Unable to fetch location. Please try again.', '无法获取定位，请重试。');
      if (error.code === error.POSITION_UNAVAILABLE) {
        errMsg = locMsg('Location unavailable. Turn on GPS.', '无法获取位置，请开启手机 GPS。');
      } else if (error.code === error.TIMEOUT) {
        errMsg = locMsg('Waiting for a GPS signal...', '正在等待 GPS 信号...');
      }

      // Transient errors leave the watcher running - it self-heals on the
      // next fix, and renderUserLocationUI clears the error styling.
      if (!userLocation) showLocationError(errMsg);
    }

    // watchPosition only fires when the OS decides the position changed, so
    // a simulator edit (or a browser that caches fixes) can stall updates.
    // Actively re-read on the configured interval as well, so the Settings
    // frequency always drives refresh rate.
    function stopLocationPolling() {
      if (locationPollTimer) {
        clearInterval(locationPollTimer);
        locationPollTimer = null;
      }
    }

    function startLocationPolling() {
      stopLocationPolling();
      if (locationInterval === 0 || locationWatcher === null) return;
      locationPollTimer = setInterval(() => {
        if (locationInterval === 0 || locationWatcher === null) {
          stopLocationPolling();
          return;
        }
        navigator.geolocation.getCurrentPosition(
          handleGeoPosition,
          handleGeoFailure,
          { enableHighAccuracy: true, timeout: Math.max(5000, locationInterval * 1000), maximumAge: 0 }
        );
      }, locationInterval * 1000);
    }

    function requestUserLocation() {
      const locateIcon = document.getElementById('locateBtnIcon');

      if (!('geolocation' in navigator)) {
        showLocationError(locMsg('Geolocation is not supported by this browser.', '您的浏览器不支持地理定位服务。'));
        return;
      }

      const originOk = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!originOk) {
        showLocationError(locMsg(
          'Location requires HTTPS. Please host this file on an HTTPS server.',
          '定位服务仅支持在 HTTPS 环境下运行，请在安全的主机服务器上访问此页面。'
        ));
        return;
      }

      // Already tracking: just recentre on the last known fix.
      if (locationWatcher !== null) {
        if (userLocation) renderUserLocationUI(true);
        return;
      }

      if (locationInterval === 0) {
        showLocationError(locMsg(
          'Location tracking is switched off in Settings.',
          '设置中已关闭位置追踪。'
        ));
        return;
      }

      locateIcon.classList.add('animate-spin');

      // maximumAge lets an existing recent fix be shown instantly while the
      // watch keeps refining it; enableHighAccuracy still asks the GPS to
      // take over as soon as it locks.
      const watchOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 };
      firstLocationFix = true;
      locationWatchStartedAt = Date.now();

      locationWatcher = navigator.geolocation.watchPosition(
        handleGeoPosition,
        handleGeoFailure,
        watchOptions
      );
      startLocationPolling();
    }

    // v2 keys: the old values are ignored so a fresh visit lands on the
    // intended defaults - English, light mode, location off.
    const THEME_KEY = 'plannerTheme_v2';
    const LANG_KEY = 'uiLang_v2';
    const LEGACY_SETTING_KEYS = ['plannerTheme', 'uiLang'];

    function getTheme() {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(theme, persist = false) {
      const next = theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      if (persist) {
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      }
      syncSettingsUI();
    }

    function setTheme(theme) {
      applyTheme(theme, true);
    }

    function loadSettings() {
      try {
        LEGACY_SETTING_KEYS.forEach(key => localStorage.removeItem(key));
        const i = parseInt(localStorage.getItem('locInterval'), 10);
        locationInterval = LOCATION_INTERVALS.includes(i) ? i : 30;
        const l = localStorage.getItem(LANG_KEY);
        if (l === 'en' || l === 'zh') currentLang = l;
        const t = localStorage.getItem(THEME_KEY);
        if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
      } catch (e) {}
      applyTheme(getTheme());
    }

    function openSettings() {
      document.getElementById('settingsModal').classList.remove('hidden');
      syncSettingsUI();
    }

    function closeSettings() {
      document.getElementById('settingsModal').classList.add('hidden');
    }

    function syncSettingsUI() {
      const t = document.getElementById('settingsTitle');
      if (!t) return;
      t.innerText = locMsg('Settings', '设置');
      document.getElementById('settingsThemeLabel').innerText = locMsg('Appearance', '外观');
      document.getElementById('settingsLangLabel').innerText = locMsg('Language', '语言');
      document.getElementById('settingsFreqLabel').innerText = locMsg('Location Update Frequency', '位置更新频率');
      document.getElementById('settingsFreqNote').innerText = locMsg(
        'How often the map marker refreshes while you move. Longer intervals save battery.',
        '移动时地图标记的刷新频率。间隔越长越省电。'
      );
      document.getElementById('settingsLocState').innerText =
        locationWatcher !== null && userLocation
          ? locMsg('Currently tracking', '正在追踪')
          : locMsg('Not tracking', '未追踪');

      document.querySelectorAll('.setting-theme-btn').forEach(btn => {
        const on = btn.dataset.themeOpt === getTheme();
        btn.className = 'setting-theme-btn px-3 py-2 rounded-xl text-xs font-semibold transition border ' +
          (on ? 'bg-red-600 text-white border-red-500 shadow'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700');
      });

      document.querySelectorAll('.setting-lang-btn').forEach(btn => {
        const on = btn.dataset.lang === currentLang;
        btn.className = 'setting-lang-btn px-3 py-2 rounded-xl text-xs font-semibold transition border ' +
          (on ? 'bg-red-600 text-white border-red-500 shadow'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700');
      });

      document.querySelectorAll('.setting-int-btn').forEach(btn => {
        const on = parseInt(btn.dataset.int, 10) === locationInterval;
        btn.className = 'setting-int-btn flex-1 min-w-[54px] px-2 py-2 rounded-xl text-xs font-semibold transition border ' +
          (on ? 'bg-blue-600 text-white border-blue-500 shadow'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700');
      });
    }

    function setLocationInterval(sec) {
      const v = LOCATION_INTERVALS.includes(sec) ? sec : 5;
      locationInterval = v;
      try { localStorage.setItem('locInterval', String(v)); } catch (e) {}
      lastLocationApplied = 0;
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      syncSettingsUI();
      if (v === 0) {
        stopLocationTracking();
      } else {
        resetLocateBtn();
        if (locationWatcher !== null) startLocationPolling();
      }
    }

    function stopLocationTracking() {
      if (locationWatcher !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(locationWatcher);
        locationWatcher = null;
      }
      stopLocationPolling();
      if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }
      userLocation = null;
      lastLocationApplied = 0;
      pendingCoords = null;
      firstLocationFix = true;
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
      document.getElementById('locationBanner').classList.add('hidden');
      const currentFilter = document.querySelector('.tab-btn.bg-red-600')?.id.replace('tab-', '') || 'all';
      renderItinerary(currentFilter);
      resetLocateBtn();
      syncSettingsUI();
    }

    function showLocationError(msg) {
      document.getElementById('locationBanner').classList.remove('hidden');
      const coordsEl = document.getElementById('userCoordsText');
      coordsEl.style.color = '#fda4af';
      coordsEl.innerText = msg;
      document.getElementById('locationDistanceSummary').innerText = '';
      resetLocateBtn();
    }

    function restoreKit() {
      try {
        localStorage.removeItem('kitDismissed');
        localStorage.removeItem('kitOpen');
      } catch (e) {}
      const body = document.getElementById('kitBody');
      const chev = document.getElementById('kitChevron');
      // Closed by default - the expanded panel is tall and squeezes the
      // itinerary scroll area on small screens.
      body.classList.add('hidden');
      chev.classList.remove('rotate-180');
      applyKitText();
    }

    function setLanguage(lang) {
      currentLang = lang;

      document.getElementById('ui-app-title').innerText = lang === 'en' ? 'Japan Travel Planner 2026' : '日本行程规划 2026';
      document.getElementById('ui-app-subtitle').innerText = lang === 'en' ? 'Oct 23 – Nov 01 • 10 Days (Hokkaido & Kansai)' : '10月23日 – 11月01日 • 10天 (北海道与关西)';
      document.getElementById('ui-overview-btn').innerText = lang === 'en' ? 'Overview Map' : '全景地图';
      try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
      resetLocateBtn();
      
      document.getElementById('tab-all').innerText = lang === 'en' ? 'All 10 Days' : '全部10天';
      document.getElementById('tab-hokkaido').innerText = lang === 'en' ? 'Hokkaido (D1-D6)' : '北海道 (D1-D6)';
      document.getElementById('tab-kansai').innerText = lang === 'en' ? 'Kansai (D7-D10)' : '关西 (D7-D10)';

      applyKitText();
      if (weatherSelectedCode) selectWeatherFor(null, null, weatherSelectedCode, weatherSelectedDay);
      syncSettingsUI();

      updateMobileMapButtonText();
      if (dayCarouselBuiltLang !== currentLang) buildDayCarousel();
      
      const currentFilter = getCurrentFilter();
      renderItinerary(currentFilter);

      if (selectedDayId) {
        selectDay(selectedDayId, { scroll: false });
      } else {
        renderAllRoutesOnMap();
      }
    }

    function getCurrentFilter() {
      return document.querySelector('.tab-btn.bg-red-600')?.id.replace('tab-', '') || 'all';
    }

    function setActiveTab(leg) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-red-600', 'text-white');
        btn.classList.add('bg-slate-800', 'text-slate-300');
      });
      const activeBtn = document.getElementById(`tab-${leg}`);
      if (activeBtn) {
        activeBtn.classList.add('bg-red-600', 'text-white');
        activeBtn.classList.remove('bg-slate-800', 'text-slate-300');
      }
    }

    function scrollToDayCard(dayId) {
      const container = document.getElementById('itineraryContainer');
      const card = document.getElementById(`day-card-${dayId}`);
      if (!container || !card) return;
      const offset = card.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + offset - 8, behavior: 'smooth' });
    }

    function dayCost(day) {
      if (day.estCost) return day.estCost;
      const total = day.stops.reduce((sum, s) => {
        const m = /[\d,]+/.exec(String(s.cost || ''));
        if (!m) return sum;
        const v = parseInt(m[0].replace(/,/g, ''), 10);
        return sum + (v > 0 && v < 200000 ? v : 0);
      }, 0);
      return total > 0 ? '¥' + total.toLocaleString() : '—';
    }

    function tripTotal() {
      return daysData.reduce((sum, d) => {
        if (d.estCost) return sum;
        return sum + d.stops.reduce((s2, s) => {
          const m = /[\d,]+/.exec(String(s.cost || ''));
          if (!m) return s2;
          const v = parseInt(m[0].replace(/,/g, ''), 10);
          return s2 + (v > 0 && v < 200000 ? v : 0);
        }, 0);
      }, 0);
    }

    function spreadDuplicateCoords(stops) {
      const seen = new Map();
      return stops.map(s => {
        const key = `${s.lat},${s.lng}`;
        const n = seen.get(key) || 0;
        if (n === 0) { seen.set(key, 1); return s; }
        const step = 0.0007 * n;
        seen.set(key, n + 1);
        return { ...s, lat: s.lat + step, lng: s.lng - step * 0.6 };
      });
    }

    function renderItinerary(filter = 'all') {
      const container = document.getElementById('itineraryContainer');
      container.innerHTML = '';

      const filteredDays = daysData.filter(d => filter === 'all' || d.leg === filter);

      filteredDays.forEach(day => {
        const isSelected = selectedDayId === day.id;
        const isToday = todayState.dayId === day.id;
        const card = document.createElement('div');
        card.id = `day-card-${day.id}`;
        card.className = `p-3 rounded-xl transition cursor-pointer border ${
          isSelected 
            ? 'bg-slate-800 border-red-500 ring-1 ring-red-500/50 shadow-lg' 
            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
        }`;
        
        card.onclick = () => selectDay(day.id);

        card.innerHTML = `
          <div class="flex justify-between items-start gap-1.5 mb-1.5">
            <div>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded text-white shadow-sm" style="background-color: ${day.color}">Day ${day.id}</span>
              ${isToday ? '<span class="text-[9px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950 border border-emerald-800 px-1.5 py-0.5 rounded ml-1.5">Today</span>' : ''}
              <span class="text-[11px] text-slate-400 ml-2 font-medium">${day.date}</span>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <span id="wx-${day.id}" class="hidden"></span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-emerald-400 font-mono border border-slate-800">${dayCost(day)}</span>
            </div>
          </div>
          <h3 class="font-semibold text-sm text-slate-100 mb-2">${day.title[currentLang]}</h3>
          
          <div class="space-y-2 pl-2 border-l-2 border-slate-800">
            ${day.stops.map((stop, idx) => {
              let distHtml = '';
              if (userLocation) {
                const dist = calculateHaversineDistance(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
                distHtml = `<span class="stop-dist text-[9px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 font-mono border border-blue-800/60 ml-1.5" data-stop-lat="${stop.lat}" data-stop-lng="${stop.lng}"><i class="fa-solid fa-location-arrow text-[8px] mr-1"></i>${dist} km</span>`;
              }
              const nextHtml = isToday
                ? `<span class="next-stop-badge text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white flex-shrink-0 ${idx === todayState.nextIdx ? '' : 'hidden'}" data-stop="${day.id}-${idx}">${locMsg('Next', '下一站')}</span>`
                : '';

              return `
                <div class="text-xs stop-row" data-row="${day.id}-${idx}">
                  <div class="flex items-center gap-1.5 text-slate-300 font-medium">
                    <span class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0" style="background-color: ${day.color}">${idx + 1}</span>
                    <span class="truncate">${stop.name[currentLang]}</span>${distHtml}${nextHtml}
                    <span class="text-[10px] text-slate-500 ml-auto flex-shrink-0 font-mono">${stop.time}</span>
                  </div>
                  <div class="flex justify-between items-center text-[11px] text-slate-400 pl-5 mt-0.5">
                    <span class="truncate pr-2">${stop.desc[currentLang]}</span>
                    <span class="text-[10px] text-slate-500 font-mono flex-shrink-0">${stop.cost}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        container.appendChild(card);
      });

      updateDayChipStates();

      applyWeatherUI();
      applyNextStopBadges();
    }

    function updateDayChipStates() {
      for (let i = 1; i <= 10; i++) {
        const isTodayChip = i === todayState.dayId;
        const activeCls = 'day-chip px-2 py-1 rounded-md bg-red-600 text-white font-mono text-xs font-bold shadow';
        const idleCls = 'day-chip px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs border border-slate-700/50';
        const todayCls = isTodayChip ? ' ring-2 ring-emerald-400' : '';
        ['chip', 'map-chip'].forEach(prefix => {
          const chip = document.getElementById(`${prefix}-${i}`);
          if (!chip) return;
          chip.className = (i === selectedDayId ? activeCls : idleCls) + todayCls;
          chip.title = isTodayChip ? locMsg('Today', '今天') : '';
        });
      }
      const mapAll = document.getElementById('map-chip-all');
      if (mapAll) {
        const showAllActive = selectedDayId === null;
        mapAll.className = 'map-day-chip flex-shrink-0 px-2 py-1 rounded-md font-mono text-xs ' +
          (showAllActive
            ? 'bg-red-600 text-white font-bold shadow'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50');
      }
    }

    function filterLeg(leg) {
      setActiveTab(leg);

      if (leg === 'all') {
        selectedDayId = null;
        renderItinerary('all');
        updateDayCarouselVisibility();
        renderAllRoutesOnMap();
      } else {
        const firstDay = daysData.find(d => d.leg === leg);
        if (firstDay) {
          selectDay(firstDay.id, { scroll: false });
        } else {
          renderItinerary(leg);
        }
      }
    }

    function routeModeLabel(result, day) {
      if (TOUR_DAYS.has(day.id)) return currentLang === 'en' ? 'walking + tour bus' : '步行 + 旅游巴士';
      if (result.transitLegs > 0 || day.id === 7) return currentLang === 'en' ? 'walking + JR/train' : '步行 + JR/铁路';
      return currentLang === 'en' ? 'walking route' : '步行路线';
    }

    function drawRouteSegments(segments, color) {
      segments.forEach(segment => {
        const style = {
          color,
          weight: 5,
          opacity: segment.mode === 'walking' ? 0.82 : 0.92,
          lineCap: 'round',
          lineJoin: 'round'
        };
        if (segment.fallback) {
          style.dashArray = '4, 8';
          style.opacity = 0.55;
        }
        L.polyline(segment.path, style).addTo(currentLayerGroup);
      });
    }

    let dayCarouselBuiltLang = null;
    let carouselScrollTimer = null;
    let carouselProgrammatic = false;
    let carouselProgrammaticTimer = null;
    let carouselEventsBound = false;
    let dayRenderToken = 0;
    let lastDayBounds = null;
    let overviewBounds = null;

    function buildDayCarousel() {
      const track = document.getElementById('dayCarouselTrack');
      const dots = document.getElementById('carouselDots');
      if (!track || !dots) return;

      track.innerHTML = '';
      dots.innerHTML = '';
      daysData.forEach((day, index) => {
        const slide = document.createElement('div');
        slide.className = 'day-carousel-slide min-w-full px-10 pt-2.5 pb-5 cursor-pointer';
        slide.dataset.dayId = day.id;
        const dateLabel = (day.date || '').split(' / ')[0];
        const modeLabel = TOUR_DAYS.has(day.id)
          ? (currentLang === 'en' ? 'Walk + tour bus' : '步行 + 旅游巴士')
          : (currentLang === 'en' ? 'Walk + JR/train' : '步行 + JR/铁路');
        slide.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="w-1.5 h-10 rounded-full flex-shrink-0" style="background-color: ${day.color}"></span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <span class="font-bold" style="color: ${day.color}">DAY ${day.id}</span>
                <span>•</span>
                <span class="truncate">${dateLabel}</span>
              </div>
              <div class="text-[13px] font-bold text-slate-100 truncate">${day.title[currentLang]}</div>
              <div class="text-[10px] text-slate-400">${day.stops.length} ${currentLang === 'en' ? 'stops' : '个行程点'} • ${modeLabel}</div>
            </div>
          </div>
        `;
        slide.onclick = () => selectDay(day.id);
        track.appendChild(slide);

        const dot = document.createElement('button');
        dot.className = 'pointer-events-auto h-1.5 w-1.5 rounded-full bg-slate-600 transition-all';
        dot.setAttribute('aria-label', `Day ${day.id}`);
        dot.onclick = event => {
          event.stopPropagation();
          selectDay(day.id, { scroll: false });
        };
        dots.appendChild(dot);
      });

      dayCarouselBuiltLang = currentLang;
      if (!carouselEventsBound) {
        carouselEventsBound = true;
        track.addEventListener('scroll', () => {
          if (carouselProgrammatic) return;
          clearTimeout(carouselScrollTimer);
          carouselScrollTimer = setTimeout(() => {
            const width = track.clientWidth || 1;
            const index = Math.max(0, Math.min(daysData.length - 1, Math.round(track.scrollLeft / width)));
            const day = daysData[index];
            updateCarouselDots(index);
            if (day && day.id !== selectedDayId) {
              selectDay(day.id, { scroll: false, fromCarousel: true });
            }
          }, 130);
        });
      }
    }

    function updateCarouselDots(index) {
      const dots = document.querySelectorAll('#carouselDots button');
      dots.forEach((dot, i) => {
        dot.className = i === index
          ? 'pointer-events-auto h-1.5 w-4 rounded-full bg-red-500 transition-all'
          : 'pointer-events-auto h-1.5 w-1.5 rounded-full bg-slate-600 transition-all';
      });
      const prev = document.getElementById('carouselPrev');
      const next = document.getElementById('carouselNext');
      if (prev) prev.disabled = index <= 0;
      if (next) next.disabled = index >= daysData.length - 1;
    }

    function syncDayCarousel(dayId, smooth = false) {
      const track = document.getElementById('dayCarouselTrack');
      if (!track) return;
      const index = daysData.findIndex(day => day.id === dayId);
      if (index < 0) return;
      updateCarouselDots(index);
      const target = index * track.clientWidth;
      if (Math.abs(track.scrollLeft - target) > 2) {
        carouselProgrammatic = true;
        track.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
        clearTimeout(carouselProgrammaticTimer);
        carouselProgrammaticTimer = setTimeout(() => { carouselProgrammatic = false; }, smooth ? 480 : 90);
      }
    }

    function updateDayCarouselVisibility() {
      const carousel = document.getElementById('dayCarousel');
      if (!carousel) return;
      carousel.classList.toggle('hidden', selectedDayId === null);
      if (selectedDayId !== null) syncDayCarousel(selectedDayId, false);
    }

    function moveDayCarousel(direction) {
      const index = daysData.findIndex(day => day.id === selectedDayId);
      if (index < 0) return;
      const target = daysData[index + direction];
      if (target) selectDay(target.id, { scroll: false });
    }

    async function selectDay(dayId, opts = {}) {
      const day = daysData.find(d => d.id === dayId);
      if (!day) return;
      const renderToken = ++dayRenderToken;
      selectedDayId = dayId;
      if (dayCarouselBuiltLang !== currentLang) buildDayCarousel();
      const mobileStatus = document.getElementById('mobile-status-label');
      if (mobileStatus) {
        mobileStatus.innerText = currentLang === 'en'
          ? `Day ${day.id} • ${day.stops.length} stops`
          : `第 ${day.id} 天 • ${day.stops.length} 个行程点`;
      }
      updateDayCarouselVisibility();

      // if the active leg tab hides this day, switch to the tab that shows it
      let filter = getCurrentFilter();
      if (filter !== 'all' && filter !== day.leg) {
        filter = day.leg;
        setActiveTab(filter);
      }

      renderItinerary(filter);
      if (opts.scroll !== false) scrollToDayCard(dayId);
      if (!opts.fromCarousel) syncDayCarousel(dayId, opts.scroll !== false);

      // Pull the live JMA weather for wherever this day is mostly spent.
      const dayArea = dominantAreaForDay(day);
      if (dayArea) selectWeatherFor(null, null, dayArea, day.id);

      document.getElementById('routeStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping';
      document.getElementById('mapLegendTitle').innerText = currentLang === 'en' ? `Finding Day ${day.id} routes...` : `正在查找第 ${day.id} 天路线...`;

      currentLayerGroup.clearLayers();
      beginRouteBudget(40000);
      const markerPoints = spreadDuplicateCoords(day.stops);

      markerPoints.forEach((stop, idx) => {
        const marker = L.marker([stop.lat, stop.lng], {
          icon: createCustomMarker(idx + 1, day.color)
        }).addTo(currentLayerGroup);

        let userDistStr = '';
        if (userLocation) {
          const d = calculateHaversineDistance(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
          userDistStr = `<div class="text-[10px] text-blue-400 font-mono mt-1"><i class="fa-solid fa-location-arrow mr-1"></i>${d} km from you</div>`;
        }

        marker.bindPopup(`
          <div class="p-2 min-w-[190px]">
            <div class="flex justify-between items-center mb-1">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style="background-color: ${day.color}">Stop ${idx + 1}</span>
              <span class="text-[10px] text-slate-400 font-mono">${stop.time}</span>
            </div>
            <div class="font-bold text-xs text-slate-100">${stop.name[currentLang]}</div>
            <div class="text-[11px] text-slate-300 mt-1">${stop.desc[currentLang]}</div>
            ${userDistStr}
            <div class="text-[10px] text-emerald-400 font-mono mt-1 font-semibold">${stop.cost}</div>
          </div>
        `);
        // Clicking a stop pulls the live JMA weather for that place.
        marker.on('click', () => selectWeatherFor(stop.lat, stop.lng, null, day.id));
      });

      const schematicCoords = (day.id === 7 ? day.stops.slice(3) : day.stops)
        .map(s => [s.lat, s.lng]);

      // Draw an instant schematic so the map is usable right away; exact
      // routes replace it when they resolve.
      let schematicLayer = null;
      if (schematicCoords.length > 1) {
        schematicLayer = L.polyline(schematicCoords, {
          color: day.color, weight: 3, opacity: 0.5, dashArray: '4, 8'
        }).addTo(currentLayerGroup);
        lastDayBounds = L.latLngBounds(schematicCoords);
        map.fitBounds(lastDayBounds, { padding: [40, 40] });
      }

      const fitPoints = [];
      let summary;

      // Draw each leg the moment it resolves so a slow planner call never
      // holds up the whole day. The dashed schematic stays underneath until
      // every leg is in - otherwise the map would end up half empty.
      const paintSegment = (segment) => {
        if (renderToken !== dayRenderToken) return;
        drawRouteSegments([segment], day.color);
        fitPoints.push(...segment.path);
        if (fitPoints.length > 1) {
          lastDayBounds = L.latLngBounds(fitPoints);
          map.fitBounds(lastDayBounds, { padding: [40, 40] });
        }
      };
      const dropSchematic = () => {
        if (schematicLayer) {
          currentLayerGroup.removeLayer(schematicLayer);
          schematicLayer = null;
        }
      };

      if (day.id === 7) {
        const cts = [42.7752, 141.6923];
        const itm = [34.7855, 135.4382];
        const [toAirport, fromAirport] = await Promise.all([
          fetchRouteForStops(day.stops.slice(0, 3), day, paintSegment),
          // Skip the flight stop itself - it is drawn as a dashed arc below
          // and routing it through the transit planner only wastes a request.
          fetchRouteForStops(day.stops.slice(4), day, paintSegment)
        ]);
        if (renderToken !== dayRenderToken) return;

        L.polyline([cts, [38.8, 137.8], itm], {
          color: '#ec4899', weight: 3, dashArray: '6, 10', opacity: 0.85
        }).addTo(currentLayerGroup);
        fitPoints.push(cts, [38.8, 137.8], itm);
        summary = {
          transitLegs: toAirport.transitLegs + fromAirport.transitLegs,
          tourLegs: 0,
          modes: [...new Set([...toAirport.modes, ...fromAirport.modes])]
        };
      } else {
        summary = await fetchRouteForStops(day.stops, day, paintSegment);
        if (renderToken !== dayRenderToken) return;
      }

      // Every leg is in - the dashed schematic has done its job.
      dropSchematic();

      if (fitPoints.length > 1) {
        lastDayBounds = L.latLngBounds(fitPoints);
        map.fitBounds(lastDayBounds, { padding: [40, 40] });
      }

      document.getElementById('routeStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
      document.getElementById('mapLegendTitle').innerText = `Day ${day.id}: ${day.title[currentLang]}`;
      document.getElementById('mapLegendSubtitle').innerText = `${day.stops.length} ${currentLang === 'en' ? 'stops' : '个行程点'} • ${routeModeLabel(summary, day)}`;
    }

    function renderAllRoutesOnMap() {
      ++dayRenderToken;
      currentLayerGroup.clearLayers();
      lastDayBounds = null;
      updateDayCarouselVisibility();
      const mobileStatus = document.getElementById('mobile-status-label');
      if (mobileStatus) mobileStatus.innerText = currentLang === 'en' ? 'Days 1 - 10' : '第 1 - 10 天';
      document.getElementById('routeStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping';
      document.getElementById('mapLegendTitle').innerText = currentLang === 'en' ? 'Loading Overview...' : '加载全景路线中...';

      const allPoints = [];

      for (const day of daysData) {
        if (day.id === 1) continue;
        allPoints.push(...day.stops.map(s => [s.lat, s.lng]));

        day.stops.forEach((stop) => {
          L.circleMarker([stop.lat, stop.lng], {
            radius: 4, fillColor: day.color, color: '#ffffff', weight: 1, fillOpacity: 0.9
          }).addTo(currentLayerGroup).bindPopup(`
            <div class="p-1.5">
              <div class="text-[10px] font-bold text-slate-400">Day ${day.id}</div>
              <div class="font-bold text-xs text-slate-100">${stop.name[currentLang]}</div>
            </div>
          `).on('click', () => selectWeatherFor(stop.lat, stop.lng, null, day.id));
        });

        if (day.id === 7) {
          L.polyline([[42.7752, 141.6923], [38.8, 137.8], [34.7855, 135.4382]], { color: '#ec4899', weight: 2, dashArray: '5, 8' }).addTo(currentLayerGroup);
        }

        const overviewStops = day.id === 7 ? day.stops.slice(3) : day.stops;
        L.polyline(overviewStops.map(stop => [stop.lat, stop.lng]), {
          color: day.color,
          weight: 2,
          opacity: 0.55,
          dashArray: '3, 7'
        }).addTo(currentLayerGroup);
      }

      if (allPoints.length > 0) {
        overviewBounds = L.latLngBounds(allPoints);
        map.fitBounds(overviewBounds, { padding: [30, 30] });
      }
      setTimeout(() => map.invalidateSize(), 100);

      document.getElementById('routeStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse';
      document.getElementById('mapLegendTitle').innerText = currentLang === 'en' ? '10-Day Transit Overview' : '10天公共交通全景';
      document.getElementById('mapLegendSubtitle').innerText = currentLang === 'en' ? 'Schematic day flow • select a day for exact walking, JR and train routes' : '每日路线示意 • 选择日期查看步行、JR 与铁路实际路线';

      // Overview mode still gets live weather - show it for where the trip starts.
      const firstDay = daysData[0];
      const startArea = firstDay ? dominantAreaForDay(firstDay) : null;
      if (startArea) selectWeatherFor(null, null, startArea, firstDay ? firstDay.id : null);
    }

    function toggleMobileMap() {
      const mapWrapper = document.getElementById('mapWrapper');
      const sidebar = document.getElementById('itinerarySidebar');
      isMobileMapVisible = !isMobileMapVisible;

      if (isMobileMapVisible) {
        mapWrapper.classList.remove('hidden');
        sidebar.classList.add('hidden');
        map.invalidateSize();
        setTimeout(() => {
          map.invalidateSize();
          const bounds = lastDayBounds || overviewBounds;
          if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
          if (selectedDayId !== null) syncDayCarousel(selectedDayId, false);
        }, 200);
      } else {
        mapWrapper.classList.add('hidden');
        sidebar.classList.remove('hidden');
      }

      updateMobileMapButtonText();
    }

    function updateMobileMapButtonText() {
      const btnText = document.getElementById('mobileMapToggleText');
      if (isMobileMapVisible) {
        btnText.innerText = currentLang === 'en' ? 'Hide Map' : '隐藏地图';
      } else {
        btnText.innerText = currentLang === 'en' ? 'Show Map' : '显示地图';
      }
    }

    // Live JST Clock Functionality
    function updateJSTClock() {
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const jstDate = new Date(utc + (3600000 * 9));
      
      const hours = String(jstDate.getHours()).padStart(2, '0');
      const minutes = String(jstDate.getMinutes()).padStart(2, '0');
      const seconds = String(jstDate.getSeconds()).padStart(2, '0');
      
      document.getElementById('jstClock').innerText = `${hours}:${minutes}:${seconds} JST`;
    }
    setInterval(updateJSTClock, 1000);
    updateJSTClock();

    // Auto-Scroll Ticker Animation
    function initTickerAnimation() {
      const viewport = document.getElementById('tickerViewport');
      const text = document.getElementById('liveTickerText');
      if (!viewport || !text) return;

      let animationFrameId = null;
      let startTimestamp = null;
      const speedPixelsPerSec = 45;

      function step(timestamp) {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = (timestamp - startTimestamp) / 1000;
        const distanceMoved = elapsed * speedPixelsPerSec;

        const viewportWidth = viewport.clientWidth;
        const textWidth = text.scrollWidth;
        const totalDistance = textWidth + viewportWidth;

        if (distanceMoved < totalDistance) {
          const currentPos = viewportWidth - distanceMoved;
          text.style.transform = `translateX(${currentPos}px)`;
          animationFrameId = requestAnimationFrame(step);
        } else {
          text.style.transform = `translateX(-${textWidth}px)`;
          setTimeout(() => {
            text.style.transform = `translateX(${viewportWidth}px)`;
            startTimestamp = null;
            animationFrameId = requestAnimationFrame(step);
          }, 2000);
        }
      }

      text.style.transform = `translateX(${viewport.clientWidth}px)`;
      animationFrameId = requestAnimationFrame(step);
    }

    window.addEventListener('resize', () => {
      if (map) map.invalidateSize();
      if (selectedDayId !== null) syncDayCarousel(selectedDayId, false);
    });

    window.onload = function() {
      loadSettings();
      if (currentLang !== 'en') setLanguage(currentLang);
      resetLocateBtn();
      todayState = computeTodayState();
      renderItinerary();
      buildDayCarousel();
      buildWeatherPicker();
      if (todayState.dayId) {
        selectDay(todayState.dayId, { scroll: false });
      } else {
        renderAllRoutesOnMap();
      }
      loadWeather();
      initTickerAnimation();
      restoreKit();
      setInterval(refreshToday, 30000);

      // Warm the transit planner once the first view is on screen, so
      // clicking through the days afterwards is instant.
      setTimeout(() => { prefetchTransitRoutes(); }, 2500);
    };


    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSettings(); });
  