// ── Configuration ─────────────────────────────────────────────────────────────
// Change BRANCH to whichever branch you are actively editing.
const BRANCH   = 'master';
const REPO     = 'esa/nanosat-mo-framework';
const DOCS_DIR = 'docs/source';
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${DOCS_DIR}/`;
const GH_BLOB  = `https://github.com/${REPO}/blob/${BRANCH}/${DOCS_DIR}/`;

let currentPage           = 'index';
let parentPage            = 'index'; // top-level sidebar item that owns the current view
let tocSections           = []; // [{caption, entries:[{label,path}]}]
let currentPageSubEntries = []; // [{label,path}] from the active top-level page's toctree

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
            stash(`<a href="#" data-rst-page="${escHtml(page)}" class="rst-page-link">${escHtml(label)}</a>`))
        .replace(/:doc:`([^`]+)`/g, (_, page) =>
            stash(`<a href="#" data-rst-page="${escHtml(page)}" data-auto-title="true" class="rst-page-link">${escHtml(page.split('/').pop().replace(/[-_]/g, ' '))}</a>`));

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
                    if (lm) return `<li><a href="#" data-rst-page="${escHtml(lm[2])}" class="rst-page-link">${escHtml(lm[1])}</a></li>`;
                    const label = e.split('/').pop().replace(/[-_]/g, ' ');
                    return `<li><a href="#" data-rst-page="${escHtml(e)}" data-auto-title="true" class="rst-page-link">${escHtml(label)}</a></li>`;
                });
                return `<div class="toctree"><ul>${items.join('')}</ul></div>\n`;
            }
            case 'rubric':
                return `<p class="rubric">${applyInline(d.arg)}</p>\n`;
            case 'centered':
                return `<p style="text-align:center"><strong>${applyInline(d.arg)}</strong></p>\n`;
            case 'math':
                return `<div class="admonition math"><pre>${escHtml(d.content || d.arg)}</pre></div>\n`;
            case 'literalinclude':
                return `<pre><code>[included file: ${escHtml(d.arg)}]</code></pre>\n`;
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

    // Home entry — expanded when parentPage is index
    const homeExpanded = parentPage === 'index';
    html += `<ul class="sidebar-list">
      <li class="${homeExpanded ? 'active' : ''}">
        <a href="#" data-rst-page="index" class="rst-page-link">&#8962;&ensp;Home</a>
        ${homeExpanded ? sublist() : ''}
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

    // Decide whether this is a top-level toc entry or a child of the current parent.
    // Child pages keep the parent's sidebar context (parentPage + currentPageSubEntries)
    // so the parent item stays expanded and the active sub-item can be highlighted.
    const topLevelPaths  = tocSections.flatMap(s => s.entries).map(e => e.path);
    const isTopLevel     = page === 'index' || topLevelPaths.includes(page);
    const isSubEntry     = currentPageSubEntries.some(e => e.path === page);

    if (isTopLevel) {
        parentPage            = page;
        currentPageSubEntries = []; // will be repopulated after fetch
    } else if (!isSubEntry) {
        // Unknown page (direct URL, browser back, etc.) — treat as its own parent
        parentPage            = page;
        currentPageSubEntries = [];
    }
    // isSubEntry: keep parentPage and currentPageSubEntries unchanged so the
    // sidebar stays expanded with the parent highlighted and the sub-item active.

    const content = document.getElementById('rst-content');
    const crumb   = document.getElementById('breadcrumb');
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
                    history.replaceState({ page }, '', '#' + page);
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

        // Populate sub-entries only when visiting a top-level (or unknown) page.
        // When visiting a sub-entry we intentionally keep the parent's sub-entries.
        if (!isSubEntry) {
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
        if (!isSubEntry) currentPageSubEntries = [];
        content.innerHTML = `<div class="rst-error">
            <strong>Could not load ${escHtml(page + '.rst')}</strong><br>
            <small>${escHtml(err.message)}</small><br><br>
            <a href="${escHtml(GH_BLOB + page + '.rst')}" target="_blank">View on GitHub instead &rarr;</a>
        </div>`;
    }

    crumb.textContent = page === 'index' ? '' : page.replace(/\//g, ' › ');
    rtdLink.href = RAW_BASE + page + '.rst';
    updateSidebar();
}

function navigate(page) {
    page = page.replace(/^\//, '').replace(/\.rst$/, '');
    history.pushState({ page }, '', '#' + page);
    loadPage(page);
}

// ── Global link handler (sidebar + content) ───────────────────────────────────

document.body.addEventListener('click', function(e) {
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
        loadPage(e.state.page);
    }
});

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
    // 1. Fetch index.rst to get the toctree structure
    try {
        const res = await fetch(RAW_BASE + 'index.rst');
        if (res.ok) tocSections = extractTocTree(await res.text());
    } catch (_) { /* sidebar will be empty, content still loads */ }

    // 2. Replace filename-derived labels with the actual page titles (h1 headings),
    //    fetching all pages in parallel so the sidebar matches ReadTheDocs exactly.
    const allEntries = tocSections.flatMap(s => s.entries);
    await Promise.all(allEntries.map(async entry => {
        const title = await fetchPageTitle(entry.path);
        if (title) entry.label = title;
    }));

    // 3. Load the initial page (also triggers first sidebar render)
    const initPage = window.location.hash.slice(1) || 'index';
    loadPage(initPage);
})();
