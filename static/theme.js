// 主题与调色板处理
const userPrefKey = 'fs_theme_pref';
let colorSchemeMQ = matchMedia('(prefers-color-scheme: dark)');
let mqListener = null;

function applyTheme(mode) {
    localStorage.setItem(userPrefKey, mode);
    if (mqListener && mode !== 'auto') {try { colorSchemeMQ.removeEventListener('change', mqListener); } catch (e) { try { colorSchemeMQ.removeListener(mqListener); } catch (e) { } }mqListener = null;}
    if (mode === 'dark') {
        document.documentElement.classList.add('dark-mode');
    } else if (mode === 'light') {
        document.documentElement.classList.remove('dark-mode');
    } else if (mode === 'auto') {
        if (colorSchemeMQ.matches) {document.documentElement.classList.add('dark-mode');} else {document.documentElement.classList.remove('dark-mode');}
        if (!mqListener) {
            mqListener = (e) => {if (e.matches) document.documentElement.classList.add('dark-mode'); else document.documentElement.classList.remove('dark-mode');};
            try { colorSchemeMQ.addEventListener('change', mqListener); } catch (e) { try { colorSchemeMQ.addListener(mqListener); } catch (e) { } }
        }
    }
    try {
        const btn = document.getElementById('themeBtn');
        if (btn) {
            const icons = { light: '☀️', dark: '🌙', auto: '🌗' };
            btn.textContent = icons[mode] || '🌗';
            btn.title = '切换主题（当前：' + (mode === 'light' ? '浅色' : mode === 'dark' ? '深色' : '自动') + '）';
        }
    } catch (e) { }
}
(function () {
    const saved = localStorage.getItem(userPrefKey);
    if (saved) {applyTheme(saved);} else {applyTheme('auto');}
})();

const themeBtn = document.getElementById('themeBtn');
if (themeBtn) themeBtn.addEventListener('click', () => {
    const current = localStorage.getItem(userPrefKey) || 'auto';
    const order = ['light', 'dark', 'auto'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    applyTheme(next);
    showToast && showToast('主题：' + next, 'ok');
});

// 主题色板菜单初始化
(function initPaletteMenu() {
    const menu = document.getElementById('themePaletteMenu');
    const mainBtn = document.getElementById('themeColorBtn');
    if (!menu || !mainBtn) return;
    const btns = [...menu.querySelectorAll('.palette-btn')];
    // 初始化按钮颜色与点击处理
    btns.forEach(b => {
        const c = b.getAttribute('data-color');
        b.style.background = c;
        b.addEventListener('click', (ev) => {
            ev.stopPropagation();
            btns.forEach(x => x.classList.remove('selected'));
            b.classList.add('selected');
            applyThemeColor(c);
            localStorage.setItem('fs_theme_color', c);
            menu.classList.remove('show');
            menu.classList.add('hide');
            setTimeout(() => { menu.style.display = 'none'; }, 180);
            showToast && showToast('主题色已设置: ' + c, 'ok', 1200);
        });
    });
    mainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.style.display === 'block' && menu.classList.contains('show')) {
            menu.classList.remove('show'); menu.classList.add('hide');
            setTimeout(() => { menu.style.display = 'none'; }, 180);
        } else {
            menu.style.display = 'block';
            requestAnimationFrame(() => { menu.classList.remove('hide'); menu.classList.add('show'); });
        }
    });
    const resetBtn = menu.querySelector('.reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetThemeColor();
            menu.classList.remove('show'); menu.classList.add('hide');
            setTimeout(() => { menu.style.display = 'none'; }, 180);
        });
    }
    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== mainBtn) {
            if (menu.style.display === 'block') {
                menu.classList.remove('show'); menu.classList.add('hide');
                setTimeout(() => { menu.style.display = 'none'; }, 180);
            }
        }
    });
    const saved = localStorage.getItem('fs_theme_color');
    if (saved) {
        const match = btns.find(x => x.getAttribute('data-color') === saved);
        if (match) { match.classList.add('selected'); applyThemeColor(saved); }
    }
})();

// 主题色处理函数（依赖 hex/rgb/hsl 工具）
function applyThemeColor(hex) {
    if (!hex || hex[0] !== '#') return;
    try {
        const rgb = hexToRgb(hex);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const primary = hex;
        const primaryMid = hslToHex(hsl.h, clamp(hsl.s * 0.95, 0.4, 0.9), clamp(hsl.l * 1.05, 0.45, 0.65));
        const primaryDark = hslToHex(hsl.h, clamp(hsl.s * 1.05, 0.6, 1), clamp(hsl.l * 0.75, 0.25, 0.45));
        const primary2 = hslToHex(hsl.h, clamp(hsl.s * 0.75, 0.3, 0.8), clamp(hsl.l * 1.3, 0.7, 0.85));
        const primary3 = hslToHex(hsl.h, clamp(hsl.s * 0.85, 0.4, 0.9), clamp(hsl.l * 1.1, 0.55, 0.75));
        const rgbVals = `${parseInt(rgb.r)},${parseInt(rgb.g)},${parseInt(rgb.b)}`;
        const bgLight = hslToHex(hsl.h, clamp(hsl.s * 0.25, 0.1, 0.4), clamp(hsl.l * 2.2, 0.92, 0.98));
        const bgMid = hslToHex(hsl.h, clamp(hsl.s * 0.15, 0.05, 0.3), clamp(hsl.l * 1.8, 0.88, 0.95));
        const bgDark = hslToHex(hsl.h, clamp(hsl.s * 0.9, 0.4, 1), clamp(hsl.l * 0.25, 0.08, 0.3));
        const bgDarkMid = hslToHex(hsl.h, clamp(hsl.s * 0.7, 0.3, 1), clamp(hsl.l * 0.12, 0.04, 0.18));
        const root = document.documentElement.style;
        root.setProperty('--primary', primary);
        root.setProperty('--primary-mid', primaryMid);
        root.setProperty('--primary-dark', primaryDark);
        root.setProperty('--primary-2', primary2);
        root.setProperty('--primary-3', primary3);
        root.setProperty('--primary-rgb', rgbVals);
        root.setProperty('--grad', `linear-gradient(135deg, ${primary}, ${primary2})`);
        root.setProperty('--bg-light', bgLight);
        root.setProperty('--bg-mid', bgMid);
        root.setProperty('--bg-dark', bgDark);
        root.setProperty('--bg-dark-mid', bgDarkMid);
        document.body.style.background = `radial-gradient(circle at 20% 20%, ${bgLight} 0%, ${bgMid} 40%, ${bgMid} 100%)`;
        document.body.style.backgroundAttachment = 'fixed';
        const darkModeStyle = document.getElementById('dynamicDarkBg') || document.createElement('style');
        darkModeStyle.id = 'dynamicDarkBg';
        darkModeStyle.textContent = `.dark-mode body { background: radial-gradient(circle at 20% 20%, ${bgDark} 0%, ${bgDarkMid} 60%, ${bgDarkMid} 100%) !important; background-attachment: fixed !important; }`;
        if (!document.getElementById('dynamicDarkBg')) {
            document.head.appendChild(darkModeStyle);
        }
    } catch (e) { console.error('theme color apply error', e); }
}

function resetThemeColor() {
    try {
        localStorage.removeItem('fs_theme_color');
        const dyn = document.getElementById('dynamicDarkBg');
        if (dyn && dyn.parentNode) dyn.parentNode.removeChild(dyn);
        const root = document.documentElement.style;
        root.removeProperty('--primary');
        root.removeProperty('--primary-mid');
        root.removeProperty('--primary-dark');
        root.removeProperty('--primary-2');
        root.removeProperty('--primary-3');
        root.removeProperty('--primary-rgb');
        root.removeProperty('--grad');
        root.removeProperty('--bg-light');
        root.removeProperty('--bg-mid');
        root.removeProperty('--bg-dark');
        root.removeProperty('--bg-dark-mid');
        document.body.style.background = '';
        document.body.style.backgroundAttachment = '';
        const menu = document.getElementById('themePaletteMenu');
        if (menu) {
            const sel = menu.querySelectorAll('.palette-btn.selected');
            sel.forEach(s => s.classList.remove('selected'));
        }
        showToast && showToast('已恢复为默认主题色', 'ok');
    } catch (e) {
        console.error('resetThemeColor error', e);
        showToast && showToast('恢复默认主题失败', 'err');
    }
}

// 色彩工具函数
function hexToRgb(hex) { const h = hex.replace('#', ''); const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16); const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255; return { r, g, b }; }
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); let h, s, l = (max + min) / 2; if (max === min) { h = s = 0; } else { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break; } h /= 6; } return { h: h * 360, s, l }; }
function hslToHex(h, s, l) { h /= 360; let r, g, b; if (s === 0) { r = g = b = l; } else { const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; }; const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3); } const toHex = x => { const v = Math.round(x * 255).toString(16).padStart(2, '0'); return v; }; return `#${toHex(r)}${toHex(g)}${toHex(b)}`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
