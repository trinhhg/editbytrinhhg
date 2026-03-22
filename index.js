// ==========================================
// 1. STATE & DATA MANAGEMENT
// ==========================================
const LORE_KEY = 'super_editor_lore_v1';
const SETTING_KEY = 'super_editor_settings_v1';

let loreData = {
    currentStoryId: null,
    stories: []
};

let appSettings = {
    theme: 'fluffy', // 'fluffy' or 'liquid'
    editorFont: "'Nunito', sans-serif",
    editorSize: "16px",
    dialogueFormat: 0,
    abnormalCaps: 0,
    regexMode: 'chapter',
    customRegex: '',
    replaceModes: {
        default: { pairs: [], matchCase: false, wholeWord: false, autoCaps: false }
    },
    currentReplaceMode: 'default'
};

// ==========================================
// 2. INITIALIZATION & UI ROUTING
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    applyThemeSettings();
    initEventListeners();
    
    renderStories();
    renderModeSelect();
    renderPairsList();
    updateEditorSettingsUI();
    
    // Khôi phục trạng thái truyện
    if (loreData.currentStoryId && loreData.stories.some(s => s.id === loreData.currentStoryId)) {
        selectStory(loreData.currentStoryId, false);
    } else {
        switchTab('dashboard');
    }
    
    document.body.classList.remove('loading');
});

function loadAllData() {
    const savedLore = localStorage.getItem(LORE_KEY);
    if (savedLore) loreData = JSON.parse(savedLore);
    
    const savedSettings = localStorage.getItem(SETTING_KEY);
    if (savedSettings) {
        let parsed = JSON.parse(savedSettings);
        appSettings = { ...appSettings, ...parsed };
        if (!appSettings.replaceModes[appSettings.currentReplaceMode]) {
            appSettings.currentReplaceMode = Object.keys(appSettings.replaceModes)[0] || 'default';
        }
    }
}

function saveLore() { localStorage.setItem(LORE_KEY, JSON.stringify(loreData)); }
function saveSettings() { localStorage.setItem(SETTING_KEY, JSON.stringify(appSettings)); }

// Thông báo
function showNotify(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `notify-toast ${type}`;
    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Chuyển Tab Chính
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-tab[data-tab="${tabId}"]`).classList.add('active');
    
    if (tabId === 'lore') renderEntityTable();
}

// Chuyển Tab Phụ (Sidebar trong)
function initEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });

    document.querySelectorAll('.inner-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            const sidebar = e.target.closest('.inner-sidebar');
            const container = e.target.closest('.layout-with-sidebar').querySelector('.inner-content');
            
            sidebar.querySelectorAll('.inner-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetId = btn.dataset.target;
            container.querySelectorAll('.inner-pane').forEach(p => p.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        };
    });

    // Theme Toggle
    document.getElementById('theme-toggle').onclick = () => {
        appSettings.theme = appSettings.theme === 'liquid' ? 'fluffy' : 'liquid';
        applyThemeSettings();
        saveSettings();
    };

    // Editor Text Counters
    document.getElementById('raw-text').addEventListener('input', function() {
        document.getElementById('count-original').innerText = this.value.trim().split(/\s+/).filter(x=>x).length;
    });
    document.getElementById('split-input-text').addEventListener('input', function() {
        document.getElementById('split-input-word-count').innerText = this.value.trim().split(/\s+/).filter(x=>x).length + ' W';
    });

    // Siêu Biên Tập
    document.getElementById('btn-super-replace').onclick = performSuperEdit;
    
    // Split Action
    document.getElementById('split-action-btn').onclick = performSplit;
    document.querySelectorAll('input[name="split-type"]').forEach(r => r.addEventListener('change', toggleSplitMode));
    document.querySelectorAll('.split-mode-btn').forEach(b => {
        b.onclick = (e) => {
            document.querySelectorAll('.split-mode-btn').forEach(btn => btn.classList.remove('active'));
            b.classList.add('active');
        };
    });

    // Editor Settings (Cards)
    document.querySelectorAll('.option-card').forEach(card => {
        card.onclick = () => {
            const group = card.dataset.group;
            const val = parseInt(card.dataset.val);
            document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            if (group === 'format') appSettings.dialogueFormat = val;
            if (group === 'abcaps') appSettings.abnormalCaps = val;
            saveSettings();
        };
    });
}

function applyThemeSettings() {
    document.documentElement.setAttribute('data-theme', appSettings.theme);
    const toggleBtn = document.getElementById('theme-toggle');
    if (appSettings.theme === 'liquid') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-droplet"></i> Liquid';
        document.querySelector('.bg-shapes').classList.remove('hidden-fluffy');
    } else {
        toggleBtn.innerHTML = '<i class="fa-solid fa-cloud"></i> Fluffy';
        document.querySelector('.bg-shapes').classList.add('hidden-fluffy');
    }

    // Font & Size
    const font = document.getElementById('setting-font').value || appSettings.editorFont;
    const size = document.getElementById('setting-size').value || appSettings.editorSize;
    appSettings.editorFont = font;
    appSettings.editorSize = size;
    document.getElementById('setting-font').value = font;
    document.getElementById('setting-size').value = size;
    
    document.documentElement.style.setProperty('--editor-font', font);
    document.documentElement.style.setProperty('--editor-font-size', size);
}

// ==========================================
// 3. DASHBOARD & LORE MASTER CRUD
// ==========================================
function getCurrentStory() {
    if (!loreData.currentStoryId) return null;
    return loreData.stories.find(s => s.id === loreData.currentStoryId);
}

function renderStories() {
    const container = document.getElementById('story-list');
    container.innerHTML = '';
    loreData.stories.forEach(story => {
        const div = document.createElement('div');
        div.className = 'story-card';
        div.onclick = (e) => { if (!e.target.closest('.btn')) selectStory(story.id); };
        div.innerHTML = `
            <h3>${story.name}</h3>
            <p>${story.desc || 'Chưa có mô tả'}</p>
            <div class="story-stats">
                <span><i class="fa-solid fa-users"></i> ${story.entities.length} Thực thể</span>
            </div>
            <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px;">
                <button class="btn btn-outline btn-sm" onclick="editStoryMeta('${story.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-outline btn-sm text-danger" onclick="deleteStory('${story.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

function selectStory(id, doSwitch = true) {
    loreData.currentStoryId = id;
    const story = getCurrentStory();
    document.getElementById('active-story-name').innerText = story.name;
    document.getElementById('active-story-badge').style.display = 'block';
    saveLore();
    if (doSwitch) switchTab('lore');
}

function saveStory() {
    const id = document.getElementById('story-id').value;
    const name = document.getElementById('story-name').value;
    if (!name) return showNotify("Thiếu tên truyện", "error");
    
    if (id) {
        const s = loreData.stories.find(x => x.id === id);
        s.name = name; s.desc = document.getElementById('story-desc').value;
    } else {
        loreData.stories.push({
            id: 's-' + Date.now(), name, desc: document.getElementById('story-desc').value,
            entities: [], relations: []
        });
    }
    saveLore(); closeModal('modal-story'); renderStories(); showNotify("Đã lưu truyện!");
    if (loreData.currentStoryId === id) document.getElementById('active-story-name').innerText = name;
}

function deleteStory(id) {
    if (confirm("Xóa truyện này và toàn bộ dữ liệu bên trong?")) {
        loreData.stories = loreData.stories.filter(x => x.id !== id);
        if (loreData.currentStoryId === id) {
            loreData.currentStoryId = null;
            document.getElementById('active-story-name').innerText = "Chưa chọn truyện";
        }
        saveLore(); renderStories();
    }
}

function editStoryMeta(id) {
    const s = loreData.stories.find(x => x.id === id);
    if (s) {
        document.getElementById('story-id').value = s.id;
        document.getElementById('story-name').value = s.name;
        document.getElementById('story-desc').value = s.desc;
        openModal('modal-story');
    }
}
function resetStoryForm() {
    document.getElementById('story-id').value = '';
    document.getElementById('story-name').value = '';
    document.getElementById('story-desc').value = '';
}

// --- ENTITY CRUD ---
const typeMap = { 'character':'Nhân vật', 'location':'Địa danh', 'faction':'Thế lực', 'item':'Vật phẩm' };
function renderEntityTable() {
    const s = getCurrentStory(); if (!s) return;
    const tbody = document.getElementById('entity-list-body');
    const filterTxt = document.getElementById('search-entity')?.value.toLowerCase() || '';
    const filterType = document.getElementById('filter-type')?.value || 'all';
    tbody.innerHTML = '';
    
    let html = '';
    s.entities.forEach((ent, idx) => {
        const aliasStr = ent.aliases.join(', ');
        if ((ent.name.toLowerCase().includes(filterTxt) || aliasStr.toLowerCase().includes(filterTxt)) && 
            (filterType === 'all' || ent.type === filterType)) {
            let badgeClass = ent.type === 'character' ? 'blue' : (ent.type === 'location' ? 'green' : (ent.type === 'faction' ? 'yellow' : 'gray'));
            html += `
                <tr>
                    <td class="text-muted">${idx + 1}</td>
                    <td class="bold text-primary">${ent.name}</td>
                    <td><span class="glass-badge ${badgeClass}" style="display:inline-block; font-size:10px; padding:2px 8px">${typeMap[ent.type]}</span></td>
                    <td class="text-sm">${aliasStr}</td>
                    <td class="text-sm text-muted">${ent.notes || ''}</td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="editEntity('${ent.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-sm btn-outline text-danger" onclick="deleteEntity('${ent.id}')"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }
    });
    tbody.innerHTML = html;
}

function saveEntity() {
    const s = getCurrentStory(); if (!s) return showNotify("Vui lòng chọn truyện trước!", "error");
    const id = document.getElementById('ent-id').value;
    const name = document.getElementById('ent-name').value.trim();
    if (!name) return showNotify("Thiếu tên chuẩn!", "error");
    
    const aliasesRaw = document.getElementById('ent-aliases').value;
    const aliases = aliasesRaw ? aliasesRaw.split(',').map(x => x.trim()).filter(x => x && x !== name) : [];

    const ent = {
        id: id || 'e-' + Date.now(),
        type: document.getElementById('ent-type').value,
        name: name,
        aliases: aliases,
        notes: document.getElementById('ent-notes').value
    };

    if (id) s.entities[s.entities.findIndex(x => x.id === id)] = ent;
    else s.entities.unshift(ent); // Thêm lên đầu cho dễ thấy
    
    saveLore(); closeModal('modal-entity'); renderEntityTable(); showNotify("Đã lưu Thực thể!");
}

function deleteEntity(id) {
    if (confirm("Xóa thực thể này?")) {
        const s = getCurrentStory();
        s.entities = s.entities.filter(x => x.id !== id);
        saveLore(); renderEntityTable();
    }
}
function editEntity(id) {
    const e = getCurrentStory().entities.find(x => x.id === id);
    document.getElementById('ent-id').value = e.id;
    document.getElementById('ent-name').value = e.name;
    document.getElementById('ent-type').value = e.type;
    document.getElementById('ent-aliases').value = e.aliases.join(', ');
    document.getElementById('ent-notes').value = e.notes;
    openModal('modal-entity');
}
function openEntityModal() {
    ['ent-id', 'ent-name', 'ent-aliases', 'ent-notes'].forEach(id => document.getElementById(id).value = '');
    openModal('modal-entity');
}

// ==========================================
// 4. SIÊU EDITOR & REPLACE LOGIC
// ==========================================
function updateEditorSettingsUI() {
    document.querySelector(`.option-card[data-group="format"][data-val="${appSettings.dialogueFormat}"]`)?.classList.add('active');
    document.querySelector(`.option-card[data-group="abcaps"][data-val="${appSettings.abnormalCaps}"]`)?.classList.add('active');
    
    // Regex Split Mode
    const radio = document.querySelector(`input[name="regex-preset"][value="${appSettings.regexMode}"]`);
    if(radio) radio.checked = true;
    document.getElementById('custom-regex-input').value = appSettings.customRegex;
}

// --- QUẢN LÝ CẶP THAY THẾ ---
function renderModeSelect() {
    const sel = document.getElementById('mode-select');
    sel.innerHTML = '';
    Object.keys(appSettings.replaceModes).forEach(m => {
        sel.add(new Option(m, m));
    });
    sel.value = appSettings.currentReplaceMode;
    sel.onchange = (e) => {
        appSettings.currentReplaceMode = e.target.value;
        saveSettings(); renderPairsList();
    };
}

function renderPairsList() {
    const mode = appSettings.replaceModes[appSettings.currentReplaceMode];
    if (!mode) return;
    
    // Cập nhật nút Toggle
    const updBtn = (id, prop, text) => {
        const btn = document.getElementById(id);
        btn.innerText = `${text}: ${mode[prop] ? 'ON' : 'OFF'}`;
        btn.className = mode[prop] ? 'btn-toggle active' : 'btn-toggle';
        btn.onclick = () => { mode[prop] = !mode[prop]; saveSettings(); renderPairsList(); };
    };
    updBtn('match-case', 'matchCase', 'Match Case');
    updBtn('whole-word', 'wholeWord', 'Whole Word');
    updBtn('auto-caps', 'autoCaps', 'Auto Caps');

    const list = document.getElementById('punctuation-list');
    list.innerHTML = '';
    mode.pairs.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'pair-item';
        div.innerHTML = `
            <span class="bold text-muted" style="width:20px">${i+1}</span>
            <input type="text" class="input-glass find" placeholder="Tìm" value="${p.find.replace(/"/g, '&quot;')}">
            <i class="fa-solid fa-arrow-right text-muted"></i>
            <input type="text" class="input-glass replace" placeholder="Thay thành" value="${(p.replace||'').replace(/"/g, '&quot;')}">
            <button class="btn-remove" onclick="removePair(${i})"><i class="fa-solid fa-xmark"></i></button>
        `;
        div.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
            p.find = div.querySelector('.find').value;
            p.replace = div.querySelector('.replace').value;
            saveSettings();
        }));
        list.appendChild(div);
    });
}
document.getElementById('add-pair').onclick = () => {
    appSettings.replaceModes[appSettings.currentReplaceMode].pairs.unshift({ find: '', replace: '' });
    saveSettings(); renderPairsList();
};
function removePair(idx) {
    appSettings.replaceModes[appSettings.currentReplaceMode].pairs.splice(idx, 1);
    saveSettings(); renderPairsList();
}

// Mode Management
document.getElementById('add-mode').onclick = () => {
    const name = prompt("Tên bộ lọc mới:");
    if(name && !appSettings.replaceModes[name]) {
        appSettings.replaceModes[name] = { pairs: [], matchCase: false, wholeWord: false, autoCaps: false };
        appSettings.currentReplaceMode = name; saveSettings(); renderModeSelect(); renderPairsList();
    }
};
document.getElementById('delete-mode').onclick = () => {
    if(confirm("Xóa bộ lọc này?") && Object.keys(appSettings.replaceModes).length > 1) {
        delete appSettings.replaceModes[appSettings.currentReplaceMode];
        appSettings.currentReplaceMode = Object.keys(appSettings.replaceModes)[0];
        saveSettings(); renderModeSelect(); renderPairsList();
    }
};

// --- CORE ALGORITHM: SIÊU BIÊN TẬP ---
function performSuperEdit() {
    const story = getCurrentStory();
    if (!story) return showNotify("Vui lòng Chọn hoặc Tạo truyện trước khi chạy Siêu Biên Tập!", "error");
    
    const rawText = document.getElementById('raw-text').value;
    if (!rawText.trim()) return showNotify("Chưa có văn bản!", "error");

    const mode = appSettings.replaceModes[appSettings.currentReplaceMode];
    let text = rawText.normalize('NFC')
                .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E\u301D-\u301F\uFF02\u02DD]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u275B\u275C\u276E\u276F\uA78C\uFF07]/g, "'");
    
    let stats = { replace: 0, caps: 0, entities: 0 };
    let extractedNames = new Set();
    
    // 1. CHẠY REPLACE (Single-Pass)
    if (mode.pairs.length > 0) {
        const rules = mode.pairs.filter(p => p.find.trim()).sort((a,b) => b.find.length - a.find.length);
        if (rules.length > 0) {
            const replaceMap = {};
            rules.forEach(r => replaceMap[r.find.toLowerCase()] = r.replace);
            
            const escapedTerms = rules.map(r => r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const flags = mode.matchCase ? 'gu' : 'giu';
            const regex = mode.wholeWord 
                ? new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedTerms})(?![\\p{L}\\p{N}_])`, flags)
                : new RegExp(`(${escapedTerms})`, flags);
            
            text = text.replace(regex, (match) => {
                stats.replace++;
                let replacement = replaceMap[match.toLowerCase()] || match;
                if (!mode.matchCase) {
                    if (match === match.toUpperCase() && match !== match.toLowerCase()) replacement = replacement.toUpperCase();
                    else if (match[0] === match[0].toUpperCase()) replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
                }
                return `\uE000${replacement}\uE001`; // Bọc để bảo vệ
            });
        }
    }

    // 2. ABNORMAL CAPS
    if (appSettings.abnormalCaps === 1) {
        text = text.replace(/(?<=[\p{Ll},;]\s+)([\p{Lu}][\p{Ll}]+)/gum, (match, p1) => {
            // Không hạ cấp nếu nó đã bị bọc bảo vệ E000
            if (match.includes('\uE000')) return match;
            return p1.toLowerCase();
        });
    }

    // 3. AUTO CAPS (Sau dấu chấm, chấm hỏi, ngoặc kép)
    if (mode.autoCaps) {
        const autoCapsRegex = /(^|[.?!]\s+|:\s*["“]\s*)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu;
        text = text.replace(autoCapsRegex, (match, prefix, mStart, mContent, mEnd, rawWord) => {
            let targetWord = mContent || rawWord;
            if (!targetWord) return match;
            let capped = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
            if (mStart) { stats.caps++; return `${prefix}\uE000${capped}\uE001`; }
            if (rawWord.charAt(0) !== rawWord.charAt(0).toUpperCase()) {
                stats.caps++; return `${prefix}\uE002${capped}\uE003`; // E002 là AutoCaps
            }
            return match;
        });
    }

    // 4. FORMAT HỘI THOẠI
    if (appSettings.dialogueFormat > 0) {
        const dRegex = /(^|[\n])([^:\n]+):\s*(?:\n\s*)?([“"'])([\s\S]*?)([”"'])/gm;
        text = text.replace(dRegex, (match, p1, p2, p3, p4) => {
            const context = p2.trim(), content = p4.trim();
            if (appSettings.dialogueFormat === 1) return `${p1}${context}: "${content}"`;
            if (appSettings.dialogueFormat === 2) return `${p1}${context}:\n\n"${content}"`;
            if (appSettings.dialogueFormat === 3) return `${p1}${context}:\n\n- ${content}`;
            return match;
        });
    }

    // 5. EXTRACT NEW ENTITIES & HIGHLIGHT EXISTING LORE
    // Gom tất cả tên Thực thể hiện có để tránh extract trùng
    let existingNames = [];
    story.entities.forEach(e => { existingNames.push(e.name.toLowerCase()); e.aliases.forEach(a => existingNames.push(a.toLowerCase())); });
    
    // Xóa rác và bảo vệ các từ đã Replace
    let cleanTextForExtraction = text.replace(/\uE000.*?\uE001|\uE002.*?\uE003/g, ' '); 

    const extractLogic = (match, p1) => {
        const entity = p1.trim();
        if (entity && !existingNames.includes(entity.toLowerCase())) {
            extractedNames.add(entity);
        }
        return match;
    };

    // Màng 1: Giữa câu (Mọi độ dài)
    cleanTextForExtraction.replace(/(?<!^[^\S\n]*|(?:\.|\?|!|\n)\s*)([\p{Lu}][\p{Ll}]*(?:\s+[\p{Lu}][\p{Ll}]*)*)/gu, extractLogic);
    // Màng 2: Đầu câu / Sau dấu (>= 2 âm tiết)
    cleanTextForExtraction.replace(/(?:^[^\S\n]*|(?:\.|\?|!|\n)\s*)([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+)+)/gu, extractLogic);

    // Tự động thêm vào cơ sở dữ liệu truyện
    const newEntitiesArray = Array.from(extractedNames);
    if (newEntitiesArray.length > 0) {
        newEntitiesArray.forEach(name => {
            story.entities.unshift({
                id: 'e-' + Date.now() + Math.random(),
                type: 'character', name: name, aliases: [], notes: 'Auto-extracted'
            });
        });
        saveLore();
        stats.entities = newEntitiesArray.length;
    }

    // 6. RENDER HTML CHO EDITOR KẾT QUẢ
    text = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '').join('\n\n'); // Spacing
    
    // Highlight Regex cho tất cả entities trong truyện (Sắp xếp dài lên trước)
    const allLoreNames = [];
    story.entities.forEach(e => { allLoreNames.push(e.name); allLoreNames.push(...e.aliases); });
    allLoreNames.sort((a,b) => b.length - a.length);

    let finalHTML = text;
    if (allLoreNames.length > 0) {
        const escapedLore = allLoreNames.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const loreRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedLore})(?![\\p{L}\\p{N}_])`, 'g');
        // Tránh replace đè vào các tag \uE000
        const parts = finalHTML.split(/(\uE000.*?\uE001|\uE002.*?\uE003)/);
        finalHTML = parts.map(part => {
            if (part.startsWith('\uE000') || part.startsWith('\uE002')) return part;
            return part.replace(loreRegex, '<mark class="hl-lore">$1</mark>');
        }).join('');
    }

    // Đổi tag đặc biệt thành span
    finalHTML = finalHTML
        .replace(/\n/g, '<br>')
        .replace(/\uE000(.*?)\uE001/g, '<mark class="hl-replaced">$1</mark>')
        .replace(/\uE002(.*?)\uE003/g, '<mark class="hl-new-entity">$1</mark>'); // AutoCaps color

    // Update UI
    const out = document.getElementById('processed-output');
    out.innerHTML = finalHTML;
    document.getElementById('count-replace').innerText = stats.replace;
    document.getElementById('count-caps').innerText = stats.caps;
    document.getElementById('count-new-entities').innerText = stats.entities;
    document.getElementById('count-result').innerText = out.innerText.trim().split(/\s+/).filter(x=>x).length;
    
    showNotify(`Thành công! Phát hiện ${stats.entities} danh từ mới.`);
}

function clearEditor() {
    document.getElementById('raw-text').value = '';
    document.getElementById('processed-output').innerHTML = '';
    ['original','replace','caps','new-entities','result'].forEach(id => document.getElementById(`count-${id}`).innerText = '0');
}

function copyResult() {
    const t = document.getElementById('processed-output').innerText;
    if (t) {
        navigator.clipboard.writeText(t).then(() => showNotify("Đã sao chép kết quả!"));
    }
}

// ==========================================
// 5. CHIA CHƯƠNG LOGIC
// ==========================================
function toggleSplitMode() {
    const isRegex = document.querySelector('input[name="split-type"][value="regex"]').checked;
    document.getElementById('split-type-count').classList.toggle('hidden', isRegex);
    document.getElementById('split-type-regex').classList.toggle('hidden', !isRegex);
}

function getSplitRegex() {
    const radioVal = document.querySelector('input[name="regex-preset"]:checked')?.value || appSettings.regexMode;
    if (radioVal === 'chapter') return /(?:Chương|Chapter)\s+\d+(?:[:.-]\s*.*)?/gi;
    if (radioVal === 'book') return /(?:Hồi|Quyển)\s+(?:\d+|[IVXLCDM]+)(?:[:.-]\s*.*)?/gi;
    if (radioVal === 'custom' && document.getElementById('custom-regex-input').value) {
        try { return new RegExp(document.getElementById('custom-regex-input').value, 'gmi'); } catch(e) { return null; }
    }
    return null;
}

function performSplit() {
    const text = document.getElementById('split-input-text').value.trim();
    if (!text) return showNotify("Chưa có nội dung để chia!", "error");
    
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = '';
    const isRegex = document.querySelector('input[name="split-type"][value="regex"]').checked;
    
    let parts = [];
    if (isRegex) {
        const regex = getSplitRegex();
        if (!regex) return showNotify("Regex không hợp lệ!", "error");
        const matches = [...text.matchAll(regex)];
        if (matches.length === 0) return showNotify("Không tìm thấy chương nào trùng khớp Regex!", "error");
        
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = (i < matches.length - 1) ? matches[i+1].index : text.length;
            const content = text.substring(start, end).trim();
            parts.push({ title: content.split('\n')[0].trim(), content });
        }
    } else {
        const numParts = parseInt(document.querySelector('.split-mode-btn.active').dataset.split);
        const paragraphs = text.split('\n').filter(p => p.trim());
        const totalWords = text.split(/\s+/).length;
        const targetWords = Math.ceil(totalWords / numParts);
        
        let currentPart = [], currentCount = 0;
        for (let p of paragraphs) {
            const wCount = p.split(/\s+/).length;
            if (currentCount + wCount > targetWords && parts.length < numParts - 1) {
                parts.push({ title: `Phần ${parts.length + 1}`, content: currentPart.join('\n\n') });
                currentPart = [p]; currentCount = wCount;
            } else {
                currentPart.push(p); currentCount += wCount;
            }
        }
        if (currentPart.length) parts.push({ title: `Phần ${parts.length + 1}`, content: currentPart.join('\n\n') });
    }

    parts.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'split-card glass-panel';
        const wCount = p.content.split(/\s+/).filter(x=>x).length;
        card.innerHTML = `
            <div class="split-card-header">
                <span title="${p.title}">${p.title.substring(0,25)}...</span>
                <span class="badge-small">${wCount} W</span>
            </div>
            <textarea class="custom-scrollbar flex-1" readonly style="border:none; padding:10px; resize:none">${p.content}</textarea>
            <div class="split-footer" style="padding:10px; border-top:1px solid rgba(0,0,0,0.05)">
                <button class="btn btn-success w-100 copy-split"><i class="fa-regular fa-copy"></i> Copy Phần ${i+1}</button>
            </div>
        `;
        card.querySelector('.copy-split').onclick = (e) => {
            navigator.clipboard.writeText(p.content).then(() => {
                const btn = e.target;
                const old = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Copy';
                setTimeout(() => btn.innerHTML = old, 1500);
            });
        };
        wrapper.appendChild(card);
    });
    showNotify(`Đã chia thành ${parts.length} phần!`);
}

// ==========================================
// 6. UTILS (Modal, CSV)
// ==========================================
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function resetAllData() {
    if (confirm("Lưu ý: Thao tác này sẽ XÓA TOÀN BỘ dữ liệu Truyện, Cài đặt và Lịch sử biên tập. Bạn có chắc chắn?")) {
        localStorage.removeItem(LORE_KEY);
        localStorage.removeItem(SETTING_KEY);
        location.reload();
    }
}
