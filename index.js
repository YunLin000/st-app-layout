/* ============================================================================
 * st-app-layout · index.js
 * 酒馆 APP 布局 · Stage 1 (v0.4.0)
 * 适用：SillyTavern 1.19.0
 *
 * 设计要点（对应需求文档）：
 *   - 只用 SillyTavern.getContext() 公开 API + 原生 DOM，不 import 内部模块。
 *   - 聊天界面沿用原生 #sheld / #chat / #send_form，绝不重画消息与输入。
 *   - 列表/Tab/弹窗/顶部栏为新建 DOM；所有用户文本走 textContent（防注入）。
 *   - 失败自动退回原版（移除 body.st-app-on）；界面可见版本号 + 错误条。
 *   - 手机返回键逐级后退（history 栈：菜单→弹窗→二级页→列表）。
 *   - 布局与主题解耦：配色全靠 style.css 里的 var(--SmartTheme*)。
 * ============================================================================ */

const MODULE = 'st_app_layout';
const VERSION = '0.8.6';
const STAGE = 'Stage 2 + 主题';

/* Stage 2/3：新建聊天 + 角色历史会话数 + 右栏菜单切换（script.js 公开导出；Third-party 扩展同路径引用是 ST 通行做法） */
import { doNewChat, getPastCharacterChats, select_selected_character, selectRightMenuWithAnimation } from '../../../../script.js';

/* ---------- inline SVG 线条图标（不用 emoji，不用 Font Awesome） ---------- */
const ICONS = {
    chat: '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>',
    users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    api: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2" style="fill:currentColor;stroke:none"/><circle cx="8" cy="12" r="2" style="fill:currentColor;stroke:none"/><circle cx="15" cy="18" r="2" style="fill:currentColor;stroke:none"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.7" style="fill:currentColor;stroke:none"/><circle cx="12" cy="12" r="1.7" style="fill:currentColor;stroke:none"/><circle cx="19" cy="12" r="1.7" style="fill:currentColor;stroke:none"/></svg>',
    dotsV: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.7" style="fill:currentColor;stroke:none"/><circle cx="12" cy="12" r="1.7" style="fill:currentColor;stroke:none"/><circle cx="12" cy="19" r="1.7" style="fill:currentColor;stroke:none"/></svg>',
    refresh: '<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    inbox: '<svg viewBox="0 0 24 24"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" style="fill:currentColor;stroke:none"/><circle cx="15" cy="12" r="2" style="fill:currentColor;stroke:none"/><circle cx="8" cy="18" r="2" style="fill:currentColor;stroke:none"/></svg>',
    code: '<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    smile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
    image: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
    volume: '<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" style="fill:currentColor;stroke:none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="6" style="fill:currentColor;stroke:none"/><rect x="12" y="7" width="3" height="10" style="fill:currentColor;stroke:none"/><rect x="17" y="13" width="3" height="4" style="fill:currentColor;stroke:none"/></svg>',
    layout: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    power: '<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

const TABS = [
    { id: 'chat', label: '聊天', icon: 'chat', ready: true },
    { id: 'characters', label: '角色', icon: 'users', ready: true },
    { id: 'api', label: 'API', icon: 'api', ready: true },
    { id: 'settings', label: '设置', icon: 'settings', ready: true },
];

/* 原生抽屉选择器（需求五：⋯ 菜单收纳原顶部栏功能） */
const NATIVE_DRAWERS = {
    characterManagement: '#rightNavHolder',
    worldInfo: '#WI-SP-button',
    aiConfig: '#ai-config-button',
    persona: '#persona-management-button',
    extensions: '#extensions-settings-button',
};

/* 原生顶部栏全部入口（含标题/副标题；第三方扩展注册的抽屉会动态扫描进来） */
const BUILTIN_DRAWERS = {
    '#WI-SP-button': { title: '世界书', sub: 'Lorebook / 全局世界书' },
    '#ai-config-button': { title: 'AI 配置', sub: '预设 / 采样 / 上下文长度' },
    '#sys-settings-button': { title: 'API 连接', sub: '连接类型 / URL / Key / 模型' },
    '#advanced-formatting-button': { title: '高级格式', sub: 'Instruct / 上下文模板' },
    '#extensions-settings-button': { title: '扩展（插件）', sub: '正则 / 生图 / TTS / 插件开关' },
    '#persona-management-button': { title: '人设管理', sub: '用户人设' },
    '#backgrounds-button': { title: '背景', sub: '更换背景图' },
    '#user-settings-button': { title: '用户设置', sub: '字体 / 消息样式 / 偏好' },
    '#rightNavHolder': { title: '角色管理', sub: '角色列表 / 编辑 / 导入' },
};

/* ---------- 运行时状态 ---------- */
const state = {
    ctx: null,
    settings: null,
    enabled: false,
    view: 'tabs',      // 'tabs' | 'chat'
    tab: 'chat',
    chats: [],
    chatsLoading: false,
    chatsError: null,
    chatsLoadedAt: 0,
    opening: false,
    sheetOpen: false,
    backStack: [],
    historyPushed: false,
    conflictDetected: false,
    lastError: null,
    geomBlockerLogged: false,
    geomInfo: null,
    themeBlockParent: null,
    currentChatMeta: null,
    nativeDrawerId: null,
    movedPanel: null,
    nextLayerReplacesHistory: false,
    skipNextPopstate: false,
};

/* ============================================================================
 * 小工具
 * ========================================================================== */

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
}

function icon(name) {
    const span = document.createElement('span');
    span.className = 'st-app-ico';
    span.innerHTML = ICONS[name] || '';
    return span;
}

function debounce(fn, wait) {
    let t = null;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function safe(label, fn) {
    return function (...args) {
        try {
            const r = fn.apply(this, args);
            if (r && typeof r.then === 'function') {
                return r.catch((e) => reportError(label, e));
            }
            return r;
        } catch (e) {
            reportError(label, e);
        }
    };
}

function reportError(label, e) {
    const msg = e && e.message ? e.message : String(e);
    console.error('[st-app-layout]', label, e);
    state.lastError = { label, message: msg, time: Date.now() };
    showErrorBanner(label, msg);
    toastrNotify('error', `${label}: ${msg}`);
}

/* ============================================================================
 * 几何自愈：窄屏「只显示一条」根因
 * ----------------------------------------------------------------------------
 * 现象：聊天列表能渲染、能滚，但可视高度只有约一条。
 * 根因：<body>/<html> 上若存在 transform / filter / perspective / contain /
 *   will-change，会为 position:fixed 的后代创建新的「包含块」，于是我们的
 *   #st-app-root（inset:0）不再相对视口、而是相对那个被压扁的 body/祖先。
 *   宽屏时该属性可能不触发或 body 高度够大；窄屏时 body 高度塌缩 → 只剩一条。
 * 处理：① 检测并中和这些破坏性属性；② 用内联 !important 强制自身几何。
 * ========================================================================== */

function detectGeometryBlockers() {
    const out = [];
    const check = (node, label) => {
        if (!node) return;
        let cs;
        try { cs = getComputedStyle(node); } catch { return; }
        const bad = [];
        if (cs.transform && cs.transform !== 'none') bad.push('transform:' + cs.transform.slice(0, 24));
        if (cs.filter && cs.filter !== 'none') bad.push('filter:' + cs.filter.slice(0, 24));
        if (cs.perspective && cs.perspective !== 'none') bad.push('perspective:' + cs.perspective);
        if (cs.willChange && /transform|filter|perspective/.test(cs.willChange)) bad.push('will-change:' + cs.willChange);
        if (cs.contain && cs.contain !== 'none') bad.push('contain:' + cs.contain);
        if (bad.length) out.push(label + ' [' + bad.join(', ') + ']');
    };
    check(document.documentElement, 'html');
    check(document.body, 'body');
    return out;
}

function applyGeometry(reason) {
    const root = document.getElementById('st-app-root');
    if (!root) return;
    if (!state.enabled) { state.geomInfo = null; return; } // 原版模式不动 body/html
    const blockers = detectGeometryBlockers();

    if (blockers.length) {
        // 中和会破坏 position:fixed 包含块的属性（仅 APP 模式；内联 !important）
        const targets = [document.documentElement, document.body];
        for (const t of targets) {
            try {
                t.style.setProperty('transform', 'none', 'important');
                t.style.setProperty('filter', 'none', 'important');
                t.style.setProperty('perspective', 'none', 'important');
                t.style.setProperty('will-change', 'auto', 'important');
                t.style.setProperty('contain', 'none', 'important');
            } catch { /* noop */ }
        }
        if (!state.geomBlockerLogged) {
            state.geomBlockerLogged = true;
            console.warn('[st-app-layout] 检测到破坏 position:fixed 的祖先属性，已中和：', blockers);
        }
    }

    // 强制自身几何（内联 !important，压过一切主题规则）
    const s = root.style;
    s.setProperty('position', 'fixed', 'important');
    s.setProperty('top', '0', 'important');
    s.setProperty('left', '0', 'important');
    s.setProperty('right', '0', 'important');
    s.setProperty('bottom', '0', 'important');
    s.setProperty('width', '100vw', 'important');
    s.setProperty('height', '100dvh', 'important');
    s.setProperty('z-index', '10010', 'important');

    // 页面层也钉死铺满根容器
    const pages = document.getElementById('st-app-pages');
    if (pages) {
        const ps = pages.style;
        ps.setProperty('position', 'absolute', 'important');
        ps.setProperty('inset', '0', 'important');
    }

    // 复检：若仍异常，提示用户（但不阻断）
    let rect = null;
    try { rect = root.getBoundingClientRect(); } catch { /* noop */ }
    state.geomInfo = { blockers, rect, vp: { w: window.innerWidth, h: window.innerHeight }, reason: reason || '' };
    if (rect && (rect.height < window.innerHeight * 0.6)) {
        console.warn('[st-app-layout] #st-app-root 高度仍异常:', rect, 'blockers=', blockers);
    }
}

const debouncedGeometry = debounce(() => { if (state.enabled) applyGeometry('resize'); }, 150);

/** 关闭 APP 模式时，清掉皮肤/毛玻璃/强调色/圆角/密度等外观覆盖，让原生完全恢复 */
function clearAppearanceOverrides() {
    const body = document.body;
    try {
        SKINS.forEach((sk) => body.classList.remove('st-app-skin-' + sk.id));
        body.classList.remove('st-app-flat');
        document.documentElement.style.removeProperty('--st-app-accent');
        document.documentElement.style.removeProperty('--st-app-radius-scale');
        document.documentElement.style.removeProperty('--st-app-density');
    } catch { /* noop */ }
}

/** 关闭 APP 模式时，清掉我们给 body/html/#st-app-root 加的内联覆盖，让原生主题完全恢复 */
function clearGeometryOverrides() {
    for (const t of [document.documentElement, document.body]) {
        try {
            t.style.removeProperty('transform');
            t.style.removeProperty('filter');
            t.style.removeProperty('perspective');
            t.style.removeProperty('will-change');
            t.style.removeProperty('contain');
        } catch { /* noop */ }
    }
    const root = document.getElementById('st-app-root');
    if (root) { ['position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'z-index'].forEach((p) => root.style.removeProperty(p)); }
    const pages = document.getElementById('st-app-pages');
    if (pages) { pages.style.removeProperty('position'); pages.style.removeProperty('inset'); }
    state.geomInfo = null;
    state.geomBlockerLogged = false;
}

function fatal(e) {
    console.error('[st-app-layout] FATAL', e);
    state.enabled = false;
    document.body.classList.remove('st-app-on', 'st-app-chat', 'st-app-native-drawer');
    showErrorBanner('插件初始化失败，已自动退回原版布局', e && e.message ? e.message : String(e));
}

function toastrNotify(type, msg) {
    try {
        if (typeof toastr !== 'undefined' && toastr[type]) toastr[type](msg, '酒馆 APP 布局');
    } catch { /* noop */ }
}

function stripExt(name) {
    return String(name || '').replace(/\.jsonl$/, '');
}

function firstChar(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    return Array.from(s)[0];
}

/* ---------- 设置存取（走酒馆 extension_settings） ---------- */
function getSettings(ctx) {
    const store = ctx.extensionSettings;
    if (!store[MODULE] || typeof store[MODULE] !== 'object') {
        store[MODULE] = { enabled: true };
    }
    if (typeof store[MODULE].enabled !== 'boolean') store[MODULE].enabled = true;
    return store[MODULE];
}

function saveSettings() {
    try { state.ctx && state.ctx.saveSettingsDebounced && state.ctx.saveSettingsDebounced(); } catch { /* noop */ }
}

/* ============================================================================
 * 启动
 * ========================================================================== */

function whenReady(fn, tries = 120) {
    const ctx = globalThis.SillyTavern && globalThis.SillyTavern.getContext && globalThis.SillyTavern.getContext();
    // 关键：延后到当前同步执行栈结束再跑 init —— 模块顶层 const（SKINS 等）
    // 全部初始化完成后才执行，避免 TDZ「Cannot access 'X' before initialization」。
    if (ctx && document.body) { setTimeout(() => fn(ctx), 0); return; }
    if (tries <= 0) {
        console.error('[st-app-layout] SillyTavern 上下文未就绪，插件未启用');
        return;
    }
    setTimeout(() => whenReady(fn, tries - 1), 120);
}

whenReady((ctx) => {
    try { init(ctx); } catch (e) { fatal(e); }
});

function init(ctx) {
    state.ctx = ctx;
    state.settings = getSettings(ctx);

    applyUrlOverrides();

    injectShell();
    bindShellEvents();
    bindContextEvents(ctx);
    watchNestedPopups();
    watchExtensionList();

    detectLayoutConflicts();

    // 应用初始模式（默认启用；失败不会加 body class）
    setModeEnabled(state.settings.enabled !== false, { persist: false, silent: true });

    // 原生扩展设置面板（挂在 Extensions 抽屉，任何时候都能进来开关）
    safe('settings panel', registerNativeSettings)();

    // Stage 2：恢复主题色
    applyAccent();
    // v0.6.0：外观系统（皮肤/圆角/密度/毛玻璃）
    ensureAppearanceDefaults();
    applyAppearance();

    // 酒馆主题变量变更（用户切换第三方主题）时重算强调色与不透明 backing
    try {
        const mo = new MutationObserver(debounce(() => { try { applyAccent(); updateContrastTokens(); } catch { /* noop */ } }, 200));
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    } catch { /* noop */ }

    // 几何自愈：中和破坏 position:fixed 的祖先 + 强制自身尺寸
    safe('geometry', applyGeometry)('init');

    console.info(`[st-app-layout] v${VERSION} ${STAGE} loaded · mode=${state.enabled ? 'APP' : 'native'}`);
}

/* URL 逃生口：?st_app_layout=off 强制原版，=on 强制 APP（方便排查） */
function applyUrlOverrides() {
    try {
        const v = new URLSearchParams(location.search).get('st_app_layout');
        if (v === 'off') { state.settings.enabled = false; saveSettings(); }
        else if (v === 'on') { state.settings.enabled = true; saveSettings(); }
    } catch { /* noop */ }
}

/* ============================================================================
 * DOM 外壳注入
 * ========================================================================== */

function injectShell() {
    // 主根容器（已有的话先移除，保证幂等）
    const old = document.getElementById('st-app-root');
    if (old) old.remove();

    const root = el('div', null);
    root.id = 'st-app-root';
    root.innerHTML = `
        <main id="st-app-pages" role="main"></main>
        <nav id="st-app-tabbar" role="tablist" aria-label="主导航"></nav>
        <header id="st-app-chat-topbar">
            <button class="st-app-icon-btn" data-act="back" aria-label="返回"><span class="st-app-ico">${ICONS.back}</span></button>
            <div class="st-app-chat-id">
                <span class="st-app-avatar-wrap sm" id="st-app-chat-avatar-wrap"></span>
                <span class="st-app-chat-id-text">
                    <span class="st-app-chat-id-name" id="st-app-chat-name"></span>
                    <span class="st-app-chat-id-sub" id="st-app-chat-sub"></span>
                </span>
            </div>
            <button class="st-app-icon-btn st-app-icon-btn-sm" data-act="more" aria-label="更多"><span class="st-app-ico">${ICONS.more}</span></button>
        </header>
        <div id="st-app-chat-loading" class="st-app-chat-loading" aria-hidden="true">
            <span class="st-app-chat-loading-spin"></span>
            <span class="st-app-chat-loading-text">正在加载聊天…</span>
        </div>
        <div id="st-app-sheet-mask"></div>
        <section id="st-app-sheet" role="dialog" aria-modal="true">
            <div class="st-app-sheet-handle"></div>
            <div class="st-app-sheet-title" id="st-app-sheet-title"></div>
            <div class="st-app-sheet-body" id="st-app-sheet-body"></div>
        </section>
        <section id="st-app-native-page" aria-hidden="true">
            <header class="st-app-native-page-head">
                <button class="st-app-icon-btn" data-act="close-native-page" aria-label="返回"><span class="st-app-ico">${ICONS.back}</span></button>
                <h1 class="st-app-page-title" id="st-app-native-page-title"></h1>
            </header>
            <div class="st-app-native-page-body" id="st-app-native-page-body"></div>
        </section>
    `;
    document.body.appendChild(root);

    // 页面内容（一级 Tab 页）
    buildPages(document.getElementById('st-app-pages'));
    buildTabBar(document.getElementById('st-app-tabbar'));

    ensureBodyLevel('st-app-error-banner', () => buildErrorBanner());

    // 版本号：只在聊天页头部的 chip 显示（一级主页右下不再显示角标）
    const chip = document.querySelector('#st-app-pages .st-app-version-chip');
    if (chip) chip.textContent = 'v' + VERSION;
}

function ensureBodyLevel(id, factory) {
    let n = document.getElementById(id);
    if (!n) { n = factory(); document.body.appendChild(n); }
    return n;
}

function buildPages(pages) {
    // ---- 聊天页 ----
    const chatPage = el('section', 'st-app-page active');
    chatPage.dataset.page = 'chat';
    const chatHead = el('div', 'st-app-page-head');
    chatHead.appendChild(el('h1', 'st-app-page-title', '聊天'));
    chatHead.appendChild(el('span', 'st-app-version-chip', 'v' + VERSION));
    const refreshBtn = el('button', 'st-app-icon-btn');
    refreshBtn.type = 'button';
    refreshBtn.dataset.act = 'refresh-chats';
    refreshBtn.title = '刷新聊天列表';
    refreshBtn.setAttribute('aria-label', '刷新聊天列表');
    refreshBtn.innerHTML = ICONS.refresh;
    chatHead.appendChild(refreshBtn);
    chatPage.appendChild(chatHead);
    const chatList = el('div', null);
    chatList.id = 'st-app-chat-list';
    chatList.className = 'st-app-list';
    chatPage.appendChild(chatList);
    pages.appendChild(chatPage);

    // ---- 角色 / API / 设置页 ----
    pages.appendChild(buildCharactersPage());
    pages.appendChild(buildApiPage());
    pages.appendChild(buildSettingsPage());
}

function buildPlaceholder(page, iconKey, title, sub) {
    const sec = el('section', 'st-app-page');
    sec.dataset.page = page;
    const head = el('div', 'st-app-page-head');
    head.appendChild(el('h1', 'st-app-page-title', title));
    sec.appendChild(head);
    const ph = el('div', 'st-app-placeholder');
    const ic = el('span', 'st-app-ico');
    ic.innerHTML = ICONS[iconKey] || '';
    ph.appendChild(ic);
    ph.appendChild(el('div', 'st-app-placeholder-title', title));
    ph.appendChild(el('div', 'st-app-placeholder-sub', sub));
    ph.appendChild(el('span', 'st-app-badge', 'Stage 2 · 即将上线'));
    sec.appendChild(ph);
    return sec;
}

function buildSettingsPage() {
    const sec = el('section', 'st-app-page');
    sec.dataset.page = 'settings';
    const head = el('div', 'st-app-page-head');
    head.appendChild(el('h1', 'st-app-page-title', '设置'));
    sec.appendChild(head);

    const list = el('div', 'st-app-list');
    list.id = 'st-app-settings-list';
    sec.appendChild(list);

    // 二级页：UI 主题（覆盖在列表上）
    const sub = el('div', 'st-app-subpage');
    sub.id = 'st-app-subpage';
    const subHead = el('div', 'st-app-subpage-head');
    const backBtn = el('button', 'st-app-icon-btn');
    backBtn.type = 'button';
    backBtn.dataset.act = 'close-subpage';
    backBtn.setAttribute('aria-label', '返回');
    backBtn.innerHTML = '<span class="st-app-ico">' + ICONS.back + '</span>';
    subHead.appendChild(backBtn);
    const subTitle = el('h1', 'st-app-page-title', 'UI 主题');
    subTitle.id = 'st-app-subpage-title';
    subHead.appendChild(subTitle);
    sub.appendChild(subHead);
    const subBody = el('div', 'st-app-subpage-body');
    subBody.id = 'st-app-subpage-body';
    sub.appendChild(subBody);
    sec.appendChild(sub);

    renderSettingsList();
    return sec;
}

/* ---- 动态收集：原生顶部栏抽屉 + 扩展插件面板（通用适配，后续插件注册自动出现） ---- */

function drawerTitleOf(d) {
    try {
        const tog = d.querySelector('.drawer-toggle');
        const icon = d.querySelector('.drawer-icon');
        const t = (tog && tog.getAttribute('title')) || (icon && icon.getAttribute('title')) || (tog && tog.textContent.trim());
        return (t || d.textContent.trim() || '').slice(0, 30) || '面板';
    } catch { return '面板'; }
}

function collectNativeDrawers() {
    const out = [];
    // 内置 9 项按偏好顺序（若 DOM 里存在）
    for (const sel of Object.keys(BUILTIN_DRAWERS)) {
        if (document.querySelector(sel)) {
            const m = BUILTIN_DRAWERS[sel];
            out.push({ id: sel, title: m.title, sub: m.sub, builtin: true });
        }
    }
    // 第三方注册到 #top-settings-holder 的抽屉（非内置）
    const holder = document.querySelector('#top-settings-holder');
    if (holder) {
        holder.querySelectorAll(':scope > .drawer').forEach((d) => {
            const sel = d.id ? '#' + d.id : null;
            if (sel && !BUILTIN_DRAWERS[sel] && !out.some((x) => x.id === sel)) {
                out.push({ id: sel, title: drawerTitleOf(d), sub: '顶部栏面板', builtin: false });
            }
        });
    }
    return out;
}

function collectExtensionPanels() {
    const out = [];
    const seen = new Set();
    const roots = ['#extensions_settings2', '#extensions_settings'];
    let i = 0;
    for (const sel of roots) {
        const root = document.querySelector(sel);
        if (!root) continue;
        root.querySelectorAll('.inline-drawer').forEach((d) => {
            // 排除我们自己注入的、以及嵌套进来的插件自己的子面板（只取顶层面板）
            if (d.querySelector('#st_app_layout_enable')) return;
            if (d.closest('.st-app-')) return;
            // 已单列在 ⋯ 里的内置扩展容器不重复
            if (d.closest('#sd_container,#tts_container,#regex_container')) return;
            const b = d.querySelector('.inline-drawer-toggle b, .inline-drawer-header b, .inline-drawer-toggle > b, b');
            let title = (b && b.textContent.trim()) || '';
            if (!title) {
                const t = d.querySelector('.inline-drawer-toggle');
                title = t ? t.textContent.trim().slice(0, 30) : '';
            }
            if (!title) title = '扩展 ' + (++i);
            if (!d.id) d.id = 'st-app-ext-panel-' + (out.length) + '-' + Math.floor(Math.random() * 1e6);
            const key = title;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ id: d.id, title });
        });
    }
    return out;
}

/** 扩展面板标题（.extension_container 或 .inline-drawer） */
function extensionTitleOf(el) {
    try {
        const b = el.querySelector('.inline-drawer-toggle b, .inline-drawer-header b, .inline-drawer-toggle > b, h4.extension_header b, .ext_title');
        if (b) return b.textContent.trim().slice(0, 40);
        const h = el.querySelector('h4, .extension_header, b, strong');
        if (h) return h.textContent.trim().slice(0, 40);
    } catch { /* noop */ }
    return '';
}

/** 收集 Extensions 抽屉里所有扩展面板（内置容器 / 第三方面板 / 自定义面板），
 *  逐条拆成独立入口。原生 Extensions 弹窗保留不动，这里只是读它的子节点。
 *  注意：有些插件（如酒馆助手 #tavern_helper）挂的是普通 div，不是 .inline-drawer
 *  也不是 .extension_container → 扫所有直接子 div，按标题/已知 id 映射识别。 */
const KNOWN_CUSTOM_PANELS = {
    tavern_helper: '酒馆助手',
};

/** 由标题生成确定性 id（重建后同标题仍得到同一 id，避免随机 id 漂移导致点不中） */
function extTitleSlug(title, kind) {
    const s = String(title || '扩展').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    return 'st-app-ext-' + (kind === 'container' ? 'ctn' : 'pnl') + '-' + s;
}

function findExtensionPanelByTitle(title) {
    if (!title) return null;
    const roots = ['#extensions_settings', '#extensions_settings2'];
    for (const sel of roots) {
        const root = document.querySelector(sel);
        if (!root) continue;
        for (const child of (root.children || [])) {
            if (child.closest('.st-app-')) continue;
            if (extensionTitleOf(child) === title) return child;
        }
    }
    return null;
}

function collectExtensionEntries() {
    const out = [];
    const seen = new Set();
    const roots = ['#extensions_settings', '#extensions_settings2'];
    for (const sel of roots) {
        const root = document.querySelector(sel);
        if (!root) continue;
        root.querySelectorAll(':scope > div').forEach((child) => {
            if (child.closest('.st-app-')) return;
            if (child.querySelector('#st_app_layout_enable')) return;
            let kind = 'panel';
            if (child.classList.contains('extension_container')) kind = 'container';
            else if (child.classList.contains('inline-drawer')) kind = 'panel';
            else kind = 'custom';
            let title = extensionTitleOf(child);
            // 自定义面板：无内嵌标题时按已知 id 映射（如 tavern_helper → 酒馆助手）
            if (!title && kind === 'custom' && child.id) {
                title = KNOWN_CUSTOM_PANELS[child.id] || '';
            }
            // 无标题 = 未加载/预留空壳/无法识别 → 不列（避免数字占位项）
            if (!title) return;
            if (seen.has(title)) return;
            seen.add(title);
            // 无原生 id → 用标题生成确定性 id（不用随机数，防止重建后 id 变化）
            if (!child.id) child.id = extTitleSlug(title, kind);
            out.push({ id: child.id, title, kind });
        });
    }
    return out;
}

/** 设置页可见时，扩展列表变更（删除/新增/启停）自动刷新 —— 同步显示 */
function watchExtensionList() {
    if (typeof MutationObserver === 'undefined') return;
    let timer = 0;
    const debounced = () => {
        clearTimeout(timer);
        timer = setTimeout(safe('ext-list-sync', () => {
            if (!state.enabled || state.tab !== 'settings' || state.view !== 'tabs') return;
            const page = document.getElementById('st-app-settings-list');
            if (!page || !page.offsetParent) return; // 设置页不可见就不刷
            renderSettingsList();
        }), 250);
    };
    const obs = new MutationObserver(debounced);
    for (const sel of ['#extensions_settings', '#extensions_settings2']) {
        const r = document.querySelector(sel);
        if (r) obs.observe(r, { childList: true, subtree: false });
    }
}

/** 渲染设置列表（原生全部入口 + 扩展插件面板 + 保命绳 + 诊断） */
function renderSettingsList() {
    const list = document.getElementById('st-app-settings-list');
    if (!list) return;
    list.textContent = '';

    list.appendChild(el('div', 'st-app-group-title', '外观'));
    const gUI = el('div', 'st-app-group');
    gUI.appendChild(buildActRow('open-theme', 'UI 主题', '皮肤 / 圆角 / 密度 / 主题色 / 布局模式'));
    list.appendChild(gUI);

    list.appendChild(el('div', 'st-app-group-title', '酒馆原生设置'));
    const gNative = el('div', 'st-app-group');
    const drawers = collectNativeDrawers();
    for (const d of drawers) {
        if (!d.builtin) continue; // 第三方抽屉放到「扩展插件」分组
        // 角色管理：设置里点进去要进「角色列表」，不是上次的编辑界面
        if (d.id === '#rightNavHolder') {
            const b = el('button', 'st-app-row st-app-row-btn');
            b.type = 'button';
            b.dataset.act = 'open-character-list';
            b.appendChild(buildRowMain(d.title, d.sub || ''));
            gNative.appendChild(b);
            continue;
        }
        gNative.appendChild(buildDrawerRow(d.id, d.title, d.sub || ''));
    }
    if (!gNative.children.length) {
        const row = el('div', 'st-app-row');
        row.appendChild(buildRowMain('未找到原生入口', '请确认酒馆已加载顶部栏'));
        gNative.appendChild(row);
    }
    list.appendChild(gNative);

    // 扩展插件：第三方顶部栏抽屉（主面板）+ Extensions 里每个扩展拆成独立二级入口 + 原生插件管理
    const thirdDrawers = drawers.filter((d) => !d.builtin);
    const extEntries = collectExtensionEntries();
    list.appendChild(el('div', 'st-app-group-title', '扩展插件'));
    const gExt = el('div', 'st-app-group');
    for (const d of thirdDrawers) {
        gExt.appendChild(buildDrawerRow(d.id, d.title, '插件主面板'));
    }
    for (const e of extEntries) {
        const b = el('button', 'st-app-row st-app-row-btn');
        b.type = 'button';
        b.dataset.act = 'open-ext-panel';
        b.dataset.panel = e.id;
        b.dataset.title = e.title;
        b.appendChild(buildRowMain(e.title, e.kind === 'container' ? '内置扩展' : '插件设置 / 面板'));
        gExt.appendChild(b);
    }
    list.appendChild(gExt);

    list.appendChild(el('div', 'st-app-group-title', '数据与维护'));
    const gMaint = el('div', 'st-app-group');
    gMaint.appendChild(buildActRow('reload', '重新加载', '刷新页面'));
    list.appendChild(gMaint);

    list.appendChild(el('div', 'st-app-group-title', '布局'));
    const gMode = el('div', 'st-app-group');
    const rowMode = el('div', 'st-app-row');
    rowMode.appendChild(buildRowMain('APP 布局', '关闭后完全恢复酒馆原生界面（保命绳）'));
    const sw = el('button', 'st-app-switch');
    sw.type = 'button';
    sw.dataset.act = 'toggle-mode';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-label', 'APP 布局开关');
    rowMode.appendChild(sw);
    gMode.appendChild(rowMode);
    list.appendChild(gMode);

    list.appendChild(el('div', 'st-app-group-title', '诊断与关于'));
    const gAbout = el('div', 'st-app-group');
    gAbout.appendChild(buildActRow('diag', '诊断信息', '层级 / 视口 / 版本 / 状态'));
    gAbout.appendChild(buildRowInfo(null, '版本', `v${VERSION} · ${STAGE}`));
    gAbout.appendChild(buildRowInfo(null, '原则', '只改布局、不碰配色、不改酒馆数据'));
    list.appendChild(gAbout);

    const conflict = el('div', 'st-app-group-title');
    conflict.id = 'st-app-conflict-title';
    conflict.style.display = 'none';
    list.appendChild(conflict);
    const conflictBody = el('div', 'st-app-group');
    conflictBody.id = 'st-app-conflict-body';
    conflictBody.style.display = 'none';
    list.appendChild(conflictBody);

    renderModeUi();
    renderConflictNotice();
}

function buildActRow(act, title, sub) {
    const btn = el('button', 'st-app-row st-app-row-btn');
    btn.type = 'button';
    btn.dataset.act = act;
    btn.appendChild(buildRowMain(title, sub));
    return btn;
}

function buildDrawerRow(drawer, title, sub, focus, keywords) {
    const btn = el('button', 'st-app-row st-app-row-btn');
    btn.type = 'button';
    btn.dataset.act = 'open-drawer';
    btn.dataset.drawer = drawer;
    btn.dataset.title = title || '';
    if (focus) btn.dataset.focus = focus;
    if (keywords) btn.dataset.keywords = keywords;
    btn.appendChild(buildRowMain(title, sub));
    return btn;
}

function buildRowMain(title, sub) {
    const main = el('div', 'st-app-row-main');
    main.appendChild(el('div', 'st-app-row-title', title));
    if (sub) main.appendChild(el('div', 'st-app-row-sub', sub));
    return main;
}

function buildRowBtn(act, title, sub) {
    const btn = el('button', 'st-app-row st-app-row-btn');
    btn.type = 'button';
    btn.dataset.act = act;
    btn.appendChild(buildRowMain(title, sub));
    return btn;
}

function buildRowInfo(act, title, value) {
    const row = el('div', 'st-app-row');
    row.appendChild(buildRowMain(title, ''));
    if (value) {
        const v = el('span', 'st-app-row-value', value);
        row.appendChild(v);
    }
    return row;
}

/* ============================================================================
 * Stage 2 · 角色 Tab（卡片网格 / 角色概括弹窗 / 开场白选择 / 导入）
 * ========================================================================== */

const ACCENT_PRESETS = [
    { name: '跟随主题', color: 'var(--SmartThemeEmColor)' },
    { name: '暖橙', color: '#e0833a' },
    { name: '海蓝', color: '#4a8fd6' },
    { name: '青竹', color: '#3fae8a' },
    { name: '紫罗兰', color: '#9a6bd1' },
    { name: '玫红', color: '#d65a7a' },
];

function truncate(s, n) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
}

function buildCharactersPage() {
    const sec = el('section', 'st-app-page');
    sec.dataset.page = 'characters';
    const head = el('div', 'st-app-page-head');
    head.appendChild(el('h1', 'st-app-page-title', '角色'));
    const search = document.createElement('input');
    search.type = 'search';
    search.id = 'st-app-char-search';
    search.className = 'st-app-search';
    search.placeholder = '搜索角色 / 标签';
    search.setAttribute('aria-label', '搜索角色');
    head.appendChild(search);
    sec.appendChild(head);

    const grid = el('div', 'st-app-char-grid');
    grid.id = 'st-app-char-grid';
    sec.appendChild(grid);

    const fab = el('button', 'st-app-fab');
    fab.type = 'button';
    fab.dataset.act = 'import-char';
    fab.setAttribute('aria-label', '导入角色卡');
    fab.title = '导入角色卡';
    fab.innerHTML = ICONS.plus;
    sec.appendChild(fab);

    search.addEventListener('input', debounce(() => renderCharacterGrid(), 200));
    return sec;
}

function renderCharacterGrid() {
    const grid = document.getElementById('st-app-char-grid');
    if (!grid) return;
    const ctx = state.ctx;
    if (!ctx || !Array.isArray(ctx.characters)) return;

    const search = document.getElementById('st-app-char-search');
    const q = (search ? search.value : '').trim().toLowerCase();
    const items = ctx.characters
        .map((c, idx) => ({ c, idx }))
        .filter(({ c }) => c && c.name)
        .filter(({ c }) => {
            if (!q) return true;
            if (String(c.name).toLowerCase().includes(q)) return true;
            const tags = Array.isArray(c.data?.tags) ? c.data.tags : [];
            return tags.some((tg) => String(tg).toLowerCase().includes(q));
        });

    grid.textContent = '';
    if (!items.length) {
        grid.appendChild(buildEmpty(q ? '没有匹配的角色' : '还没有角色', q ? '换个关键词试试。' : '点右下角 + 导入角色卡，或在酒馆原生角色管理里新建。', null));
        return;
    }
    const frag = document.createDocumentFragment();
    for (const { c, idx } of items) frag.appendChild(buildCharCard(c, idx));
    grid.appendChild(frag);
}

function buildCharCard(c, idx) {
    const card = el('button', 'st-app-char-card');
    card.type = 'button';
    card.dataset.chid = String(idx);
    const url = c.avatar && c.avatar !== 'none' ? state.ctx.getThumbnailUrl('avatar', c.avatar) : '';
    const av = makeAvatar(url, c.name);
    av.classList.add('st-app-char-card-avatar');
    card.appendChild(av);
    card.appendChild(el('div', 'st-app-char-card-name', c.name));
    const tags = Array.isArray(c.data?.tags) ? c.data.tags.filter(Boolean) : [];
    if (tags.length) {
        const tw = el('div', 'st-app-char-card-tags');
        tw.appendChild(el('span', 'st-app-tag', String(tags[0])));
        if (tags.length > 1) tw.appendChild(el('span', 'st-app-tag', '+' + (tags.length - 1)));
        card.appendChild(tw);
    }
    return card;
}

function getGreetings(ch) {
    const fm = (ch.first_mes || '').trim();
    const alts = Array.isArray(ch.data?.alternate_greetings) ? ch.data.alternate_greetings.map(String) : [];
    const list = fm ? [fm, ...alts] : alts.slice();
    if (list.length === 0) list.push(''); // 自由开始（空开场白）
    return list;
}

async function openCharacterSheet(chid) {
    const ctx = state.ctx;
    // 浅层角色先取全量数据（tags/描述/开场白 等才可靠）
    try { if (typeof ctx.unshallowCharacter === 'function') await ctx.unshallowCharacter(chid); } catch { /* noop */ }
    renderCharacterSheet(chid);
}

function renderCharacterSheet(chid) {
    const ctx = state.ctx;
    const ch = ctx.characters?.[chid];
    if (!ch) return;
    const body = document.getElementById('st-app-sheet-body');
    if (!body) return;
    body.textContent = '';

    const head = el('div', 'st-app-charsheet-head');
    const url = ch.avatar && ch.avatar !== 'none' ? ctx.getThumbnailUrl('avatar', ch.avatar) : '';
    const av = makeAvatar(url, ch.name);
    av.classList.add('lg');
    head.appendChild(av);
    const info = el('div', 'st-app-charsheet-info');
    info.appendChild(el('div', 'st-app-charsheet-name', ch.name || ''));
    const tags = Array.isArray(ch.data?.tags) ? ch.data.tags.filter(Boolean) : [];
    if (tags.length) {
        const tw = el('div', 'st-app-charsheet-tags');
        for (const tg of tags.slice(0, 4)) tw.appendChild(el('span', 'st-app-tag', String(tg)));
        info.appendChild(tw);
    }
    head.appendChild(info);
    body.appendChild(head);

    const desc = el('div', 'st-app-charsheet-desc');
    desc.textContent = String(ch.description || ch.data?.description || '（无描述）');
    body.appendChild(desc);

    const stats = el('div', 'st-app-charsheet-stats');
    stats.appendChild(el('div', 'st-app-charsheet-stat', '统计加载中…'));
    body.appendChild(stats);

    const acts = el('div', 'st-app-charsheet-actions');
    const bEdit = el('button', 'st-app-btn');
    bEdit.type = 'button';
    bEdit.dataset.act = 'edit-char';
    bEdit.dataset.chid = String(chid);
    bEdit.textContent = '编辑';
    const bStart = el('button', 'st-app-btn st-app-btn-accent');
    bStart.type = 'button';
    bStart.dataset.act = 'start-chat';
    bStart.dataset.chid = String(chid);
    bStart.textContent = '开始聊天';
    acts.appendChild(bEdit);
    acts.appendChild(bStart);
    body.appendChild(acts);

    showCustomSheet(ch.name || '角色');
    safe('char stats', () => fillCharStats(chid, stats))();
}

async function fillCharStats(chid, statsEl) {
    const ctx = state.ctx;
    const ch = ctx.characters?.[chid];
    if (!ch || !statsEl) return;
    const cells = [{ k: '开场白', v: String(getGreetings(ch).length) }];

    try {
        if (typeof getPastCharacterChats === 'function') {
            const past = await getPastCharacterChats(chid);
            if (Array.isArray(past)) cells.push({ k: '对话', v: String(past.length) });
        }
    } catch { /* noop */ }

    try {
        if (typeof ctx.getTokenCountAsync === 'function') {
            const text = [ch.description, ch.personality, ch.scenario, ch.first_mes, ...(ch.data?.alternate_greetings || [])]
                .filter(Boolean).join('\n');
            if (text) {
                const n = await ctx.getTokenCountAsync(text);
                if (n != null) cells.push({ k: 'Token', v: String(n) });
            }
        }
    } catch { /* noop */ }

    statsEl.textContent = '';
    for (const c of cells) {
        const cell = el('div', 'st-app-charsheet-stat');
        cell.appendChild(el('div', 'st-app-charsheet-stat-k', c.k));
        cell.appendChild(el('div', 'st-app-charsheet-stat-v', c.v));
        statsEl.appendChild(cell);
    }
}

function openGreetingPicker(chid) {
    const ctx = state.ctx;
    const ch = ctx.characters?.[chid];
    if (!ch) return;
    const greetings = getGreetings(ch);
    const rows = greetings.map((g, i) => ({
        icon: g ? 'chat' : 'plus',
        label: g ? truncate(g, 60) : '自由开始（空开场白）',
        sub: g ? '' : '不写入开场白，直接进入空对话',
        onClick: () => startChatWithGreeting(chid, i),
    }));
    // 关掉角色弹窗，再弹开场白选择
    closeSheetThen(() => showSheet(`选择开场白（${greetings.length} 条）`, rows));
}

async function startChatWithGreeting(chid, index) {
    const ctx = state.ctx;
    try {
        ctx.loader?.show?.();
        // 若目标角色已是当前角色，跳过重新加载，避免多生成一次空聊天
        if (String(ctx.characterId) !== String(chid)) {
            await ctx.selectCharacterById(chid, { switchMenu: false });
        }
        if (typeof doNewChat === 'function') {
            await doNewChat({ deleteCurrentChat: false });
        }
        await applyGreeting(index);
        enterChatView();
        setTimeout(() => { try { ctx.scrollChatToBottom?.(); } catch { /* noop */ } }, 300);
    } catch (e) {
        reportError('开始聊天失败', e);
    } finally {
        try { ctx.loader?.hide?.(); } catch { /* noop */ }
    }
}

/** 把新聊天的首条消息切到指定开场白（等价于原生 swipe） */
async function applyGreeting(index) {
    const ctx = state.ctx;
    const chat = ctx.chat;
    if (!Array.isArray(chat) || !chat.length) return;
    const first = chat[0];
    if (Array.isArray(first.swipes) && first.swipes.length > index) {
        first.swipe_id = index;
        first.mes = first.swipes[index];
    }
    try { if (typeof ctx.saveChat === 'function') await ctx.saveChat(); } catch { /* noop */ }
    try { if (typeof ctx.printMessages === 'function') await ctx.printMessages(); } catch { /* noop */ }
}

async function editCharacter(chid) {
    const ctx = state.ctx;
    try {
        await ctx.selectCharacterById(chid, { switchMenu: true });
        openNativeDrawer('#rightNavHolder', { title: '角色编辑' }); // 右侧角色管理抽屉里就是编辑表单
    } catch (e) {
        reportError('打开角色编辑失败', e);
    }
}

function openImportSheet() {
    const rows = [
        { icon: 'plus', label: '从文件导入', sub: 'PNG / JSON / YAML / charx（酒馆原生导入器）', onClick: triggerImportFile },
        { icon: 'api', label: '从链接导入', sub: '输入角色卡直链 URL', onClick: importFromUrl },
    ];
    showSheet('导入角色卡', rows);
}

function triggerImportFile() {
    const btn = document.getElementById('character_import_button');
    if (btn) { btn.click(); return; }
    const input = document.getElementById('character_import_file');
    if (input) { input.click(); return; }
    toastrNotify('warning', '未找到原生导入入口');
}

async function importFromUrl() {
    const ctx = state.ctx;
    let url = '';
    try { url = window.prompt('输入角色卡链接（PNG / JSON 直链）：') || ''; } catch { /* noop */ }
    if (!url) return;
    try {
        if (typeof ctx.importFromExternalUrl !== 'function') throw new Error('当前酒馆版本不支持链接导入');
        await ctx.importFromExternalUrl(url);
        toastrNotify('success', '已开始导入角色卡');
    } catch (e) {
        reportError('链接导入失败', e);
    }
}

/* ============================================================================
 * Stage 2 · API Tab（把原生设置项重新组织成 App 列表）
 * ========================================================================== */

function buildApiPage() {
    const sec = el('section', 'st-app-page');
    sec.dataset.page = 'api';
    const head = el('div', 'st-app-page-head');
    head.appendChild(el('h1', 'st-app-page-title', 'API'));
    sec.appendChild(head);

    const list = el('div', 'st-app-list');
    list.id = 'st-app-api-list';

    list.appendChild(el('div', 'st-app-group-title', '连接与模型'));
    const g1 = el('div', 'st-app-group');
    g1.appendChild(buildDrawerRow('#sys-settings-button', 'API 连接', '连接类型 / URL / Key / 模型'));
    list.appendChild(g1);

    list.appendChild(el('div', 'st-app-group-title', '响应配置'));
    const g2 = el('div', 'st-app-group');
    g2.appendChild(buildDrawerRow('#ai-config-button', '预设与采样', '预设 / 温度 / 上下文长度 / 采样参数'));
    g2.appendChild(buildDrawerRow('#advanced-formatting-button', '高级格式', 'Instruct / 上下文模板 / 格式'));
    list.appendChild(g2);

    list.appendChild(el('div', 'st-app-group-title', '世界与扩展'));
    const g3 = el('div', 'st-app-group');
    g3.appendChild(buildDrawerRow('#WI-SP-button', '世界书', 'Lorebook / 全局世界书'));
    g3.appendChild(buildDrawerRow('#extensions-settings-button', '扩展（插件）', '已装插件设置 / 正则 / 生图 / TTS'));
    list.appendChild(g3);

    sec.appendChild(list);
    return sec;
}

/* ============================================================================
 * Stage 2 · UI 主题二级页（搬原生主题块 + 主题色 + 布局模式）
 * ========================================================================== */

/* 皮肤 / 圆角 / 密度 预设 */
const SKINS = [
    { id: 'glass', name: '流光玻璃', tag: '推荐 · 中性能' },
    { id: 'paper', name: '纸感', tag: '均衡 · 高性能' },
    { id: 'minimal', name: '极简', tag: '极速 · 最高性能' },
    { id: 'neon', name: '夜光', tag: '科技感 · 中性能' },
];
const RADIUS_OPTIONS = [
    { id: 'sharp', name: '利落', scale: 0.72 },
    { id: 'round', name: '圆润', scale: 1 },
    { id: 'soft', name: '大圆角', scale: 1.35 },
];
const DENSITY_OPTIONS = [
    { id: 'comfortable', name: '舒适', value: 1 },
    { id: 'compact', name: '紧凑', value: 0.86 },
];

function ensureAppearanceDefaults() {
    const s = state.settings;
    if (!s.skin) s.skin = 'glass';
    if (!s.radius) s.radius = 'round';
    if (!s.density) s.density = 'comfortable';
    if (typeof s.glass !== 'boolean') s.glass = true;
    if (typeof s.accent !== 'string') s.accent = '';
}

/** 应用全部外观：皮肤 + 圆角 + 密度 + 毛玻璃 + 主题色（全部走 CSS 变量，不碰原生 .mes） */
function applyAppearance() {
    const s = state.settings || {};
    ensureAppearanceDefaults();
    const body = document.body;
    SKINS.forEach((sk) => body.classList.toggle('st-app-skin-' + sk.id, s.skin === sk.id));
    body.classList.toggle('st-app-flat', s.glass === false);
    const radius = RADIUS_OPTIONS.find((r) => r.id === s.radius) || RADIUS_OPTIONS[1];
    const density = DENSITY_OPTIONS.find((d) => d.id === s.density) || DENSITY_OPTIONS[0];
    try {
        document.documentElement.style.setProperty('--st-app-radius-scale', String(radius.scale));
        document.documentElement.style.setProperty('--st-app-density', String(density.value));
    } catch { /* noop */ }
    applyAccent();
    updateContrastTokens();
}

function overRgb(fg, bg) {
    const a = fg[3] == null ? 1 : fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

/**
 * 计算两个「保险 token」：
 *  - --st-app-solid：由主题 tint 合成出的「不透明」表面，用于二级层/弹层做 backing，
 *    修复毛玻璃/透明背景下二级界面能看见一级菜单内容的穿透问题。
 *  - --st-app-on-accent-strong：强调色上的对比色（FAB 图标 / 激活药丸图标）。
 */
function updateContrastTokens() {
    try {
        const tint = probeColorCSS('var(--SmartThemeBlurTintColor)');
        if (tint) {
            const lum = relLumRgb(tint);
            const base = lum < 0.5 ? [10, 10, 12] : [250, 250, 250];
            const solid = (tint[3] == null || tint[3] >= 0.98) ? tint : mixRgb(overRgb(tint, base), base, 0.03);
            document.documentElement.style.setProperty('--st-app-solid', `rgb(${Math.round(solid[0])}, ${Math.round(solid[1])}, ${Math.round(solid[2])})`);
        }
        const accent = probeColorCSS('var(--st-app-accent)');
        if (accent) {
            const lum = relLumRgb(accent);
            document.documentElement.style.setProperty('--st-app-on-accent-strong', lum > 0.42 ? 'var(--black90a)' : 'var(--white100)');
        }
    } catch { /* noop */ }
}

function pickSkin(id) {
    if (!SKINS.find((s) => s.id === id)) return;
    state.settings.skin = id;
    applyAppearance();
    saveSettings();
    document.querySelectorAll('.st-app-skin-card').forEach((c) => c.classList.toggle('active', c.dataset.skin === id));
    toastrNotify('info', '皮肤：' + (SKINS.find((s) => s.id === id) || {}).name);
}

function pickRadius(id) {
    if (!RADIUS_OPTIONS.find((r) => r.id === id)) return;
    state.settings.radius = id;
    applyAppearance();
    saveSettings();
    document.querySelectorAll('[data-act="pick-radius"]').forEach((b) => b.classList.toggle('active', b.dataset.radius === id));
}

function pickDensity(id) {
    if (!DENSITY_OPTIONS.find((d) => d.id === id)) return;
    state.settings.density = id;
    applyAppearance();
    saveSettings();
    document.querySelectorAll('[data-act="pick-density"]').forEach((b) => b.classList.toggle('active', b.dataset.density === id));
}

function toggleFlat() {
    state.settings.glass = !state.settings.glass;
    applyAppearance();
    saveSettings();
    document.querySelectorAll('[data-act="toggle-flat"]').forEach((sw) => {
        sw.classList.toggle('on', state.settings.glass);
        sw.setAttribute('aria-checked', String(state.settings.glass));
    });
    toastrNotify('info', state.settings.glass ? '毛玻璃已开启' : '毛玻璃已关闭（性能优先）');
}

function openThemeSubPage() {
    const sub = document.getElementById('st-app-subpage');
    const body = document.getElementById('st-app-subpage-body');
    if (!sub || !body) return;
    restoreNativeElement(); // 若刚从统一二级页切来，先还原被搬走的面板
    body.textContent = '';
    const titleEl = document.getElementById('st-app-subpage-title');
    if (titleEl) titleEl.textContent = 'UI 主题';
    ensureAppearanceDefaults();
    const s = state.settings;

    // ---- 皮肤 ----
    const gSkin = el('div', 'st-app-group');
    gSkin.appendChild(el('div', 'st-app-group-title', '皮肤'));
    const picker = el('div', 'st-app-skin-picker');
    for (const sk of SKINS) {
        const card = el('button', 'st-app-skin-card');
        card.type = 'button';
        card.dataset.act = 'pick-skin';
        card.dataset.skin = sk.id;
        card.appendChild(el('div', 'st-app-skin-card-preview'));
        card.appendChild(el('div', 'st-app-skin-card-name', sk.name));
        card.appendChild(el('div', 'st-app-skin-card-tag', sk.tag));
        if (s.skin === sk.id) card.classList.add('active');
        picker.appendChild(card);
    }
    gSkin.appendChild(picker);
    body.appendChild(gSkin);

    // ---- 圆角 / 密度 / 毛玻璃 ----
    const gTune = el('div', 'st-app-group');
    const rowRadius = el('div', 'st-app-row st-app-row-col');
    rowRadius.appendChild(el('div', 'st-app-row-title', '圆角'));
    const segR = el('div', 'st-app-segment');
    for (const r of RADIUS_OPTIONS) {
        const b = el('button', 'st-app-segment-btn', r.name);
        b.type = 'button';
        b.dataset.act = 'pick-radius';
        b.dataset.radius = r.id;
        if (s.radius === r.id) b.classList.add('active');
        segR.appendChild(b);
    }
    rowRadius.appendChild(segR);
    gTune.appendChild(rowRadius);

    const rowDensity = el('div', 'st-app-row st-app-row-col');
    rowDensity.appendChild(el('div', 'st-app-row-title', '密度'));
    const segD = el('div', 'st-app-segment');
    for (const d of DENSITY_OPTIONS) {
        const b = el('button', 'st-app-segment-btn', d.name);
        b.type = 'button';
        b.dataset.act = 'pick-density';
        b.dataset.density = d.id;
        if (s.density === d.id) b.classList.add('active');
        segD.appendChild(b);
    }
    rowDensity.appendChild(segD);
    gTune.appendChild(rowDensity);

    const rowGlass = el('div', 'st-app-row');
    rowGlass.appendChild(buildRowMain('毛玻璃', '关闭可提升低端机性能（皮肤仍可用）'));
    const swGlass = el('button', 'st-app-switch');
    swGlass.type = 'button';
    swGlass.dataset.act = 'toggle-flat';
    swGlass.setAttribute('role', 'switch');
    swGlass.setAttribute('aria-label', '毛玻璃开关');
    if (s.glass) swGlass.classList.add('on');
    rowGlass.appendChild(swGlass);
    gTune.appendChild(rowGlass);
    body.appendChild(gTune);

    // ---- 主题色 + 布局模式 ----
    const gMine = el('div', 'st-app-group');
    const rowAccent = el('div', 'st-app-row st-app-row-col');
    rowAccent.appendChild(el('div', 'st-app-row-title', '主题色（仅作用于本插件导航层）'));
    const swatches = el('div', 'st-app-accent-picker');
    for (const a of ACCENT_PRESETS) {
        const sw = el('button', 'st-app-accent-swatch');
        sw.type = 'button';
        sw.dataset.act = 'pick-accent';
        sw.dataset.color = a.color;
        sw.title = a.name;
        sw.style.setProperty('--swatch', a.color);
        sw.textContent = String(a.name).slice(0, 1);
        if ((s.accent || '') === a.color) sw.classList.add('active');
        swatches.appendChild(sw);
    }
    rowAccent.appendChild(swatches);
    gMine.appendChild(rowAccent);

    const rowMode = el('div', 'st-app-row');
    rowMode.appendChild(buildRowMain('APP 布局', 'APP 模式 / 原版（保命绳）'));
    const sw = el('button', 'st-app-switch');
    sw.type = 'button';
    sw.dataset.act = 'toggle-mode';
    sw.setAttribute('role', 'switch');
    rowMode.appendChild(sw);
    gMine.appendChild(rowMode);
    body.appendChild(gMine);

    // ---- 搬原生主题块（兼容第三方主题；关闭二级页时还原） ----
    const themeBlock = document.getElementById('UI-Theme-Block');
    if (themeBlock) {
        if (!state.themeBlockParent) state.themeBlockParent = themeBlock.parentElement;
        const wrap = el('div', 'st-app-group');
        wrap.appendChild(el('div', 'st-app-group-title', '酒馆原生主题（第三方主题在这里切）'));
        wrap.appendChild(themeBlock);
        body.appendChild(wrap);
    } else {
        const row = el('div', 'st-app-row');
        row.appendChild(buildRowMain('未找到原生主题块', '请确认酒馆版本包含 #UI-Theme-Block'));
        body.appendChild(row);
    }

    sub.classList.add('open');
    renderModeUi();
}


/** 还原搬进二级页的原生主题块 */
function restoreThemeBlock() {
    const themeBlock = document.getElementById('UI-Theme-Block');
    if (themeBlock && state.themeBlockParent) {
        try { state.themeBlockParent.appendChild(themeBlock); } catch { /* noop */ }
    }
    state.themeBlockParent = null;
}

function closeSubPage() {
    const sub = document.getElementById('st-app-subpage');
    if (sub) sub.classList.remove('open');
    restoreThemeBlock();
}

/* 设置 → 角色管理：进入「角色列表」界面（强制列表，不受上次编辑界面影响） */
function openCharacterList() {
    openNativeDrawer('#rightNavHolder', { title: '角色管理' });
    setTimeout(() => {
        try { selectRightMenuWithAnimation('rm_characters_block'); } catch { /* noop */ }
    }, 120);
}

/* 聊天 ⋯ → 角色管理：直接进入「当前聊天角色卡」的编辑界面 */
function openCurrentCharacterEditor() {
    const ctx = state.ctx;
    const chid = ctx && ctx.characterId;
    openNativeDrawer('#rightNavHolder', { title: '角色编辑' });
    if (chid != null && chid !== undefined) {
        setTimeout(() => {
            try { select_selected_character(chid, { switchMenu: true }); } catch { /* noop */ }
        }, 150);
    }
}

/** 把扩展面板搬进统一二级页（与原生抽屉同一套「返回+标题」顶栏），关闭时还原 */
function openPanelSubpage(panelId, title) {
    // 兼容传参带 `#`（如 '#regex_container'）与不带（如 'regex_container'）
    const id = String(panelId || '').replace(/^#/, '');
    let panel = id ? document.getElementById(id) : null;
    // id 失效（元素被插件重建/换 id）→ 按标题在扩展区域兜底查找
    if (!panel) panel = findExtensionPanelByTitle(title);
    if (!panel) {
        // 仍找不到 → 回退到原生扩展面板，保证用户能进到对应设置（不做死胡同）
        toastrNotify('info', '未找到独立面板，已打开原生扩展面板');
        openNativeDrawer('#extensions-settings-button', { title: title || '扩展（插件）' });
        return;
    }
    // 强制展开所有 inline-drawer-content（不点击 toggle —— ST 的 toggle 走 slideToggle 动画，
    // 与 DOM 搬动冲突会卡在 height:0/overflow:hidden，导致面板看起来空白）
    panel.querySelectorAll('.inline-drawer-content').forEach((c) => { c.style.display = 'block'; });
    openNativePageElement(panel, title || '插件', 'panel', null);
}

function pickAccent(color) {
    if (!color) return;
    state.settings.accent = color;
    try { document.documentElement.style.setProperty('--st-app-accent', color); } catch { /* noop */ }
    saveSettings();
    document.querySelectorAll('.st-app-accent-swatch').forEach((s) => {
        s.classList.toggle('active', s.dataset.color === color);
    });
    toastrNotify('info', '主题色已更新');
}

function applyAccent() {
    const explicit = state.settings?.accent;
    let color = explicit || autoAccentFromTheme();

    // ---- 对比度安全：强调色若在深/浅背景上太糊（<3.2:1），自动向正文色混合理顺 ----
    try {
        const tintRgb = probeColorCSS('var(--SmartThemeBlurTintColor)');
        const fgRgb = probeColorCSS('var(--SmartThemeBodyColor)');
        if (tintRgb && fgRgb) {
            const accentRgb = color ? (color.startsWith('var(') ? probeColorCSS(color) : (parseColorRgb(color) || probeColorCSS(color))) : fgRgb;
            if (accentRgb) {
                let fixed = accentRgb;
                let guard = 0;
                while (contrastRatioRgb(fixed, tintRgb) < 3.2 && guard < 12) {
                    const towardLight = relLumRgb(fgRgb) >= relLumRgb(tintRgb);
                    fixed = mixRgb(fixed, towardLight ? [255, 255, 255] : [0, 0, 0], 0.12);
                    guard++;
                }
                if (guard > 0) color = `rgb(${fixed.join(', ')})`;
            }
        }
    } catch { /* noop */ }

    try {
        if (color) document.documentElement.style.setProperty('--st-app-accent', color);
        else document.documentElement.style.removeProperty('--st-app-accent');
    } catch { /* noop */ }
}

/** 用临时元素把任意 CSS 颜色（含 var()/hsl()）解析成 [r,g,b] */
function probeColorCSS(value) {
    if (!value) return null;
    try {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;color:' + value;
        document.body.appendChild(probe);
        const rgb = parseColorRgb(getComputedStyle(probe).color);
        probe.remove();
        return rgb;
    } catch { return null; }
}

function relLumRgb([r, g, b]) {
    const f = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatioRgb(a, b) {
    const la = relLumRgb(a);
    const lb = relLumRgb(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
}

function mixRgb(a, b, t) {
    return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
}

function autoAccentFromTheme() {
    try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim();
        const rgb = parseColorRgb(raw);
        if (!rgb) return null;
        const [r, g, b] = rgb.map((v) => v / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const lum = (max + min) / 2;
        const sat = (max === min) ? 0 : (lum > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
        // 低饱和 / 过暗 / 过亮 → 回退暖橙
        if (sat < 0.32 || lum < 0.12 || lum > 0.93) return '#d97757';
        return null; // 主题强调色本身够鲜艳 → 跟随
    } catch { return null; }
}

function parseColorRgb(raw) {
    if (!raw) return null;
    let m = raw.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
    if (m) return [+m[1], +m[2], +m[3]];
    m = raw.match(/^#([0-9a-f]{6})$/i);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    return null;
}

/* ============================================================================
 * 通用：自定义弹层（不清空 body，由调用方自己填内容）
 * ========================================================================== */

function showCustomSheet(title) {
    const sheet = document.getElementById('st-app-sheet');
    const mask = document.getElementById('st-app-sheet-mask');
    const titleEl = document.getElementById('st-app-sheet-title');
    if (!sheet || !mask || !titleEl) return;
    if (state.sheetOpen) return;
    titleEl.textContent = title || '';
    state.sheetOpen = true;
    requestAnimationFrame(() => {
        mask.classList.add('open');
        sheet.classList.add('open');
    });
    pushLayer({ kind: 'sheet', close: () => closeSheet() });
}

function buildTabBar(nav) {
    nav.textContent = '';
    for (const t of TABS) {
        const b = el('button', 'st-app-tab');
        b.type = 'button';
        b.dataset.tab = t.id;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(t.id === state.tab));
        const wrap = el('span', 'st-app-tab-icon-wrap');
        wrap.innerHTML = ICONS[t.icon] || '';
        b.appendChild(wrap);
        b.appendChild(el('span', 'st-app-tab-label', t.label));
        nav.appendChild(b);
    }
}

/* ============================================================================
 * 事件绑定
 * ========================================================================== */

function bindShellEvents() {
    const root = document.getElementById('st-app-root');
    if (!root) return;

    // 统一点击代理
    root.addEventListener('click', safe('click', (ev) => {
        const t = ev.target.closest('[data-act],[data-tab],[data-chid]');
        if (!t) return;

        if (t.dataset.tab) { switchTab(t.dataset.tab); return; }

        if (t.dataset.act) {
            switch (t.dataset.act) {
                case 'back': requestBack(); break;
                case 'more': openMoreMenu(); break;
                case 'refresh-chats': safe('refresh', refreshChats)(); break;
                case 'toggle-mode': setModeEnabled(!state.enabled, { persist: true }); break;
                case 'reload': location.reload(); break;
                case 'diag': showDiagnostics(); break;
                case 'close-error': hideErrorBanner(); break;
                // Stage 2
                case 'import-char': openImportSheet(); break;
                case 'start-chat': openGreetingPicker(Number(t.dataset.chid)); break;
                case 'edit-char': closeSheetThen(() => editCharacter(Number(t.dataset.chid))); break;
                case 'pick-greeting': startChatWithGreeting(Number(t.dataset.chid), Number(t.dataset.index)); break;
                case 'open-drawer':
                    openNativeDrawer(t.dataset.drawer || '', {
                        title: t.dataset.title || '',
                        focus: t.dataset.focus || '',
                        keywords: (t.dataset.keywords || '').split(',').filter(Boolean),
                    });
                    break;
                case 'open-character-list': openCharacterList(); break;
                case 'open-ext-panel': openPanelSubpage(t.dataset.panel, t.dataset.title); break;
                case 'close-native-page': requestBack(); break;
                case 'open-theme': openThemeSubPage(); break;
                case 'close-subpage': closeSubPage(); break;
                case 'pick-accent': pickAccent(t.dataset.color || ''); break;
                case 'pick-skin': pickSkin(t.dataset.skin || ''); break;
                case 'pick-radius': pickRadius(t.dataset.radius || ''); break;
                case 'pick-density': pickDensity(t.dataset.density || ''); break;
                case 'toggle-flat': toggleFlat(); break;
            }
            return;
        }

        // 角色卡片点击（无 data-act，仅有 data-chid）
        if (t.dataset.chid != null) { safe('char sheet', () => openCharacterSheet(Number(t.dataset.chid)))(); }
    }));

    // sheet 遮罩点击 = 关闭
    const mask = document.getElementById('st-app-sheet-mask');
    if (mask) mask.addEventListener('click', safe('mask', () => { if (state.sheetOpen) requestBack(); }));

    // 窗口尺寸变化时重算几何（酒馆在 1000px 断点会重排 #sheld/#top-settings-holder）
    window.addEventListener('resize', safe('resize', debouncedGeometry));
    try { if (window.visualViewport) window.visualViewport.addEventListener('resize', safe('vv-resize', debouncedGeometry)); } catch { /* noop */ }
}

function bindContextEvents(ctx) {
    const es = ctx.eventSource;
    const et = ctx.eventTypes;
    if (!es || !et) return;
    try {
        es.on(et.APP_READY, safe('APP_READY', onAppReady));
        es.on(et.EXTENSIONS_FIRST_LOAD, safe('EXTENSIONS_FIRST_LOAD', () => {
            safe('settings panel', registerNativeSettings)();
            try { renderSettingsList(); } catch { /* noop */ }
            onAppReady();
        }));
        es.on(et.CHAT_CHANGED, safe('CHAT_CHANGED', () => { updateChatTopbar(); debouncedRefresh(); }));
        es.on(et.CHAT_CREATED, safe('CHAT_CREATED', debouncedRefresh));
        es.on(et.CHAT_DELETED, safe('CHAT_DELETED', debouncedRefresh));
        es.on(et.CHAT_RENAMED, safe('CHAT_RENAMED', debouncedRefresh));
        es.on(et.CHARACTER_DELETED, safe('CHARACTER_DELETED', debouncedRefresh));
        es.on(et.CHARACTER_RENAMED, safe('CHARACTER_RENAMED', debouncedRefresh));
        es.on(et.CHARACTER_PAGE_LOADED, safe('CHARACTER_PAGE_LOADED', debouncedRefreshChars));
        es.on(et.CHARACTER_EDITED, safe('CHARACTER_EDITED', debouncedRefreshChars));
        es.on(et.CHARACTER_DUPLICATED, safe('CHARACTER_DUPLICATED', debouncedRefreshChars));
    } catch { /* noop */ }
}

const debouncedRefresh = debounce(() => { if (state.enabled && state.view !== 'chat') refreshChats(); }, 600);
const debouncedRefreshChars = debounce(() => { if (state.enabled && state.tab === 'characters') renderCharacterGrid(); }, 300);

function onAppReady() {
    if (state.enabled && state.view !== 'chat' && state.tab === 'chat') {
        safe('APP_READY refresh', refreshChats)();
    }
    renderModeUi();
    applyAppearance();
    applyGeometry('APP_READY');
}

/* ============================================================================
 * 模式开关
 * ========================================================================== */

function setModeEnabled(enabled, { persist = true, silent = false } = {}) {
    state.enabled = !!enabled;
    state.settings.enabled = state.enabled;
    document.body.classList.toggle('st-app-on', state.enabled);

    if (!state.enabled) {
        // 关闭时：清理我们的视图状态与内联覆盖，原生界面立刻恢复
        document.body.classList.remove('st-app-chat', 'st-app-native-drawer');
        closeSheet();
        try { closeNativePage(); } catch { /* noop */ }
        document.querySelectorAll('.st-app-managed').forEach((el) => el.classList.remove('st-app-managed'));
        clearGeometryOverrides();
        clearAppearanceOverrides();
        state.view = 'tabs';
        state.skipNextPopstate = false;
        state.nextLayerReplacesHistory = false;
        const depth = state.backStack.length;
        state.backStack.length = 0;
        // 消费掉我们压入的 history 标记（若栈空则什么都不做）
        if (depth > 0) { try { history.go(-depth); } catch { /* noop */ } }
    } else {
        switchTab(state.tab || 'chat', { force: true });
    }

    renderModeUi();

    if (state.enabled) {
        applyAppearance();
        setTimeout(() => applyGeometry('mode'), 0);
    }

    if (persist) saveSettings();
    if (!silent) toastrNotify(state.enabled ? 'success' : 'info', state.enabled ? '已切换到 APP 布局' : '已恢复酒馆原生布局');
    if (state.enabled) safe('enable refresh', refreshChats)();
}

function renderModeUi() {
    document.querySelectorAll('[data-act="toggle-mode"]').forEach((sw) => {
        sw.classList.toggle('on', state.enabled);
        sw.setAttribute('aria-checked', String(state.enabled));
    });
    const chip = document.querySelector('#st-app-pages .st-app-version-chip');
    if (chip) chip.textContent = 'v' + VERSION;
    renderConflictNotice();
    syncNativeCheckbox();
}

/* ============================================================================
 * 原生扩展设置面板（Extras → Extensions 抽屉里的「酒馆 APP 布局」）
 * ----------------------------------------------------------------------------
 * 目的：① 让插件在「插件管理」里有明确入口；② 布局关掉后仍能从原生抽屉重新开启
 *（否则我们的设置 Tab 随布局一起消失，用户会被锁在外面）。
 * ========================================================================== */

function registerNativeSettings() {
    const ctx = state.ctx;
    if (!ctx || typeof ctx.renderExtensionTemplateAsync !== 'function') return;
    if (document.getElementById('st_app_layout_enable')) return; // 幂等

    ctx.renderExtensionTemplateAsync('third-party/st-app-layout', 'settings').then((html) => {
        const target = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
        if (!target) {
            console.warn('[st-app-layout] 未找到扩展设置容器，原生设置面板跳过');
            return;
        }
        // 用纯 DOM 追加顶层节点（避免 $(html).children() 丢掉外层 .inline-drawer）
        const tpl = document.createElement('div');
        tpl.innerHTML = html;
        while (tpl.firstChild) target.appendChild(tpl.firstChild);

        syncNativeCheckbox();
        const cb = document.getElementById('st_app_layout_enable');
        if (cb) {
            cb.addEventListener('change', safe('native-toggle', () => {
                setModeEnabled(!!cb.checked, { persist: true });
            }));
        }
    }).catch((e) => reportError('设置面板加载失败', e));
}

function syncNativeCheckbox() {
    const cb = document.getElementById('st_app_layout_enable');
    if (cb) cb.checked = !!state.enabled;
}

/* ============================================================================
 * Tab 切换
 * ========================================================================== */

function switchTab(id, { force = false } = {}) {
    if (!TABS.find((t) => t.id === id)) id = 'chat';
    state.tab = id;

    // Tab 切换时如果在聊天二级页，先退回列表
    if (state.view === 'chat') { exitChatView({ skipHistory: true }); }

    document.querySelectorAll('#st-app-pages .st-app-page').forEach((p) => {
        p.classList.toggle('active', p.dataset.page === id);
    });
    document.querySelectorAll('#st-app-tabbar .st-app-tab').forEach((t) => {
        const active = t.dataset.tab === id;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
    });

    if (id !== 'settings') closeSubPage();
    if (id === 'characters') renderCharacterGrid();
    if (id === 'settings') renderSettingsList();

    if (id === 'chat' && (force || Date.now() - state.chatsLoadedAt > 30000)) {
        safe('tab refresh', refreshChats)();
    }
}

/* ============================================================================
 * 聊天记录列表
 * ========================================================================== */

async function refreshChats() {
    const ctx = state.ctx;
    if (!ctx || !state.enabled) return;
    state.chatsLoading = true;
    if (!state.chats.length) renderChatList();
    try {
        const res = await fetch('/api/chats/recent', {
            method: 'POST',
            headers: ctx.getRequestHeaders(),
            body: JSON.stringify({ max: 80, pinned: pinGetAll() }),
            cache: 'no-cache',
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        state.chats = Array.isArray(data) ? data.filter((c) => c && c.file_name) : [];
        state.chatsError = null;
        state.chatsLoadedAt = Date.now();
    } catch (e) {
        state.chatsError = e;
    } finally {
        state.chatsLoading = false;
        renderChatList();
    }
}

function renderChatList() {
    const list = document.getElementById('st-app-chat-list');
    if (!list) return;
    list.textContent = '';

    if (state.chatsLoading && !state.chats.length) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 6; i++) frag.appendChild(buildSkeletonItem());
        list.appendChild(frag);
        return;
    }
    if (state.chatsError && !state.chats.length) {
        list.appendChild(buildEmpty('读取聊天记录失败', state.chatsError.message || String(state.chatsError), { act: 'refresh-chats', label: '重试' }));
        return;
    }
    if (!state.chats.length) {
        list.appendChild(buildEmpty('还没有聊天记录', '去角色页开始一段对话吧（角色页将在第二阶段上线）', { act: 'switch-characters', label: '去角色页' }));
        return;
    }

    const frag = document.createDocumentFragment();
    for (const item of state.chats) {
        const meta = resolveChatMeta(item);
        frag.appendChild(buildChatRow(item, meta));
    }
    list.appendChild(frag);
}

function resolveChatMeta(item) {
    const ctx = state.ctx;
    if (item.group) {
        const g = ctx.groups && ctx.groups.find ? ctx.groups.find((x) => String(x.id) === String(item.group)) : null;
        return { name: (g && g.name) || '群聊', avatarUrl: '', sub: '群聊', kind: 'group', group: item.group };
    }
    const avatarFile = item.avatar || '';
    const idx = avatarFile && ctx.characters ? ctx.characters.findIndex((c) => c.avatar === avatarFile) : -1;
    const ch = idx >= 0 ? ctx.characters[idx] : null;
    const name = (ch && ch.name) || stripExt(item.file_id) || '聊天';
    const avatarUrl = ch && ch.avatar && ch.avatar !== 'none' ? ctx.getThumbnailUrl('avatar', ch.avatar) : '';
    return { name, avatarUrl, sub: stripExt(item.file_id), chid: idx, kind: 'char', avatarFile };
}

/* ============================================================================
 * 聊天列表「⋮」菜单：置顶 / 复制分支 / 删除
 * 置顶沿用酒馆原生 pinnedChats 存储（accountStorage），与欢迎屏置顶互通。
 * ========================================================================== */

const PINNED_STORAGE_KEY = 'pinnedChats';

function pinGetState() {
    try {
        const raw = state.ctx?.accountStorage?.getItem(PINNED_STORAGE_KEY);
        const st = raw ? JSON.parse(raw) : {};
        return st && typeof st === 'object' ? st : {};
    } catch { return {}; }
}

function pinSaveState(st) {
    try { state.ctx?.accountStorage?.setItem(PINNED_STORAGE_KEY, JSON.stringify(st)); } catch { /* noop */ }
}

function pinKeyOf(item) {
    const g = item.group ? 'group_' + item.group : '';
    const a = item.avatar ? 'char_' + item.avatar : '';
    return g + a + '_' + item.file_name;
}

function pinIsPinned(item) {
    try { return pinKeyOf(item) in pinGetState(); } catch { return false; }
}

function pinGetAll() {
    try { return Object.values(pinGetState()); } catch { return []; }
}

function togglePin(item) {
    const st = pinGetState();
    const k = pinKeyOf(item);
    if (k in st) {
        delete st[k];
        toastrNotify('info', '已取消置顶');
    } else {
        st[k] = { group: item.group || undefined, avatar: item.avatar || undefined, file_name: item.file_name };
        toastrNotify('success', '已置顶');
    }
    pinSaveState(st);
}

async function askConfirm(title, text, okButton = '确定') {
    const ctx = state.ctx;
    try {
        if (ctx.Popup && ctx.Popup.show && typeof ctx.Popup.show.confirm === 'function') {
            return !!(await ctx.Popup.show.confirm(title, text));
        }
        if (ctx.callGenericPopup && ctx.POPUP_TYPE) {
            return !!(await ctx.callGenericPopup(text, ctx.POPUP_TYPE.CONFIRM, '', { okButton, cancelButton: '取消' }));
        }
    } catch { /* noop */ }
    try { return window.confirm(title + '\n' + text); } catch { return false; }
}

/** 聊天条目的 ⋮ 弹窗：角色图 + 介绍 + 三按钮 */
async function openChatItemMenu(item, meta) {
    const ctx = state.ctx;
    const body = document.getElementById('st-app-sheet-body');
    if (!body) return;
    body.textContent = '';

    const head = el('div', 'st-app-chatmenu-head');
    const av = makeAvatar(meta.avatarUrl, meta.name);
    av.classList.add('lg');
    head.appendChild(av);
    const info = el('div', 'st-app-chatmenu-info');
    info.appendChild(el('div', 'st-app-charsheet-name', meta.name || ''));
    info.appendChild(el('div', 'st-app-row-sub', meta.kind === 'group' ? '群聊' : ('对话：' + (meta.sub || ''))));
    head.appendChild(info);
    body.appendChild(head);

    const desc = el('div', 'st-app-charsheet-desc');
    desc.textContent = meta.kind === 'group' ? '群聊对话' : '加载介绍中…';
    body.appendChild(desc);

    const pinned = pinIsPinned(item);
    const acts = el('div', 'st-app-chatmenu-actions');
    const bPin = el('button', 'st-app-btn' + (pinned ? ' st-app-btn-accent' : ''), pinned ? '取消置顶' : '置顶');
    bPin.type = 'button';
    bPin.addEventListener('click', safe('pin', () => {
        closeSheet();
        togglePin(item);
        safe('refresh', refreshChats)();
    }));
    acts.appendChild(bPin);

    if (meta.kind === 'char') {
        const bCopy = el('button', 'st-app-btn', '复制');
        bCopy.type = 'button';
        bCopy.addEventListener('click', safe('copy', () => duplicateChat(item, meta)));
        acts.appendChild(bCopy);
    }

    const bDel = el('button', 'st-app-btn st-app-btn-danger', '删除');
    bDel.type = 'button';
    bDel.addEventListener('click', safe('delete', () => closeSheetThen(() => confirmDeleteChat(item, meta))));
    acts.appendChild(bDel);
    body.appendChild(acts);

    showCustomSheet(meta.kind === 'group' ? '群聊' : '对话操作');

    // 异步补角色介绍（浅层角色先取全量）
    if (meta.kind === 'char' && meta.chid >= 0) {
        try { if (typeof ctx.unshallowCharacter === 'function') await ctx.unshallowCharacter(meta.chid); } catch { /* noop */ }
        const ch = ctx.characters && ctx.characters[meta.chid];
        const text = String(ch?.description || ch?.data?.description || '').trim();
        desc.textContent = text || '（该角色卡没有描述）';
    }
}

/** 复制当前对话为独立分支（新文件，互不干扰） */
async function duplicateChat(item, meta) {
    const ctx = state.ctx;
    if (meta.kind === 'group') { toastrNotify('warning', '群聊暂不支持复制分支'); return; }
    const oldName = String(item.file_id || '');
    const avatar = String(item.avatar || '');
    if (!avatar) throw new Error('缺少角色头像信息，无法复制');
    const ch = ctx.characters && ctx.characters[meta.chid];
    const chName = (ch && ch.name) || meta.name || stripExt(oldName);

    const getRes = await fetch('/api/chats/get', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ ch_name: chName, file_name: oldName, avatar_url: avatar }),
    });
    if (!getRes.ok) throw new Error('读取对话失败 HTTP ' + getRes.status);
    const data = await getRes.json();
    const chatArr = Array.isArray(data) ? data : [];
    // 去掉元数据里的 integrity（新文件需要重新生成，否则保存会被完整性检查拒绝）
    if (chatArr[0] && chatArr[0].chat_metadata && typeof chatArr[0].chat_metadata === 'object') {
        delete chatArr[0].chat_metadata.integrity;
    }

    // 生成唯一新名字，避免覆盖已有对话
    const existing = new Set((state.chats || []).map((c) => String(c.file_id)));
    let n = 2;
    let newName = oldName + ' 副本';
    while (existing.has(newName)) newName = oldName + ' 副本 ' + (n++);

    const saveRes = await fetch('/api/chats/save', {
        method: 'POST',
        headers: ctx.getRequestHeaders(),
        cache: 'no-cache',
        body: JSON.stringify({ ch_name: chName, file_name: newName, chat: chatArr, avatar_url: avatar, force: true }),
    });
    if (!saveRes.ok) throw new Error('保存分支失败 HTTP ' + saveRes.status);

    closeSheet();
    toastrNotify('success', '已复制为独立对话分支：' + newName);
    safe('refresh', refreshChats)();
}

/** 删除对话（先关 ⋮ 弹窗，再弹确认框） */
async function confirmDeleteChat(item, meta) {
    const label = meta.kind === 'group' ? (meta.name + ' · 群聊对话') : (meta.name + ' · ' + (meta.sub || item.file_id));
    const ok = await askConfirm('删除对话', '确定删除对话「' + label + '」吗？此操作不可恢复。', '删除');
    if (!ok) return;
    await deleteChatFile(item, meta);
    toastrNotify('success', '对话已删除');
    safe('refresh', refreshChats)();
}

async function deleteChatFile(item, meta) {
    const ctx = state.ctx;
    const headers = ctx.getRequestHeaders();
    if (meta.kind === 'group') {
        const res = await fetch('/api/chats/group/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: String(item.file_id) }),
        });
        if (!res.ok) throw new Error('删除群聊对话失败 HTTP ' + res.status);
        return;
    }
    const res = await fetch('/api/chats/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({ chatfile: String(item.file_id) + '.jsonl', avatar_url: String(item.avatar || '') }),
    });
    if (!res.ok) throw new Error('删除对话失败 HTTP ' + res.status);
}

function buildChatRow(item, meta) {
    const row = el('div', 'st-app-chat-item');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.dataset.chat = String(item.file_id || '');
    if (meta.kind === 'group') row.dataset.group = String(item.group || '');
    else row.dataset.avatar = String(item.avatar || '');

    row.appendChild(makeAvatar(meta.avatarUrl, meta.name));

    const main = el('div', 'st-app-chat-main');
    const line = el('div', 'st-app-chat-row');
    line.appendChild(el('span', 'st-app-chat-name', meta.name));
    if (pinIsPinned(item)) line.appendChild(el('span', 'st-app-chat-pin', '置顶'));
    line.appendChild(el('time', 'st-app-chat-time', fmtTime(item.last_mes)));
    main.appendChild(line);

    const preview = el('span', 'st-app-chat-preview', stripPreview(item.mes));
    main.appendChild(preview);
    row.appendChild(main);

    // 竖三点：点击打开「对话操作」弹窗（置顶 / 复制分支 / 删除）
    const dots = el('button', 'st-app-chat-dots');
    dots.type = 'button';
    dots.setAttribute('aria-label', '对话操作');
    dots.innerHTML = '<span class="st-app-ico">' + ICONS.dotsV + '</span>';
    dots.addEventListener('click', (ev) => {
        ev.stopPropagation();
        safe('chat menu', () => openChatItemMenu(item, meta))();
    });
    row.appendChild(dots);

    row.addEventListener('click', (ev) => {
        if (ev.target.closest('.st-app-chat-dots')) return;
        safe('openChat', () => openChat(item, meta))();
    });
    row.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            safe('openChat', () => openChat(item, meta))();
        }
    });
    return row;
}

function buildEmpty(title, sub, action) {
    const wrap = el('div', 'st-app-empty');
    const ic = el('span', 'st-app-ico');
    ic.innerHTML = ICONS.inbox;
    wrap.appendChild(ic);
    wrap.appendChild(el('div', 'st-app-empty-title', title));
    wrap.appendChild(el('div', 'st-app-empty-sub', sub));
    if (action) {
        const b = el('button', 'st-app-btn st-app-btn-accent', action.label);
        b.type = 'button';
        if (action.act === 'switch-characters') {
            b.addEventListener('click', () => switchTab('characters'));
        } else if (action.act === 'refresh-chats') {
            b.addEventListener('click', safe('retry', refreshChats));
        }
        wrap.appendChild(b);
    }
    return wrap;
}

function buildSkeletonItem() {
    const item = el('div', 'st-app-skeleton-item');
    item.appendChild(el('div', 'st-app-skeleton-avatar'));
    const main = el('div', 'st-app-skeleton-main');
    main.appendChild(el('div', 'st-app-skeleton-line short'));
    main.appendChild(el('div', 'st-app-skeleton-line'));
    item.appendChild(main);
    return item;
}

function makeAvatar(url, name) {
    const wrap = el('span', 'st-app-avatar-wrap');
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const fallback = el('span', 'st-app-avatar-fallback', firstChar(name));
    if (url) {
        img.src = url;
        img.addEventListener('error', () => wrap.classList.add('is-fallback'));
        wrap.appendChild(img);
        wrap.appendChild(fallback);
    } else {
        wrap.classList.add('is-fallback');
        wrap.appendChild(fallback);
    }
    return wrap;
}

function fmtTime(v) {
    try {
        if (v == null || v === '') return '';
        const ctx = state.ctx;
        const m = ctx && ctx.timestampToMoment ? ctx.timestampToMoment(v) : null;
        if (m && m.isValid) {
            if (!m.isValid()) return '';
            return m.format('MM-DD HH:mm');
        }
        const d = new Date(v);
        const ok = !isNaN(d.getTime());
        if (!ok) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ''; }
}

function stripPreview(mes) {
    const s = String(mes || '').replace(/\s+/g, ' ').trim();
    if (!s) return '（暂无消息）';
    return s;
}

/* ============================================================================
 * 打开聊天 → 进入聊天二级页
 * ========================================================================== */

async function openChat(item, meta) {
    if (state.opening) return;
    state.opening = true;
    const ctx = state.ctx;
    // 1) 立即进入聊天视图 + 加载态（不等数据，点击即响应）
    enterChatView({ meta });
    setChatLoading(true);
    try {
        if (meta.kind === 'group') {
            if (typeof ctx.openGroupChat !== 'function') throw new Error('当前酒馆版本不支持打开群聊');
            await ctx.openGroupChat(String(item.group), String(item.file_id));
        } else {
            const chid = meta.chid;
            if (chid < 0) throw new Error('找不到这条聊天对应的角色（角色可能已被删除）');
            const target = String(item.file_id || '');
            // 原生欢迎屏 openRecentCharacterChat 同款路径：
            // 先选角色（内部加载该角色「当前」聊天），再比对目标聊天名，
            // 不同则 openCharacterChat 切到目标 —— 保证同一角色多条对话各自独立。
            // 不再预写 chat 指针（之前的优化会导致同角色多条对话都指向最新那条）。
            await ctx.selectCharacterById(chid, { switchMenu: false });
            const cur = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : null;
            if (cur !== target && typeof ctx.openCharacterChat === 'function') {
                await ctx.openCharacterChat(target);
            }
        }
        enterChatView({ meta }); // 数据就绪，刷新顶栏（仍以点开的聊天为准）
        setTimeout(() => { try { ctx.scrollChatToBottom && ctx.scrollChatToBottom(); } catch { /* noop */ } }, 220);
    } catch (e) {
        reportError('打开聊天失败', e);
    } finally {
        setChatLoading(false);
        state.opening = false;
        try { ctx.loader && ctx.loader.hide && ctx.loader.hide(); } catch { /* noop */ }
    }
}

function setChatLoading(on) {
    const el2 = document.getElementById('st-app-chat-loading');
    if (el2) {
        el2.classList.toggle('show', !!on);
        el2.setAttribute('aria-hidden', on ? 'false' : 'true');
    }
}

function enterChatView({ meta } = {}) {
    const wasChat = state.view === 'chat';
    state.currentChatMeta = meta || state.currentChatMeta || null;
    state.view = 'chat';
    document.body.classList.add('st-app-chat');
    document.body.classList.remove('st-app-native-drawer');
    updateChatTopbar();
    if (!wasChat) {
        pushLayer({ kind: 'chat', close: () => exitChatView({ skipHistory: true }) });
        applyGeometry('enter-chat');
    }
}

function exitChatView({ skipHistory = false } = {}) {
    if (state.view !== 'chat') return;
    state.view = 'tabs';
    state.currentChatMeta = null;
    document.body.classList.remove('st-app-chat');
    setChatLoading(false);
    updateChatTopbar();
    // skipHistory 仅用于由 history popstate 触发的关闭，避免重复操作历史
    void skipHistory;
    safe('exit refresh', refreshChats)();
    applyGeometry('exit-chat');
}

function updateChatTopbar() {
    const ctx = state.ctx;
    const wrap = document.getElementById('st-app-chat-avatar-wrap');
    const nameEl = document.getElementById('st-app-chat-name');
    const subEl = document.getElementById('st-app-chat-sub');
    if (!wrap || !nameEl || !subEl) return;

    if (state.view !== 'chat') {
        nameEl.textContent = '';
        subEl.textContent = '';
        wrap.textContent = '';
        wrap.className = 'st-app-avatar-wrap sm';
        return;
    }

    // 以「点开的那条聊天」为准（meta），避免切换角色/加载期间的 ctx 时序把顶栏
    // 显示成交互前的角色（如 SillyTavern system）
    const meta = state.currentChatMeta;
    let name = '', sub = '', avatarUrl = '', avatarFile = '';
    try {
        if (meta && meta.kind === 'group') {
            name = meta.name || '群聊';
            sub = '群聊';
        } else if (meta && meta.kind === 'char') {
            name = meta.name || '';
            sub = meta.sub || '';
            avatarUrl = meta.avatarUrl || '';
            avatarFile = meta.avatarFile || '';
        } else {
            const group = ctx.groupId ? (ctx.groups && ctx.groups.find ? ctx.groups.find((g) => String(g.id) === String(ctx.groupId)) : null) : null;
            if (group) {
                name = group.name || '群聊';
                sub = '群聊';
            } else {
                const chid = ctx.characterId;
                const ch = chid != null ? ctx.characters && ctx.characters[chid] : null;
                if (ch) {
                    name = ch.name || '';
                    sub = stripExt(ch.chat || '');
                    avatarFile = ch.avatar && ch.avatar !== 'none' ? ch.avatar : '';
                    if (avatarFile) avatarUrl = ctx.getThumbnailUrl('avatar', avatarFile);
                }
                if (!name && ctx.name2) name = ctx.name2;
            }
        }
    } catch { /* noop */ }
    if (!name) name = '聊天';

    nameEl.textContent = name;
    nameEl.title = name;
    subEl.textContent = sub;
    subEl.title = sub;

    fillTopbarAvatar(wrap, avatarUrl, avatarFile, name);
}

/** 顶部圆形头像：缩略图 → 完整头像 → 首字兜底（加载失败也能看到首字） */
function fillTopbarAvatar(wrap, url, file, name) {
    wrap.textContent = '';
    wrap.className = 'st-app-avatar-wrap sm';
    const fallback = el('span', 'st-app-avatar-fallback', firstChar(name));
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => {
        if (img.dataset.retried !== '1' && file) {
            img.dataset.retried = '1';
            img.src = 'characters/' + file;
            return;
        }
        wrap.classList.add('is-fallback');
    });
    if (url) { img.src = url; }
    else if (file) { img.src = 'characters/' + file; }
    else { wrap.classList.add('is-fallback'); }
    wrap.appendChild(img);
    wrap.appendChild(fallback);
}

/* ============================================================================
 * ⋯ 更多菜单（底部弹层）+ 通用 sheet
 * ========================================================================== */

function openMoreMenu() {
    const rows = [];
    rows.push({ icon: 'users', label: '角色管理', sub: '当前角色卡编辑', onClick: openCurrentCharacterEditor });
    rows.push({ icon: 'book', label: '世界书', onClick: () => openNativeDrawer(NATIVE_DRAWERS.worldInfo, { title: '世界书' }) });
    rows.push({ icon: 'sliders', label: '预设 / 采样', onClick: () => openNativeDrawer(NATIVE_DRAWERS.aiConfig, { title: '预设与采样' }) });
    rows.push({ icon: 'api', label: '模型切换', sub: '直接选已拉取的模型，与 API 页同步', onClick: showModelSwitch });
    rows.push({ icon: 'code', label: '正则', onClick: () => openPanelSubpage('#regex_container', '正则') });
    rows.push({ icon: 'smile', label: '人设', onClick: () => openNativeDrawer(NATIVE_DRAWERS.persona, { title: '人设管理' }) });
    rows.push({ icon: 'image', label: '生图', onClick: () => openPanelSubpage('#sd_container', '生图') });
    rows.push({ icon: 'volume', label: 'TTS', onClick: () => openPanelSubpage('#tts_container', 'TTS') });
    rows.push({ icon: 'chart', label: 'Token 统计', onClick: showTokenStats });

    // 扩展插件（动态扫描）：只列第三方注册到原顶部栏的抽屉（点开即插件主面板，
    // 如 Horae 时光记忆）。没有顶部栏抽屉的插件（如总结）请从原生 Extensions 抽屉进入。
    const extThirdDrawers = collectNativeDrawers().filter((d) => !d.builtin);
    if (extThirdDrawers.length) {
        rows.push({ divider: true });
        for (const d of extThirdDrawers) {
            rows.push({ icon: 'api', label: d.title, sub: '插件', onClick: () => openNativeDrawer(d.id, { title: d.title }) });
        }
    }

    rows.push({ divider: true });
    rows.push({ icon: 'plus', label: '开始新聊天', sub: '使用酒馆原生确认', onClick: triggerNativeOption('option_start_new_chat') });
    rows.push({ icon: 'close', label: '关闭当前聊天', onClick: triggerNativeOption('option_close_chat') });
    rows.push({ divider: true });
    rows.push({ icon: 'layout', label: state.enabled ? '切回原版布局' : '切换到 APP 布局', onClick: () => { closeSheet(); setModeEnabled(!state.enabled, { persist: true }); } });

    showSheet('更多', rows);
}

/* ---------- 模型切换（读原生 select，与 API 页同步） ---------- */
function findModelSelect() {
    const ctx = state.ctx || {};
    const sourceMap = { makersuite: 'google', google: 'google', azure_openai: 'openai' };
    let source = '';
    try { source = String(ctx.chatCompletionSettings?.chat_completion_source || ''); } catch { /* noop */ }
    const key = sourceMap[source] || source;
    let target = key ? document.getElementById('model_' + key + '_select') : null;
    if (target && target.options && target.options.length) return target;

    let current = '';
    try { current = String(ctx.getChatCompletionModel ? ctx.getChatCompletionModel() : ''); } catch { /* noop */ }
    const all = Array.from(document.querySelectorAll('select[id^="model_"][id$="_select"]'));
    if (current) {
        const hit = all.find((s) => s.value === current && s.options && s.options.length);
        if (hit) return hit;
    }
    const visible = all.find((s) => s.options && s.options.length && s.offsetParent !== null);
    return visible || all.find((s) => s.options && s.options.length) || null;
}

function showModelSwitch() {
    const select = findModelSelect();
    if (!select || !select.options || !select.options.length) {
        showSheet('模型切换', [{ label: '当前 API 没有可用的模型列表', sub: '请先在 API → API 连接里拉取模型', chevron: false }]);
        return;
    }
    const current = select.value;
    const rows = [];
    for (const opt of Array.from(select.options)) {
        const v = opt.value;
        if (!v) continue;
        const isCur = v === current;
        rows.push({
            icon: isCur ? 'sliders' : 'api',
            label: (opt.textContent || v).trim() || v,
            sub: isCur ? '当前使用' : '',
            onClick: () => pickModel(select, v),
        });
    }
    showSheet('模型切换' + (current ? ' · ' + current : ''), rows);
}

function pickModel(select, value) {
    try {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        toastrNotify('success', '模型已切换：' + value);
    } catch (e) {
        reportError('切换模型失败', e);
    }
}

function triggerNativeOption(id) {
    return () => {
        closeSheet();
        setTimeout(() => {
            const n = document.getElementById(id);
            if (n) n.click();
            else toastrNotify('warning', '未找到原生入口：' + id);
        }, 60);
    };
}

function showSheet(title, rows) {
    if (state.sheetOpen) return; // 正常流程会先关旧弹层再开新的
    const sheet = document.getElementById('st-app-sheet');
    const mask = document.getElementById('st-app-sheet-mask');
    const titleEl = document.getElementById('st-app-sheet-title');
    const body = document.getElementById('st-app-sheet-body');
    if (!sheet || !mask || !body) return;

    titleEl.textContent = title || '';
    body.textContent = '';
    for (const r of rows) {
        if (r.divider) { body.appendChild(el('div', 'st-app-sheet-divider')); continue; }
        body.appendChild(buildSheetRow(r));
    }

    state.sheetOpen = true;
    requestAnimationFrame(() => {
        mask.classList.add('open');
        sheet.classList.add('open');
    });

    pushLayer({ kind: 'sheet', close: () => closeSheet() });
}

function buildSheetRow(r) {
    const row = el('button', 'st-app-sheet-row');
    row.type = 'button';
    if (r.icon) { const ic = el('span', 'st-app-ico'); ic.innerHTML = ICONS[r.icon] || ''; row.appendChild(ic); }
    const main = el('div', 'st-app-sheet-row-main');
    main.appendChild(el('span', 'st-app-sheet-row-label', r.label || ''));
    if (r.sub) main.appendChild(el('span', 'st-app-sheet-row-sub', r.sub));
    row.appendChild(main);
    row.addEventListener('click', safe('sheet-row', () => {
        if (typeof r.onClick !== 'function') return;
        // 先关弹层（走系统返回，保证 history 同步），弹层关闭后再执行动作
        closeSheetThen(() => {
            try { r.onClick(); } catch (e) { reportError('菜单项', e); }
        });
    }));
    return row;
}

function closeSheet() {
    if (!state.sheetOpen) return;
    state.sheetOpen = false;
    const sheet = document.getElementById('st-app-sheet');
    const mask = document.getElementById('st-app-sheet-mask');
    if (sheet) sheet.classList.remove('open');
    if (mask) mask.classList.remove('open');
}

/* ============================================================================
 * 原生二级界面：统一二级页覆盖层
 * 做法：把原生抽屉 / 扩展面板的「内容元素」搬进 #st-app-native-page（root 级），
 *       由它提供统一的「← 返回 + 标题」顶栏 + 内容区；关闭时还原到原位置。
 * 好处：完全不碰原生抽屉定位/层级，图标行不会再错位。
 * ========================================================================== */

let movedNativeElement = null;

/** 还原搬进统一二级页的元素（含类名与原生抽屉关闭） */
function restoreNativeElement() {
    const m = movedNativeElement;
    if (!m) return;
    movedNativeElement = null;
    try {
        const el2 = m.element;
        el2.classList.remove('st-app-embedded-panel', 'st-app-embedded-drawer');
        // 还原 content 的 open/closed 状态
        if (m.contentEl) {
            m.contentEl.classList.remove('openDrawer');
            m.contentEl.classList.add(m.wasOpen ? 'openDrawer' : 'closedDrawer');
            if (!m.wasOpen) m.contentEl.classList.remove('openDrawer');
            if (m.wasClosed) m.contentEl.classList.add('closedDrawer'); else m.contentEl.classList.remove('closedDrawer');
        } else {
            // 扩展面板（inline-drawer）自身
            if (m.wasClosed) el2.classList.add('closedDrawer'); else el2.classList.remove('closedDrawer');
            if (m.wasOpen) el2.classList.add('openDrawer'); else el2.classList.remove('openDrawer');
        }
        // 还原 DOM 位置
        if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(el2, m.next);
        else if (m.parent) m.parent.appendChild(el2);
    } catch { /* noop */ }
    // 若之前是我们主动打开的原生抽屉，还原后把它关掉，避免状态残留
    try {
        if (m.drawerEl) {
            const content = m.drawerEl.querySelector('.drawer-content');
            if (content && content.classList.contains('openDrawer')) {
                const tog = m.drawerEl.querySelector('.drawer-toggle');
                if (tog) tog.click();
            }
        }
    } catch { /* noop */ }
}

function setNativePageTitle(title) {
    const t = document.getElementById('st-app-native-page-title');
    if (t) t.textContent = title || '';
}

function closeNativePage() {
    restoreNativeElement();
    const page = document.getElementById('st-app-native-page');
    if (page) {
        page.classList.remove('open');
        page.setAttribute('aria-hidden', 'true');
    }
}

/** 把原生面板元素搬进统一二级页并打开。
 *  kind='drawer'：搬整个 .drawer（保留插件内部父节点结构，如 Horae 的 #horae_drawer）；
 *  kind='panel'：搬 .drawer-content / .inline-drawer / .extension_container（内置或扩展面板）。
 *  drawerEl：可选，父抽屉（用于关闭时还原原生抽屉状态）。 */
function openNativePageElement(element, title, kind, drawerEl) {
    const page = document.getElementById('st-app-native-page');
    const bodyEl = document.getElementById('st-app-native-page-body');
    if (!page || !bodyEl || !element) return;
    restoreNativeElement();
    const isDrawer = (kind === 'drawer');
    const contentEl = isDrawer ? element.querySelector('.drawer-content') : null;
    movedNativeElement = {
        element,
        parent: element.parentElement,
        next: element.nextSibling,
        kind: kind || 'panel',
        contentEl,
        wasOpen: contentEl ? contentEl.classList.contains('openDrawer') : element.classList.contains('openDrawer'),
        wasClosed: contentEl ? contentEl.classList.contains('closedDrawer') : element.classList.contains('closedDrawer'),
        drawerEl: drawerEl || (isDrawer ? element : null),
    };
    element.classList.add('st-app-embedded-panel');
    if (isDrawer) element.classList.add('st-app-embedded-drawer');
    // 确保 content 可见
    if (contentEl) {
        contentEl.classList.remove('closedDrawer');
        contentEl.classList.add('openDrawer');
    } else {
        element.classList.remove('closedDrawer');
        element.classList.add('openDrawer');
    }
    bodyEl.textContent = '';
    bodyEl.appendChild(element);
    setNativePageTitle(title || '面板');
    page.classList.add('open');
    page.setAttribute('aria-hidden', 'false');
    pushLayer({ kind: 'native-page', close: () => closeNativePage() });
}

function openNativeDrawer(selector, opts = {}) {
    const title = (opts && opts.title) || (selector && BUILTIN_DRAWERS[selector] ? BUILTIN_DRAWERS[selector].title : '') || '面板';
    const drawer = document.querySelector(selector);
    if (!drawer) { toastrNotify('warning', '未找到原生面板：' + selector); return; }
    const content = drawer.querySelector('.drawer-content');
    if (!content) { toastrNotify('warning', '面板没有内容：' + selector); return; }
    // 先让原生抽屉「打开」一次以完成懒初始化
    const isOpen = content.classList.contains('openDrawer');
    if (!isOpen) {
        const toggle = drawer.querySelector('.drawer-toggle');
        if (!toggle) { toastrNotify('warning', '面板无法打开：' + selector); return; }
        toggle.click();
    }
    const focusSelector = (opts && opts.focus) || '';
    const focusKeywords = (opts && opts.keywords) || [];
    const isBuiltin = !!BUILTIN_DRAWERS[selector];
    setTimeout(() => {
        if (isBuiltin) {
            // 内置抽屉（世界书/API 等）：只搬 .drawer-content，不破坏复杂面板内部布局
            openNativePageElement(content, title, 'panel', drawer);
        } else {
            // 第三方抽屉（Horae 等）：搬整个 .drawer，保留插件父节点结构
            openNativePageElement(drawer, title, 'drawer', null);
        }
        if (focusSelector || (focusKeywords && focusKeywords.length)) {
            setTimeout(() => { try { focusInDrawer(focusSelector, focusKeywords); } catch { /* noop */ } }, 120);
        }
    }, 40);
}

function focusInDrawer(selector, keywords) {
    let target = selector ? document.querySelector(selector) : null;
    if (!target && keywords && keywords.length) {
        const containers = document.querySelectorAll('#rm_extensions_block .extension_container, #rm_extensions_block .inline-drawer');
        containers.forEach((c) => {
            if (target) return;
            const txt = (c.id + ' ' + (c.textContent || '')).toLowerCase();
            if (keywords.some((k) => txt.includes(String(k).toLowerCase()))) target = c;
        });
    }
    if (target) {
        try {
            // 展开它所在的 inline-drawer（若折叠）
            const inline = target.closest('.inline-drawer');
            if (inline && inline.querySelector('.inline-drawer-content')) {
                const ic = inline.querySelector('.inline-drawer-content');
                if (ic.classList.contains('displayNone') || getComputedStyle(ic).display === 'none') {
                    const tog = inline.querySelector('.inline-drawer-toggle');
                    if (tog) tog.click();
                }
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch { /* noop */ }
    }
}

/* ============================================================================
 * Token 统计 / 诊断
 * ========================================================================== */

async function showTokenStats() {
    const ctx = state.ctx;
    const rows = [];
    rows.push({ label: '会话消息数', value: String((ctx.chat && ctx.chat.length) || 0) });
    rows.push({ label: '上下文上限 maxContext', value: String(ctx.maxContext != null ? ctx.maxContext : '—') });

    let model = '—';
    try { if (typeof ctx.getChatCompletionModel === 'function') model = await ctx.getChatCompletionModel(); } catch { /* noop */ }
    if (model == null || model === '') model = '—';
    rows.push({ label: '当前模型', value: String(model) });

    let tokens = null;
    try {
        if (typeof ctx.getTokenCountAsync === 'function') {
            const text = (ctx.chat || []).map((m) => m.mes || '').join('\n');
            if (text) tokens = await ctx.getTokenCountAsync(text);
        }
    } catch { /* noop */ }
    if (tokens != null) rows.push({ label: '当前上下文 Token 估算', value: String(tokens) });

    showSheet('Token 统计', rows.map((r) => ({ label: r.label, sub: r.value, chevron: false })));
}

function showDiagnostics() {
    const ctx = state.ctx;
    const rows = [];
    const v = (sel, prop) => {
        try {
            const n = document.querySelector(sel);
            if (!n) return '（不存在）';
            if (prop === 'z') return String(getComputedStyle(n).zIndex);
            if (prop === 'vis') return getComputedStyle(n).visibility;
            return '';
        } catch (e) { return 'err'; }
    };

    rows.push({ label: '版本', sub: `v${VERSION} ${STAGE}`, chevron: false });
    rows.push({ label: '模式', sub: state.enabled ? 'APP 布局' : '原版', chevron: false });
    rows.push({ label: '视图', sub: state.view, chevron: false });
    rows.push({ label: 'body class', sub: document.body.className || '(空)', chevron: false });
    rows.push({ label: '视口', sub: `${window.innerWidth}×${window.innerHeight} · dpr=${window.devicePixelRatio}`, chevron: false });
    rows.push({ label: 'isMobile', sub: String(ctx.isMobile ? ctx.isMobile() : 'n/a'), chevron: false });
    rows.push({ label: '返回栈深度', sub: String(state.backStack.length), chevron: false });
    rows.push({ label: '聊天记录数', sub: String(state.chats.length), chevron: false });
    rows.push({ label: '角色数', sub: String((ctx.characters && ctx.characters.length) || 0), chevron: false });
    rows.push({ label: '当前 chid', sub: String(ctx.characterId), chevron: false });
    rows.push({ label: '当前 chatId', sub: String(typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : 'n/a'), chevron: false });
    rows.push({ divider: true });
    rows.push({ label: '#sheld z-index', sub: v('#sheld', 'z') + ' · vis=' + v('#sheld', 'vis'), chevron: false });
    rows.push({ label: '#top-settings-holder z', sub: v('#top-settings-holder', 'z'), chevron: false });
    rows.push({ label: '#chat z-index', sub: v('#chat', 'z'), chevron: false });
    rows.push({ label: '已装抽屉', sub: countDrawers(), chevron: false });
    if (state.lastError) rows.push({ label: '最近错误', sub: state.lastError.label + ': ' + state.lastError.message, chevron: false });

    rows.push({ divider: true });
    const gi = state.geomInfo;
    rows.push({ label: '#st-app-root 尺寸', sub: gi && gi.rect ? `${Math.round(gi.rect.width)}×${Math.round(gi.rect.height)} @${Math.round(gi.rect.left)},${Math.round(gi.rect.top)}` : '—', chevron: false });
    rows.push({ label: '视口', sub: gi ? `${gi.vp.w}×${gi.vp.h}` : `${innerWidth}×${innerHeight}`, chevron: false });
    rows.push({ label: 'fixed 破坏属性', sub: (gi && gi.blockers && gi.blockers.length) ? gi.blockers.join(' | ') : '无', chevron: false });

    showSheet('诊断信息', rows);
}

function countDrawers() {
    const ids = Object.values(NATIVE_DRAWERS);
    const found = ids.filter((s) => document.querySelector(s)).length;
    return `${found}/${ids.length}`;
}

/* ============================================================================
 * 错误条
 * ========================================================================== */

function buildErrorBanner() {
    const b = el('div', null);
    b.id = 'st-app-error-banner';
    const main = el('div', 'st-app-error-main');
    main.appendChild(el('div', 'st-app-error-title', '酒馆 APP 布局出错了'));
    const txt = el('div', 'st-app-error-text', '');
    main.appendChild(txt);
    b.appendChild(main);
    const close = el('button', 'st-app-error-close');
    close.type = 'button';
    close.setAttribute('aria-label', '关闭错误提示');
    close.innerHTML = ICONS.close;
    close.addEventListener('click', hideErrorBanner);
    b.appendChild(close);
    return b;
}

function showErrorBanner(title, text) {
    const b = document.getElementById('st-app-error-banner');
    if (!b) return;
    const t = b.querySelector('.st-app-error-title');
    const x = b.querySelector('.st-app-error-text');
    if (t) t.textContent = title || '酒馆 APP 布局出错了';
    if (x) x.textContent = text || '';
    b.classList.add('show');
}

function hideErrorBanner() {
    const b = document.getElementById('st-app-error-banner');
    if (b) b.classList.remove('show');
}

/* ============================================================================
 * 冲突检测（claude-surface 等改布局的主题/扩展）
 * ========================================================================== */

function detectLayoutConflicts() {
    try {
        const hit =
            document.querySelector('link[href*="claude-surface"]') ||
            document.querySelector('[id*="claude-surface"]') ||
            document.querySelector('[class*="claude-surface"]');
        if (hit) {
            state.conflictDetected = true;
            toastrNotify('warning', '检测到 claude-surface 等改布局的扩展，可能与本插件冲突，建议二选一');
        }
    } catch { /* noop */ }
}

function renderConflictNotice() {
    const title = document.getElementById('st-app-conflict-title');
    const body = document.getElementById('st-app-conflict-body');
    if (!title || !body) return;
    if (!state.conflictDetected) { title.style.display = 'none'; body.style.display = 'none'; return; }
    title.style.display = '';
    body.style.display = '';
    title.textContent = '兼容性提示';
    body.textContent = '';
    const row = el('div', 'st-app-row');
    row.appendChild(buildRowMain('检测到改布局的扩展', 'claude-surface 等会与本插件打架，建议在酒馆扩展管理里二选一。'));
    body.appendChild(row);
}

/* ============================================================================
 * 手机返回键：backStack 与 history 标记严格 1:1
 * ----------------------------------------------------------------------------
 * 策略：每压一层(菜单/弹窗/二级页)就 pushState 一个标记；系统返回(popstate)
 * 时正好弹掉一层并执行其 close。层与标记一一对应，保证「关菜单 → 关弹窗 →
 * 退出二级页 → 回列表」逐级后退，不直接退出网页。
 * ========================================================================== */

let pendingAfterPop = [];

/** 弹层关闭后要执行的动作（等 popstate 处理完再跑） */
function afterPop(fn) { pendingAfterPop.push(fn); }

function drainAfterPop() {
    const q = pendingAfterPop;
    pendingAfterPop = [];
    q.forEach((fn) => setTimeout(() => { try { fn(); } catch (e) { reportError('afterPop', e); } }, 0));
}

function pushLayer(layer) {
    layer.__kind = layer.kind;
    state.backStack.push(layer);
    if (state.nextLayerReplacesHistory) {
        state.nextLayerReplacesHistory = false;
        try { history.replaceState({ stApp: true }, ''); } catch { /* noop */ }
    } else {
        try { history.pushState({ stApp: true }, ''); } catch { /* noop */ }
    }
}

window.addEventListener('popstate', safe('popstate', () => {
    // 嵌套弹窗自关闭后主动 history.back() 消费孤儿标记：跳过这次 popstate
    if (state.skipNextPopstate) {
        state.skipNextPopstate = false;
        drainAfterPop();
        return;
    }
    if (state.backStack.length > 0) {
        const layer = state.backStack.pop();
        try { layer.close && layer.close(); } catch (e) { reportError('back', e); }
    } else if (state.view === 'chat') {
        exitChatView({ skipHistory: true });
    }
    drainAfterPop();
}));

/** 关闭当前最上层（走系统返回，保证 history 同步；列表页则由浏览器接管） */
function requestBack() {
    if (state.backStack.length > 0) {
        try { history.back(); return; } catch { /* noop */ }
    }
    if (state.view === 'chat') { exitChatView({ skipHistory: true }); return; }
    try { history.back(); } catch { /* noop */ }
}

/** 关闭弹层后执行一个动作（如：关掉⋯菜单 → 打开原生抽屉） */
function closeSheetThen(action) {
    if (!state.sheetOpen) {
        if (action) setTimeout(action, 0);
        return;
    }
    const top = state.backStack[state.backStack.length - 1];
    if (top && top.__kind === 'sheet') {
        // 同步弹 sheet 层 + 视觉关闭，不依赖异步 history.back → 避免 40ms 窗口期栈错乱。
        // 下一个 pushLayer 用 replaceState 替换 sheet 的 history 标记（不新增、不留孤儿）。
        state.backStack.pop();
        closeSheet();
        state.nextLayerReplacesHistory = true;
        if (action) setTimeout(action, 0);
    } else {
        // 兜底：视觉关闭 + 直接执行
        closeSheet();
        if (action) setTimeout(action, 0);
    }
}

/* ============================================================================
 * 树枝状层级：自动捕获嵌套弹窗
 *
 * 酒馆原生除了 <dialog>（浏览器 top-layer，自带 OK/Cancel，不干预）外，
 * 还有一批 position:fixed 的「伪弹窗」（世界书编辑器/角色高级定义/聊天选择等）。
 * 这些在我们的覆盖层上方可见、有自己的关闭按钮，但返回键管不到。
 *
 * 方案：MutationObserver 监听它们的出现 → pushLayer 挂 history 层 →
 *       返回键关闭它们（点击其关闭按钮）；若用户用弹窗自己的关闭按钮关了，
 *       observer 检测到隐藏 → 同步弹栈 + history.back 消费孤儿标记（skipNextPopstate）。
 * ========================================================================== */

const NESTED_POPUPS = [
    { sel: '#world_popup', closeSel: '#world_popup_close, [onclick*="hideWorldInfo"], .fa-times, .fa-xmark' },
    { sel: '#character_popup', closeSel: '#character_popup_cross, .fa-times, .fa-xmark' },
    { sel: '#select_chat_popup', closeSel: '#select_chat_cross, #shadow_select_chat_popup, .fa-times, .fa-xmark' },
    { sel: '#rawPromptPopup', closeSel: '#rawPromptPopupClose, .fa-times, .fa-xmark' },
    { sel: '#export_format_popup', closeSel: '#export_format_popup_close, .fa-times, .fa-xmark' },
    { sel: '#dialogue_del_mes', closeSel: '#dialogue_del_mes_cancel, .fa-times, .fa-xmark' },
];

function popupIsVisible(el) {
    if (!el) return false;
    try {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        return el.offsetParent !== null || cs.position === 'fixed';
    } catch { return false; }
}

function manageNestedPopup(el, closeSel) {
    if (el.classList.contains('st-app-managed')) return;
    el.classList.add('st-app-managed');
    let closeBtn = null;
    for (const cs of closeSel.split(',')) {
        try { closeBtn = el.querySelector(cs.trim()); } catch { /* noop */ }
        if (closeBtn) break;
    }
    pushLayer({
        kind: 'nested-popup',
        _target: el,
        close: () => {
            try {
                if (closeBtn) closeBtn.click();
                else el.style.display = 'none';
            } catch { /* noop */ }
        },
    });
}

function watchNestedPopups() {
    if (typeof MutationObserver === 'undefined') return; // 环境不支持则跳过（真机/浏览器都有）
    const observer = new MutationObserver(safe('popup-watch', () => {
        if (!document.body.classList.contains('st-app-on')) return;
        const overlayOpen = document.getElementById('st-app-native-page')?.classList.contains('open');
        const chatActive = document.body.classList.contains('st-app-chat');
        if (!overlayOpen && !chatActive && !state.sheetOpen) return;

        for (const p of NESTED_POPUPS) {
            const el = document.querySelector(p.sel);
            if (!el) continue;
            const visible = popupIsVisible(el);
            const managed = el.classList.contains('st-app-managed');
            if (visible && !managed) {
                manageNestedPopup(el, p.closeSel);
            } else if (!visible && managed) {
                // 弹窗被关了（自己的关闭按钮 或 我们的返回键）
                el.classList.remove('st-app-managed');
                const top = state.backStack[state.backStack.length - 1];
                if (top && top.__kind === 'nested-popup' && top._target === el) {
                    // 自关闭：栈里还留着我们的层 → 同步弹出 + history.back 消费孤儿标记
                    state.backStack.pop();
                    state.skipNextPopstate = true;
                    try { history.back(); } catch { state.skipNextPopstate = false; }
                }
            }
        }
    }));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
}
