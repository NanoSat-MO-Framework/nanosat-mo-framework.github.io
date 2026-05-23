// ── Configuration ─────────────────────────────────────────────────────────────
let BRANCH   = 'master';
const REPO     = 'esa/nanosat-mo-framework';
const DOCS_DIR = 'docs/source';
const GH_API   = `https://api.github.com/repos/${REPO}`;
let RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DOCS_DIR}/`;
let GH_BLOB  = `https://github.com/${REPO}/blob/${BRANCH}/${DOCS_DIR}/`;

function updateBranchConfig(branch) {
    BRANCH   = branch;
    RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DOCS_DIR}/`;
    GH_BLOB  = `https://github.com/${REPO}/blob/${BRANCH}/${DOCS_DIR}/`;
}

let currentPage           = 'index';
let _tabGroupCount        = 0;
let parentPage            = 'index'; // top-level sidebar item that owns the current view
let tocSections           = []; // [{caption, entries:[{label,path}]}]
let currentPageSubEntries = []; // [{label,path}] from the active top-level page's toctree

// ── Search index ──────────────────────────────────────────────────────────────
// Map of path -> { label, text } built in background after toctree loads.
const searchIndex = new Map();

function resolvePath(base, ref) {
    if (ref.startsWith('/')) return ref.slice(1);
    const dir = base.includes('/') ? base.split('/').slice(0, -1).join('/') + '/' : '';
    const parts = (dir + ref).split('/');
    const out = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
    return out.join('/');
}

async function indexPage(path, label) {
    if (searchIndex.has(path)) return;
    searchIndex.set(path, { label: label || path, text: '' });
    try {
        const res = await fetch(RAW_BASE + path + '.rst');
        if (!res.ok) return;
        const text = await res.text();
        searchIndex.set(path, { label: label || path, text });
        // Discover sub-pages from toctree directives and index them too
        const toctreeRe = /\.\. toctree::.*?\n((?:(?:[ \t]+[^\n]*)?\n)*)/g;
        let m;
        while ((m = toctreeRe.exec(text)) !== null) {
            for (const line of m[1].split('\n')) {
                const entry = line.trim();
                if (!entry || entry.startsWith(':')) continue;
                // Strip <Title> style: "Label <path>" → path
                const titled = entry.match(/^.+<(.+)>$/);
                const subPath = resolvePath(path, titled ? titled[1] : entry);
                if (!searchIndex.has(subPath))
                    indexPage(subPath, titled ? entry.replace(/<.+>/, '').trim() : entry);
            }
        }
    } catch (_) {}
}

async function buildSearchIndex() {
    searchIndex.clear();
    const seed = [{ label: 'NanoSat MO Framework Documentation', path: 'index' }];
    tocSections.forEach(({ entries }) => entries.forEach(e => seed.push(e)));
    await Promise.all(seed.map(({ label, path }) => indexPage(path, label)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── Asset URL resolver ────────────────────────────────────────────────────────
// Resolves image/file paths from RST directives against the raw GitHub base URL.
// Handles relative paths (../images/foo.png) and already-absolute URLs.

function resolveAssetUrl(path) {
    path = path.trim();
    if (/^https?:\/\//.test(path)) return path;
    // Sphinx copies source images into _images/ at build time; in the raw source
    // they live under images/ instead.
    path = path.replace(/^_images\//, 'images/');
    const pageDir = currentPage.includes('/')
        ? currentPage.split('/').slice(0, -1).join('/')
        : '';
    const parts = (pageDir ? pageDir + '/' + path : path).split('/');
    const resolved = [];
    for (const p of parts) {
        if (p === '..') resolved.pop();
        else if (p !== '.') resolved.push(p);
    }
    return RAW_BASE + resolved.join('/');
}

// ── Inline RST markup ─────────────────────────────────────────────────────────

function applyInline(text) {
    // Stash every link as a placeholder so the bare-URL regex cannot
    // re-match URLs that are already inside href="…" attributes.
    const links = [];
    const stash = html => { const id = links.length; links.push(html); return `\x02${id}\x03`; };

    // RST link constructs (stashed first)
    text = text
        .replace(/`([^`<]+?)\s+<([^>]+)>`_+/g, (_, label, url) =>
            stash(`<a href="${escHtml(url)}" target="_blank">${escHtml(label)}</a>`))
        .replace(/:ref:`([^`<]+?)\s+<([^>]+)>`/g, (_, label, target) =>
            stash(`<a href="#${target.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escHtml(label)}</a>`))
        .replace(/:ref:`([^`]+)`/g, (_, ref) =>
            stash(`<a href="#${ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escHtml(ref)}</a>`))
        .replace(/:doc:`([^`<]+?)\s+<([^>]+)>`/g, (_, label, page) =>
            stash(`<a href="#" data-rst-page="${escHtml(resolvePath(currentPage, page))}" class="rst-page-link">${escHtml(label)}</a>`))
        .replace(/:doc:`([^`]+)`/g, (_, page) =>
            stash(`<a href="#" data-rst-page="${escHtml(resolvePath(currentPage, page))}" data-auto-title="true" class="rst-page-link">${escHtml(page.split('/').pop().replace(/[-_]/g, ' '))}</a>`));

    // Non-link inline markup
    text = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
        .replace(/``(.+?)``/g, (_, c) => `<code>${escHtml(c)}</code>`)
        .replace(/:[a-z]+:(?:type|class|meth|func|attr|field|ref):`(~?)([^`]+)`/g, (_, tilde, val) => {
            const display = tilde ? val.split('.').pop() : val;
            return `<code>${escHtml(display)}</code>`;
        })
        .replace(/:(code|class|meth|attr|func|mod|obj|exc|data|const|any|type):`([^`]+)`/g,
            (_, role, val) => `<code>${escHtml(role === 'meth' ? val + '()' : val)}</code>`)
        .replace(/`([^`]+)`__?/g, (_, t) => `<em>${escHtml(t)}</em>`)
        // Single backtick with no suffix = Sphinx default role (title-reference → italic)
        .replace(/`([^`]+)`(?!_)/g, (_, t) => `<em>${escHtml(t)}</em>`);

    // Bare URLs (safe now — no href="…" in the text yet)
    text = text.replace(/(https?:\/\/[^\s<>"')[\]]+)/g, url =>
        stash(`<a href="${escHtml(url)}" target="_blank">${escHtml(url)}</a>`));

    // Unescape RST backslash-escaped characters (e.g. \_ \* \` \\)
    text = text.replace(/\\([*_`\\|])/g, '$1');

    return text.replace(/\x02(\d+)\x03/g, (_, i) => links[+i]);
}

// ── RST block parser ──────────────────────────────────────────────────────────

function parseRST(text) {
    const lines = text.split('\n');
    let pos = 0;
    const sectionChars = [];

    const cur  = () => (pos < lines.length ? lines[pos] : null);
    const peek = n  => (pos + n < lines.length ? lines[pos + n] : null);
    function isBlank(l) { return l !== null && l.trim() === ''; }
    function indentOf(l) { if (!l) return 0; const m = l.match(/^(\s*)/); return m ? m[1].length : 0; }
    const ADORN_RE = /^([=\-~^`'"#*+<>!@$%&])\1+\s*$/;
    function isAdorn(l) { return l !== null && ADORN_RE.test(l); }
    function sectionLevel(ch) {
        let i = sectionChars.indexOf(ch);
        if (i === -1) { sectionChars.push(ch); i = sectionChars.length - 1; }
        return i + 1;
    }
    function skipBlanks() { while (pos < lines.length && isBlank(lines[pos])) pos++; }

    function collectBlock(baseIndent) {
        const out = [];
        while (pos < lines.length) {
            const l = lines[pos];
            if (isBlank(l)) { out.push(''); pos++; continue; }
            if (indentOf(l) <= baseIndent) break;
            out.push(l); pos++;
        }
        while (out.length && out[out.length - 1].trim() === '') out.pop();
        return out;
    }

    function parseDirective() {
        const l = cur();
        const base = indentOf(l);
        const m = l.trimStart().match(/^\.\.\s+([\w][\w-]*)(?:::\s*(.*)|::)$/);
        if (!m) { pos++; return null; }
        const name = m[1].toLowerCase();
        const arg  = (m[2] || '').trim();
        pos++;
        const block = collectBlock(base);
        let bi = 0;
        while (bi < block.length && isBlank(block[bi])) bi++;
        // Collect option lines (:key: value)
        const optStart = bi;
        while (bi < block.length && /^\s+:[\w-]+:/.test(block[bi])) bi++;
        const options = block.slice(optStart, bi).map(l => l.trim());
        while (bi < block.length && isBlank(block[bi])) bi++;
        const contentLines = block.slice(bi);
        const minInd = contentLines.reduce((m, l) => l.trim() ? Math.min(m, indentOf(l)) : m, Infinity);
        const content = contentLines
            .map(l => l.trim() ? l.slice(minInd === Infinity ? 0 : minInd) : '')
            .join('\n').trimEnd();
        return { name, arg, options, content };
    }

    function admonition(cls, title, content) {
        return `<div class="admonition ${cls}"><p class="admonition-title">${title}</p>${
            content ? `<p>${applyInline(content)}</p>` : ''}</div>\n`;
    }

    function renderDirective(d) {
        switch (d.name) {
            case 'code-block': case 'code': case 'sourcecode': case 'highlight':
                return `<pre><code class="language-${escHtml(d.arg || 'text')}">${escHtml(d.content)}</code></pre>\n`;
            case 'note':        return admonition('note',        'Note',        d.content);
            case 'warning':     return admonition('warning',     'Warning',     d.content);
            case 'tip':         return admonition('tip',         'Tip',         d.content);
            case 'important':   return admonition('important',   'Important',   d.content);
            case 'caution':     return admonition('caution',     'Caution',     d.content);
            case 'deprecated':  return admonition('deprecated',  `Deprecated since ${escHtml(d.arg)}`,      d.content);
            case 'versionadded':   return admonition('versionadded',   `New in version ${escHtml(d.arg)}`,     d.content);
            case 'versionchanged': return admonition('versionchanged', `Changed in version ${escHtml(d.arg)}`, d.content);
            case 'image': case 'figure': {
                const alt = d.content.match(/:alt:\s*(.+)/)?.[1] || d.arg;
                const src = resolveAssetUrl(d.arg);
                return `<figure class="rst-figure"><img src="${escHtml(src)}" alt="${escHtml(alt)}"></figure>\n`;
            }
            case 'toctree': {
                // :hidden: means Sphinx omits the toctree from page content
                // (it still appears in the sidebar via currentPageSubEntries)
                if (d.options && d.options.some(o => /^:hidden:/.test(o))) return '';
                const entries = d.content.split('\n')
                    .map(l => l.trim()).filter(l => l && !l.startsWith(':') && !l.startsWith('..'));
                if (!entries.length) return '';
                const items = entries.map(e => {
                    const lm = e.match(/^(.+)\s+<(.+)>$/);
                    if (lm) {
                        const resolved = resolvePath(currentPage, lm[2]);
                        return `<li><a href="#" data-rst-page="${escHtml(resolved)}" class="rst-page-link">${escHtml(lm[1])}</a></li>`;
                    }
                    const resolved = resolvePath(currentPage, e);
                    const label = e.split('/').pop().replace(/[-_]/g, ' ');
                    return `<li><a href="#" data-rst-page="${escHtml(resolved)}" data-auto-title="true" class="rst-page-link">${escHtml(label)}</a></li>`;
                });
                return `<div class="toctree"><ul>${items.join('')}</ul></div>\n`;
            }
            case 'glossary': {
                // Content after option-stripping: terms at indent 0, definitions indented.
                const lines = d.content.split('\n');
                const entries = [];
                let terms = [], defLines = [];

                const flush = () => {
                    if (terms.length) entries.push({ terms: [...terms], def: defLines.join(' ').trim() });
                    terms = []; defLines = [];
                };

                for (const line of lines) {
                    if (line.trim() === '') { flush(); continue; }
                    if (indentOf(line) === 0) {
                        // A zero-indent line may be a new term stacked on the previous one
                        // (RST allows multiple terms sharing one definition).
                        if (defLines.length) flush();
                        terms.push(line.trim());
                    } else {
                        defLines.push(line.trim());
                    }
                }
                flush();
                if (!entries.length) return '';

                const sorted = d.options.some(o => /^:sorted:/.test(o));
                if (sorted) entries.sort((a, b) =>
                    a.terms[0].toLowerCase().localeCompare(b.terms[0].toLowerCase()));

                let html = '<dl class="rst-glossary">';
                for (const { terms: ts, def } of entries) {
                    for (const t of ts) {
                        const id = 'term-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
                        html += `<dt id="${escHtml(id)}">${applyInline(t)}</dt>`;
                    }
                    html += `<dd>${applyInline(def)}</dd>\n`;
                }
                return html + '</dl>\n';
            }
            case 'list-table': {
                const headerRowsOpt = d.options.find(o => /^:header-rows:/.test(o));
                const headerRows = headerRowsOpt
                    ? parseInt(headerRowsOpt.replace(/^:header-rows:\s*/, ''), 10) || 0 : 0;
                const widthsOpt = d.options.find(o => /^:widths:/.test(o));
                const widthStr = widthsOpt ? widthsOpt.replace(/^:widths:\s*/, '').trim() : '';
                const widths = (widthStr && widthStr !== 'auto')
                    ? widthStr.split(/\s+/).map(Number).filter(n => !isNaN(n)) : null;

                // Parse "* - cell\n  - cell\n  - cell\n* - ..." into rows of cells.
                const rows = [];
                let currentRow = null, currentCell = null;
                for (const line of d.content.split('\n')) {
                    if (/^\* - /.test(line)) {
                        currentRow = []; rows.push(currentRow);
                        currentCell = [line.slice(3).trim()]; currentRow.push(currentCell);
                    } else if (/^  - /.test(line) && currentRow) {
                        currentCell = [line.slice(3).trim()]; currentRow.push(currentCell);
                    } else if (currentCell) {
                        currentCell.push(line.trim());
                    }
                }
                if (!rows.length) return '';

                const total = widths ? widths.reduce((a, b) => a + b, 0) : 0;
                let th = '<table class="rst-table">';
                if (widths && total > 0) {
                    th += '<colgroup>' +
                        widths.map(w => `<col style="width:${Math.round(w / total * 100)}%">`).join('') +
                        '</colgroup>';
                }
                rows.forEach((row, ri) => {
                    const tag = ri < headerRows ? 'th' : 'td';
                    th += '<tr>' + row.map(cell =>
                        `<${tag}>${applyInline(cell.filter(Boolean).join(' '))}</${tag}>`
                    ).join('') + '</tr>\n';
                });
                return th + '</table>\n';
            }
            case 'rubric':
                return `<p class="rubric">${applyInline(d.arg)}</p>\n`;
            case 'centered':
                return `<p style="text-align:center"><strong>${applyInline(d.arg)}</strong></p>\n`;
            case 'mermaid':
                return `<div class="mermaid">${d.content}</div>\n`;
            case 'math':
                return `<div class="admonition math"><pre>${escHtml(d.content || d.arg)}</pre></div>\n`;
            case 'literalinclude':
                return `<pre><code>[included file: ${escHtml(d.arg)}]</code></pre>\n`;
            case 'tabs': {
                const tabLines = d.content.split('\n');
                const tabs = [];
                let curTab = null;
                for (const line of tabLines) {
                    const m = line.match(/^\.\.\s+tab::\s*(.*)/);
                    if (m) {
                        if (curTab) tabs.push(curTab);
                        curTab = { name: m[1].trim(), lines: [] };
                    } else if (curTab) {
                        curTab.lines.push(line);
                    }
                }
                if (curTab) tabs.push(curTab);
                if (!tabs.length) return '';
                const uid = 'tg' + (++_tabGroupCount);
                let html = '<div class="rst-tabs">';
                html += '<div class="rst-tabs-nav">';
                tabs.forEach((tab, i) => {
                    html += `<button class="rst-tab-btn${i === 0 ? ' active' : ''}" data-tabs="${uid}" data-idx="${i}">${escHtml(tab.name)}</button>`;
                });
                html += '</div>';
                tabs.forEach((tab, i) => {
                    let end = tab.lines.length;
                    while (end > 0 && tab.lines[end - 1].trim() === '') end--;
                    const trimmed = tab.lines.slice(0, end);
                    const minInd = trimmed.reduce((m, l) => l.trim() ? Math.min(m, l.match(/^(\s*)/)[1].length) : m, Infinity);
                    const body = trimmed.map(l => l.trim() ? l.slice(minInd === Infinity ? 0 : minInd) : '').join('\n');
                    html += `<div class="rst-tab-pane${i === 0 ? ' active' : ''}" data-tabs="${uid}" data-idx="${i}">`;
                    html += parseRST(body);
                    html += '</div>';
                });
                html += '</div>';
                return html;
            }
            case 'contents': case 'include': case 'index': case 'only': case 'raw':
            case 'tabularcolumns': case 'automodule': case 'autoclass': case 'autofunction':
            case 'autosummary': case 'currentmodule': case 'sectionauthor':
            case 'moduleauthor': case 'role': case 'default-role':
                return '';
            default:
                return d.content
                    ? `<div class="admonition"><p class="admonition-title">${escHtml(d.name)}</p><p>${applyInline(d.content)}</p></div>\n`
                    : '';
        }
    }

    let html = '';

    while (pos < lines.length) {
        const l = cur();
        if (isBlank(l)) { pos++; continue; }

        // overline + title + underline
        if (isAdorn(l) && peek(1) !== null && !isBlank(peek(1)) &&
            isAdorn(peek(2)) && l[0] === (peek(2) || '')[0]) {
            const ch = l[0]; const title = lines[pos + 1].trim();
            pos += 3; skipBlanks();
            const lvl = sectionLevel(ch);
            const id  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
            html += `<h${Math.min(lvl, 6)} id="${id}">${applyInline(title)}</h${Math.min(lvl, 6)}>\n`;
            continue;
        }

        // title + underline (Sphinx tolerates underlines shorter than the title)
        if (!isAdorn(l) && isAdorn(peek(1)) && !isBlank(peek(1))) {
            const title = l.trim(); const ch = lines[pos + 1][0];
            pos += 2; skipBlanks();
            const lvl = sectionLevel(ch);
            const id  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/, '');
            html += `<h${Math.min(lvl, 6)} id="${id}">${applyInline(title)}</h${Math.min(lvl, 6)}>\n`;
            continue;
        }

        const trimmed = l.trimStart();

        // hyperlink target
        if (/^\.\.\s+_[^:]+:/.test(trimmed)) {
            const id = trimmed.match(/^\.\.\s+_([^:]+):/)?.[1]?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (id) html += `<span id="${id}"></span>`;
            pos++; continue;
        }

        // directive
        if (/^\.\.\s+[\w][\w-]*::/.test(trimmed)) {
            const d = parseDirective();
            if (d) { html += renderDirective(d); continue; }
        }

        // skip remaining .. comments
        if (trimmed.startsWith('.. ')) {
            const base = indentOf(l); pos++; collectBlock(base); continue;
        }

        // bullet list
        if (/^(\s*)([-*+])\s/.test(l)) {
            const listIndent = indentOf(l);
            html += '<ul>\n';
            while (pos < lines.length) {
                const li = lines[pos];
                if (isBlank(li)) { pos++; continue; }
                const lm = li.match(/^(\s*)([-*+])\s+(.*)/);
                if (!lm || lm[1].length !== listIndent) break;
                pos++;
                let text = lm[3];
                while (pos < lines.length && !isBlank(lines[pos]) && indentOf(lines[pos]) > listIndent + 1) {
                    text += ' ' + lines[pos].trim(); pos++;
                }
                // Item ending with :: — the indented block that follows is a code block
                if (text.endsWith('::')) {
                    const label = text.slice(0, -2).trimEnd();
                    while (pos < lines.length && isBlank(lines[pos])) pos++;
                    if (pos < lines.length && indentOf(lines[pos]) > listIndent) {
                        const codeLines = collectBlock(listIndent);
                        const minInd = codeLines.reduce((m, l) => l.trim() ? Math.min(m, indentOf(l)) : m, Infinity);
                        const code = codeLines.map(l => l.trim() ? l.slice(minInd === Infinity ? 0 : minInd) : '').join('\n').trimEnd();
                        html += `<li>${label ? `<strong>${applyInline(label)}</strong><br>` : ''}<pre><code>${escHtml(code)}</code></pre></li>\n`;
                    } else {
                        html += `<li>${applyInline(label || text)}</li>\n`;
                    }
                } else {
                    html += `<li>${applyInline(text)}</li>\n`;
                }
            }
            html += '</ul>\n'; continue;
        }

        // numbered list
        if (/^(\s*)(\d+\.|#\.)\s/.test(l)) {
            const listIndent = indentOf(l);
            html += '<ol>\n';
            while (pos < lines.length) {
                const li = lines[pos];
                if (isBlank(li)) { pos++; continue; }
                const lm = li.match(/^(\s*)(\d+\.|#\.)\s+(.*)/);
                if (!lm || lm[1].length !== listIndent) break;
                pos++;
                let text = lm[3];
                while (pos < lines.length && !isBlank(lines[pos]) && indentOf(lines[pos]) > listIndent + 1) {
                    text += ' ' + lines[pos].trim(); pos++;
                }
                html += `<li>${applyInline(text)}</li>\n`;
            }
            html += '</ol>\n'; continue;
        }

        // paragraph
        const paraLines = [];
        while (pos < lines.length) {
            const pl = lines[pos];
            if (isBlank(pl) || isAdorn(pl)) break;
            if (/^\.\.\s/.test(pl.trimStart())) break;
            if (/^(\s*)([-*+]|\d+\.|#\.)\s/.test(pl)) break;
            paraLines.push(pl.trim()); pos++;
        }
        if (!paraLines.length) { pos++; continue; }

        const paraText = paraLines.join(' ');

        if (paraText.endsWith('::')) {
            const intro = paraText.slice(0, -2).trimEnd();
            if (intro) html += `<p>${applyInline(intro)}</p>\n`;
            skipBlanks();
            if (pos < lines.length && indentOf(lines[pos]) > 0) {
                const block = collectBlock(indentOf(lines[pos]) - 1);
                html += `<pre><code>${escHtml(block.join('\n'))}</code></pre>\n`;
            }
            continue;
        }

        html += `<p>${applyInline(paraText)}</p>\n`;
    }

    return html;
}

// ── Page title extractor ──────────────────────────────────────────────────────

function extractFirstHeading(rstText) {
    const lines  = rstText.split('\n');
    const ADORN  = /^([=\-~^`'"#*+<>!@$%&])\1+\s*$/;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i], next = lines[i + 1], after = lines[i + 2];
        // overline + title + underline
        if (ADORN.test(l) && next?.trim() && after && ADORN.test(after) && l[0] === after[0])
            return next.trim();
        // title + underline
        if (l.trim() && next && ADORN.test(next) && next.trim().length >= l.trim().length)
            return l.trim();
    }
    return null;
}

async function fetchPageTitle(path) {
    try {
        const res = await fetch(RAW_BASE + path + '.rst');
        if (!res.ok) return null;
        return extractFirstHeading(await res.text());
    } catch (_) { return null; }
}

// ── Toctree extractor ─────────────────────────────────────────────────────────
// Returns [{caption, entries:[{label, path}]}] from all toctree directives.

function extractTocTree(rstText) {
    const sections = [];
    const lines    = rstText.split('\n');
    let i = 0;

    while (i < lines.length) {
        if (!/^\s*\.\.\s+toctree::/.test(lines[i])) { i++; continue; }

        const baseIndent = lines[i].search(/\S/);
        i++;

        let caption = null;
        const entries = [];

        while (i < lines.length) {
            const line    = lines[i];
            const trimmed = line.trim();

            if (trimmed === '') { i++; continue; }
            if (line.search(/\S/) <= baseIndent) break; // end of block

            if (trimmed.startsWith(':caption:')) {
                caption = trimmed.replace(/^:caption:\s*/, '').replace(/:$/, '').trim();
            } else if (!trimmed.startsWith(':')) {
                // Entry: "Label <page>" or "page"
                const lm = trimmed.match(/^(.+?)\s+<(.+?)>\s*$/);
                if (lm) {
                    entries.push({ label: lm[1].trim(), path: lm[2].trim() });
                } else {
                    const name  = trimmed.split('/').pop();
                    const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ');
                    entries.push({ label, path: trimmed });
                }
            }
            i++;
        }

        if (entries.length) sections.push({ caption, entries });
    }

    return sections;
}

// ── Sidebar rendering ─────────────────────────────────────────────────────────

function extractHeadings(contentEl) {
    const headings = [];
    contentEl.querySelectorAll('h2').forEach(h => {
        if (h.id) headings.push({ id: h.id, text: h.textContent.trim() });
    });
    return headings;
}

function buildSidebarHtml(sections, activePage, headings) {
    function sublist() {
        // Prefer child pages from the parent page's toctree
        if (currentPageSubEntries.length) {
            const items = currentPageSubEntries.map(e => {
                const subActive = activePage === e.path;
                return `<li class="${subActive ? 'active' : ''}">` +
                    `<a href="#" data-rst-page="${escHtml(e.path)}" class="rst-page-link">${escHtml(e.label)}</a>` +
                    `</li>`;
            }).join('');
            return `<ul class="sidebar-sublist">${items}</ul>`;
        }
        // Fall back to H2 section headings on the current page
        if (!headings.length) return '';
        const items = headings.map(h =>
            `<li><a href="#${escHtml(h.id)}">${escHtml(h.text)}</a></li>`
        ).join('');
        return `<ul class="sidebar-sublist">${items}</ul>`;
    }

    let html = '';

    // Home entry
    const homeActive = parentPage === 'index';
    html += `<ul class="sidebar-list">
      <li class="${homeActive ? 'active' : ''}">
        <a href="#" data-rst-page="index" class="rst-page-link">NanoSat MO Framework Documentation</a>
      </li>
    </ul>`;

    sections.forEach(({ caption, entries }) => {
        if (caption) html += `<div class="sidebar-caption">${escHtml(caption)}</div>`;
        html += '<ul class="sidebar-list">';
        entries.forEach(({ label, path }) => {
            // Use parentPage (not activePage) so the parent item stays highlighted
            // when the user is viewing one of its child pages.
            const expanded = parentPage === path;
            html += `<li class="${expanded ? 'active' : ''}">
              <a href="#" data-rst-page="${escHtml(path)}" class="rst-page-link">${escHtml(label)}</a>
              ${expanded ? sublist() : ''}
            </li>`;
        });
        html += '</ul>';
    });

    return html;
}

function updateSidebar() {
    const contentEl = document.getElementById('rst-content');
    const headings  = extractHeadings(contentEl);
    document.getElementById('sidebar-nav').innerHTML =
        buildSidebarHtml(tocSections, currentPage, headings);
}

// ── Navigation & fetch ────────────────────────────────────────────────────────

async function loadPage(page) {
    const prevPage = currentPage;
    currentPage = page;

    const topLevelPaths = tocSections.flatMap(s => s.entries).map(e => e.path);
    const isTopLevel    = page === 'index' || topLevelPaths.includes(page);
    const isSubEntry    = currentPageSubEntries.some(e => e.path === page);
    // Whether we need to populate currentPageSubEntries from the fetched page's toctree.
    let shouldPopulateSubEntries = false;

    if (isTopLevel) {
        parentPage = page;
        currentPageSubEntries = [];
        shouldPopulateSubEntries = true;
    } else if (isSubEntry) {
        // Keep parentPage and currentPageSubEntries unchanged so the sidebar stays
        // expanded with the parent highlighted and the active sub-item visible.
    } else {
        // Direct link to a page not yet in the sidebar context.
        // The toctree uses "dir/index" entries (e.g. "mission-integration/index"), so we
        // cannot rely on a simple prefix match. Instead, find any top-level entry that lives
        // in the same directory as the current page — that is the logical parent.
        const pageDir = page.includes('/') ? page.split('/').slice(0, -1).join('/') : '';
        const inferredParent = pageDir
            ? topLevelPaths.find(p => {
                // Plain-name parent: "mission-integration" is a direct prefix.
                if (page.startsWith(p + '/')) return true;
                // Dir/index parent: "mission-integration/index" shares the same dir.
                const pDir = p.includes('/') ? p.split('/').slice(0, -1).join('/') : '';
                return pDir.length > 0 && pDir === pageDir;
            })
            : null;
        if (inferredParent) {
            parentPage = inferredParent;
            try {
                const parentRes = await fetch(RAW_BASE + inferredParent + '.rst');
                if (parentRes.ok) {
                    // parentDir is the *directory* of the parent file, not the file itself.
                    // "mission-integration/index" → "mission-integration/"
                    // "mission-integration"       → "mission-integration/"
                    const parentDir = inferredParent.includes('/')
                        ? inferredParent.split('/').slice(0, -1).join('/') + '/'
                        : inferredParent + '/';
                    const rawEntries = extractTocTree(await parentRes.text())
                        .flatMap(s => s.entries)
                        .map(e => ({
                            label: e.label,
                            path:  e.path.includes('/') ? e.path : parentDir + e.path
                        }));
                    currentPageSubEntries = rawEntries;
                    await Promise.all(rawEntries.map(async entry => {
                        const title = await fetchPageTitle(entry.path);
                        if (title) entry.label = title;
                    }));
                } else {
                    currentPageSubEntries = [];
                }
            } catch (_) {
                currentPageSubEntries = [];
            }
        } else {
            // Truly unknown page — treat as its own parent.
            parentPage = page;
            currentPageSubEntries = [];
            shouldPopulateSubEntries = true;
        }
    }

    const content = document.getElementById('rst-content');
    const rtdLink = document.getElementById('rtd-link');

    content.innerHTML = '<p class="rst-loading">Loading&hellip;</p>';

    try {
        let res = await fetch(RAW_BASE + page + '.rst');

        // Sphinx toctree paths are relative to the document that contains them.
        // If a page lives in a sub-directory (e.g. apps/apps.rst) its toctree
        // entries (e.g. "setup") resolve to apps/setup.rst, not setup.rst.
        // Retry with the referring page's directory as a prefix when 404.
        if (!res.ok && !page.includes('/')) {
            const prevDir = prevPage.includes('/')
                ? prevPage.split('/').slice(0, -1).join('/')
                : '';
            if (prevDir) {
                const relPage = prevDir + '/' + page;
                const relRes  = await fetch(RAW_BASE + relPage + '.rst');
                if (relRes.ok) {
                    res  = relRes;
                    page = relPage;
                    currentPage = page;
                    history.replaceState({ page, branch: BRANCH }, '', '?branch=' + encodeURIComponent(BRANCH) + '#' + page);
                }
            }
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        content.innerHTML = parseRST(text);

        // Syntax-highlight all code blocks
        if (typeof hljs !== 'undefined') {
            content.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
        }

        // Render mermaid diagrams
        if (typeof mermaid !== 'undefined') {
            const mermaidEls = [...content.querySelectorAll('.mermaid')];
            if (mermaidEls.length) mermaid.run({ nodes: mermaidEls });
        }

        content.parentElement.scrollTo(0, 0);
        window.scrollTo(0, 0);

        // Replace auto-labeled :doc: link text with the real page title (H1).
        const pageDir = page.includes('/')
            ? page.split('/').slice(0, -1).join('/') + '/'
            : '';
        const autoLinks = [...content.querySelectorAll('a[data-auto-title]')];
        if (autoLinks.length) {
            await Promise.all(autoLinks.map(async link => {
                const linkPage = link.dataset.rstPage;
                const resolved = linkPage.includes('/') ? linkPage : pageDir + linkPage;
                const title = await fetchPageTitle(resolved);
                if (title) link.textContent = title;
            }));
        }

        // Populate sub-entries from the fetched page's own toctree only for top-level
        // and truly unknown pages. Sub-entries and inferred-parent pages already have
        // currentPageSubEntries set correctly above.
        if (shouldPopulateSubEntries) {
            const pageDir = page.includes('/')
                ? page.split('/').slice(0, -1).join('/') + '/'
                : '';
            const rawEntries = extractTocTree(text)
                .flatMap(s => s.entries)
                .map(e => ({
                    label: e.label,
                    path:  e.path.includes('/') ? e.path : pageDir + e.path
                }));
            currentPageSubEntries = rawEntries;
            await Promise.all(rawEntries.map(async entry => {
                const title = await fetchPageTitle(entry.path);
                if (title) entry.label = title;
            }));
        }

    } catch (err) {
        if (shouldPopulateSubEntries) currentPageSubEntries = [];
        content.innerHTML = `<div class="rst-error">
            <strong>Could not load ${escHtml(page + '.rst')}</strong><br>
            <small>${escHtml(err.message)}</small><br><br>
            <a href="${escHtml(GH_BLOB + page + '.rst')}" target="_blank">View on GitHub instead &rarr;</a>
        </div>`;
    }

    rtdLink.href = RAW_BASE + page + '.rst';
    updateSidebar();
}

function navigate(page) {
    page = page.replace(/^\//, '').replace(/\.rst$/, '');
    history.pushState({ page, branch: BRANCH }, '', '?branch=' + encodeURIComponent(BRANCH) + '#' + page);
    loadPage(page);
}

// ── Global link handler (sidebar + content) ───────────────────────────────────

document.body.addEventListener('click', function(e) {
    // Tab switching
    const tabBtn = e.target.closest('.rst-tab-btn');
    if (tabBtn) {
        const uid = tabBtn.dataset.tabs;
        const idx = tabBtn.dataset.idx;
        document.querySelectorAll(`.rst-tab-btn[data-tabs="${uid}"]`).forEach(b => b.classList.remove('active'));
        document.querySelectorAll(`.rst-tab-pane[data-tabs="${uid}"]`).forEach(p => p.classList.remove('active'));
        tabBtn.classList.add('active');
        document.querySelector(`.rst-tab-pane[data-tabs="${uid}"][data-idx="${idx}"]`).classList.add('active');
        return;
    }

    // Page navigation links (toctree, :doc:, etc.)
    const pageLink = e.target.closest('.rst-page-link');
    if (pageLink) {
        e.preventDefault();
        navigate(pageLink.dataset.rstPage);
        return;
    }

    // Section anchor links (href="#some-heading") — scroll without changing the
    // URL hash so the router never mistakes a section ID for a page name.
    const anchor = e.target.closest('a[href^="#"]');
    if (anchor) {
        const id = anchor.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
});

// Only respond to history entries that our own navigate() created.
// Anchor clicks push entries with no state; ignoring those prevents section
// IDs (e.g. "consumer-test-tool-ctt") from being treated as page paths.
window.addEventListener('popstate', e => {
    if (e.state && e.state.page) {
        if (e.state.branch && e.state.branch !== BRANCH) {
            initBranch(e.state.branch, e.state.page);
        } else {
            loadPage(e.state.page);
        }
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────

async function fetchBranches(preferredBranch) {
    try {
        const res = await fetch(GH_API + '/branches?per_page=100');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const branches = await res.json();
        const select = document.getElementById('branchSelect');
        select.innerHTML = '';
        branches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.name;
            opt.textContent = b.name;
            select.appendChild(opt);
        });
        const target = (preferredBranch && branches.some(b => b.name === preferredBranch))
            ? preferredBranch : BRANCH;
        select.value = target;
        updateBranchConfig(target);
    } catch (_) {
        const select = document.getElementById('branchSelect');
        if (select && select.options.length === 0) {
            const opt = document.createElement('option');
            opt.value = BRANCH;
            opt.textContent = BRANCH;
            select.appendChild(opt);
        }
    }
}

async function initBranch(branch, page) {
    updateBranchConfig(branch);
    const select = document.getElementById('branchSelect');
    if (select) select.value = branch;

    document.getElementById('sidebar-nav').innerHTML = '<p class="sidebar-loading">Loading&hellip;</p>';

    tocSections = [];
    currentPage = 'index';
    parentPage  = 'index';
    currentPageSubEntries = [];

    try {
        const res = await fetch(RAW_BASE + 'index.rst');
        if (res.ok) tocSections = extractTocTree(await res.text());
    } catch (_) {}

    const allEntries = tocSections.flatMap(s => s.entries);
    await Promise.all(allEntries.map(async entry => {
        const title = await fetchPageTitle(entry.path);
        if (title) entry.label = title;
    }));

    loadPage(page || 'index');
    buildSearchIndex(); // background — do not await
}

(async function init() {
    const urlBranch = new URLSearchParams(window.location.search).get('branch');
    const initPage  = window.location.hash.slice(1) || 'index';

    await fetchBranches(urlBranch);

    document.getElementById('branchSelect').addEventListener('change', function () {
        const branch = this.value;
        history.pushState({ page: 'index', branch }, '', '?branch=' + encodeURIComponent(branch));
        initBranch(branch, 'index');
    });

    document.getElementById('searchbox').addEventListener('input', function () {
        const term = this.value.trim().toLowerCase();
        if (!term) { updateSidebar(); return; }

        // Collect label matches (preserving section structure)
        const labelHitPaths = new Set();
        let html = '';
        if ('nanosat mo framework documentation'.includes(term)) {
            labelHitPaths.add('index');
            html += `<ul class="sidebar-list"><li>` +
                `<a href="#" data-rst-page="index" class="rst-page-link">NanoSat MO Framework Documentation</a>` +
                `</li></ul>`;
        }
        tocSections.forEach(function ({ caption, entries }) {
            const matched = entries.filter(function (e) {
                return e.label.toLowerCase().includes(term);
            });
            matched.forEach(function (e) { labelHitPaths.add(e.path); });
            if (!matched.length) return;
            if (caption) html += `<div class="sidebar-caption">${escHtml(caption)}</div>`;
            html += '<ul class="sidebar-list">';
            matched.forEach(function ({ label, path }) {
                html += `<li><a href="#" data-rst-page="${escHtml(path)}" class="rst-page-link">${escHtml(label)}</a></li>`;
            });
            html += '</ul>';
        });

        // Content matches from search index (pages not already shown above)
        const contentHits = [];
        searchIndex.forEach(function ({ label, text }, path) {
            if (!labelHitPaths.has(path) && text.toLowerCase().includes(term))
                contentHits.push({ label, path });
        });
        if (contentHits.length) {
            html += `<div class="sidebar-caption">In page content</div><ul class="sidebar-list">`;
            contentHits.forEach(function ({ label, path }) {
                html += `<li><a href="#" data-rst-page="${escHtml(path)}" class="rst-page-link">${escHtml(label)}</a></li>`;
            });
            html += '</ul>';
        }

        document.getElementById('sidebar-nav').innerHTML =
            html || '<p class="sidebar-loading">No results.</p>';
    });

    await initBranch(BRANCH, initPage);
})();

// ── Sidebar resize ────────────────────────────────────────────────────────────
(function () {
    const resizer = document.getElementById('sidebar-resizer');
    const sidebar = document.getElementById('sidebar');
    let isResizing = false;

    resizer.addEventListener('mousedown', function () {
        isResizing = true;
        resizer.classList.add('resizing');
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isResizing) return;
        const width = e.clientX;
        if (width > 150 && width < 700) {
            sidebar.style.width = width + 'px';
        }
    });

    document.addEventListener('mouseup', function () {
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
})();
