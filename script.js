/* ============================================================
   to-do-list · script.js
   双 UI（手机 / 电脑）共用逻辑
   功能：添加 / 完成 / 星标 / 编辑 / 删除 / 筛选 / 深浅色 / 本地存储
        下载源码 ZIP / 设置面板
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'simple-todo-v4';

  var state = load();
  var filter = 'all';
  var editingId = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ===== 数据存取 ===== */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (Array.isArray(p)) return p;
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return [];
  }
  function save(tasks) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks || state)); } catch (e) { /* 忽略 */ }
  }

  /* ===== 工具 ===== */
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function dateText() {
    var d = new Date();
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WEEK[d.getDay()];
  }
  function subText() {
    var active = state.filter(function (t) { return !t.done; }).length;
    var done = state.length - active;
    return dateText() + ' · ' + active + ' 项待办' + (done ? ' · 已完成 ' + done + ' 项' : '');
  }
  function dueInfo(isoStr) {
    if (!isoStr) return null;
    var today = iso(new Date());
    if (isoStr === today) return { label: '今天', cls: 'today' };
    var tm = new Date(); tm.setDate(tm.getDate() + 1);
    if (isoStr === iso(tm)) return { label: '明天', cls: '' };
    var parts = isoStr.split('-');
    var label = Number(parts[1]) + '月' + Number(parts[2]) + '日';
    if (isoStr < today) return { label: label, cls: 'overdue' };
    return { label: label, cls: '' };
  }
  function find(id) {
    for (var i = 0; i < state.length; i++) if (state[i].id === id) return state[i];
    return null;
  }
  function visibleTasks() {
    return state.filter(function (t) {
      if (filter === 'active') return !t.done;
      if (filter === 'done') return t.done;
      if (filter === 'important') return t.important;
      return true;
    });
  }
  var FILTER_TITLES = { all: '全部', active: '进行中', done: '已完成', important: '重要' };

  /* ===== 渲染 ===== */
  function taskHTML(t) {
    var due = dueInfo(t.dueDate);
    var meta = '';
    if (due) meta += '<span class="due ' + due.cls + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 11h16"/></svg>' + due.label + '</span>';
    if (t.important && filter !== 'important') meta += '<span class="imp-tag"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/></svg>重要</span>';
    var body = editingId === t.id
      ? '<input class="edit-input" data-edit value="' + esc(t.text) + '" maxlength="120">'
      : '<div class="task-text">' + esc(t.text) + '</div>';
    return '<div class="task' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
      '<button class="check" data-act="toggle" aria-label="完成/恢复">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 6.5"/></svg>' +
      '</button>' +
      '<div class="task-body">' + body +
        (meta ? '<div class="task-meta">' + meta + '</div>' : '') +
      '</div>' +
      '<button class="star' + (t.important ? ' on' : '') + '" data-act="star" aria-label="标记重要">' +
        '<svg viewBox="0 0 24 24" fill="' + (t.important ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z"/></svg>' +
      '</button>' +
      '<button class="del" data-act="del" aria-label="删除">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>' +
      '</button>' +
    '</div>';
  }

  function counts() {
    return {
      all: state.length,
      active: state.filter(function (t) { return !t.done; }).length,
      done: state.filter(function (t) { return t.done; }).length,
      important: state.filter(function (t) { return t.important; }).length
    };
  }
  function emptyCopy() {
    return {
      all: ['还没有任务', '在输入框添加你的第一个任务'],
      active: ['没有进行中的任务', '全部搞定，休息一下吧'],
      done: ['还没有已完成的任务', '完成的任务会出现在这里'],
      important: ['还没有重要任务', '点击任务旁的星标即可标记为重要']
    }[filter] || ['还没有任务', '在输入框添加你的第一个任务'];
  }

  function render() {
    var c = counts();
    var tasks = visibleTasks();
    var html = tasks.map(taskHTML).join('');

    /* 手机 UI */
    $('dateSubM').textContent = subText();
    var tabs = document.querySelectorAll('#navbarM .tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      var f = tabs[i].getAttribute('data-filter');
      tabs[i].classList.toggle('active', f === filter);
      var n = tabs[i].querySelector('.n');
      if (n) { n.textContent = c[f]; n.classList.toggle('hide', c[f] === 0); }
    }
    moveIndicator(document.querySelector('#navbarM .tab-btn.active'));
    $('taskGroupM').innerHTML = html;
    var eM = $('emptyM'), cpM = emptyCopy();
    if (tasks.length === 0) {
      eM.classList.add('show');
      $('emptyTitleM').textContent = cpM[0];
      $('emptySubM').textContent = cpM[1];
    } else {
      eM.classList.remove('show');
    }

    /* 电脑 UI */
    $('dateSubD').textContent = dateText();
    $('dSubM').textContent = c.active + ' 项待办 · 已完成 ' + c.done + ' 项';
    $('dFilterTitle').textContent = FILTER_TITLES[filter];
    var items = document.querySelectorAll('#desktopApp .side-item');
    for (var j = 0; j < items.length; j++) {
      var fj = items[j].getAttribute('data-filter');
      items[j].classList.toggle('active', fj === filter);
      var nj = items[j].querySelector('.n');
      if (nj) { nj.textContent = c[fj]; nj.classList.toggle('hide', c[fj] === 0); }
    }
    $('taskGroupD').innerHTML = html;
    var eD = $('emptyD'), cpD = emptyCopy();
    if (tasks.length === 0) {
      eD.classList.add('show');
      $('emptyTitleD').textContent = cpD[0];
      $('emptySubD').textContent = cpD[1];
    } else {
      eD.classList.remove('show');
    }

    if (editingId) {
      var ei = document.querySelector('[data-edit]');
      if (ei) { ei.focus(); ei.setSelectionRange(ei.value.length, ei.value.length); }
    }
  }

  function moveIndicator(btn) {
    if (!btn) return;
    var ind = document.querySelector('#navbarM .indicator');
    var w = Math.round(btn.offsetWidth * 0.90);
    ind.style.width = w + 'px';
    ind.style.transform = 'translateX(' + (btn.offsetLeft + (btn.offsetWidth - w) / 2) + 'px)';
  }

  /* ===== 操作 ===== */
  function addTask(inputEl) {
    var text = inputEl.value.trim();
    if (!text) return;
    state.unshift({ id: uid(), text: text, done: false, important: false, dueDate: null, createdAt: Date.now(), completedAt: null });
    save();
    inputEl.value = '';
    inputEl.focus();
    render();
    var sc = $('listScrollM');
    if (sc) sc.scrollTop = 0;
    sc = $('listScrollD');
    if (sc) sc.scrollTop = 0;
  }
  function toggleDone(id) {
    var t = find(id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    save(); render();
  }
  function toggleImportant(id) {
    var t = find(id);
    if (!t) return;
    t.important = !t.important;
    save(); render();
  }
  function del(id) {
    var go = function () {
      state = state.filter(function (x) { return x.id !== id; });
      if (editingId === id) editingId = null;
      save(); render();
    };
    var el = document.querySelector('.task[data-id="' + id + '"]');
    if (el) { el.classList.add('removing'); setTimeout(go, 220); } else go();
  }
  function commitEdit(id, text) {
    var t = find(id);
    text = (text || '').trim();
    if (t && text) t.text = text;
    editingId = null;
    save(); render();
  }

  /* ===== 事件：添加 ===== */
  function bindAdd(formId, btnId, inputId) {
    var form = $(formId), btn = $(btnId), input = $(inputId);
    btn.addEventListener('click', function () { addTask(input); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addTask(input); }
    });
  }
  bindAdd('addFormM', 'addBtnM', 'taskInputM');
  bindAdd('addFormD', 'addBtnD', 'taskInputD');

  /* ===== 事件：筛选切换 ===== */
  function setFilter(f) {
    filter = f;
    editingId = null;
    render();
    var sc = $('listScrollM');
    if (sc) sc.scrollTop = 0;
    sc = $('listScrollD');
    if (sc) sc.scrollTop = 0;
  }
  $('navbarM').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) setFilter(b.getAttribute('data-filter'));
  });
  document.querySelector('#desktopApp .side-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) setFilter(b.getAttribute('data-filter'));
  });

  /* ===== 事件：内容滚动时底条平移（仅手机） ===== */
  var listScrollM = $('listScrollM');
  var navbarM = $('navbarM');
  listScrollM.addEventListener('scroll', function () {
    navbarM.classList.toggle('min', listScrollM.scrollTop > 6);
  }, { passive: true });

  /* ===== 事件：任务行操作（两套 UI 共用） ===== */
  function bindTaskGroup(containerId) {
    var group = $(containerId);
    group.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      var row = e.target.closest('.task');
      if (!row) return;
      var id = row.getAttribute('data-id');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'toggle') toggleDone(id);
        if (a === 'star') toggleImportant(id);
        if (a === 'del') del(id);
        return;
      }
      var txt = e.target.closest('.task-text');
      if (txt && !row.classList.contains('done')) {
        editingId = id;
        render();
      }
    });
    group.addEventListener('keydown', function (e) {
      if (!editingId) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        var i = document.querySelector('[data-edit]');
        commitEdit(editingId, i ? i.value : '');
      } else if (e.key === 'Escape') {
        editingId = null;
        render();
      }
    });
    group.addEventListener('blur', function (e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('edit-input')) {
        var val = t.value;
        setTimeout(function () {
          if (!document.activeElement.classList.contains('edit-input')) commitEdit(editingId, val);
        }, 0);
      }
    }, true);
  }
  bindTaskGroup('taskGroupM');
  bindTaskGroup('taskGroupD');

  /* ===== 深浅色 ===== */
  var FILENAME = ['index.html', 'style-public.css', 'style-phone.css', 'style-computer.css', 'script.js'];

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var dark = theme === 'dark';
    var moons = document.querySelectorAll('.ic-moon');
    var suns = document.querySelectorAll('.ic-sun');
    for (var i = 0; i < moons.length; i++) moons[i].style.display = dark ? 'none' : '';
    for (var j = 0; j < suns.length; j++) suns[j].style.display = dark ? '' : 'none';
    var sws = document.querySelectorAll('.set-switch');
    for (var k = 0; k < sws.length; k++) {
      sws[k].classList.toggle('on', dark);
      sws[k].setAttribute('aria-checked', dark ? 'true' : 'false');
    }
    try { localStorage.setItem('simple-todo-theme', theme); } catch (e) { /* 忽略 */ }
  }
  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }
  $('themeBtnM').addEventListener('click', toggleTheme);
  $('themeBtnD').addEventListener('click', toggleTheme);
  (function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('simple-todo-theme'); } catch (e) { /* 忽略 */ }
    applyTheme(saved === 'dark' ? 'dark' : 'light');
  })();

  /* ===== 下载源码 ZIP ===== */
  function downloadZip() {
    if (typeof JSZip === 'undefined') {
      alert('压缩库加载失败，请刷新后重试');
      return;
    }
    var toast = function (msg) {
      var el = document.createElement('div');
      el.textContent = msg;
      el.style.cssText = 'position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:99;background:rgba(20,24,34,.9);color:#fff;font-size:13px;padding:9px 16px;border-radius:99px;';
      document.body.appendChild(el);
      setTimeout(function () { el.remove(); }, 2200);
    };
    var fail = function () { toast('下载失败，请稍后重试'); };
    var reqs = FILENAME.map(function (f) {
      return fetch(f, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(f);
        return r.text();
      });
    });
    Promise.all(reqs).then(function (texts) {
      var zip = new JSZip();
      for (var i = 0; i < FILENAME.length; i++) {
        zip.file('to-do-list/' + FILENAME[i], texts[i]);
      }
      return zip.generateAsync({ type: 'blob' });
    }).then(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'to-do-list.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast('已开始下载 to-do-list.zip');
    }).catch(fail);
  }
  $('dlBtnM').addEventListener('click', function (e) { e.preventDefault(); downloadZip(); });
  $('dlBtnD').addEventListener('click', function (e) { e.preventDefault(); downloadZip(); });

  /* ===== 设置面板（手机底部弹层 / 电脑居中弹窗，共用逻辑） ===== */
  function closeAllSettings() {
    var ps = document.querySelectorAll('.settings.show, .set-sheet.show');
    for (var i = 0; i < ps.length; i++) ps[i].classList.remove('show');
    var ms = document.querySelectorAll('.set-mask.show');
    for (var j = 0; j < ms.length; j++) ms[j].classList.remove('show');
  }
  function bindSettings(btnId, panelId, maskId) {
    var btn = $(btnId), panel = $(panelId), mask = $(maskId);
    if (!btn || !panel || !mask) return;
    btn.addEventListener('click', function () {
      panel.classList.add('show');
      mask.classList.add('show');
    });
    mask.addEventListener('click', closeAllSettings);
  }
  bindSettings('setBtnD', 'settingsPanel', 'settingsMask');
  bindSettings('setBtnM', 'settingsPanelM', 'settingsMaskM');

  /* 设置面板内容行（共用） */
  document.addEventListener('click', function (e) {
    var row = e.target.closest('.set-row[data-act]');
    if (!row) return;
    var act = row.getAttribute('data-act');
    if (act === 'theme') toggleTheme();
    if (act === 'dl') downloadZip();
    if (act === 'clear') {
      if (state.length && !confirm('确定要清空所有任务吗？此操作不可恢复。')) return;
      state = [];
      editingId = null;
      save();
      render();
      closeAllSettings();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllSettings();
  });

  render();
})();
