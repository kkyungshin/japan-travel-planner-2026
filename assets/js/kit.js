    const KIT_TEXT = {
      en: {
        title: 'Weather notes',
        line1: 'JMA recorded its strongest El Niño on record in September (NINO.3 at +4.0°C, beating the 1997 peak), and NOAA puts >83% odds it peaks this winter. El Niño weakens the winter monsoon, so Japan skews milder: JMA has Hokkaido at 40% above-normal temps and Kansai at 60%.',
        line2: 'A warm winter is not a warm trip. El Niño years swing further between spells — JMA notes cold outbreaks and Pacific-side snow are more likely precisely because the pattern is unstable. Treat the outlook as a lean, not a forecast.',
        line3: 'The Pacific side is the wet side. JMA expects more rain and fewer clear days for Osaka and Kyoto this winter, so the Kansai leg (Days 7–10) is the one most likely to be wet, not snowy.',
        line4: 'Days 4–5 remain the coldest exposure: Lake Toya and Noboribetsu sit 40–70 km inland, both tours start around 7 AM outdoors, and Jozankei’s foot bath is outside. Sunset is ~16:50.'
      },
      zh: {
        title: '天气备注',
        line1: '日本气象厅记录到有观测以来最强的厄尔尼诺（9月 NINO.3 达 +4.0°C，超过 1997 年峰值），美国 NOAA 认为今冬达到峰值的概率超过 83%。厄尔尼诺会削弱冬季季风，日本整体偏暖：气象厅预计北海道气温偏高的概率为 40%，关西为 60%。',
        line2: '暖冬不等于暖行程。厄尔尼诺年份气温起伏更大 —— 气象厅指出，正因为环流不稳定，寒潮与太平洋侧降雪反而更容易发生。请将此视为概率倾向，而非确定性预报。',
        line3: '太平洋侧是湿侧。气象厅预计今冬大阪与京都降雨更多、晴天更少，因此关西段（第 7–10 天）最可能遇到的是雨天而非雪天。',
        line4: '第 4–5 天仍是最冷时段：洞爷湖与登别位于内陆 40–70 公里，两天一日游均于早上 7 点左右在户外开始，定山溪足浴也在户外。日落约 16:50。'
      }
    };

    function applyKitText() {
      const t = KIT_TEXT[currentLang] || KIT_TEXT.en;
      document.getElementById('kitTitle').innerText = t.title;
      ['line1', 'line2', 'line3', 'line4'].forEach(k => {
        const el = document.getElementById('kit-' + k);
        if (el) el.innerText = t[k];
      });
    }

    function toggleKit() {
      const body = document.getElementById('kitBody');
      const chev = document.getElementById('kitChevron');
      const willOpen = body.classList.contains('hidden');
      body.classList.toggle('hidden', !willOpen);
      chev.classList.toggle('rotate-180', willOpen);
    }
