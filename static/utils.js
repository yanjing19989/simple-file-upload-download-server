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
    const SORT_FIELDS = new Set(['name', 'size', 'modified']);
    const FILE_NAME_COLLATOR = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    const THEME_PRESETS = {
        '#2563eb': {
            light: { primary: '#2563eb', hover: '#1d4ed8', contrast: '#ffffff' },
            dark: { primary: '#60a5fa', hover: '#93c5fd', contrast: '#111827' },
        },
        '#0f766e': {
            light: { primary: '#0f766e', hover: '#115e59', contrast: '#ffffff' },
            dark: { primary: '#5eead4', hover: '#99f6e4', contrast: '#111827' },
        },
        '#15803d': {
            light: { primary: '#15803d', hover: '#166534', contrast: '#ffffff' },
            dark: { primary: '#4ade80', hover: '#86efac', contrast: '#111827' },
        },
        '#b45309': {
            light: { primary: '#b45309', hover: '#92400e', contrast: '#ffffff' },
            dark: { primary: '#fbbf24', hover: '#fcd34d', contrast: '#111827' },
        },
        '#c2410c': {
            light: { primary: '#c2410c', hover: '#9a3412', contrast: '#ffffff' },
            dark: { primary: '#fb923c', hover: '#fdba74', contrast: '#111827' },
        },
        '#be123c': {
            light: { primary: '#be123c', hover: '#9f1239', contrast: '#ffffff' },
            dark: { primary: '#fb7185', hover: '#fda4af', contrast: '#111827' },
        },
        '#6d28d9': {
            light: { primary: '#6d28d9', hover: '#5b21b6', contrast: '#ffffff' },
            dark: { primary: '#a78bfa', hover: '#c4b5fd', contrast: '#111827' },
        },
    };
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

    function formatModified(value) {
        const timestamp = Number(value);
        if (!Number.isFinite(timestamp) || timestamp < 0) return '—';
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString([], {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
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

    function normalizeThemeColor(value) {
        const normalized = String(value || '').toLowerCase();
        return THEME_PRESETS[normalized] ? normalized : null;
    }

    function getThemePreset(value, darkMode) {
        const color = normalizeThemeColor(value);
        if (!color) throw new RangeError('Unsupported theme color');
        return THEME_PRESETS[color][darkMode ? 'dark' : 'light'];
    }

    function getThemeColors() {
        return Object.keys(THEME_PRESETS);
    }

    function filterFiles(files, query) {
        const normalized = String(query || '').trim().toLowerCase();
        const source = Array.isArray(files) ? files : [];
        if (!normalized) return source.slice();
        return source.filter(file =>
            String(file.name || '').toLowerCase().includes(normalized)
        );
    }

    function joinPath(base, name) {
        const prefix = String(base || '').replace(/\/+$/, '');
        const suffix = String(name || '').replace(/^\/+/, '');
        if (!prefix) return suffix;
        if (!suffix) return prefix;
        return prefix + '/' + suffix;
    }

    function buildBreadcrumbs(path) {
        const breadcrumbs = [{ label: '根目录', path: '' }];
        let current = '';
        for (const part of String(path || '').split('/').filter(Boolean)) {
            current = joinPath(current, part);
            breadcrumbs.push({ label: part, path: current });
        }
        return breadcrumbs;
    }

    function sortFiles(files, field = 'modified', direction = 'desc') {
        const source = Array.isArray(files) ? files.slice() : [];
        const selectedField = SORT_FIELDS.has(field)
            ? field
            : 'modified';
        const multiplier = direction === 'asc' ? 1 : -1;

        return source.sort((left, right) => {
            const leftName = String(left.name || '');
            const rightName = String(right.name || '');
            const leftDirectory = left.kind === 'directory';
            const rightDirectory = right.kind === 'directory';
            if (leftDirectory !== rightDirectory) {
                return leftDirectory ? -1 : 1;
            }
            if (selectedField === 'size' && leftDirectory) {
                return FILE_NAME_COLLATOR.compare(leftName, rightName);
            }
            let primary;
            if (selectedField === 'name') {
                primary = FILE_NAME_COLLATOR.compare(leftName, rightName);
            } else {
                const leftValue = Number(left[selectedField]);
                const rightValue = Number(right[selectedField]);
                primary = (Number.isFinite(leftValue) ? leftValue : 0) -
                    (Number.isFinite(rightValue) ? rightValue : 0);
            }
            if (primary) return primary * multiplier;

            const nameOrder = FILE_NAME_COLLATOR.compare(
                leftName,
                rightName,
            );
            if (nameOrder) return nameOrder;
            if (leftName === rightName) return 0;
            return leftName < rightName ? -1 : 1;
        });
    }

    function findUploadConflicts(files, currentFiles) {
        const existingNames = new Set(
            (Array.isArray(currentFiles) ? currentFiles : [])
                .map(file => String(file.name || '').toLowerCase())
                .filter(Boolean)
        );
        const selectedNames = new Map();
        const conflicts = new Map();
        for (const file of Array.from(files || [])) {
            const name = String(file && file.name || '');
            const normalized = name.toLowerCase();
            if (!normalized) continue;
            if (existingNames.has(normalized)) {
                conflicts.set(normalized, name);
            }
            if (selectedNames.has(normalized)) {
                conflicts.set(normalized, selectedNames.get(normalized));
            } else {
                selectedNames.set(normalized, name);
            }
        }
        return [...conflicts.values()];
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
        formatModified,
        extIcon,
        normalizeThemeMode,
        normalizeThemeColor,
        getThemePreset,
        getThemeColors,
        filterFiles,
        joinPath,
        buildBreadcrumbs,
        sortFiles,
        findUploadConflicts,
        retainAvailableSelection,
        updateVisibleSelection,
        debounce,
    };
})();

if (typeof window !== 'undefined') window.FSUtils = FSUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = FSUtils;
