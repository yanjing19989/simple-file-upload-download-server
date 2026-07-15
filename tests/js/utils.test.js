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
    assert.equal(utils.normalizeThemeColor('#7C3AED'), '#7c3aed');
    assert.equal(utils.normalizeThemeColor('#ffffff'), '#4f46e5');
    assert.equal(utils.normalizeThemeColor('bad', '#059669'), '#059669');
    assert.equal(utils.normalizeThemeColor('bad', 'also-bad'), '#4f46e5');
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
