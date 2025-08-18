// 认证与密钥处理
let globalKey = '';
function getKey() { if (!window.ENCRYPTED) return '0'; if (!globalKey) globalKey = prompt('请输入密钥：'); return globalKey; }
function resetKey() { globalKey = ''; if (typeof showToast === 'function') showToast('密钥已重置', 'warn'); }
window.FSAuth = { getKey, resetKey };
