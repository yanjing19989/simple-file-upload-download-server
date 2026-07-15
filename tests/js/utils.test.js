const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../../static/utils.js');

test('escapeHtml escapes markup and quotes', () => {
    assert.equal(
        utils.escapeHtml(`<a title="x">Tom & 'Ada'</a>`),
        '&lt;a title=&quot;x&quot;&gt;Tom &amp; &#39;Ada&#39;&lt;/a&gt;',
    );
    assert.equal(utils.escapeHtml(null), '');
});

test('theme preferences only accept supported values', () => {
    assert.equal(utils.normalizeThemeMode('dark'), 'dark');
    assert.equal(utils.normalizeThemeMode('sepia'), 'auto');
    assert.equal(utils.normalizeThemeColor('#6D28D9'), '#6d28d9');
    assert.equal(utils.normalizeThemeColor('#ffffff'), null);
    assert.equal(utils.normalizeThemeColor('bad'), null);
    assert.equal(utils.normalizeThemeColor('#4f46e5'), null);
    assert.equal(utils.normalizeThemeColor('#db2777'), null);
    assert.deepEqual(utils.getThemePreset('#2563eb', false), {
        primary: '#2563eb', hover: '#1d4ed8', contrast: '#ffffff',
    });
    assert.deepEqual(utils.getThemePreset('#2563eb', true), {
        primary: '#60a5fa', hover: '#93c5fd', contrast: '#111827',
    });
    assert.throws(
        () => utils.getThemePreset('#4f46e5', false),
        /Unsupported theme color/,
    );
});

test('filter, sort, and folder helpers preserve navigation rules', () => {
    assert.equal(utils.joinPath('', 'docs'), 'docs');
    assert.equal(utils.joinPath('docs', 'images'), 'docs/images');
    assert.deepEqual(utils.buildBreadcrumbs('docs/images'), [
        { label: '根目录', path: '' },
        { label: 'docs', path: 'docs' },
        { label: 'images', path: 'docs/images' },
    ]);

    const entries = [
        { name: 'large.bin', kind: 'file', size: 100, modified: 300 },
        { name: 'zeta', kind: 'directory', modified: 100 },
        { name: 'alpha', kind: 'directory', modified: 200 },
        { name: 'small.txt', kind: 'file', size: 10, modified: 400 },
    ];
    assert.deepEqual(
        utils.filterFiles(entries, 'SMALL'),
        [entries[3]],
    );
    assert.deepEqual(
        utils.sortFiles(entries, 'name', 'asc').map(item => item.name),
        ['alpha', 'zeta', 'large.bin', 'small.txt'],
    );
    assert.deepEqual(
        utils.sortFiles(entries, 'size', 'desc').map(item => item.name),
        ['alpha', 'zeta', 'large.bin', 'small.txt'],
    );
    assert.equal(entries[0].name, 'large.bin');
});

test('findUploadConflicts catches existing and batch duplicates', () => {
    const selected = [
        { name: 'report.pdf' },
        { name: 'new.txt' },
        { name: 'DUP.txt' },
        { name: 'dup.TXT' },
    ];
    const existing = [{ name: 'Report.PDF' }, { name: 'other.bin' }];
    assert.deepEqual(
        utils.findUploadConflicts(selected, existing),
        ['report.pdf', 'DUP.txt'],
    );
    assert.deepEqual(utils.findUploadConflicts([], existing), []);
});

test('selection helpers retain hidden selections and reconcile removals', () => {
    const files = [{ name: 'a.txt' }, { name: 'b.txt' }, { name: 'c.txt' }];
    const retained = utils.retainAvailableSelection(
        new Set(['a.txt', 'removed.txt']),
        files,
    );
    assert.deepEqual([...retained], ['a.txt']);

    const selected = utils.updateVisibleSelection(
        retained,
        ['b.txt'],
        'select',
    );
    assert.deepEqual([...selected], ['a.txt', 'b.txt']);

    const inverted = utils.updateVisibleSelection(
        selected,
        ['b.txt', 'c.txt'],
        'invert',
    );
    assert.deepEqual([...inverted], ['a.txt', 'c.txt']);
});
