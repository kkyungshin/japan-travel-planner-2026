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

    // Official JMA "telop" weather codes (気象庁 天気予報コード表). Used for
    // the 7-day outlook, which only publishes codes and no prose.
    const JMA_CODE_LABELS = {
      '100': 'Clear', '101': 'Fair, cloudy at times', '102': 'Fair, rain at times',
      '103': 'Fair, occasional rain', '104': 'Fair, snow at times',
      '105': 'Fair, occasional snow', '106': 'Fair, rain or snow at times',
      '107': 'Fair, occasional rain or snow', '110': 'Clear, then cloudy at times',
      '111': 'Clear, then cloudy', '112': 'Clear, then rain at times',
      '113': 'Clear, then occasional rain', '114': 'Clear, then rain',
      '115': 'Clear, then snow at times', '116': 'Clear, then occasional snow',
      '117': 'Clear, then snow', '118': 'Clear, then rain or snow',
      '120': 'Clear, rain at times around dawn and dusk',
      '160': 'Fair, snow or rain at times', '170': 'Fair, occasional snow or rain',
      '181': 'Clear, then snow or rain',
      '200': 'Cloudy', '201': 'Cloudy, clear at times', '202': 'Cloudy, rain at times',
      '203': 'Cloudy, occasional rain', '204': 'Cloudy, snow at times',
      '205': 'Cloudy, occasional snow', '206': 'Cloudy, rain or snow at times',
      '207': 'Cloudy, occasional rain or snow', '210': 'Cloudy, then clear at times',
      '211': 'Cloudy, then clear', '212': 'Cloudy, then rain at times',
      '213': 'Cloudy, then occasional rain', '214': 'Cloudy, then rain',
      '215': 'Cloudy, then snow at times', '216': 'Cloudy, then occasional snow',
      '217': 'Cloudy, then snow', '218': 'Cloudy, then rain or snow',
      '260': 'Cloudy, snow or rain at times', '270': 'Cloudy, occasional snow or rain',
      '281': 'Cloudy, then snow or rain',
      '300': 'Rain', '301': 'Rain, clear at times', '302': 'Rain, sometimes easing',
      '303': 'Rain, occasional snow', '304': 'Rain or snow', '306': 'Heavy rain',
      '308': 'Rain with strong wind', '309': 'Rain, snow at times',
      '311': 'Rain then clear', '313': 'Rain then cloudy', '314': 'Rain then occasional snow',
      '315': 'Rain then snow', '316': 'Rain or snow then clear', '317': 'Rain or snow then cloudy',
      '340': 'Snow or rain', '361': 'Snow or rain then clear', '371': 'Snow or rain then cloudy',
      '400': 'Snow', '401': 'Snow, clear at times', '402': 'Snow, sometimes easing',
      '403': 'Snow, occasional rain', '405': 'Heavy snow', '406': 'Blizzard',
      '407': 'Blizzard', '409': 'Snow, rain at times', '411': 'Snow then clear',
      '413': 'Snow then cloudy', '414': 'Snow then rain', '450': 'Snow with thunder'
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

    // The 7-day outlook publishes one entry per day for the coming week -
    // weather code, rain chance and min/max temperatures.
    function parseJmaWeek(forecast) {
      const week = forecast && forecast[1];
      if (!week || !week.timeSeries || !week.timeSeries.length) return [];
      const codesTs = week.timeSeries[0];
      const tempsTs = week.timeSeries[1];
      const codeArea = (codesTs.areas || [])[0] || {};
      const tempArea = (tempsTs && (tempsTs.areas || [])[0]) || {};

      const tempsByDate = new Map();
      (tempsTs && tempsTs.timeDefines || []).forEach((iso, i) => {
        tempsByDate.set(iso.slice(0, 10), {
          min: (tempArea.tempsMin || [])[i],
          max: (tempArea.tempsMax || [])[i]
        });
      });

      // JMA leaves the first day of the weekly outlook blank for
      // temperatures - those come from the city's own daily series instead
      // (today min/max then tomorrow min/max).
      const cityTs = forecast[0] && forecast[0].timeSeries && forecast[0].timeSeries[2];
      const cityArea = cityTs && (cityTs.areas || [])[0];
      if (cityTs && cityArea && cityArea.temps) {
        const defines = cityTs.timeDefines || [];
        const t = cityArea.temps;
        if (defines[0] && t[0] !== '' && t[1] !== '') {
          tempsByDate.set(defines[0].slice(0, 10), { min: t[0], max: t[1] });
        }
        if (defines[2] && t[2] !== '' && t[3] !== '') {
          tempsByDate.set(defines[2].slice(0, 10), { min: t[2], max: t[3] });
        }
      }

      return (codesTs.timeDefines || []).map((iso, i) => {
        const date = iso.slice(0, 10);
        const t = tempsByDate.get(date) || {};
        return {
          date,
          label: JMA_CODE_LABELS[(codeArea.weatherCodes || [])[i]] || '',
          pop: (codeArea.pops || [])[i],
          min: t.min,
          max: t.max
        };
      });
    }

    function tripDateForDayId(id) {
      const d = new Date(Date.UTC(2026, 9, 23 + (id - 1)));
      const p = n => String(n).padStart(2, '0');
      return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    }

    // Date-only formatting - the trip dates are JST calendar days, so they
    // must not be shifted by the viewer's own timezone.
    function tripDateLabel(dateISO) {
      const parts = String(dateISO).split('-').map(Number);
      if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return dateISO;
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
    }

    async function loadJmaWeather(area) {
      const [forecast, warnings] = await Promise.all([
        fetchJsonTimeout(`${JMA_FORECAST_BASE}${area.office}.json`),
        fetchJsonTimeout(`${JMA_WARNING_BASE}${area.office}.json`)
      ]);

      const parsed = {
        area, headline: '', detail: '', issued: '', temps: null,
        warnings: [], warningsFailed: false, week: []
      };

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
          parsed.headline = JMA_CODE_LABELS[code] || '';
          if (!parsed.headline) { parsed.headline = parsed.detail; parsed.detail = ''; }
        }
        const avg = forecast[1] && forecast[1].tempAverage && forecast[1].tempAverage.areas;
        if (avg && avg.length) {
          parsed.temps = { min: avg[0].min, max: avg[0].max };
        }
        parsed.week = parseJmaWeek(forecast);
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

    // JMA's public feed has no apparent-temperature field, so "feels like"
    // and the live current reading come from the same Open-Meteo model the
    // day cards already use. Cached for 20 minutes per place.
    const apparentNowCache = new Map();

    async function loadApparentNow(area) {
      const cached = apparentNowCache.get(area.code);
      if (cached && Date.now() - cached.at < 20 * 60 * 1000) return cached.value;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${area.lat}&longitude=${area.lng}` +
        '&current=temperature_2m,apparent_temperature&timezone=Asia%2FTokyo';
      const data = await fetchJsonTimeout(url, 8000);
      if (!data || !data.current) return null;
      const value = {
        temp: data.current.temperature_2m,
        apparent: data.current.apparent_temperature
      };
      apparentNowCache.set(area.code, { at: Date.now(), value });
      return value;
    }

    let weatherSelectedCode = null;
    let weatherSelectedDay = null;
    let weatherRequestToken = 0;

    async function selectWeatherFor(lat, lng, explicitCode, dayId) {
      const area = explicitCode
        ? JMA_AREAS.find(a => a.code === explicitCode)
        : findJmaArea(lat, lng);
      if (!area) return;
      weatherSelectedCode = area.code;
      weatherSelectedDay = dayId != null ? dayId : weatherSelectedDay;
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

      const [weather, typhoon, now] = await Promise.all([
        loadJmaWeather(area),
        loadJmaTyphoon(area),
        loadApparentNow(area)
      ]);
      if (token !== weatherRequestToken) return;

      const parts = [];
      // The forecast for the day being viewed comes first - that is the date
      // the traveller actually cares about.
      const targetDate = dayId != null ? tripDateForDayId(dayId) : null;
      const jmaDay = targetDate ? weather.week.find(w => w.date === targetDate) : null;
      const openMeteoDay = dayId != null ? weatherByDay[dayId] : null;

      // "feels like" is a model value - JMA does not publish one.
      const feelsBit = (min, max) => (min == null || max == null ? '' :
        `<span class="font-mono text-slate-400" title="${locMsg('Apparent temperature (model)', '体感温度（模式）')}">feels ${Math.round(min)}° / ${Math.round(max)}°C</span>`);

      if (jmaDay) {
        parts.push(`<div class="flex items-baseline gap-1.5">
          <span class="font-mono text-[10px] text-slate-400">${tripDateLabel(targetDate)}</span>
          <span class="font-semibold text-slate-100">${jmaDay.label}</span>
        </div>`);
        const bits = [];
        if (jmaDay.min != null && jmaDay.max != null) bits.push(`<span class="font-mono text-sky-300">${jmaDay.min}° / ${jmaDay.max}°C</span>`);
        if (openMeteoDay) bits.push(feelsBit(openMeteoDay.tminApp, openMeteoDay.tmaxApp));
        if (jmaDay.pop != null && jmaDay.pop !== '') bits.push(`<span class="font-mono text-blue-300">${jmaDay.pop}% rain</span>`);
        if (bits.length) parts.push(`<div>${bits.join(' · ')}</div>`);
      } else if (openMeteoDay) {
        // Beyond JMA's 7-day window - fall back to the model's day forecast.
        const meta = WMO_CODES[openMeteoDay.code] || WMO_CODES[3];
        parts.push(`<div class="flex items-baseline gap-1.5">
          <span class="font-mono text-[10px] text-slate-400">${tripDateLabel(targetDate)}</span>
          <span class="font-semibold text-slate-100">${meta[0]}</span>
        </div>`);
        const bits = [`<span class="font-mono text-sky-300">${Math.round(openMeteoDay.tmin)}° / ${Math.round(openMeteoDay.tmax)}°C</span>`];
        bits.push(feelsBit(openMeteoDay.tminApp, openMeteoDay.tmaxApp));
        if (openMeteoDay.pop != null) bits.push(`<span class="font-mono text-blue-300">${Math.round(openMeteoDay.pop)}% rain</span>`);
        parts.push(`<div>${bits.join(' · ')}</div>`);
      }

      // Current conditions - the trip is imminent, so the live readout and
      // any active warning matter more than a long-range outlook.
      if (weather.headline) {
        parts.push(`<div class="flex items-baseline gap-1.5 pt-0.5">
          <span class="font-mono text-[10px] text-slate-400">${locMsg('Today', '今天')}</span>
          <span class="text-slate-300">${weather.detail && weather.detail !== weather.headline ? weather.headline + ' · ' + weather.detail : weather.headline}</span>
        </div>`);
      }
      if (now) {
        parts.push(`<div class="font-mono text-[10px] text-slate-500">
          ${locMsg('Now', '当前')} <span class="text-sky-300">${Math.round(now.temp)}°C</span>
          ${now.apparent != null ? ` · <span class="text-slate-400">feels ${Math.round(now.apparent)}°C</span>` : ''}
        </div>`);
      } else if (weather.temps) {
        parts.push(`<div class="font-mono text-[10px] text-slate-500">${locMsg('Week avg', '本周均温')} ${weather.temps.min}° / ${weather.temps.max}°C</div>`);
      }
      if (bodyEl) bodyEl.innerHTML = parts.join('') || locMsg('No forecast available.', '暂无预报。');

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
        sourceEl.innerHTML = locMsg(
          `Forecast, alerts &amp; typhoon: <span class="text-slate-400">Japan Meteorological Agency</span> · issued ${issued}<br>` +
          `<span class="text-slate-400">Feels-like &amp; current: Open-Meteo model</span>`,
          `预报、警报与台风：<span class="text-slate-400">日本气象厅</span> · 发布于 ${issued}<br>` +
          `<span class="text-slate-400">体感温度与实况：Open-Meteo 模式</span>`
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
      // Picking a place should take you there - jump the map and the
      // itinerary to the day that spends the most time in that area.
      picker.onchange = () => {
        const code = picker.value;
        const day = dayForAreaCode(code);
        if (day) selectDay(day.id);
        else selectWeatherFor(null, null, code, weatherSelectedDay);
      };
    }

    // The day that a given JMA area belongs to.
    function dayForAreaCode(code) {
      for (const day of daysData) {
        if (dominantAreaForDay(day) === code) return day;
      }
      return null;
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
