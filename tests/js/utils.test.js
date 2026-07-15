/**
 * Unit tests for the DOM-independent helpers exported by static/utils.js.
 *
 * The production file exposes the same object as window.FSUtils in a browser
 * and module.exports under Node. Testing the CommonJS export keeps this suite
 * dependency-free and prevents a simulated DOM from hiding global coupling.
 *
 * Run from the repository root with:
 *     node --test tests/js/*.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const utils = require('../../static/utils.js');

test('escapeHtml escapes markup and quotes', () => {
    // Cover every character that can change HTML text/attribute structure.
    assert.equal(
        utils.escapeHtml(`<a title="x">Tom & 'Ada'</a>`),
        '&lt;a title=&quot;x&quot;&gt;Tom &amp; &#39;Ada&#39;&lt;/a&gt;',
    );
    assert.equal(utils.escapeHtml(null), '');
});

test('formatSize handles boundaries and invalid input', () => {
    // Exact powers of 1024 advance units; invalid values normalize to zero.
    assert.equal(utils.formatSize(0), '0.00 B');
    assert.equal(utils.formatSize(1024), '1.00 KB');
    assert.equal(utils.formatSize(1.5 * 1024 * 1024), '1.50 MB');
    assert.equal(utils.formatSize(-1), '0.00 B');
    assert.equal(utils.formatSize(Number.NaN), '0.00 B');
});

test('formatModified formats timestamps and rejects invalid values', () => {
    assert.notEqual(utils.formatModified(0), '—');
    assert.equal(utils.formatModified(-1), '—');
    assert.equal(utils.formatModified('not-a-date'), '—');
});

test('extIcon maps known types and shortens unknown extensions', () => {
    // Matching is case-insensitive and uses the last extension segment.
    assert.equal(utils.extIcon('photo.JPEG'), 'IMG');
    assert.equal(utils.extIcon('archive.tar.gz'), 'ARC');
    assert.equal(utils.extIcon('server.py'), 'SRC');
    assert.equal(utils.extIcon('payload.custom'), 'CUS');
    assert.equal(utils.extIcon('README'), '');
});

test('theme preferences only accept supported values', () => {
    // These inputs model corrupted or manually edited localStorage values.
    assert.equal(utils.normalizeThemeMode('dark'), 'dark');
    assert.equal(utils.normalizeThemeMode('sepia'), 'auto');
    assert.equal(utils.normalizeThemeColor('#6D28D9'), '#6d28d9');
    assert.equal(utils.normalizeThemeColor('#ffffff'), null);
    assert.equal(utils.normalizeThemeColor('bad'), null);
    assert.equal(utils.normalizeThemeColor('#4f46e5'), null);
    assert.equal(utils.normalizeThemeColor('#db2777'), null);
    assert.throws(
        () => utils.getThemePreset('#4f46e5', false),
        /Unsupported theme color/,
    );
});

test('filterFiles is case-insensitive and does not mutate input', () => {
    const files = [
        { name: 'Report.PDF', size: 10 },
        { name: 'notes.txt', size: 20 },
        { name: 'photo.jpg', size: 30 },
    ];
    assert.deepEqual(
        utils.filterFiles(files, ' PORT '),
        [{ name: 'Report.PDF', size: 10 }],
    );
    // Even an empty query returns a copy so callers cannot mutate the cache by
    // sorting or splicing the returned visible-file array.
    assert.notEqual(utils.filterFiles(files, ''), files);
    assert.equal(files.length, 3);
});

test('sortFiles supports all columns without mutating input', () => {
    const files = [
        { name: 'file10.txt', size: 20, modified: 100 },
        { name: 'file2.txt', size: 20, modified: 300 },
        { name: 'alpha.txt', size: 30, modified: 200 },
    ];
    assert.deepEqual(
        utils.sortFiles(files, 'name', 'asc').map(file => file.name),
        ['alpha.txt', 'file2.txt', 'file10.txt'],
    );
    assert.deepEqual(
        utils.sortFiles(files, 'size', 'desc').map(file => file.name),
        ['alpha.txt', 'file2.txt', 'file10.txt'],
    );
    assert.deepEqual(
        utils.sortFiles(files, 'modified', 'desc').map(file => file.name),
        ['file2.txt', 'alpha.txt', 'file10.txt'],
    );
    assert.equal(files[0].name, 'file10.txt');
});

test('folder helpers build breadcrumbs and keep directories first', () => {
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
        utils.sortFiles(entries, 'size', 'desc').map(item => item.name),
        ['alpha', 'zeta', 'large.bin', 'small.txt'],
    );
    assert.deepEqual(
        utils.sortFiles(entries, 'modified', 'desc').map(item => item.name),
        ['alpha', 'zeta', 'small.txt', 'large.bin'],
    );
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

    // Selecting a filtered result retains an earlier selection that is hidden
    // by the current filter.
    const selected = utils.updateVisibleSelection(
        retained,
        ['b.txt'],
        'select',
    );
    assert.deepEqual([...selected], ['a.txt', 'b.txt']);

    // Inversion affects visible names only: b is removed, c is added, and the
    // hidden a selection remains available for batch download.
    const inverted = utils.updateVisibleSelection(
        selected,
        ['b.txt', 'c.txt'],
        'invert',
    );
    assert.deepEqual([...inverted], ['a.txt', 'c.txt']);
});
