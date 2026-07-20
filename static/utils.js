// 无 DOM 依赖的格式化、筛选和选择状态工具。
const FSUtils = (function () {
    const TYPE_GROUPS = [
        ['image', new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff', 'heic'])],
        ['archive', new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst'])],
        ['video', new Set(['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v'])],
        ['audio', new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'])],
        ['pdf', new Set(['pdf'])],
        ['text', new Set(['txt', 'md', 'log', 'rtf', 'ini', 'conf'])],
        ['code', new Set(['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'java', 'c', 'h', 'cpp', 'hpp', 'go', 'rs', 'php', 'rb', 'sh', 'bat', 'ps1', 'sql'])],
        ['document', new Set(['doc', 'docx', 'odt', 'pages'])],
        ['sheet', new Set(['xls', 'xlsx', 'csv', 'tsv', 'ods', 'numbers'])],
        ['slide', new Set(['ppt', 'pptx', 'odp', 'key'])],
    ];
    const THEME_MODES = new Set(['light', 'dark', 'auto']);
    const SORT_FIELDS = new Set(['name', 'size', 'modified']);
    const FILE_NAME_COLLATOR = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    // 每项依次为浅色悬停色、深色主色、深色悬停色。
    const THEME_PRESETS = {
        '#2563eb': ['#1d4ed8', '#60a5fa', '#93c5fd'],
        '#0f766e': ['#115e59', '#5eead4', '#99f6e4'],
        '#15803d': ['#166534', '#4ade80', '#86efac'],
        '#b45309': ['#92400e', '#fbbf24', '#fcd34d'],
        '#c2410c': ['#9a3412', '#fb923c', '#fdba74'],
        '#be123c': ['#9f1239', '#fb7185', '#fda4af'],
        '#6d28d9': ['#5b21b6', '#a78bfa', '#c4b5fd'],
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
        for (const [type, extensions] of TYPE_GROUPS) {
            if (extensions.has(extension)) return type;
        }
        return 'file';
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
        const [lightHover, darkPrimary, darkHover] = THEME_PRESETS[color];
        return darkMode
            ? { primary: darkPrimary, hover: darkHover, contrast: '#111827' }
            : { primary: color, hover: lightHover, contrast: '#ffffff' };
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
