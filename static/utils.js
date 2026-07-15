// 无 DOM 依赖的格式化、筛选和选择状态工具。
const FSUtils = (function () {
    const TYPE_GROUPS = [
        ['IMG', new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'])],
        ['ARC', new Set(['zip', 'rar', '7z', 'tar', 'gz'])],
        ['VID', new Set(['mp4', 'mkv', 'avi', 'mov', 'webm'])],
        ['AUD', new Set(['mp3', 'wav', 'flac', 'aac', 'ogg'])],
        ['PDF', new Set(['pdf'])],
        ['TXT', new Set(['txt', 'md', 'log'])],
        ['SRC', new Set(['py', 'js', 'ts', 'java', 'c', 'cpp', 'go', 'rs', 'sh', 'bat'])],
    ];
    const THEME_MODES = new Set(['light', 'dark', 'auto']);
    const THEME_COLORS = new Set([
        '#4f46e5', '#7c3aed', '#0891b2', '#059669',
        '#d97706', '#dc2626', '#db2777',
    ]);

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(
            /[&<>"']/g,
            character => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character],
        );
    }

    function formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = Number(bytes);
        if (!Number.isFinite(value) || value < 0) value = 0;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return value.toFixed(2) + ' ' + units[unit];
    }

    function extIcon(name) {
        const value = String(name || '');
        const extension = value.includes('.')
            ? value.split('.').pop().toLowerCase()
            : '';
        for (const [label, extensions] of TYPE_GROUPS) {
            if (extensions.has(extension)) return label;
        }
        return extension.substring(0, 3).toUpperCase();
    }

    function normalizeThemeMode(value) {
        return THEME_MODES.has(value) ? value : 'auto';
    }

    function normalizeThemeColor(value, fallback = '#4f46e5') {
        const normalized = String(value || '').toLowerCase();
        const normalizedFallback = String(fallback || '').toLowerCase();
        return THEME_COLORS.has(normalized)
            ? normalized
            : (THEME_COLORS.has(normalizedFallback)
                ? normalizedFallback
                : '#4f46e5');
    }

    function filterFiles(files, query) {
        const normalized = String(query || '').trim().toLowerCase();
        const source = Array.isArray(files) ? files : [];
        if (!normalized) return source.slice();
        return source.filter(file =>
            String(file.name || '').toLowerCase().includes(normalized)
        );
    }

    function retainAvailableSelection(selectedNames, files) {
        const available = new Set(
            (Array.isArray(files) ? files : []).map(file => file.name)
        );
        return new Set(
            [...selectedNames].filter(name => available.has(name))
        );
    }

    function updateVisibleSelection(selectedNames, visibleNames, operation) {
        const next = new Set(selectedNames);
        for (const name of visibleNames) {
            if (operation === 'select') next.add(name);
            else if (operation === 'invert') {
                if (next.has(name)) next.delete(name);
                else next.add(name);
            }
        }
        return next;
    }

    function debounce(callback, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => callback.apply(this, args), delay);
        };
    }

    return {
        escapeHtml,
        formatSize,
        extIcon,
        normalizeThemeMode,
        normalizeThemeColor,
        filterFiles,
        retainAvailableSelection,
        updateVisibleSelection,
        debounce,
    };
})();

if (typeof window !== 'undefined') window.FSUtils = FSUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = FSUtils;
