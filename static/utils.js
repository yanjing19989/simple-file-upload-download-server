// 工具函数：格式化、转义、大小与图标
function escapeHtml(s) { return s.replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }
function formatSize(bytes) { const u = ['B','KB','MB','GB','TB']; let i = 0; let n = bytes || 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return n.toFixed(2) + ' ' + u[i]; }
function extIcon(name) { const ext = (name || '').split('.').pop().toLowerCase(); if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return 'IMG'; if (['zip','rar','7z','tar','gz'].includes(ext)) return 'ARC'; if (['mp4','mkv','avi','mov','webm'].includes(ext)) return 'VID'; if (['mp3','wav','flac','aac','ogg'].includes(ext)) return 'AUD'; if (['pdf'].includes(ext)) return 'PDF'; if (['txt','md','log'].includes(ext)) return 'TXT'; if (['py','js','ts','java','c','cpp','go','rs','sh','bat'].includes(ext)) return 'SRC'; return (ext || '').substring(0,3).toUpperCase(); }

// 导出到全局以便其他模块访问（非模块化加载）
window.FSUtils = { escapeHtml, formatSize, extIcon };
