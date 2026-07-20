// DOM、渲染和交互状态集中在此模块，业务请求由 files.js 提供。
window.FSUI = (function () {
    const elements = {
        fileInput: document.getElementById('fileInput'),
        uploadBtn: document.getElementById('uploadBtn'),
        progressBar: document.getElementById('progressBar'),
        progressPercent: document.getElementById('progressPercent'),
        status: document.getElementById('status'),
        speedLine: document.getElementById('speedLine'),
        etaLine: document.getElementById('etaLine'),
        uploadStatus: document.getElementById('uploadStatus'),
        dropZone: document.getElementById('dropZone'),
        selectedList: document.getElementById('selectedList'),
        uploadTarget: document.getElementById('uploadTarget'),
        breadcrumb: document.getElementById('breadcrumb'),
        fileTableBody: document.getElementById('fileTableBody'),
        fileCount: document.getElementById('fileCount'),
        selectedCount: document.getElementById('selectedCount'),
        lastRefresh: document.getElementById('lastRefresh'),
        downloadBtn: document.getElementById('downloadSelBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        selectAllBtn: document.getElementById('selectAllBtn'),
        invertBtn: document.getElementById('invertBtn'),
        searchInput: document.getElementById('search'),
        clearBtn: document.getElementById('clearBtn'),
        sortButtons: document.querySelectorAll('[data-sort]'),
        overwriteModal: document.getElementById('overwriteModal'),
        overwriteList: document.getElementById('overwriteList'),
        overwriteMore: document.getElementById('overwriteMore'),
        cancelOverwriteBtn: document.getElementById('cancelOverwriteBtn'),
        confirmOverwriteBtn: document.getElementById('confirmOverwriteBtn'),
        resetKeyBtn: document.getElementById('resetKeyBtn'),
        encState: document.getElementById('encState'),
        securityPill: document.getElementById('securityPill'),
        aboutBtn: document.getElementById('aboutBtn'),
        aboutModal: document.getElementById('aboutModal'),
        toastStack: document.getElementById('toastStack'),
    };
    const FILE_ICON_SVGS = {
        file: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8" cy="12" r=".7"/><circle cx="12" cy="12" r=".7"/><circle cx="16" cy="12" r=".7"/></svg>',
        image: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.5"/><path d="m6.5 17 4-4 2.5 2 2-2 2.5 4"/></svg>',
        archive: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 9h16M10 4v2m0 1.5v3m0 1.5v2m-1 1.5h2v2H9z"/></svg>',
        video: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m10 8.5 5.5 3.5-5.5 3.5Z"/></svg>',
        audio: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M11 15.5V8l5-1v7M11 10l5-1"/><circle cx="8.5" cy="15.5" r="2.5"/><circle cx="13.5" cy="14" r="2.5"/></svg>',
        pdf: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 16.5c2.8-3.3 4.2-6.3 3.5-8.6-.3-1.1-1.4-1-1.4.2.1 2.8 2.4 6.2 5.6 7.5 1.3.5 1.8-.5.8-1.1-2.3-1.4-6-.6-8.9.8"/></svg>',
        text: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8.5h8m-8 3.5h8m-8 3.5h5"/></svg>',
        code: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m10 9-3 3 3 3m4-6 3 3-3 3"/></svg>',
        document: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 8 2 8 2-6 2 6 2-8"/></svg>',
        sheet: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8m-8 4h8m-8 4h8M11 8v8"/></svg>',
        slide: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20l4-4 4 4M8 8h4m-4 3h7"/></svg>',
    };

    let actions = {};
    let selectedNames = new Set();
    let uploadBusy = false;
    let downloadBusy = false;
    let sortState = { field: 'modified', direction: 'desc' };
    let pendingOverwrite = null;
    let overwritePreviousFocus = null;
    let overwritePreviousOverflow = '';
    let lastFocusedElement = null;
    let previousBodyOverflow = '';

    function fileIconMarkup(name) {
        const type = FSUtils.extIcon(name);
        const icon = FILE_ICON_SVGS[type] || FILE_ICON_SVGS.file;
        return '<span class="file-icon file-icon--' + type +
            '" aria-hidden="true">' + icon + '</span>';
    }

    function showToast(message, type = 'ok', timeout = 3200) {
        while (elements.toastStack.children.length >= 4) {
            elements.toastStack.firstElementChild.remove();
        }
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.setAttribute('role', type === 'err' ? 'alert' : 'status');
        toast.textContent = message;
        elements.toastStack.appendChild(toast);
        setTimeout(() => {
            if (!toast.isConnected) return;
            toast.classList.add('is-leaving');
            setTimeout(() => toast.remove(), 200);
        }, timeout);
    }

    function getUploadFiles() {
        return Array.from(elements.fileInput.files || []);
    }

    function updateSelectedFiles() {
        const files = getUploadFiles();
        if (!files.length) {
            elements.selectedList.textContent = '尚未选择文件';
            elements.uploadBtn.disabled = true;
            return;
        }
        const total = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const names = files.map(file => file.name);
        const preview = names.slice(0, 3).join('、') +
            (names.length > 3 ? ' 等' : '');
        elements.selectedList.textContent =
            files.length + ' 个文件 · ' + FSUtils.formatSize(total) +
            ' · ' + preview;
        elements.uploadBtn.disabled = uploadBusy;
    }

    function handleFiles(files) {
        if (!files || !files.length) return;
        try {
            const transfer = new DataTransfer();
            for (const file of files) transfer.items.add(file);
            elements.fileInput.files = transfer.files;
            updateSelectedFiles();
            showToast('已选择 ' + files.length + ' 个文件');
        } catch (error) {
            showToast(
                '当前浏览器无法接收拖放文件，请使用“选择文件”',
                'warn',
            );
        }
    }

    function setUploadBusy(busy) {
        uploadBusy = Boolean(busy);
        elements.uploadBtn.disabled =
            uploadBusy || getUploadFiles().length === 0;
        elements.uploadBtn.querySelector('span').textContent =
            uploadBusy ? '正在上传' : '开始上传';
        elements.fileInput.disabled = uploadBusy;
        elements.resetKeyBtn.disabled = uploadBusy;
        elements.clearBtn.textContent =
            uploadBusy ? '取消上传' : '清空进度';
        elements.clearBtn.classList.toggle('ghost-button', !uploadBusy);
        elements.clearBtn.classList.toggle('danger-button', uploadBusy);
        elements.dropZone.setAttribute('aria-disabled', String(uploadBusy));
        for (const button of elements.breadcrumb.querySelectorAll('button')) {
            button.disabled = uploadBusy;
        }
        for (const button of elements.fileTableBody.querySelectorAll(
            '.directory-link'
        )) {
            button.disabled = uploadBusy;
        }
    }

    function setUploadStatus(type, title, detail) {
        elements.uploadStatus.className = 'upload-status is-' + type;
        elements.status.textContent = title;
        if (detail !== undefined) elements.etaLine.textContent = detail;
    }

    function setUploadProgress(percent, speed, eta) {
        const numeric = Number(percent);
        const value = Number.isFinite(numeric)
            ? Math.max(0, Math.min(100, numeric))
            : 0;
        elements.progressBar.value = value;
        elements.progressBar.textContent = value.toFixed(0) + '%';
        elements.progressPercent.textContent = value.toFixed(0) + '%';
        elements.speedLine.textContent = speed || '0 KB/s';
        elements.etaLine.textContent =
            eta || (value >= 100 ? '传输完成' : '计算剩余时间');
    }

    function clearUploadProgress() {
        setUploadProgress(0, '0 KB/s', '准备就绪');
        setUploadStatus('idle', '等待上传', '准备就绪');
    }

    function clearUploadSelection() {
        elements.fileInput.value = '';
        updateSelectedFiles();
    }

    function setDirectory(path) {
        const breadcrumbs = FSUtils.buildBreadcrumbs(path);
        const fragment = document.createDocumentFragment();
        for (const [index, breadcrumb] of breadcrumbs.entries()) {
            const button = document.createElement('button');
            button.className = 'breadcrumb-button' +
                (index === breadcrumbs.length - 1 ? ' is-current' : '');
            button.type = 'button';
            button.dataset.path = breadcrumb.path;
            button.textContent = breadcrumb.label;
            button.disabled = uploadBusy;
            if (index === breadcrumbs.length - 1) {
                button.setAttribute('aria-current', 'page');
            }
            fragment.appendChild(button);
        }
        elements.breadcrumb.replaceChildren(fragment);
        elements.uploadTarget.textContent =
            '当前位置：' + breadcrumbs.map(item => item.label).join(' / ');
    }

    function clearDirectoryState(options) {
        selectedNames = new Set();
        elements.searchInput.value = '';
        if (!(options && options.preserveUpload)) {
            clearUploadSelection();
        }
        updateSelected();
    }

    function setRefreshBusy(busy) {
        elements.refreshBtn.disabled = Boolean(busy);
    }

    function setDownloadBusy(busy) {
        downloadBusy = Boolean(busy);
        elements.downloadBtn.querySelector('span').textContent =
            downloadBusy ? '正在下载' : '下载所选';
        updateSelected();
    }

    function setLastRefresh(date = new Date()) {
        elements.lastRefresh.textContent = '刷新于 ' +
            date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function stateIcon(kind) {
        if (kind === 'error') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>';
        }
        if (kind === 'locked') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H10l2 2h5.5A2.5 2.5 0 0 1 20 9.5v7A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"/></svg>';
    }

    function setFileViewState(kind, title, detail, action) {
        const row = document.createElement('tr');
        row.className = 'state-row';
        const cell = document.createElement('td');
        cell.colSpan = 4;
        if (kind === 'loading') {
            cell.innerHTML =
                '<span class="loading-spinner" aria-hidden="true"></span>' +
                '<strong>' + FSUtils.escapeHtml(title) + '</strong>' +
                '<small>' + FSUtils.escapeHtml(detail || '') + '</small>';
            elements.fileCount.textContent = '正在读取…';
        } else {
            const button = action
                ? '<button class="button secondary-button" data-state-action type="button">' +
                    FSUtils.escapeHtml(action.label) + '</button>'
                : '';
            cell.innerHTML =
                '<div class="state-content">' + stateIcon(kind) +
                '<strong>' + FSUtils.escapeHtml(title) + '</strong>' +
                '<small>' + FSUtils.escapeHtml(detail || '') + '</small>' +
                button + '</div>';
            elements.fileCount.textContent =
                kind === 'locked' ? '需要访问密钥' : '暂无可显示文件';
            if (action) {
                cell.querySelector('[data-state-action]')
                    .addEventListener('click', action.handler, { once: true });
            }
        }
        row.appendChild(cell);
        elements.fileTableBody.replaceChildren(row);
        elements.selectAllBtn.disabled = true;
        elements.invertBtn.disabled = true;
        if (kind === 'locked') {
            elements.searchInput.disabled = true;
            for (const button of elements.sortButtons) button.disabled = true;
        }
    }

    function updateSelected() {
        elements.selectedCount.textContent = String(selectedNames.size);
        elements.downloadBtn.disabled =
            downloadBusy || selectedNames.size === 0;
    }

    function renderTableFromCache(files) {
        const cache = Array.isArray(files) ? files : [];
        elements.searchInput.disabled = false;
        for (const button of elements.sortButtons) button.disabled = false;
        selectedNames = FSUtils.retainAvailableSelection(
            selectedNames,
            cache.filter(item => item.kind !== 'directory'),
        );
        const query = elements.searchInput.value;
        const visible = FSUtils.sortFiles(
            FSUtils.filterFiles(cache, query),
            sortState.field,
            sortState.direction,
        );

        if (!visible.length) {
            const emptySearch = Boolean(query.trim() && cache.length);
            setFileViewState(
                'empty',
                emptySearch ? '没有匹配的文件' : '当前目录为空',
                emptySearch
                    ? '尝试使用其他关键词搜索'
                    : '上传文件后会显示在这里',
            );
            elements.fileCount.textContent = emptySearch
                ? '0 / ' + cache.length + ' 项'
                : '0 个文件夹 · 0 个文件';
            updateSelected();
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const file of visible) {
            const row = document.createElement('tr');
            if (file.kind === 'directory') {
                row.className = 'directory-row';
                row.dataset.path = file.path;
                row.innerHTML =
                    '<td class="checkbox-cell"><span class="directory-open" aria-hidden="true">›</span></td>' +
                    '<td class="name-cell"><button class="directory-link" type="button" data-directory-path="' +
                    FSUtils.escapeHtml(file.path) + '"' +
                    (uploadBusy ? ' disabled' : '') + '>' +
                    '<span class="file-icon file-icon--folder" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 8h17M5 5h5l2 3h7.5a1 1 0 0 1 1 1v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg></span>' +
                    '<span class="fname" title="' +
                    FSUtils.escapeHtml(file.name) + '">' +
                    FSUtils.escapeHtml(file.name) + '</span></button></td>' +
                    '<td class="modified-cell">' +
                    FSUtils.escapeHtml(
                        FSUtils.formatModified(file.modified)
                    ) + '</td>' +
                    '<td class="size-cell">—</td>';
                fragment.appendChild(row);
                continue;
            }
            const checked = selectedNames.has(file.name);
            row.className = 'file-row' + (checked ? ' is-selected' : '');
            row.dataset.name = file.name;
            row.innerHTML =
                '<td class="checkbox-cell"><input type="checkbox" class="row-check" aria-label="选择 ' +
                FSUtils.escapeHtml(file.name) + '"' +
                (checked ? ' checked' : '') + '></td>' +
                '<td class="name-cell"><div class="file-name-wrap">' +
                fileIconMarkup(file.name) +
                '<span class="fname" title="' +
                FSUtils.escapeHtml(file.name) + '">' +
                FSUtils.escapeHtml(file.name) + '</span></div></td>' +
                '<td class="modified-cell">' +
                FSUtils.escapeHtml(FSUtils.formatModified(file.modified)) +
                '</td>' +
                '<td class="size-cell">' +
                FSUtils.formatSize(file.size) + '</td>';
            fragment.appendChild(row);
        }
        elements.fileTableBody.replaceChildren(fragment);
        const directoryCount = cache.filter(
            item => item.kind === 'directory'
        ).length;
        const fileCount = cache.length - directoryCount;
        if (query.trim()) {
            const visibleDirectories = visible.filter(
                item => item.kind === 'directory'
            ).length;
            elements.fileCount.textContent =
                visibleDirectories + ' 个文件夹 · ' +
                (visible.length - visibleDirectories) + ' 个文件' +
                ' / 共 ' + cache.length + ' 项';
        } else {
            elements.fileCount.textContent =
                directoryCount + ' 个文件夹 · ' + fileCount + ' 个文件';
        }
        const hasVisibleFiles = visible.some(
            item => item.kind !== 'directory'
        );
        elements.selectAllBtn.disabled = !hasVisibleFiles;
        elements.invertBtn.disabled = !hasVisibleFiles;
        updateSelected();
    }

    function updateSortHeaders() {
        for (const button of elements.sortButtons) {
            const active = button.dataset.sort === sortState.field;
            const direction = sortState.direction === 'asc'
                ? 'ascending'
                : 'descending';
            button.closest('th').setAttribute(
                'aria-sort',
                active ? direction : 'none',
            );
            button.querySelector('.sort-indicator').textContent = active
                ? (sortState.direction === 'asc' ? '↑' : '↓')
                : '';
            button.title = active
                ? '当前排序，点击切换方向'
                : '按此列排序';
        }
    }

    function finishOverwrite(value) {
        if (!pendingOverwrite) return;
        const resolve = pendingOverwrite;
        pendingOverwrite = null;
        elements.overwriteModal.hidden = true;
        document.body.style.overflow = overwritePreviousOverflow;
        overwritePreviousFocus?.focus();
        resolve(value);
    }

    function confirmOverwrite(names) {
        const conflicts = Array.isArray(names) ? names : [];
        if (!conflicts.length) return Promise.resolve(true);
        overwritePreviousFocus = document.activeElement;
        overwritePreviousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        elements.overwriteList.replaceChildren();
        for (const name of conflicts.slice(0, 5)) {
            const item = document.createElement('li');
            item.textContent = name;
            elements.overwriteList.appendChild(item);
        }
        const remaining = conflicts.length - 5;
        elements.overwriteMore.hidden = remaining <= 0;
        elements.overwriteMore.textContent =
            remaining > 0 ? '另有 ' + remaining + ' 个重名文件' : '';
        elements.overwriteModal.hidden = false;
        requestAnimationFrame(() => elements.cancelOverwriteBtn.focus());
        return new Promise(resolve => { pendingOverwrite = resolve; });
    }

    function toggleRow(row, checked) {
        const name = row.dataset.name;
        if (checked) selectedNames.add(name);
        else selectedNames.delete(name);
        const checkbox = row.querySelector('.row-check');
        checkbox.checked = checked;
        row.classList.toggle('is-selected', checked);
        updateSelected();
    }

    function currentFiles() {
        return typeof actions.getFiles === 'function'
            ? actions.getFiles()
            : [];
    }

    function getSelectedNames() {
        return [...selectedNames];
    }

    function bindActions(nextActions) {
        actions = { ...nextActions };
    }

    ['dragenter', 'dragover'].forEach(name => {
        elements.dropZone.addEventListener(name, event => {
            event.preventDefault();
            event.stopPropagation();
            if (!uploadBusy) elements.dropZone.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(name => {
        elements.dropZone.addEventListener(name, event => {
            event.preventDefault();
            event.stopPropagation();
            elements.dropZone.classList.remove('dragover');
            if (name === 'drop' && !uploadBusy) {
                handleFiles(event.dataTransfer.files);
            }
        });
    });
    elements.dropZone.addEventListener('click', event => {
        if (!uploadBusy && !event.target.closest('label')) {
            elements.fileInput.click();
        }
    });
    elements.dropZone.addEventListener('keydown', event => {
        if (!uploadBusy && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            elements.fileInput.click();
        }
    });
    elements.fileInput.addEventListener('change', updateSelectedFiles);
    elements.clearBtn.addEventListener('click', () => {
        if (uploadBusy) actions.cancelUpload?.();
        else clearUploadProgress();
    });
    elements.uploadBtn.addEventListener('click', () => actions.upload?.());
    elements.refreshBtn.addEventListener('click', () => actions.refresh?.({
        notify: true,
    }));
    elements.downloadBtn.addEventListener(
        'click',
        () => actions.download?.(),
    );

    elements.fileTableBody.addEventListener('change', event => {
        if (!event.target.matches('.row-check')) return;
        const row = event.target.closest('.file-row');
        if (row) toggleRow(row, event.target.checked);
    });
    elements.fileTableBody.addEventListener('click', event => {
        const directory = event.target.closest('.directory-link');
        if (directory) {
            if (!uploadBusy) {
                actions.navigate?.(directory.dataset.directoryPath);
            }
            return;
        }
        const row = event.target.closest('.file-row');
        if (!row || event.target.matches('.row-check')) return;
        toggleRow(row, !row.querySelector('.row-check').checked);
    });
    elements.breadcrumb.addEventListener('click', event => {
        const button = event.target.closest('.breadcrumb-button');
        if (!button || uploadBusy) return;
        actions.navigate?.(button.dataset.path);
    });
    elements.selectAllBtn.addEventListener('click', () => {
        const names = [...elements.fileTableBody.querySelectorAll('.file-row')]
            .map(row => row.dataset.name);
        selectedNames = FSUtils.updateVisibleSelection(
            selectedNames,
            names,
            'select',
        );
        renderTableFromCache(currentFiles());
    });
    elements.invertBtn.addEventListener('click', () => {
        const names = [...elements.fileTableBody.querySelectorAll('.file-row')]
            .map(row => row.dataset.name);
        selectedNames = FSUtils.updateVisibleSelection(
            selectedNames,
            names,
            'invert',
        );
        renderTableFromCache(currentFiles());
    });
    elements.searchInput.addEventListener(
        'input',
        FSUtils.debounce(() => renderTableFromCache(currentFiles()), 120),
    );
    for (const button of elements.sortButtons) {
        button.addEventListener('click', () => {
            const field = button.dataset.sort;
            if (sortState.field === field) {
                sortState.direction =
                    sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortState = {
                    field,
                    direction: field === 'name' ? 'asc' : 'desc',
                };
            }
            updateSortHeaders();
            renderTableFromCache(currentFiles());
        });
    }

    elements.cancelOverwriteBtn.addEventListener(
        'click',
        () => finishOverwrite(false),
    );
    elements.confirmOverwriteBtn.addEventListener(
        'click',
        () => finishOverwrite(true),
    );
    elements.overwriteModal.addEventListener('mousedown', event => {
        if (event.target === elements.overwriteModal) finishOverwrite(false);
    });
    document.addEventListener('keydown', event => {
        if (elements.overwriteModal.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            finishOverwrite(false);
            return;
        }
        if (event.key !== 'Tab') return;
        const first = elements.cancelOverwriteBtn;
        const last = elements.confirmOverwriteBtn;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    function openAbout() {
        lastFocusedElement = document.activeElement;
        previousBodyOverflow = document.body.style.overflow;
        elements.aboutModal.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => {
            elements.aboutModal.querySelector('[data-close-modal]').focus();
        });
    }

    function closeAbout() {
        elements.aboutModal.hidden = true;
        document.body.style.overflow = previousBodyOverflow;
        lastFocusedElement?.focus();
    }

    elements.aboutBtn.addEventListener('click', openAbout);
    elements.aboutModal.querySelectorAll('[data-close-modal]').forEach(
        button => button.addEventListener('click', closeAbout),
    );
    elements.aboutModal.addEventListener('mousedown', event => {
        if (event.target === elements.aboutModal) closeAbout();
    });
    document.addEventListener('keydown', event => {
        if (elements.aboutModal.hidden) return;
        if (event.key === 'Escape') closeAbout();
        if (event.key !== 'Tab') return;
        const focusable = [...elements.aboutModal.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled)',
        )];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    if (window.ENCRYPTED) {
        elements.encState.textContent = '密钥保护';
        elements.securityPill.classList.add('is-protected');
        elements.resetKeyBtn.style.display = 'grid';
    } else {
        elements.encState.textContent = '连接开放';
    }
    elements.resetKeyBtn.addEventListener('click', () => FSAuth.resetKey());
    window.addEventListener('fs:key-reset', () => {
        if (!window.ENCRYPTED) return;
        setFileViewState(
            'locked',
            '访问密钥已清除',
            '刷新列表或执行文件操作时需要重新输入密钥',
            {
                label: '重新解锁',
                handler: () => actions.refresh?.(),
            },
        );
    });

    window.showToast = showToast;
    updateSortHeaders();
    return {
        bindActions,
        getUploadFiles,
        setUploadBusy,
        setUploadStatus,
        setUploadProgress,
        setRefreshBusy,
        setDownloadBusy,
        setLastRefresh,
        setFileViewState,
        renderTableFromCache,
        getSelectedNames,
        updateSelectedFiles,
        clearUploadSelection,
        setDirectory,
        clearDirectoryState,
        confirmOverwrite,
        showToast,
    };
})();
