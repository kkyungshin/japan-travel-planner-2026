    /* ------------------------------------------------------------------
       Live weather, warnings and typhoons - Japan Meteorological Agency
       (https://www.jma.go.jp). All three feeds are public, key-free and
       send Access-Control-Allow-Origin: *, so the browser can read them.
       ------------------------------------------------------------------ */

    const JMA_FORECAST_BASE = 'https://www.jma.go.jp/bosai/forecast/data/forecast/';
    const JMA_WARNING_BASE = 'https://www.jma.go.jp/bosai/warning/data/warning/';
    const JMA_TYPHOON_LIST = 'https://www.jma.go.jp/bosai/typhoon/data/targetTc.json';

    // JMA forecast areas, with the office that publishes each one. Codes
    // verified against the live JMA feeds.
    const JMA_AREAS = [
      { code: '016010', office: '016000', en: 'Sapporo', lat: 43.06, lng: 141.35 },
      { code: '016020', office: '016000', en: 'Fukagawa & Iburi', lat: 43.45, lng: 142.90 },
      { code: '016030', office: '016000', en: 'Otaru & Shiribetsu', lat: 43.19, lng: 141.00 },
      { code: '012010', office: '012000', en: 'Asahikawa & Kamikawa', lat: 43.60, lng: 142.55 },
      { code: '012020', office: '012000', en: 'Rumoi', lat: 43.80, lng: 141.60 },
      { code: '015010', office: '015000', en: 'Noboribetsu & Toyako', lat: 42.50, lng: 141.00 },
      { code: '015020', office: '015000', en: 'Hidaka', lat: 42.85, lng: 142.45 },
      { code: '017010', office: '017000', en: 'Hakodate & Oshima', lat: 41.80, lng: 140.75 },
      { code: '017020', office: '017000', en: 'Hiyama', lat: 41.90, lng: 140.30 },
      { code: '013010', office: '013000', en: 'Abashiri', lat: 44.02, lng: 144.25 },
      { code: '013020', office: '013000', en: 'Kitami', lat: 43.80, lng: 143.90 },
      { code: '013030', office: '013000', en: 'Monbetsu', lat: 44.40, lng: 143.40 },
      { code: '011000', office: '011000', en: 'Wakkanai & Soya', lat: 45.40, lng: 141.75 },
      { code: '014020', office: '014100', en: 'Kushiro', lat: 42.98, lng: 144.38 },
      { code: '014000', office: '014100', en: 'Obihiro & Tokachi', lat: 43.20, lng: 143.20 },
      { code: '020010', office: '020000', en: 'Aomori & Tsugaru', lat: 40.82, lng: 140.74 },
      { code: '050010', office: '050000', en: 'Akita coast', lat: 39.72, lng: 140.10 },
      { code: '040010', office: '040000', en: 'Sendai east', lat: 38.27, lng: 140.87 },
      { code: '150010', office: '150000', en: 'Niigata', lat: 37.88, lng: 139.02 },
      { code: '170010', office: '170000', en: 'Kanazawa', lat: 36.57, lng: 136.66 },
      { code: '130010', office: '130000', en: 'Tokyo', lat: 35.69, lng: 139.69 },
      { code: '260010', office: '260000', en: 'Kyoto & Uji', lat: 34.95, lng: 135.78 },
      { code: '260020', office: '260000', en: 'Kyoto north', lat: 35.06, lng: 135.73 },
      { code: '270000', office: '270000', en: 'Osaka', lat: 34.69, lng: 135.50 },
      { code: '280010', office: '280000', en: 'Kobe & the port', lat: 34.68, lng: 135.19 },
      { code: '280020', office: '280000', en: 'Kobe north', lat: 34.78, lng: 135.30 },
      { code: '290010', office: '290000', en: 'Nara', lat: 34.70, lng: 135.845 },
      { code: '290020', office: '290000', en: 'Nara south', lat: 34.45, lng: 135.80 }
    ];

    // JMA warning / advisory codes as published in the bosai warning feed.
    const JMA_WARNING_NAMES = {
      '02': 'Blizzard warning', '03': 'Heavy rain warning', '04': 'Flood warning',
      '05': 'Storm warning', '06': 'Heavy snow warning', '07': 'High wave warning',
      '08': 'Storm surge warning', '09': 'Landslide warning', '10': 'Heavy rain advisory',
      '12': 'Heavy snow advisory', '13': 'Blizzard advisory', '14': 'Thunderstorm advisory',
      '15': 'Strong wind advisory', '16': 'High wave advisory', '17': 'Thaw advisory',
      '18': 'Flood advisory', '19': 'Storm surge advisory', '20': 'Dense fog advisory',
      '21': 'Dry air advisory', '22': 'Avalanche advisory', '23': 'Low temperature advisory',
      '24': 'Frost advisory', '25': 'Icing advisory', '26': 'Snow advisory',
      '27': 'Other advisories', '29': 'Landslide advisory', '32': 'Blizzard special warning',
      '33': 'Heavy rain special warning', '35': 'Storm special warning',
      '36': 'Heavy snow special warning', '37': 'High wave special warning',
      '38': 'Storm surge special warning', '43': 'Heavy rain danger warning',
      '48': 'Storm surge danger warning', '49': 'Landslide danger warning'
    };

    const JMA_CODE_LABELS = {
      '100': 'Clear', '101': 'Fair', '102': 'Fair, cloudy at times',
      '103': 'Fair, cloudy, rain at times', '104': 'Fair, cloudy, snow at times',
      '105': 'Cloudy, clear at times', '106': 'Cloudy, clear, rain at times',
      '107': 'Cloudy, clear, snow at times', '110': 'Cloudy', '111': 'Rain',
      '112': 'Rain, snow at times', '113': 'Snow', '114': 'Rain or snow',
      '115': 'Snow, uncertain', '120': 'Rain or snow', '121': 'Rain or snow, uncertain'
    };

    // Japanese forecast wording -> English. Longest phrase wins.
    const JMA_TEXT_MAP = [
      ['みられ不定', 'possible, uncertain'], ['雷を伴う', 'thunder'], ['雷', 'thunder'], ['荒天', 'rough weather'],
      ['晴れ時々曇り', 'fair, becoming cloudy'], ['晴れ時々くもり', 'fair, becoming cloudy'],
      ['所により', 'in places'], ['ところより', 'in places'], ['部分的', 'partly'],
      ['夕方', 'in the evening'], ['夜遅く', 'late at night'], ['夜半', 'midnight'],
      ['昼間', 'during the day'], ['朝', 'in the morning'], ['午後', 'in the afternoon'],
      ['昼', 'during the day'], ['夜', 'at night'], ['一時', 'temporarily'],
      ['時々', 'sometimes'], ['みられ', 'observed'], ['以降', 'after'],
      ['まで', 'until'], ['から', 'from'], ['で', 'with'], ['、', ', '],
      ['晴れ', 'clear'], ['曇り', 'cloudy'], ['くもり', 'cloudy'],
      ['雨', 'rain'], ['雪', 'snow'], ['霧', 'fog']
    ].sort((a, b) => b[0].length - a[0].length);

    // Phrases that read badly when translated word by word get rewritten
    // first. The placeholders carry no spaces so they survive tokenising.
            const JMA_PHRASE_REWRITES = [
      ['夜遅く　まで', ' %%UNTILLATE%%'],
      ['夕方　まで', ' %%UNTILEVE%%'],
      ['夜　まで', ' %%UNTILNIGHT%%'],
      ['雷　を伴う', ' %%THUNDER%%'],
      ['朝晩', ' %%MORNINGEVENING%%'],
      ['から', ' %%TURNTO%%'],
      ['所により', ' %%INPLACES%%'],
      ['ところより', ' %%INPLACES%%'],
      ['所より', ' %%INPLACES%%'],
      ['　', ' ']
    ];
    const JMA_PLACEHOLDERS = {
      '%%UNTILLATE%%': 'until late night',
      '%%UNTILEVE%%': 'until evening',
      '%%UNTILNIGHT%%': 'until night',
      '%%THUNDER%%': 'thunder',
      '%%MORNINGEVENING%%': 'morning and evening',
      '%%TURNTO%%': 'turning to',
      '%%INPLACES%%': 'in places'
    };

function translateJmaWeather(jaText) {
      if (!jaText) return '';
      let text = String(jaText);
      JMA_PHRASE_REWRITES.forEach(([ja, en]) => { text = text.split(ja).join(en); });
      const tokens = text.split(/\s+/).filter(Boolean);
      const out = [];
      tokens.forEach(token => {
        if (JMA_PLACEHOLDERS[token]) { out.push(JMA_PLACEHOLDERS[token]); return; }
        let rest = token;
        let matched = false;
        while (rest.length) {
          const hit = JMA_TEXT_MAP.find(pair => rest.startsWith(pair[0]));
          if (!hit) { rest = rest.slice(1); continue; }
          out.push(hit[1]);
          rest = rest.slice(hit[0].length);
          matched = true;
        }
        if (!matched) out.push(token);
      });
      const joined = out
        .filter(part => part && part !== 'with')
        .join(', ')
        .replace(/,\s*,/g, ',')
        .replace(/,\s*\./g, '.');
      return joined.charAt(0).toUpperCase() + joined.slice(1);
    }

    function findJmaArea(lat, lng) {
      let best = null;
      let bestKm = Infinity;
      JMA_AREAS.forEach(area => {
        const km = parseFloat(calculateHaversineDistance(lat, lng, area.lat, area.lng));
        if (km < bestKm) { bestKm = km; best = area; }
      });
      return bestKm <= 120 ? best : null;
    }

    async function fetchJsonTimeout(url, timeoutMs = 9000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        return await response.json();
      } catch (e) {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    function bearingLabel(fromLat, fromLng, toLat, toLng) {
      const p1 = fromLat * Math.PI / 180, p2 = toLat * Math.PI / 180;
      const dl = (toLng - fromLng) * Math.PI / 180;
      const y = Math.sin(dl) * Math.cos(p2);
      const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
      const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
      return points[Math.round(deg / 22.5) % 16];
    }

    const COURSE_NAMES = {
      '北北西': 'NNW', '北西西': 'WNW', '西北西': 'WNW', '北西': 'NW', '北北東': 'NNE',
      '北東': 'NE', '東北東': 'ENE', '北東東': 'ENE', '東': 'E', '東南東': 'ESE',
      '南東東': 'ESE', '南東': 'SE', '南南東': 'SSE', '南': 'S', '南南西': 'SSW',
      '南西': 'SW', '西南西': 'WSW', '西南': 'SW', '西': 'W', '東南': 'SE',
      '停滞': 'stationary', 'ほぼ停滞': 'nearly stationary'
    };

    async function loadJmaWeather(area) {
      const [forecast, warnings] = await Promise.all([
        fetchJsonTimeout(`${JMA_FORECAST_BASE}${area.office}.json`),
        fetchJsonTimeout(`${JMA_WARNING_BASE}${area.office}.json`)
      ]);

      const parsed = { area, headline: '', detail: '', issued: '', temps: null, warnings: [], warningsFailed: false };

      if (forecast && forecast.length) {
        const block = forecast[0];
        const ts = block.timeSeries || [];
        parsed.issued = block.reportDatetime || '';
        const areas = (ts[0] && ts[0].areas) || [];
        const hit = areas.find(a => a.area && a.area.code === area.code);
        if (hit) {
          const code = (hit.weatherCodes || [])[0];
          const jp = (hit.weathers || [])[0];
          parsed.detail = translateJmaWeather(jp);
          // 1xx codes have a clean English label; 2xx/3xx are combinations
          // where only the Japanese text carries the detail.
          parsed.headline = JMA_CODE_LABELS[code] || '';
          if (!parsed.headline) { parsed.headline = parsed.detail; parsed.detail = ''; }
        }
        const avg = forecast[1] && forecast[1].tempAverage && forecast[1].tempAverage.areas;
        if (avg && avg.length) {
          parsed.temps = { min: avg[0].min, max: avg[0].max };
        }
      }

      if (warnings) {
        const active = [];
        (warnings.areaTypes || []).forEach(type => (type.areas || []).forEach(a => {
          if (a.code !== area.code) return;
          (a.warnings || []).forEach(w => {
            if (w.status === '発表' || w.status === '継続') active.push(w.code);
          });
        }));
        parsed.warnings = active.map(code => JMA_WARNING_NAMES[code] || `Warning ${code}`);
      } else {
        parsed.warningsFailed = true;
      }

      return parsed;
    }

    async function loadJmaTyphoon(area) {
      const list = await fetchJsonTimeout(JMA_TYPHOON_LIST, 8000);
      if (!list || !list.length) return null;
      const spec = await fetchJsonTimeout(
        `https://www.jma.go.jp/bosai/typhoon/data/${list[0].tropicalCyclone}/specifications.json`, 8000);
      if (!spec || !spec.length) return null;
      const title = spec.find(p => p.part === 'title') || {};
      const analysis = spec.find(p => p.part && p.part.en === 'Analysis') || {};
      const pos = analysis.position && analysis.position.deg;
      const info = {
        // JMA numbers typhoons as YYNN - 2630 is the 30th typhoon of 2026.
        number: title.typhoonNumber ? `No. ${parseInt(String(title.typhoonNumber).slice(2), 10)}` : '',
        name: (title.name && title.name.en) || '',
        issued: (title.issue && title.issue.JST) || list[0].issue || '',
        wind: analysis.maximumWind && analysis.maximumWind.sustained ? analysis.maximumWind.sustained['m/s'] : '',
        gust: analysis.maximumWind && analysis.maximumWind.gust ? analysis.maximumWind.gust['m/s'] : '',
        pressure: analysis.pressure || '',
        course: COURSE_NAMES[analysis.course] || analysis.course || '',
        speed: analysis.speed ? analysis.speed['km/h'] : '',
        galeKm: (analysis.galeWarning || []).reduce((max, g) => Math.max(max, (g.range && g.range.km) || 0), 0),
        lat: pos ? pos[0] : null,
        lng: pos ? pos[1] : null
      };
      if (info.lat !== null && area) {
        info.distanceKm = parseFloat(calculateHaversineDistance(area.lat, area.lng, info.lat, info.lng));
        info.bearing = bearingLabel(area.lat, area.lng, info.lat, info.lng);
      }
      return info;
    }

    let weatherSelectedCode = null;
    let weatherRequestToken = 0;

    async function selectWeatherFor(lat, lng, explicitCode) {
      const area = explicitCode
        ? JMA_AREAS.find(a => a.code === explicitCode)
        : findJmaArea(lat, lng);
      if (!area) return;
      weatherSelectedCode = area.code;
      const picker = document.getElementById('wxPicker');
      if (picker) picker.value = area.code;

      const placeEl = document.getElementById('wxPlace');
      if (placeEl) placeEl.innerText = area.en;

      const token = ++weatherRequestToken;
      const bodyEl = document.getElementById('wxBody');
      const alertEl = document.getElementById('wxAlerts');
      const sourceEl = document.getElementById('wxSource');
      if (bodyEl) bodyEl.innerText = locMsg('Loading the latest forecast…', '正在加载最新预报…');
      if (alertEl) alertEl.innerHTML = '';
      if (sourceEl) sourceEl.innerText = '';

      const [weather, typhoon] = await Promise.all([
        loadJmaWeather(area),
        loadJmaTyphoon(area)
      ]);
      if (token !== weatherRequestToken) return;

      const parts = [];
      if (weather.headline) parts.push(`<span class="font-semibold text-slate-100">${weather.headline}</span>`);
      if (weather.detail && weather.detail !== weather.headline) {
        parts.push(`<span class="text-slate-300">${weather.detail}</span>`);
      }
      if (weather.temps) {
        parts.push(`<span class="font-mono text-sky-300">${weather.temps.min}° / ${weather.temps.max}°C</span>`);
      }
      if (bodyEl) bodyEl.innerHTML = parts.join(' · ') || locMsg('No forecast available.', '暂无预报。');

      const alerts = [];
      if (weather.warnings.length) {
        alerts.push(`<div class="rounded-md border border-red-500/50 bg-red-950/50 px-2 py-1 text-red-200">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i><span class="font-semibold">${locMsg('Active alerts', '生效警报')}:</span>
          ${weather.warnings.join(', ')}
        </div>`);
      } else if (weather.warningsFailed) {
        alerts.push(`<div class="rounded-md border border-amber-500/40 bg-amber-950/30 px-2 py-1 text-amber-200">
          <i class="fa-solid fa-circle-info mr-1"></i>${locMsg('Could not load the alert feed.', '无法加载警报信息。')}
        </div>`);
      }
      if (typhoon) {
        const near = typhoon.distanceKm !== undefined && typhoon.distanceKm < 1500;
        const where = typhoon.distanceKm !== undefined
          ? locMsg(`${Math.round(typhoon.distanceKm).toLocaleString()} km ${typhoon.bearing} of ${area.en}`, `距${area.en} ${Math.round(typhoon.distanceKm).toLocaleString()} 公里，方向${typhoon.bearing}`)
          : '';
        alerts.push(`<div class="rounded-md border ${near ? 'border-orange-500/60 bg-orange-950/50' : 'border-slate-700 bg-slate-800/60'} px-2 py-1 ${near ? 'text-orange-200' : 'text-slate-300'}">
          <i class="fa-solid fa-hurricane mr-1"></i><span class="font-semibold">${locMsg('Typhoon', '台风')} ${typhoon.number} ${typhoon.name}</span>
          ${typhoon.pressure ? ` · ${typhoon.pressure} hPa` : ''}
          ${typhoon.wind ? ` · ${typhoon.wind} m/s` : ''}
          ${typhoon.gust ? ` (gust ${typhoon.gust})` : ''}
          ${typhoon.course ? ` · ${typhoon.course}` : ''}
          ${where ? ` · ${where}` : ''}
        </div>`);
      }
      if (alertEl) alertEl.innerHTML = alerts.join('');

      const iconEl = document.getElementById('wxIcon');
      if (iconEl) {
        const code = (weather.headline || '').toLowerCase();
        iconEl.className = 'fa-solid text-xs ' + (
          code.includes('snow') ? 'fa-snowflake text-cyan-300'
          : code.includes('rain') ? 'fa-cloud-rain text-blue-300'
          : code.includes('cloud') ? 'fa-cloud text-slate-300'
          : code.includes('fair') || code.includes('clear') ? 'fa-sun text-amber-300'
          : 'fa-cloud-sun text-sky-400');
      }
      if (sourceEl) {
        const issued = weather.issued ? new Date(weather.issued).toLocaleString() : '';
        sourceEl.innerText = locMsg(
          `Japan Meteorological Agency · issued ${issued}`,
          `日本气象厅 · 发布于 ${issued}`
        );
      }
    }

    function buildWeatherPicker() {
      const picker = document.getElementById('wxPicker');
      if (!picker) return;
      const seen = new Map();
      daysData.forEach(day => {
        day.stops.forEach(stop => {
          const area = findJmaArea(stop.lat, stop.lng);
          if (area && !seen.has(area.code)) seen.set(area.code, area);
        });
      });
      picker.innerHTML = '';
      seen.forEach(area => {
        const option = document.createElement('option');
        option.value = area.code;
        option.innerText = area.en;
        picker.appendChild(option);
      });
      picker.onchange = () => selectWeatherFor(null, null, picker.value);
    }

    function dominantAreaForDay(day) {
      // The stop in the middle of the day is where the day is actually
      // spent. Counting stops per area is the alternative, but a commute day
      // like Day 7 passes through more Namba stops than Kobe ones and would
      // point at the wrong place.
      const mid = day.stops[Math.floor(day.stops.length / 2)];
      const midArea = mid ? findJmaArea(mid.lat, mid.lng) : null;
      if (midArea) return midArea.code;

      const tally = new Map();
      day.stops.forEach(stop => {
        const area = findJmaArea(stop.lat, stop.lng);
        if (!area) return;
        tally.set(area.code, (tally.get(area.code) || 0) + 1);
      });
      let best = null;
      let bestCount = 0;
      tally.forEach((count, code) => {
        if (count > bestCount) { bestCount = count; best = code; }
      });
      return best;
    }
