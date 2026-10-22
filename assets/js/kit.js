    const KIT_TEXT = {
      en: { title: 'Weather & alerts' },
      zh: { title: '天气与警报' }
    };

    function applyKitText() {
      const t = KIT_TEXT[currentLang] || KIT_TEXT.en;
      document.getElementById('kitTitle').innerText = t.title;
    }

    function toggleKit() {
      const body = document.getElementById('kitBody');
      const chev = document.getElementById('kitChevron');
      const willOpen = body.classList.contains('hidden');
      body.classList.toggle('hidden', !willOpen);
      chev.classList.toggle('rotate-180', willOpen);
    }
