const DB_FILE_NAME = 'todo-data-v1_2.json';
let dbDirHandle = null;
let currentFilter = 'all';
let tasks = [];
let dirty = false;

function nowIso() {
  return new Date().toISOString();
}

function setDirty(value) {
  dirty = value;
  document.getElementById('saveStatus').textContent = value ? '未保存の変更あり' : '保存済み';
}

function createInitialData() {
  return {
    appName: 'TODO Manager',
    version: '1.2',
    updatedAt: nowIso(),
    tasks: []
  };
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.tasks)) {
    return createInitialData();
  }
  data.tasks = data.tasks.map(task => ({
    id: task.id || crypto.randomUUID(),
    title: task.title || task.text || '',
    source: task.source || 'manual',
    status: task.status || (task.completed ? 'done' : 'inbox'),
    priority: task.priority || 'medium',
    dueDate: task.dueDate || '',
    createdAt: task.createdAt || nowIso(),
    updatedAt: task.updatedAt || nowIso(),
    completedAt: task.completedAt || null
  }));
  return data;
}

async function selectDbFolder() {
  if (!window.showDirectoryPicker) {
    alert('このブラウザではフォルダ直接保存に対応していません。EdgeまたはChromeで開き、利用できない場合は「JSONをダウンロード」を使ってください。');
    return;
  }
  try {
    dbDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    document.getElementById('dbStatus').textContent = `dbフォルダ選択済み：${dbDirHandle.name}`;
    await loadFromDb();
  } catch (error) {
    document.getElementById('dbStatus').textContent = 'dbフォルダ選択をキャンセルしました';
  }
}

async function getDbFileHandle(create) {
  if (!dbDirHandle) {
    throw new Error('dbフォルダが選択されていません');
  }
  return await dbDirHandle.getFileHandle(DB_FILE_NAME, { create });
}

async function loadFromDb() {
  try {
    const fileHandle = await getDbFileHandle(false);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const data = normalizeData(JSON.parse(text || '{}'));
    tasks = data.tasks;
    setDirty(false);
    render();
  } catch (error) {
    if (!dbDirHandle) {
      alert('先にdbフォルダを選択してください。');
      return;
    }
    const data = createInitialData();
    tasks = data.tasks;
    await saveToDb();
    render();
  }
}

async function saveToDb() {
  try {
    const fileHandle = await getDbFileHandle(true);
    const writable = await fileHandle.createWritable();
    const data = {
      appName: 'TODO Manager',
      version: '1.1',
      updatedAt: nowIso(),
      tasks
    };
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    setDirty(false);
    render();
  } catch (error) {
    alert('dbフォルダへ保存できませんでした。先にdbフォルダを選択してください。');
  }
}

function addTask() {
  const titleInput = document.getElementById('titleInput');
  const title = titleInput.value.trim();
  if (!title) return;

  tasks.push({
    id: crypto.randomUUID(),
    title,
    source: document.getElementById('sourceInput').value,
    status: 'inbox',
    priority: document.getElementById('priorityInput').value,
    dueDate: document.getElementById('dueDateInput').value,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null
  });

  titleInput.value = '';
  setDirty(true);
  render();
}

function updateStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.status = status;
  task.updatedAt = nowIso();
  task.completedAt = status === 'done' ? nowIso() : null;
  setDirty(true);
  render();
}

function deleteTask(id) {
  if (!confirm('削除しますか？')) return;
  tasks = tasks.filter(t => t.id !== id);
  setDirty(true);
  render();
}

function setFilter(filter) {
  currentFilter = filter;
  render();
}

function label(value, type) {
  const maps = {
    source: { manual: '手入力', mail: 'メール', chat: 'チャット', meeting: '会議', verbal: '口頭' },
    status: { inbox: '受信箱', next: '次にやる', waiting: '誰か待ち', done: '完了' },
    priority: { high: '高', medium: '中', low: '低' }
  };
  return maps[type][value] || value;
}

function render() {
  const list = document.getElementById('taskList');
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  list.innerHTML = '';

  let filtered = tasks;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(t => t.status === currentFilter);
  }
  if (search) {
    filtered = filtered.filter(t => t.title.toLowerCase().includes(search));
  }

  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = task.status === 'done';
    check.addEventListener('change', () => updateStatus(task.id, check.checked ? 'done' : 'inbox'));

    const body = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'task-title' + (task.status === 'done' ? ' done' : '');
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const values = [
      `状態：${label(task.status, 'status')}`,
      `発生元：${label(task.source, 'source')}`,
      `優先度：${label(task.priority, 'priority')}`,
      task.dueDate ? `期限：${task.dueDate}` : '期限：未設定'
    ];
    values.forEach(v => {
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = v;
      meta.appendChild(span);
    });

    body.appendChild(title);
    body.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    [
      ['受信箱', 'inbox'],
      ['次にやる', 'next'],
      ['誰か待ち', 'waiting'],
      ['完了', 'done']
    ].forEach(([text, status]) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.disabled = task.status === status;
      btn.addEventListener('click', () => updateStatus(task.id, status));
      actions.appendChild(btn);
    });
    const del = document.createElement('button');
    del.textContent = '削除';
    del.className = 'danger';
    del.addEventListener('click', () => deleteTask(task.id));
    actions.appendChild(del);

    li.appendChild(check);
    li.appendChild(body);
    li.appendChild(actions);
    list.appendChild(li);
  });

  const counts = {
    all: tasks.length,
    inbox: tasks.filter(t => t.status === 'inbox').length,
    next: tasks.filter(t => t.status === 'next').length,
    waiting: tasks.filter(t => t.status === 'waiting').length,
    done: tasks.filter(t => t.status === 'done').length
  };
  document.getElementById('summary').textContent =
    `全件 ${counts.all}件 / 受信箱 ${counts.inbox}件 / 次にやる ${counts.next}件 / 誰か待ち ${counts.waiting}件 / 完了 ${counts.done}件`;
}

function exportJson() {
  const data = {
    appName: 'TODO Manager',
    version: '1.1',
    updatedAt: nowIso(),
    tasks
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = DB_FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = normalizeData(JSON.parse(reader.result || '{}'));
      tasks = data.tasks;
      setDirty(true);
      render();
    } catch (error) {
      alert('JSONファイルを読み込めませんでした。');
    }
  };
  reader.readAsText(file, 'utf-8');
}

window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

render();
