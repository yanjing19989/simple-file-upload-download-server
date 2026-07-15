// 浅色、深色、系统主题与强调色设置。
(function () {
    const themeKey = 'fs_theme_pref';
    const colorKey = 'fs_theme_color';
    const defaultColor = '#2563eb';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const appearanceBtn = document.getElementById('appearanceBtn');
    const panel = document.getElementById('appearancePanel');
    const closeBtn = document.getElementById('closeAppearanceBtn');
    const resetColorBtn = document.getElementById('resetThemeColorBtn');
    const modeButtons = [...document.querySelectorAll('[data-theme-mode]')];
    const colorButtons = [...document.querySelectorAll('.palette-btn[data-color]')];
    let currentColor = FSUtils.normalizeThemeColor(savedValue(colorKey, ''));
    if (!currentColor) {
        currentColor = defaultColor;
        try { localStorage.removeItem(colorKey); } catch (e) {}
    }

    function savedValue(key, fallback) {
        try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
    }

    function setSavedValue(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    function applyTheme(mode, notify) {
        mode = FSUtils.normalizeThemeMode(mode);
        const isDark = mode === 'dark' || (mode === 'auto' && media.matches);
        document.documentElement.classList.toggle('dark-mode', isDark);
        setSavedValue(themeKey, mode);
        applyThemeColor(currentColor, false, false);
        modeButtons.forEach(button => {
            const active = button.dataset.themeMode === mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (notify && typeof showToast === 'function') {
            const names = { light: '浅色', dark: '深色', auto: '跟随系统' };
            showToast('显示模式已切换为' + names[mode], 'ok', 1800);
        }
    }

    function hexToRgb(hex) {
        const value = parseInt(hex.slice(1), 16);
        return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
    }

    function updateSwatches(darkMode) {
        colorButtons.forEach(button => {
            const seed = FSUtils.normalizeThemeColor(button.dataset.color);
            const preset = FSUtils.getThemePreset(seed, darkMode);
            const active = seed === currentColor;
            button.style.background = preset.primary;
            button.style.color = preset.primary;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function applyThemeColor(hex, persist, notify) {
        const normalized = FSUtils.normalizeThemeColor(hex);
        if (!normalized) throw new RangeError('Unsupported theme color');
        currentColor = normalized;
        const darkMode = document.documentElement.classList.contains('dark-mode');
        const preset = FSUtils.getThemePreset(currentColor, darkMode);
        const rgb = hexToRgb(preset.primary);
        const root = document.documentElement.style;
        root.setProperty('--primary', preset.primary);
        root.setProperty('--primary-hover', preset.hover);
        root.setProperty('--primary-rgb', rgb.r + ',' + rgb.g + ',' + rgb.b);
        root.setProperty('--primary-contrast', preset.contrast);
        updateSwatches(darkMode);
        if (persist) setSavedValue(colorKey, currentColor);
        if (notify && typeof showToast === 'function') showToast('主题色已更新', 'ok', 1600);
    }

    function resetThemeColor() {
        try { localStorage.removeItem(colorKey); } catch (e) {}
        applyThemeColor(defaultColor, false, false);
        if (typeof showToast === 'function') showToast('已恢复默认主题色', 'ok', 1600);
    }

    function setPanel(open) {
        panel.hidden = !open;
        appearanceBtn.setAttribute('aria-expanded', String(open));
        if (open) requestAnimationFrame(() => panel.querySelector('button').focus());
    }

    modeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeMode, true)));
    colorButtons.forEach(button => button.addEventListener(
        'click',
        () => applyThemeColor(button.dataset.color, true, true),
    ));
    appearanceBtn.addEventListener('click', event => {
        event.stopPropagation();
        setPanel(panel.hidden);
    });
    closeBtn.addEventListener('click', () => { setPanel(false); appearanceBtn.focus(); });
    resetColorBtn.addEventListener('click', resetThemeColor);
    document.addEventListener('click', event => {
        if (!panel.hidden && !panel.contains(event.target) && event.target !== appearanceBtn) setPanel(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            setPanel(false);
            appearanceBtn.focus();
        }
    });
    const mediaChanged = () => {
        if (savedValue(themeKey, 'auto') === 'auto') applyTheme('auto', false);
    };
    try { media.addEventListener('change', mediaChanged); } catch (e) { media.addListener(mediaChanged); }

    applyTheme(FSUtils.normalizeThemeMode(savedValue(themeKey, 'auto')), false);
})();
