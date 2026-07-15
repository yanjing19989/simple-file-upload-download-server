// 浅色、深色、系统主题与强调色设置。
(function () {
    const themeKey = 'fs_theme_pref';
    const colorKey = 'fs_theme_color';
    const defaultColor = '#4f46e5';
    const media = matchMedia('(prefers-color-scheme: dark)');
    const appearanceBtn = document.getElementById('appearanceBtn');
    const panel = document.getElementById('appearancePanel');
    const closeBtn = document.getElementById('closeAppearanceBtn');
    const resetColorBtn = document.getElementById('resetThemeColorBtn');
    const modeButtons = [...document.querySelectorAll('[data-theme-mode]')];
    const colorButtons = [...document.querySelectorAll('.palette-btn[data-color]')];

    function savedValue(key, fallback) {
        try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
    }

    function setSavedValue(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    function applyTheme(mode, notify) {
        const isDark = mode === 'dark' || (mode === 'auto' && media.matches);
        document.documentElement.classList.toggle('dark-mode', isDark);
        setSavedValue(themeKey, mode);
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

    function channel(value) {
        return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
    }

    function darker(hex) {
        const rgb = hexToRgb(hex);
        return '#' + channel(rgb.r * .82) + channel(rgb.g * .82) + channel(rgb.b * .82);
    }

    function applyThemeColor(hex, persist, notify) {
        const rgb = hexToRgb(hex);
        const root = document.documentElement.style;
        root.setProperty('--primary', hex);
        root.setProperty('--primary-hover', darker(hex));
        root.setProperty('--primary-rgb', rgb.r + ',' + rgb.g + ',' + rgb.b);
        colorButtons.forEach(button => {
            const active = button.dataset.color.toLowerCase() === hex.toLowerCase();
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (persist) setSavedValue(colorKey, hex);
        if (notify && typeof showToast === 'function') showToast('主题色已更新', 'ok', 1600);
    }

    function resetThemeColor() {
        try { localStorage.removeItem(colorKey); } catch (e) {}
        const root = document.documentElement.style;
        ['--primary', '--primary-hover', '--primary-rgb'].forEach(name => root.removeProperty(name));
        colorButtons.forEach(button => {
            const active = button.dataset.color === defaultColor;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (typeof showToast === 'function') showToast('已恢复默认主题色', 'ok', 1600);
    }

    function setPanel(open) {
        panel.hidden = !open;
        appearanceBtn.setAttribute('aria-expanded', String(open));
        if (open) requestAnimationFrame(() => panel.querySelector('button').focus());
    }

    modeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeMode, true)));
    colorButtons.forEach(button => {
        button.style.background = button.dataset.color;
        button.style.color = button.dataset.color;
        button.addEventListener('click', () => applyThemeColor(button.dataset.color, true, true));
    });
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

    applyTheme(savedValue(themeKey, 'auto'), false);
    applyThemeColor(savedValue(colorKey, defaultColor), false, false);
})();
