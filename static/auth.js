// 认证与密钥处理：密钥仅保存在当前页面内存中。
window.FSAuth = (function () {
    let globalKey = '';
    let pendingRequest = null;
    let previousFocus = null;
    let previousOverflow = '';

    const modal = document.getElementById('keyModal');
    const form = document.getElementById('keyForm');
    const input = document.getElementById('keyInput');
    const error = document.getElementById('keyError');
    const cancelBtn = document.getElementById('cancelKeyBtn');

    function showModal(message) {
        previousFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        input.value = '';
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        error.textContent = message || '';
        modal.hidden = false;
        requestAnimationFrame(() => input.focus());
    }

    function hideModal() {
        modal.hidden = true;
        document.body.style.overflow = previousOverflow;
        if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function finish(value) {
        if (!pendingRequest) return;
        const resolve = pendingRequest.resolve;
        pendingRequest = null;
        hideModal();
        resolve(value);
    }

    function requestKey(message) {
        if (!window.ENCRYPTED) return Promise.resolve('0');
        if (globalKey) return Promise.resolve(globalKey);
        if (pendingRequest) {
            if (message) {
                error.textContent = message;
                input.setAttribute('aria-invalid', 'true');
            }
            return pendingRequest.promise;
        }

        let resolveRequest;
        const promise = new Promise(resolve => { resolveRequest = resolve; });
        pendingRequest = { promise, resolve: resolveRequest };
        showModal(message);
        return promise;
    }

    function resetKey(options) {
        const silent = options && options.silent;
        globalKey = '';
        window.dispatchEvent(new CustomEvent('fs:key-reset'));
        if (!silent && typeof showToast === 'function') showToast('访问密钥已重置', 'warn');
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        const value = input.value.trim();
        if (!value) {
            error.textContent = '请输入访问密钥';
            input.setAttribute('aria-invalid', 'true');
            input.focus();
            return;
        }
        globalKey = value;
        finish(value);
    });

    input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        error.textContent = '';
    });
    cancelBtn.addEventListener('click', () => finish(''));
    modal.addEventListener('mousedown', event => {
        if (event.target === modal) finish('');
    });
    document.addEventListener('keydown', event => {
        if (modal.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            finish('');
        }
        if (event.key === 'Tab') {
            const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    return { requestKey, resetKey };
})();
