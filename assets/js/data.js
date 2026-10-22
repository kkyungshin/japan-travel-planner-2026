    // State Variables
    let currentLang = 'en';
    let isMobileMapVisible = false;
    let userLocation = null; // { lat, lng }
    let userMarker = null;
    let locationWatcher = null;
    const LOCATION_INTERVALS = [5, 10, 30, 60, 0];
    let locationInterval = 30;
    let lastLocationApplied = 0;
    let pendingCoords = null;
    let flushTimer = null;
    let locationPollTimer = null;
    let firstLocationFix = true;
    let locationWatchStartedAt = 0;
    let todayState = { dayId: null, nextIdx: null };
    let weatherByDay = {};

    // Itinerary dataset - maintained directly in this file (no Sheet sync)
    const daysData = [
      {
        id: 1,
        leg: 'hokkaido',
        date: 'Oct 23, 2026 (Fri) / 10月23日 (周五)',
        color: '#ef4444',
        title: { en: 'Sapporo Arrival & City Highlights', zh: '抵达札幌与市区观光' },
        estCost: null,
        stops: [
          { name: { en: 'Arrive New Chitose Airport (CTS)', zh: '抵达新千岁机场 (CTS)' }, time: '1:00 PM', desc: { en: 'Clear immigration and collect bags. Take the CTS Limousine Bus directly to Hotel Monterey (about 80 min). Pick up a JR Pass here only if using one.', zh: '办理入境并提取行李，搭乘 CTS 机场巴士直达蒙特利酒店（约80分钟）。如使用 JR Pass，可先在机场领取。' }, cost: '¥1,500', lat: 42.7752, lng: 141.6923 },
          { name: { en: 'Hotel Monterey Edelhof Sapporo', zh: '札幌蒙特利埃德尔霍夫酒店' }, time: '3:00 PM', desc: { en: 'CTS Limousine Bus drops you at the hotel. Check in and leave bags before exploring.', zh: '机场巴士直接抵达酒店。办理入住并寄存行李后开始市区行程。' }, cost: 'Paid', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Lunch — Soup Curry GARAKU', zh: '午餐 — 汤咖喱 GARAKU 本店' }, time: '3:30 PM', desc: { en: 'Recommended Hokkaido-style soup curry near Odori. Expect a short queue.', zh: '推荐大通附近的人气汤咖喱，可能需要短暂排队。' }, cost: '¥2,000', lat: 43.0569, lng: 141.3551 },
          { name: { en: 'Odori Park & Sapporo TV Tower', zh: '大通公园与札幌电视塔' }, time: '4:30 PM', desc: { en: 'Autumn foliage and sunset views. Buy the TV Tower observation deck ticket in advance if possible.', zh: '欣赏秋季红叶与日落。电视塔展望台门票建议提前购买。' }, cost: '¥1,000', lat: 43.0611, lng: 141.3564 },
          { name: { en: 'Tanukikoji & ABC Mart Grand Stage', zh: '狸小路商店街与 ABC Mart' }, time: '6:00 PM', desc: { en: 'Covered arcade for souvenirs and drugstores. ABC Mart Grand Stage for ASICS Novablast 6.', zh: '有顶商店街采购伴手礼与药妆；ABC Mart 旗舰店可看 ASICS Novablast 6。' }, cost: 'Varies', lat: 43.0573, lng: 141.3524 },
          { name: { en: 'Dinner — Susukino Miso Ramen', zh: '晚餐 — 薄野味噌拉面' }, time: '7:30 PM', desc: { en: 'Susukino-area miso ramen dinner.', zh: '在薄野区域享用味噌拉面。' }, cost: '¥2,000', lat: 43.0545, lng: 141.3533 },
          { name: { en: 'Susukino Nikka Street', zh: '薄野 Nikka 霓虹街' }, time: '8:30 PM', desc: { en: 'Iconic Nikka whisky sign and Susukino street photos.', zh: '打卡经典 Nikka 威士忌霓虹牌与薄野街景。' }, cost: 'Free', lat: 43.0545, lng: 141.3533 }
        ]
      },
      {
        id: 2,
        leg: 'hokkaido',
        date: 'Oct 24, 2026 (Sat) / 10月24日 (周六)',
        color: '#f97316',
        title: { en: 'Sapporo City, Ginkgo Ave & Mt. Moiwa', zh: '札幌市区、银杏大道与藻岩山夜景' },
        estCost: null,
        stops: [
          { name: { en: 'Breakfast Near Sapporo Station', zh: '札幌站附近早餐' }, time: '8:00 AM', desc: { en: 'Matsuya, Lawson, 7-Eleven or FamilyMart for a quick start.', zh: '在松屋、Lawson、7-11 或 FamilyMart 快速解决早餐。' }, cost: '¥500', lat: 43.0615, lng: 141.3540 },
          { name: { en: 'Hokkaido University Ginkgo Avenue', zh: '北海道大学银杏大道' }, time: '10:30 AM', desc: { en: 'Take the subway from Odori to Kita-junijo, or walk about 1 hour. The ginkgo avenue is the autumn highlight.', zh: '搭乘地铁自大通至北12条，或步行约1小时。银杏大道是秋季重点。' }, cost: '¥210', lat: 43.0722, lng: 141.3431 },
          { name: { en: 'Lunch — Nemuro Hanamaru Sushi', zh: '午餐 — 根室花丸回转寿司' }, time: '12:00 PM', desc: { en: 'Popular conveyor-belt sushi at Sapporo Station. Expect a queue.', zh: '札幌站人气回转寿司，可能需要排队。' }, cost: '¥4,000', lat: 43.0686, lng: 141.3508 },
          { name: { en: 'Sapporo Beer Museum', zh: '札幌啤酒博物馆' }, time: '1:30 PM', desc: { en: 'Bus 188 from the station north side, or walk 2 km. Museum tour is free; the tasting set is paid.', zh: '从札幌站北侧搭乘188路巴士，或步行2公里。博物馆参观免费，品酒套餐另付。' }, cost: '¥1,200 tasting + ¥240 bus', lat: 43.0714, lng: 141.3695 },
          { name: { en: 'Sports Depo / Tokyu Department Store', zh: 'Sports Depo / 东急百货（可选）' }, time: '2:30 PM', desc: { en: 'If you skip the Beer Museum, use this slot: Tokyu closes 8 PM, Sports Depo closes 9 PM.', zh: '若跳过啤酒博物馆，可在此购物：东急百货20:00关门，Sports Depo 21:00关门。' }, cost: 'Varies', lat: 43.0686, lng: 141.3508 },
          { name: { en: 'Mt. Moiwa Ropeway & Mini Cable Car', zh: '藻岩山缆车与迷你缆车' }, time: '3:45 PM', desc: { en: 'Take the tram/bus to Moiwa Sanroku, then ropeway + mini cable car to the summit. Round-trip adult set ¥2,100; arrive early for sunset. Last descent 9:50 PM.', zh: '搭电车/巴士至藻岩山麓，再换乘缆车与迷你缆车登顶。成人来回套票 ¥2,100；建议提早看日落，末班下山21:50。' }, cost: '¥2,100', lat: 43.0242, lng: 141.3328 },
          { name: { en: 'Dinner — Ebisoba Ichigen / Keyaki', zh: '晚餐 — 虾そば一幻 / Keyaki' }, time: '7:30 PM', desc: { en: 'Susukino-area ramen or tonkatsu dinner.', zh: '在薄野区域享用拉面或炸猪排。' }, cost: '¥2,000', lat: 43.0545, lng: 141.3533 }
        ]
      },
      {
        id: 3,
        leg: 'hokkaido',
        date: 'Oct 25, 2026 (Sun) / 10月25日 (周日)',
        color: '#eab308',
        title: { en: 'Otaru Day Trip & Shiroi Koibito Park', zh: '小樽一日游与白色恋人公园' },
        estCost: null,
        stops: [
          { name: { en: 'Breakfast Near Sapporo Station', zh: '札幌站附近早餐' }, time: '7:30 AM', desc: { en: 'Grab a light breakfast from a convenience store before the train.', zh: '搭车前在便利店简单吃早餐。' }, cost: '¥500', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Sapporo Station → Minami-Otaru', zh: '札幌站 → 南小樽站' }, time: '8:00 AM', desc: { en: 'JR Hakodate Main Line rapid (~35-40 min, ¥800). Sit on the right for coastal views.', zh: '搭乘 JR 函馆本线快速（约35-40分钟，¥800），靠右坐可看海景。' }, cost: '¥800', lat: 43.1878, lng: 141.0076 },
          { name: { en: 'LeTAO Main Store Cheesecake', zh: 'LeTAO 本店双层芝士蛋糕' }, time: '9:00 AM', desc: { en: 'Double Fromage cheesecake brunch at the Minami-Otaru main store.', zh: '在南小樽本店品尝招牌双层芝士蛋糕。' }, cost: '¥1,200', lat: 43.1901, lng: 141.0075 },
          { name: { en: 'Otaru Music Box Museum', zh: '小樽音乐盒堂' }, time: '9:30 AM', desc: { en: 'Free entry. Antique music boxes and DIY workshop.', zh: '免费入场，可看古董音乐盒与 DIY 体验。' }, cost: 'Free', lat: 43.1904, lng: 141.0078 },
          { name: { en: 'Sakaimachi Street & Kitaichi Glass', zh: '境町通与北一硝子' }, time: '10:15 AM', desc: { en: 'Glass workshops, souvenir shops and historic streetscape.', zh: '逛玻璃工艺店、伴手礼店与历史街区。' }, cost: '¥500', lat: 43.1912, lng: 141.0068 },
          { name: { en: 'Lunch — Otaru Poseidon / Sankaku Market', zh: '午餐 — 小樽波塞冬 / 三角市场' }, time: '11:30 AM', desc: { en: 'Seafood donburi at Sankaku Market or Otaru Poseidon.', zh: '在三角市场或小樽波塞冬享用海鲜丼。' }, cost: '¥1,500', lat: 43.1980, lng: 140.9985 },
          { name: { en: 'Otaru Taishou Glass Museum', zh: '小樽大正硝子馆' }, time: '12:45 PM', desc: { en: 'Optional glass museum and workshop stop in the canal district.', zh: '运河区可选参观大正硝子馆与玻璃工坊。' }, cost: '¥700 optional', lat: 43.1956, lng: 141.0035 },
          { name: { en: 'Otaru Canal Stroll', zh: '小樽运河散步' }, time: '1:30 PM', desc: { en: 'Gas lamps and stone warehouses near Asakusa Bridge. Fewer crowds early.', zh: '浅草桥旁看煤气灯与石造仓库，早点到人较少。' }, cost: 'Free', lat: 43.1983, lng: 140.9998 },
          { name: { en: 'Sankaku Market / Naruto Main Shop', zh: '三角市场 / 鸣门本店（视时间）' }, time: '2:15 PM', desc: { en: 'If time permits, browse Sankaku Market and the Naruto main shop before the train.', zh: '如时间允许，搭车前逛三角市场与鸣门本店。' }, cost: 'Varies', lat: 43.1980, lng: 140.9985 },
          { name: { en: 'Otaru Station → Sapporo Station', zh: '小樽站 → 札幌站' }, time: '3:00 PM', desc: { en: 'JR Hakodate Main Line rapid (~35 min, ¥800). Then transfer to the Tozai Line at Sapporo.', zh: '搭乘 JR 函馆本线快速（约35分钟，¥800），在札幌转东西线。' }, cost: '¥800', lat: 43.0687, lng: 141.3508 },
          { name: { en: 'Sapporo → Miyanosawa (Tozai Line)', zh: '札幌 → 宫之泽（东西线）' }, time: '3:15 PM', desc: { en: 'Tozai Line subway from Sapporo to Miyanosawa (~15 min, ¥330). This is the reliable approach; the JR Hassamu option adds a long walk.', zh: '搭东西线地铁自札幌至宫之泽（约15分钟，¥330）。此路线最稳妥；JR 发寒站方案步行较远。' }, cost: '¥330', lat: 43.0895, lng: 141.2780 },
          { name: { en: 'Shiroi Koibito Park', zh: '白色恋人公园' }, time: '3:45 PM', desc: { en: '7 min walk from Miyanosawa Station. Factory tour, chocolate lounge and illuminated garden. Indoor area closes 5 PM.', zh: '自宫之泽站步行7分钟。参观工厂、巧克力 lounge 与灯光庭园；室内17:00关闭。' }, cost: '¥1,200', lat: 43.0886, lng: 141.2710 },
          { name: { en: 'Dinner & Shopping — AEON Mall Hassamu', zh: '晚餐与购物 — AEON 发寒店' }, time: '6:00 PM', desc: { en: 'Dinner and shopping near the factory before returning to central Sapporo.', zh: '在工厂附近晚餐购物，再返回札幌市区。' }, cost: 'Varies', lat: 43.0895, lng: 141.2780 },
          { name: { en: 'Return to Odori Station', zh: '返回大通站' }, time: '9:00 PM', desc: { en: 'Tozai Line back to Odori (~15 min, ¥290).', zh: '搭东西线返回大通（约15分钟，¥290）。' }, cost: '¥290', lat: 43.0611, lng: 141.3564 }
        ]
      },
      {
        id: 4,
        leg: 'hokkaido',
        date: 'Oct 26, 2026 (Mon) / 10月26日 (周一)',
        color: '#10b981',
        title: { en: 'Asahikawa Zoo & Biei Blue Pond (Klook)', zh: '旭川动物园与美瑛青池一日游' },
        estCost: 'Tour Paid',
        stops: [
          { name: { en: 'Depart Hotel Monterey Edelhof', zh: '离开札幌蒙特利埃德尔霍夫酒店' }, time: '7:00 AM', desc: { en: 'Grab a light breakfast, then walk 9 min to the Sapporo TV Tower pick-up point.', zh: '简单吃早餐后，步行9分钟至札幌电视塔集合点。' }, cost: 'Free', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Board Tour Bus at Sapporo TV Tower', zh: '札幌电视塔集合点上车' }, time: '7:40 AM', desc: { en: 'Depart for Asahikawa on the Klook day tour.', zh: '搭乘 Klook 一日游巴士前往旭川。' }, cost: 'Tour Included', lat: 43.0611, lng: 141.3564 },
          { name: { en: 'Asahiyama Zoo', zh: '旭山动物园' }, time: '10:30 AM', desc: { en: 'Penguin walk, polar bears and seals. Entry included in the tour.', zh: '观赏企鹅散步、北极熊与海豹。门票已含在行程内。' }, cost: 'Included', lat: 43.7683, lng: 142.4800 },
          { name: { en: 'Lunch & Transfer to Biei', zh: '午餐并前往美瑛' }, time: '12:30 PM', desc: { en: 'Buy a bento at Asahikawa Station before heading to Biei.', zh: '在旭川站买便当，随后前往美瑛。' }, cost: 'Included', lat: 43.7683, lng: 142.4800 },
          { name: { en: 'Seven Stars Tree & Tree of Ken and Mary', zh: '七星之树与肯与玛丽之树' }, time: '1:15 PM', desc: { en: 'Short photo stops among the iconic Biei farm trees.', zh: '在美瑛经典风景树旁短暂停留拍照。' }, cost: 'Included', lat: 43.6198, lng: 142.4418 },
          { name: { en: 'Shirahige Falls', zh: '白须瀑布' }, time: '2:00 PM', desc: { en: '20-minute stop at the blue cascading falls.', zh: '停留20分钟观赏蓝色瀑布。' }, cost: 'Included', lat: 43.4751, lng: 142.6394 },
          { name: { en: 'Shirogane Blue Pond (Aoiike)', zh: '白金青池' }, time: '2:20 PM', desc: { en: 'Cobalt-blue pond with autumn trees. About 30 minutes.', zh: '欣赏钴蓝色池水与秋季枯木，停留约30分钟。' }, cost: 'Included', lat: 43.4934, lng: 142.6136 },
          { name: { en: 'Tour Return to Sapporo', zh: '一日游返回札幌' }, time: '3:30 PM', desc: { en: 'Scenic drive back to Sapporo.', zh: '乘车返回札幌。' }, cost: 'Included', lat: 43.0611, lng: 141.3564 },
          { name: { en: 'Evening Shopping in Sapporo', zh: '札幌晚间购物' }, time: '6:00 PM', desc: { en: 'Drop-off at Sapporo TV Tower, then shop around Tanukikoji or Sapporo Station.', zh: '于札幌电视塔下车，随后在狸小路或札幌站周边购物。' }, cost: 'Varies', lat: 43.0570, lng: 141.3506 }
        ]
      },
      {
        id: 5,
        leg: 'hokkaido',
        date: 'Oct 27, 2026 (Tue) / 10月27日 (周二)',
        color: '#06b6d4',
        title: { en: 'Noboribetsu Hell Valley & Lake Toya', zh: '登别地狱谷与洞爷湖一日游' },
        estCost: 'Tour Paid',
        stops: [
          { name: { en: 'Depart Hotel Monterey Edelhof', zh: '离开札幌蒙特利埃德尔霍夫酒店' }, time: '7:00 AM', desc: { en: 'Light breakfast, then walk 6 min to the Sapporo Station North Exit coach area.', zh: '简单吃早餐后，步行6分钟至札幌站北口团体巴士区。' }, cost: 'Free', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Board Tour Bus at Sapporo Station North Exit', zh: '札幌站北口团体巴士上车' }, time: '7:30 AM', desc: { en: 'Depart for Noboribetsu on the Klook day tour.', zh: '搭乘 Klook 一日游巴士前往登别。' }, cost: 'Tour Included', lat: 43.0695, lng: 141.3508 },
          { name: { en: 'Noboribetsu Hell Valley (Jigokudani)', zh: '登别地狱谷' }, time: '9:50 AM', desc: { en: '40-minute walk past steaming sulfur vents. Remove silver jewellery before the onsen.', zh: '步行40分钟游览地热硫磺喷气口。泡温泉前请摘下银饰。' }, cost: 'Free', lat: 42.4975, lng: 141.1432 },
          { name: { en: 'Showa-shinzan & Usuzan Ropeway', zh: '昭和新山与有珠山缆车' }, time: '11:30 AM', desc: { en: 'Active volcanic dome. Usuzan Ropeway is ¥2,000 per adult; about 1 hr 40 min here.', zh: '观赏活火山穹丘。有珠山缆车成人 ¥2,000，此地停留约1小时40分。' }, cost: '¥2,000', lat: 42.5422, lng: 140.8601 },
          { name: { en: 'Noboribetsu Bear Ranch (Optional)', zh: '登别熊牧场（可选）' }, time: '12:30 PM', desc: { en: 'Optional bear park near Showa-shinzan, about ¥1,000 per adult.', zh: '昭和新山旁的可选熊牧场，成人约 ¥1,000。' }, cost: '¥1,000 optional', lat: 42.5399, lng: 140.8644 },
          { name: { en: 'Lunch Near Showa-shinzan', zh: '昭和新山附近午餐' }, time: '12:50 PM', desc: { en: 'Limited restaurants within 3 km; eat before the Lake Toya stops.', zh: '3公里内餐厅有限，请在前往洞爷湖前用餐。' }, cost: 'Varies', lat: 42.5422, lng: 140.8601 },
          { name: { en: 'Lake Toya Lakeside', zh: '洞爷湖畔' }, time: '1:20 PM', desc: { en: 'Caldera lake walk; one of Japan’s northernmost non-freezing lakes.', zh: '火山口湖散步；日本最北的不冻湖之一。' }, cost: 'Free', lat: 42.5539, lng: 140.8197 },
          { name: { en: 'Lake Hill Farm', zh: 'Lake Hill 农场' }, time: '2:00 PM', desc: { en: 'Gelato with views of Mt. Yotei, “little Mt. Fuji”.', zh: '品尝冰淇淋并远眺“小富士”羊蹄山。' }, cost: '¥500', lat: 42.5539, lng: 140.8197 },
          { name: { en: 'Lake Toya Observation Deck', zh: '洞爷湖展望台' }, time: '2:35 PM', desc: { en: '30-minute photo stop over the caldera lake.', zh: '停留30分钟拍摄火山口湖全景。' }, cost: 'Free', lat: 42.5867, lng: 140.8450 },
          { name: { en: 'Jozankei Futami Park Foot Bath', zh: '定山溪二见公园足浴' }, time: '4:40 PM', desc: { en: 'Free hot-spring foot bath on the return route.', zh: '返程途中体验免费温泉足浴。' }, cost: 'Free', lat: 42.9648, lng: 141.1611 },
          { name: { en: 'Tour Return — Sapporo Station', zh: '一日游返回 — 札幌站' }, time: '6:00 PM', desc: { en: 'Drop-off at the station north exit.', zh: '于札幌站北口下车。' }, cost: 'Free', lat: 43.0687, lng: 141.3508 },
          { name: { en: 'Evening Shopping — Tokyu / Sapporo Station', zh: '晚间购物 — 东急 / 札幌站' }, time: '6:15 PM', desc: { en: 'Tokyu Department Store closes 8 PM; station malls stay open later.', zh: '东急百货20:00关门，车站商场营业较晚。' }, cost: 'Varies', lat: 43.0665, lng: 141.3531 }
        ]
      },
      {
        id: 6,
        leg: 'hokkaido',
        date: 'Oct 28, 2026 (Wed) / 10月28日 (周三)',
        color: '#6366f1',
        title: { en: 'Nijo Market & Sapporo Outlet Shopping', zh: '二条市场与三井 Outlet 购物日' },
        estCost: null,
        stops: [
          { name: { en: 'Depart Hotel Monterey Edelhof', zh: '离开札幌蒙特利埃德尔霍夫酒店' }, time: '8:15 AM', desc: { en: 'Walk about 10 min to Nijo Market for a seafood breakfast.', zh: '步行约10分钟前往二条市场吃海鲜早餐。' }, cost: 'Free', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Nijo Market Seafood Breakfast', zh: '二条市场海鲜早餐' }, time: '8:30 AM', desc: { en: 'Fresh seafood donburi. Bring cash; some stalls are cash-only.', zh: '新鲜海鲜丼；部分摊位只收现金。' }, cost: '¥2,000', lat: 43.0583, lng: 141.3585 },
          { name: { en: 'Mitsui Outlet Park Kitahiroshima', zh: '三井 Outlet Park 北广岛' }, time: '10:30 AM', desc: { en: 'Direct bus from Sapporo Station. Indoor outlet shopping with tax-free counters.', zh: '从札幌站搭直达巴士，室内 Outlet 购物，设免税柜台。' }, cost: '¥600 bus', lat: 42.9649, lng: 141.4645 },
          { name: { en: 'Lunch at Mitsui Outlet', zh: '三井 Outlet 午餐' }, time: '1:00 PM', desc: { en: 'Food court lunch before returning to Sapporo.', zh: '在美食广场午餐后返回札幌。' }, cost: '¥1,500', lat: 42.9649, lng: 141.4645 },
          { name: { en: 'Sapporo Factory', zh: '札幌工厂' }, time: '2:30 PM', desc: { en: 'Historic red-brick atrium complex with shops and cafes.', zh: '红砖历史建筑中庭，购物与咖啡店集中。' }, cost: 'Free', lat: 43.0658, lng: 141.3625 },
          { name: { en: 'Stellar Place & Daimaru', zh: 'Stellar Place 与大丸百货' }, time: '5:00 PM', desc: { en: 'Department stores directly connected to JR Sapporo Station.', zh: '与札幌站直通的大型百货商场。' }, cost: 'Free', lat: 43.0686, lng: 141.3508 },
          { name: { en: 'Sapporo Parco', zh: '札幌 PARCO' }, time: '6:15 PM', desc: { en: 'Mall on the south side of Sapporo Station; quick shopping stop.', zh: '札幌站南侧购物中心，快速逛街。' }, cost: 'Free', lat: 43.0587277, lng: 141.3531576 },
          { name: { en: 'Dinner & Packing', zh: '晚餐与整理行李' }, time: '7:15 PM', desc: { en: 'Dinner near Sapporo Station, then pack. Tomorrow JL2000 departs CTS at 08:55; leave the hotel by 05:30.', zh: '在札幌站附近晚餐后收拾行李。明日 JL2000 08:55 起飞，05:30 前离开酒店。' }, cost: '¥2,000', lat: 43.0686, lng: 141.3508 }
        ]
      },
      {
        id: 7,
        leg: 'kansai',
        date: 'Oct 29, 2026 (Thu) / 10月29日 (周四)',
        color: '#ec4899',
        title: { en: 'Fly to Osaka + Kobe Beef & Harbor', zh: '飞往大阪与神户牛排港湾' },
        estCost: null,
        stops: [
          { name: { en: 'Check Out Hotel Monterey Edelhof', zh: '退房离开札幌蒙特利酒店' }, time: '5:30 AM', desc: { en: 'Wake up and complete check-out. Confirm passports, bags and IC cards before leaving.', zh: '起床后退房，确认护照、行李与 IC 卡。' }, cost: 'Free', lat: 43.0637, lng: 141.3562 },
          { name: { en: 'Sapporo Station → CTS Airport', zh: '札幌站 → 新千岁机场' }, time: '6:00 AM', desc: { en: 'JR Rapid Airport (~37-40 min, ¥1,230). Sit near the door for easy exit at CTS.', zh: '搭 JR 快速机场线（约37-40分钟，¥1,230），坐近车门方便下车。' }, cost: '¥1,230', lat: 42.7752, lng: 141.6923 },
          { name: { en: 'JAL Check-in at CTS', zh: '新千岁机场 JAL 值机' }, time: '7:15 AM', desc: { en: 'Check bags and clear security. JL2000 departs at 08:55.', zh: '托运行李并过安检。JL2000 于08:55起飞。' }, cost: 'Flight', lat: 42.7752, lng: 141.6923 },
          { name: { en: 'Flight JL2000: CTS → ITM', zh: 'JAL JL2000: 新千岁 → 伊丹' }, time: '8:55 AM', desc: { en: 'Arrive Osaka Itami at 10:55 AM. Collect bags and follow signs to the limousine bus.', zh: '10:55抵达伊丹，提取行李后跟随指示前往机场巴士。' }, cost: 'Flight', lat: 34.7855, lng: 135.4382 },
          { name: { en: 'ITM Airport → Namba (Limousine Bus)', zh: '伊丹机场 → 难波（机场巴士）' }, time: '11:30 AM', desc: { en: 'Limousine bus to Namba/OCAT (~25-35 min, ¥650).', zh: '搭机场巴士至难波 OCAT（约25-35分钟，¥650）。' }, cost: '¥650', lat: 34.6655, lng: 135.5011 },
          { name: { en: 'Drop Bags at 323 Namba', zh: '难波 323 民宿寄存行李' }, time: '12:05 PM', desc: { en: 'Walk about 5 min from OCAT, drop bags, then head straight to Kobe.', zh: '自 OCAT 步行约5分钟寄存行李，随后直接前往神户。' }, cost: 'Paid', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Namba → Kobe Sannomiya', zh: '难波 → 神户三宫' }, time: '12:35 PM', desc: { en: 'Hanshin Rapid Express (~50 min, ¥420). ICOCA accepted.', zh: '搭阪神急行（约50分钟，¥420），可使用 ICOCA。' }, cost: '¥420', lat: 34.6672, lng: 135.4978 },
          { name: { en: 'Kobe Beef Kobe-Kippo Sannomiya', zh: '神户牛排 Kobe-Kippo 三宫' }, time: '1:40 PM', desc: { en: 'Five-minute walk from Hanshin Sannomiya. A5 Kobe beef set; reserve ahead if possible.', zh: '自阪神三宫步行5分钟。A5神户牛排套餐，建议提前预约。' }, cost: '¥5,500', lat: 34.6939, lng: 135.1954 },
          { name: { en: 'Kitano Ijinkan-gai', zh: '北野异人馆街' }, time: '3:00 PM', desc: { en: '19th-century foreign merchant mansions; walk the sloping streets.', zh: '19世纪外国商人宅邸，沿坡道散步。' }, cost: '¥500', lat: 34.7003, lng: 135.1901 },
          { name: { en: 'Shin-Kobe Ropeway & Herb Gardens', zh: '新神户索道与布引香草园' }, time: '3:40 PM', desc: { en: 'Ropeway up the Rokko slope for bay views; herb garden included.', zh: '搭缆车上六甲山坡看海湾，含香草园。' }, cost: '¥1,800', lat: 34.7042, lng: 135.1969 },
          { name: { en: 'Kobe Port Tower & Meriken Park Sunset', zh: '神户港塔与美利坚公园日落' }, time: '4:35 PM', desc: { en: 'Sunset at Meriken Park. Port Tower observation + rooftop is ¥1,200; observation only ¥1,000.', zh: '在美利坚公园看日落。港塔展望台+屋顶 ¥1,200，仅展望台 ¥1,000。' }, cost: '¥1,200 optional', lat: 34.6828, lng: 135.1867 },
          { name: { en: 'Nankinmachi (Chinatown) Dinner', zh: '南京町（神户中华街）晚餐' }, time: '6:40 PM', desc: { en: '15-minute walk from the port. Gyoza and street snacks.', zh: '自港口步行15分钟，吃煎饺与小吃。' }, cost: '¥1,500', lat: 34.6888, lng: 135.1882 },
          { name: { en: 'Kobe → Namba (Hanshin)', zh: '神户三宫 → 难波' }, time: '8:00 PM', desc: { en: 'Hanshin Rapid Express (~45 min, ¥420) direct to Osaka-Namba.', zh: '搭阪神急行（约45分钟，¥420）直达大阪难波。' }, cost: '¥420', lat: 34.6672, lng: 135.4978 },
          { name: { en: 'Back to 323 Namba', zh: '返回难波 323 民宿' }, time: '9:15 PM', desc: { en: 'Walk from Osaka-Namba to the Airbnb and rest before the early Uji start.', zh: '自大阪难波步行回民宿，早点休息准备宇治早起。' }, cost: 'Free', lat: 34.6639824, lng: 135.496854 }
        ]
      },
      {
        id: 8,
        leg: 'kansai',
        date: 'Oct 30, 2026 (Fri) / 10月30日 (周五)',
        color: '#8b5cf6',
        title: { en: 'Uji Matcha & Nara Deer Park', zh: '宇治抹茶与奈良赏鹿' },
        estCost: null,
        stops: [
          { name: { en: 'Depart 323 Namba', zh: '离开难波 323 民宿' }, time: '7:00 AM', desc: { en: 'Walk about 10 min to Namba Station, then Midosuji Line to Yodoyabashi.', zh: '步行约10分钟至难波站，搭御堂筋线至淀屋桥。' }, cost: 'Free', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Osaka → Keihan Uji', zh: '大阪 → 京阪宇治' }, time: '7:15 AM', desc: { en: 'Subway to Yodoyabashi, then Keihan Main Line to Chushojima and the Uji Line (~80-90 min).', zh: '地铁至淀屋桥，转京阪本线至中书岛，再转宇治线（约80-90分钟）。' }, cost: '¥680', lat: 34.8911, lng: 135.8073 },
          { name: { en: 'Byodoin Temple Phoenix Hall', zh: '平等院凤凰堂' }, time: '9:00 AM', desc: { en: 'UNESCO Phoenix Hall on the 10-yen coin. Garden + Hoshokan ¥700; Phoenix Hall interior +¥300.', zh: '世界遗产凤凰堂，日元10元硬币图案。庭园+凤翔馆 ¥700；凤凰堂内部另加 ¥300。' }, cost: '¥700 + ¥300 optional', lat: 34.8893, lng: 135.8077 },
          { name: { en: 'Uji Bridge & Matcha Omotesando', zh: '宇治桥与抹茶参道' }, time: '10:15 AM', desc: { en: 'Walk Byodoin-dori to Uji Bridge, then browse matcha shops and buy soft serve.', zh: '沿平等院通走到宇治桥，逛抹茶店并买冰淇淋。' }, cost: '¥800', lat: 34.8925, lng: 135.8065 },
          { name: { en: 'Lunch — Uji Matcha Soba', zh: '午餐 — 宇治抹茶荞麦面' }, time: '11:30 AM', desc: { en: 'Matcha soba or eel rice near Uji Station before the train to Nara.', zh: '在宇治站附近吃抹茶荞麦面或鳗鱼饭，再搭车去奈良。' }, cost: '¥2,000', lat: 34.8906, lng: 135.8040 },
          { name: { en: 'Uji → JR Nara', zh: 'JR 宇治 → JR 奈良' }, time: '12:30 PM', desc: { en: 'JR Nara Line Miyakoji Rapid (~25-30 min). Fare is about ¥500-510.', zh: '搭 JR 奈良线宫小路快速（约25-30分钟），票价约 ¥500-510。' }, cost: '¥510', lat: 34.6806, lng: 135.8190 },
          { name: { en: 'Todai-ji Great Buddha Hall', zh: '东大寺大佛殿' }, time: '1:30 PM', desc: { en: 'Great Buddha Hall adult ¥800; joint ticket with museum ¥1,200. About 1 hour.', zh: '大佛殿成人 ¥800；含博物馆联票 ¥1,200，停留约1小时。' }, cost: '¥800', lat: 34.6851, lng: 135.8430 },
          { name: { en: 'Nara Park Deer', zh: '奈良公园小鹿' }, time: '3:00 PM', desc: { en: 'Feed the free-roaming deer. Deer crackers are about ¥200; bow before feeding.', zh: '喂食自由漫步的小鹿。鹿仙贝约 ¥200，喂食前先鞠躬。' }, cost: '¥200', lat: 34.6857, lng: 135.8433 },
          { name: { en: 'Kasuga Taisha Shrine', zh: '春日大社' }, time: '3:45 PM', desc: { en: 'Lantern-lined approach through the forest. Inner sanctuary is optional.', zh: '穿过森林的石灯笼参道，本殿参拜可选。' }, cost: 'Free', lat: 34.6813, lng: 135.8483 },
          { name: { en: 'Mt. Wakakusa Sunset', zh: '若草山夕阳' }, time: '4:45 PM', desc: { en: 'Adult ¥150. Climb the grassy slope for sunset over Nara; last entry is around 5 PM.', zh: '成人 ¥150。登上草坡看奈良日落；最后入场约17:00。' }, cost: '¥150', lat: 34.6917, lng: 135.8498 },
          { name: { en: 'Nara → Osaka (JR)', zh: '奈良 → 大阪（JR）' }, time: '6:00 PM', desc: { en: 'JR Yamatoji Rapid to Osaka Station (~50 min, ¥840), then Midosuji subway to Namba.', zh: '搭 JR 大和路线快速至大阪站（约50分钟，¥840），再转御堂筋线到难波。' }, cost: '¥840 + subway', lat: 34.6806, lng: 135.8190 },
          { name: { en: 'Dotonbori Night Walk & Dinner', zh: '道顿堀夜游与晚餐' }, time: '7:30 PM', desc: { en: 'Glico Running Man, takoyaki and street food along the canal.', zh: '打卡格力高跑跑人、吃章鱼烧与沿河小吃。' }, cost: '¥1,500', lat: 34.6687, lng: 135.5013 },
          { name: { en: 'Return to 323 Namba', zh: '返回难波 323 民宿' }, time: '9:30 PM', desc: { en: 'Walk back to the Airbnb and prepare for the early Kyoto start.', zh: '步行回民宿，准备明日京都早起。' }, cost: 'Free', lat: 34.6639824, lng: 135.496854 }
        ]
      },
      {
        id: 9,
        leg: 'kansai',
        date: 'Oct 31, 2026 (Sat) / 10月31日 (周六)',
        color: '#a855f7',
        title: { en: 'Kyoto Torii, Kiyomizu & Golden Pavilion', zh: '京都千本鸟居、清水寺与金阁寺' },
        estCost: null,
        stops: [
          { name: { en: 'Depart 323 Namba', zh: '离开难波 323 民宿' }, time: '6:00 AM', desc: { en: 'Walk to Namba Station and take the Midosuji Line to Yodoyabashi, then Keihan to Fushimi-Inari (~55 min).', zh: '步行至难波站，搭御堂筋线至淀屋桥，转京阪本线至伏见稻荷（约55分钟）。' }, cost: '¥560', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Fushimi Inari Taisha', zh: '伏见稻荷大社' }, time: '7:30 AM', desc: { en: 'Walk the vermilion torii tunnels early; the upper loop takes 2+ hours, so turn back at Yotsutsuji for this schedule.', zh: '清晨走千本鸟居；完整绕山需2小时以上，本行程建议到四辻折返。' }, cost: 'Free', lat: 34.9671, lng: 135.7727 },
          { name: { en: 'Fushimi-Inari → Gion-Shijo', zh: '伏见稻荷 → 祇园四条' }, time: '10:00 AM', desc: { en: 'Keihan Main Line north to Gion-Shijo (~15 min, ¥210).', zh: '搭京阪本线北上至祇园四条（约15分钟，¥210）。' }, cost: '¥210', lat: 35.0037, lng: 135.7750 },
          { name: { en: 'Hanamikoji & Yasaka Shrine', zh: '花见小路与八坂神社' }, time: '10:15 AM', desc: { en: 'Traditional Gion streets and Yasaka Shrine; be respectful in geisha districts.', zh: '祇园传统街区与八坂神社；在艺伎区请保持礼貌。' }, cost: 'Free', lat: 35.0036, lng: 135.7786 },
          { name: { en: 'Kiyomizu-dera Temple', zh: '清水寺' }, time: '11:00 AM', desc: { en: 'Adult ¥500. The wooden stage overlooks Kyoto; allow 1 hour.', zh: '成人 ¥500。木质舞台可俯瞰京都，停留约1小时。' }, cost: '¥500', lat: 34.9949, lng: 135.7850 },
          { name: { en: 'Ninenzaka & Sannenzaka', zh: '二年坂与三年坂' }, time: '12:30 PM', desc: { en: 'Walk down the preserved stone lanes; sample matcha sweets.', zh: '沿保存完好的石板路下行，品尝抹茶甜点。' }, cost: 'Varies', lat: 34.9972, lng: 135.7816 },
          { name: { en: 'Nishiki Market (Optional)', zh: '锦市场（可选）' }, time: '1:30 PM', desc: { en: 'Optional food street; skip if you prefer more time at Nijo Castle.', zh: '可选美食街；若想多逛二条城可跳过。' }, cost: 'Varies', lat: 35.0050, lng: 135.7649 },
          { name: { en: 'Nijo Castle (Optional)', zh: '二条城（可选）' }, time: '2:00 PM', desc: { en: 'Optional ¥1,300 admission. Ninomaru Palace and nightingale floors.', zh: '可选门票 ¥1,300，参观二之丸御殿与莺鸣地板。' }, cost: '¥1,300 optional', lat: 35.0142, lng: 135.7481 },
          { name: { en: 'Kinkaku-ji (Golden Pavilion)', zh: '金阁寺' }, time: '3:45 PM', desc: { en: 'Adult ¥500. Last entry 4:30 PM; the garden route takes about 45 min.', zh: '成人 ¥500，最后入场16:30，庭园路线约45分钟。' }, cost: '¥500', lat: 35.0394, lng: 135.7292 },
          { name: { en: 'Kyoto → Shinsaibashi', zh: '京都 → 心斋桥' }, time: '5:00 PM', desc: { en: 'Hankyu Kyoto Line to Osaka-Umeda (~45 min, ¥410), then Midosuji subway to Shinsaibashi.', zh: '搭阪急京都线至大阪梅田（约45分钟，¥410），转御堂筋线至心斋桥。' }, cost: '¥410 + subway', lat: 34.6740, lng: 135.5010 },
          { name: { en: 'Shinsaibashi Shopping & Dinner', zh: '心斋桥购物与晚餐' }, time: '6:45 PM', desc: { en: 'Shopping arcade, drugstores and dinner in Shinsaibashi.', zh: '心斋桥商店街购物、药妆与晚餐。' }, cost: '¥3,000', lat: 34.6740, lng: 135.5010 },
          { name: { en: 'Return to 323 Namba', zh: '返回难波 323 民宿' }, time: '9:00 PM', desc: { en: 'Walk back and pack for the departure day.', zh: '步行回民宿，收拾行李准备回程日。' }, cost: 'Free', lat: 34.6639824, lng: 135.496854 }
        ]
      },
      {
        id: 10,
        leg: 'kansai',
        date: 'Nov 01, 2026 (Sun) / 11月01日 (周日)',
        color: '#14b8a6',
        title: { en: 'Umeda Shopping → Rinku → KIX', zh: '梅田购物・临空城・关西机场离境' },
        estCost: null,
        stops: [
          { name: { en: 'Breakfast Near Namba', zh: '难波附近早餐' }, time: '8:30 AM', desc: { en: 'Relaxed breakfast near the Airbnb before checkout.', zh: '退房前在民宿附近悠闲吃早餐。' }, cost: '¥800', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Check Out & Store Luggage', zh: '退房并寄存行李' }, time: '9:30 AM', desc: { en: 'Check out and leave bags in Namba Station coin lockers (large locker about ¥1,500).', zh: '退房后将行李寄放在难波站置物柜（大柜约 ¥1,500）。' }, cost: '¥1,500', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Umeda Shopping — Grand Front & LUCUA', zh: '梅田购物 — Grand Front 与 LUCUA' }, time: '10:00 AM', desc: { en: 'Midosuji Line to Umeda. Shop Grand Front Osaka, LUCUA and Daimaru for last-minute gifts.', zh: '搭御堂筋线至梅田，逛 Grand Front、LUCUA 与大丸买最后伴手礼。' }, cost: 'Varies', lat: 34.7052, lng: 135.4951 },
          { name: { en: 'Umeda Sky Building (Optional)', zh: '梅田蓝天大厦（可选）' }, time: '11:30 AM', desc: { en: 'Optional Floating Garden Observatory, adult about ¥1,500.', zh: '可选空中庭园展望台，成人约 ¥1,500。' }, cost: '¥1,500 optional', lat: 34.7052, lng: 135.4897 },
          { name: { en: 'Lunch in Umeda', zh: '梅田午餐' }, time: '12:30 PM', desc: { en: 'Lunch in the station area before heading south to Rinku.', zh: '在车站区域午餐，随后南下临空城。' }, cost: '¥1,500', lat: 34.7025, lng: 135.4959 },
          { name: { en: 'More Shopping / Cafe Break', zh: '继续购物 / 咖啡休息' }, time: '1:30 PM', desc: { en: 'Last shopping or a cafe break; keep an eye on the clock for the airport.', zh: '最后购物或咖啡休息，注意前往机场的时间。' }, cost: 'Varies', lat: 34.7025, lng: 135.4959 },
          { name: { en: 'Umeda → Namba', zh: '梅田 → 难波' }, time: '2:15 PM', desc: { en: 'Midosuji subway to Namba (~15 min, ¥240). Collect luggage from the locker.', zh: '搭御堂筋线至难波（约15分钟，¥240），取回置物柜行李。' }, cost: '¥240', lat: 34.6639824, lng: 135.496854 },
          { name: { en: 'Namba → Rinku Town', zh: '难波 → 临空城' }, time: '2:45 PM', desc: { en: 'Nankai Airport Express to Rinku Town (~45 min, ¥970).', zh: '搭南海机场急行至临空城（约45分钟，¥970）。' }, cost: '¥970', lat: 34.4068, lng: 135.2954 },
          { name: { en: 'Rinku Premium Outlets', zh: '临空城 Premium Outlets' }, time: '3:30 PM', desc: { en: 'Quick outlet stop with luggage lockers on site. Aim to leave by 4:40 PM.', zh: '快速逛 Outlet，现场有置物柜；建议16:40前离开。' }, cost: 'Free', lat: 34.4068, lng: 135.2954 },
          { name: { en: 'Rinku Town → KIX', zh: '临空城 → 关西机场' }, time: '4:40 PM', desc: { en: 'Nankai train across Sky Gate Bridge (~6 min, ¥380).', zh: '搭南海电铁跨天空之门大桥（约6分钟，¥380）。' }, cost: '¥380', lat: 34.4320, lng: 135.2304 },
          { name: { en: 'KIX Check-in & Security', zh: '关西机场值机与安检' }, time: '5:00 PM', desc: { en: 'Check in for the Singapore flight, drop bags and clear security with about 2 hours before departure.', zh: '办理新加坡航班值机、托运行李并过安检，距起飞约2小时。' }, cost: 'Flight', lat: 34.4320, lng: 135.2304 },
          { name: { en: 'Flight KIX → SIN', zh: '航班 KIX → 新加坡' }, time: '7:00 PM', desc: { en: 'Depart Kansai International Airport for Singapore.', zh: '自关西国际机场起飞返回新加坡。' }, cost: 'Flight', lat: 34.4320, lng: 135.2304 }
        ]
      }
    ];
