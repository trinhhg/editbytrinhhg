// ==========================================
// 1. STATE & DATA MANAGEMENT
// ==========================================
const LORE_KEY = 'super_editor_lore_v2';
const SETTING_KEY = 'super_editor_settings_v2';

let loreData = {
    currentStoryId: null,
    stories: []
};

let appSettings = {
    theme: 'fluffy', 
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
// 2. INITIALIZATION & BINDINGS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    window.applyThemeSettings();
    initEventListeners();
    
    window.renderStories();
    window.renderModeSelect();
    window.renderPairsList();
    updateEditorSettingsUI();
    renderSplitPlaceholders(parseInt(document.querySelector('.split-mode-btn.active').dataset.split) || 2);
    
    if (loreData.currentStoryId && loreData.stories.some(s => s.id === loreData.currentStoryId)) {
        window.selectStory(loreData.currentStoryId, false);
    } else {
        window.switchTab('dashboard');
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

window.saveLore = function() { localStorage.setItem(LORE_KEY, JSON.stringify(loreData)); }
window.saveSettings = function() { localStorage.setItem(SETTING_KEY, JSON.stringify(appSettings)); }

window.showNotify = function(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `notify-toast ${type} theme-element`;
    let icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
    toast.innerHTML = `${icon} <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-tab[data-tab="${tabId}"]`)?.classList.add('active');
    
    if (tabId === 'lore') window.renderEntityTable();
}

function initEventListeners() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.onclick = () => window.switchTab(btn.dataset.tab);
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

    document.getElementById('theme-toggle').onclick = () => {
        appSettings.theme = appSettings.theme === 'liquid' ? 'fluffy' : 'liquid';
        window.applyThemeSettings();
        window.saveSettings();
    };

    document.getElementById('raw-text').addEventListener('input', function() {
        document.getElementById('count-original').innerText = this.value.trim().split(/\s+/).filter(x=>x).length;
    });
    document.getElementById('split-input-text').addEventListener('input', function() {
        document.getElementById('split-input-word-count').innerText = this.value.trim().split(/\s+/).filter(x=>x).length + ' W';
    });

    document.getElementById('btn-super-replace').onclick = window.performSuperEdit;
    
    // Split Events
    document.getElementById('split-action-btn').onclick = window.performSplit;
    document.querySelectorAll('input[name="split-type"]').forEach(r => r.addEventListener('change', window.toggleSplitMode));
    document.querySelectorAll('.split-mode-btn').forEach(b => {
        b.onclick = (e) => {
            document.querySelectorAll('.split-mode-btn').forEach(btn => btn.classList.remove('active'));
            b.classList.add('active');
            // Cập nhật giao diện thẻ trống ngay khi chọn số
            if (document.querySelector('input[name="split-type"][value="count"]').checked) {
                renderSplitPlaceholders(parseInt(b.dataset.split));
            }
        };
    });

    // Editor Setting Cards
    document.querySelectorAll('.option-card').forEach(card => {
        card.onclick = () => {
            const group = card.dataset.group;
            const val = parseInt(card.dataset.val);
            document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            if (group === 'format') appSettings.dialogueFormat = val;
            if (group === 'abcaps') appSettings.abnormalCaps = val;
            window.saveSettings();
        };
    });
}

window.applyThemeSettings = function() {
    document.documentElement.setAttribute('data-theme', appSettings.theme);
    const toggleBtn = document.getElementById('theme-toggle');
    if (appSettings.theme === 'liquid') {
        toggleBtn.innerHTML = '<i class="fa-solid fa-droplet"></i> Liquid';
        document.querySelector('.bg-shapes').classList.remove('hidden-fluffy');
    } else {
        toggleBtn.innerHTML = '<i class="fa-solid fa-cloud"></i> Fluffy';
        document.querySelector('.bg-shapes').classList.add('hidden-fluffy');
    }
}

// ==========================================
// 3. DASHBOARD & LORE MASTER
// ==========================================
window.getCurrentStory = function() {
    if (!loreData.currentStoryId) return null;
    return loreData.stories.find(s => s.id === loreData.currentStoryId);
}

window.renderStories = function() {
    const container = document.getElementById('story-list');
    container.innerHTML = '';
    loreData.stories.forEach(story => {
        const div = document.createElement('div');
        div.className = 'story-card theme-panel';
        div.onclick = (e) => { if (!e.target.closest('.btn')) window.selectStory(story.id); };
        div.innerHTML = `
            <h3>${story.name}</h3>
            <p>${story.desc || 'Chưa có mô tả'}</p>
            <div class="bold text-primary mt-10"><i class="fa-solid fa-users"></i> ${story.entities.length} Thực thể</div>
            <div style="position:absolute; top:15px; right:15px; display:flex; gap:5px;">
                <button class="btn btn-outline btn-sm theme-element" onclick="editStoryMeta('${story.id}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-outline btn-sm theme-element text-danger" onclick="deleteStory('${story.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });
}

window.selectStory = function(id, doSwitch = true) {
    loreData.currentStoryId = id;
    const story = window.getCurrentStory();
    document.getElementById('active-story-name').innerText = story.name;
    document.getElementById('active-story-badge').style.display = 'block';
    window.saveLore();
    if (doSwitch) window.switchTab('lore');
}

window.saveStory = function() {
    const id = document.getElementById('story-id').value;
    const name = document.getElementById('story-name').value;
    if (!name) return window.showNotify("Thiếu tên truyện", "error");
    
    if (id) {
        const s = loreData.stories.find(x => x.id === id);
        s.name = name; s.desc = document.getElementById('story-desc').value;
    } else {
        loreData.stories.push({ id: 's-' + Date.now(), name, desc: document.getElementById('story-desc').value, entities: [], relations: [] });
    }
    window.saveLore(); window.closeModal('modal-story'); window.renderStories(); window.showNotify("Đã lưu truyện!");
    if (loreData.currentStoryId === id) document.getElementById('active-story-name').innerText = name;
}

window.resetStoryForm = function() {
    document.getElementById('story-id').value = '';
    document.getElementById('story-name').value = '';
    document.getElementById('story-desc').value = '';
}

window.deleteStory = function(id) {
    if (confirm("Xóa truyện này và toàn bộ dữ liệu?")) {
        loreData.stories = loreData.stories.filter(x => x.id !== id);
        if (loreData.currentStoryId === id) { loreData.currentStoryId = null; document.getElementById('active-story-badge').style.display = 'none'; }
        window.saveLore(); window.renderStories();
    }
}

// --- ENTITY CRUD ---
const typeMap = { 'character':'Nhân vật', 'location':'Địa danh', 'faction':'Thế lực', 'item':'Vật phẩm' };
window.renderEntityTable = function() {
    const s = window.getCurrentStory(); if (!s) return;
    const tbody = document.getElementById('entity-list-body');
    const filterTxt = document.getElementById('search-entity').value.toLowerCase();
    const filterType = document.getElementById('filter-type').value;
    
    let html = '';
    s.entities.forEach((ent, idx) => {
        const aliasStr = ent.aliases.join(', ');
        if ((ent.name.toLowerCase().includes(filterTxt) || aliasStr.toLowerCase().includes(filterTxt)) && (filterType === 'all' || ent.type === filterType)) {
            let badgeClass = ent.type === 'character' ? 'blue' : (ent.type === 'location' ? 'green' : (ent.type === 'faction' ? 'yellow' : 'gray'));
            html += `<tr>
                <td class="text-muted">${idx + 1}</td>
                <td class="bold text-primary">${ent.name}</td>
                <td><span class="badge-theme ${badgeClass}" style="padding:4px 8px; font-size:11px">${typeMap[ent.type] || ent.type}</span></td>
                <td class="text-sm">${aliasStr}</td>
                <td>
                    <button class="btn btn-sm btn-outline theme-element" onclick="editEntity('${ent.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline theme-element text-danger" onclick="deleteEntity('${ent.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        }
    });
    tbody.innerHTML = html;
}

window.saveEntity = function() {
    const s = window.getCurrentStory(); if (!s) return window.showNotify("Chọn truyện trước!", "error");
    const id = document.getElementById('ent-id').value;
    const name = document.getElementById('ent-name').value.trim();
    if (!name) return window.showNotify("Thiếu tên chuẩn!", "error");
    
    const aliases = document.getElementById('ent-aliases').value ? document.getElementById('ent-aliases').value.split(',').map(x => x.trim()).filter(x => x && x !== name) : [];
    const ent = { id: id || 'e-' + Date.now(), type: document.getElementById('ent-type').value, name: name, aliases: aliases, notes: document.getElementById('ent-notes').value };

    if (id) s.entities[s.entities.findIndex(x => x.id === id)] = ent;
    else s.entities.unshift(ent);
    
    window.saveLore(); window.closeModal('modal-entity'); window.renderEntityTable(); window.showNotify("Đã lưu Thực thể!");
}

window.deleteEntity = function(id) {
    if (confirm("Xóa thực thể này?")) {
        const s = window.getCurrentStory();
        s.entities = s.entities.filter(x => x.id !== id);
        window.saveLore(); window.renderEntityTable();
    }
}
window.editEntity = function(id) {
    const e = window.getCurrentStory().entities.find(x => x.id === id);
    document.getElementById('ent-id').value = e.id; document.getElementById('ent-name').value = e.name;
    document.getElementById('ent-type').value = e.type; document.getElementById('ent-aliases').value = e.aliases.join(', ');
    document.getElementById('ent-notes').value = e.notes;
    window.openModal('modal-entity');
}
window.openEntityModal = function() {
    ['ent-id', 'ent-name', 'ent-aliases', 'ent-notes'].forEach(id => document.getElementById(id).value = '');
    window.openModal('modal-entity');
}

// ==========================================
// 4. SIÊU EDITOR & REPLACE LOGIC
// ==========================================
function updateEditorSettingsUI() {
    document.querySelector(`.option-card[data-group="format"][data-val="${appSettings.dialogueFormat}"]`)?.classList.add('active');
    document.querySelector(`.option-card[data-group="abcaps"][data-val="${appSettings.abnormalCaps}"]`)?.classList.add('active');
    document.getElementById('custom-regex-input').value = appSettings.customRegex;
}

window.renderModeSelect = function() {
    const sel = document.getElementById('mode-select');
    sel.innerHTML = '';
    Object.keys(appSettings.replaceModes).forEach(m => sel.add(new Option(m, m)));
    sel.value = appSettings.currentReplaceMode;
    sel.onchange = (e) => { appSettings.currentReplaceMode = e.target.value; window.saveSettings(); window.renderPairsList(); };
}

window.renderPairsList = function() {
    const mode = appSettings.replaceModes[appSettings.currentReplaceMode];
    if (!mode) return;
    
    const updBtn = (id, prop, text) => {
        const btn = document.getElementById(id);
        btn.innerText = `${text}: ${mode[prop] ? 'ON' : 'OFF'}`;
        btn.className = mode[prop] ? 'btn-toggle theme-element active' : 'btn-toggle theme-element';
        btn.onclick = () => { mode[prop] = !mode[prop]; window.saveSettings(); window.renderPairsList(); };
    };
    updBtn('match-case', 'matchCase', 'Match Case');
    updBtn('whole-word', 'wholeWord', 'Whole Word');
    updBtn('auto-caps', 'autoCaps', 'Auto Caps');

    const list = document.getElementById('punctuation-list');
    list.innerHTML = '';
    mode.pairs.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'pair-item theme-element';
        div.innerHTML = `
            <span class="bold text-muted" style="width:20px">${i+1}</span>
            <input type="text" class="input-theme find flex-1" placeholder="Tìm" value="${p.find.replace(/"/g, '&quot;')}">
            <i class="fa-solid fa-arrow-right text-muted"></i>
            <input type="text" class="input-theme replace flex-1" placeholder="Thay thành" value="${(p.replace||'').replace(/"/g, '&quot;')}">
            <button class="btn-remove" onclick="removePair(${i})"><i class="fa-solid fa-xmark"></i></button>
        `;
        div.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
            p.find = div.querySelector('.find').value; p.replace = div.querySelector('.replace').value; window.saveSettings();
        }));
        list.appendChild(div);
    });
}

document.getElementById('add-pair').onclick = () => {
    appSettings.replaceModes[appSettings.currentReplaceMode].pairs.unshift({ find: '', replace: '' });
    window.saveSettings(); window.renderPairsList();
};
window.removePair = function(idx) {
    appSettings.replaceModes[appSettings.currentReplaceMode].pairs.splice(idx, 1);
    window.saveSettings(); window.renderPairsList();
}
document.getElementById('add-mode').onclick = () => {
    const name = prompt("Tên bộ lọc mới:");
    if(name && !appSettings.replaceModes[name]) {
        appSettings.replaceModes[name] = { pairs: [], matchCase: false, wholeWord: false, autoCaps: false };
        appSettings.currentReplaceMode = name; window.saveSettings(); window.renderModeSelect(); window.renderPairsList();
    }
};

window.performSuperEdit = function() {
    const story = window.getCurrentStory();
    if (!story) return window.showNotify("Vui lòng Chọn hoặc Tạo truyện (Tab Truyện) trước!", "error");
    
    const rawText = document.getElementById('raw-text').value;
    if (!rawText.trim()) return window.showNotify("Chưa có văn bản!", "error");

    const mode = appSettings.replaceModes[appSettings.currentReplaceMode];
    let text = rawText.normalize('NFC')
                .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E\u301D-\u301F\uFF02\u02DD]/g, '"')
                .replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u275B\u275C\u276E\u276F\uA78C\uFF07]/g, "'");
    
    let stats = { replace: 0, caps: 0, entities: 0 };
    let extractedNames = new Set();
    
    // 1. CHẠY REPLACE
    if (mode.pairs.length > 0) {
        const rules = mode.pairs.filter(p => p.find.trim()).sort((a,b) => b.find.length - a.find.length);
        if (rules.length > 0) {
            const replaceMap = {};
            rules.forEach(r => replaceMap[r.find.toLowerCase()] = r.replace);
            const escapedTerms = rules.map(r => r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
            const flags = mode.matchCase ? 'gu' : 'giu';
            const regex = mode.wholeWord ? new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedTerms})(?![\\p{L}\\p{N}_])`, flags) : new RegExp(`(${escapedTerms})`, flags);
            
            text = text.replace(regex, (match) => {
                stats.replace++;
                let replacement = replaceMap[match.toLowerCase()] || match;
                if (!mode.matchCase) {
                    if (match === match.toUpperCase() && match !== match.toLowerCase()) replacement = replacement.toUpperCase();
                    else if (match[0] === match[0].toUpperCase()) replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
                }
                return `\uE000${replacement}\uE001`; 
            });
        }
    }

    // 2. AUTO CAPS & ABNORMAL
    if (appSettings.abnormalCaps === 1) {
        text = text.replace(/(?<=[\p{Ll},;]\s+)([\p{Lu}][\p{Ll}]+)/gum, (match, p1) => {
            if (match.includes('\uE000')) return match; return p1.toLowerCase();
        });
    }
    if (mode.autoCaps) {
        const autoCapsRegex = /(^|[.?!]\s+|:\s*["“]\s*)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu;
        text = text.replace(autoCapsRegex, (match, prefix, mStart, mContent, mEnd, rawWord) => {
            let targetWord = mContent || rawWord;
            if (!targetWord) return match;
            let capped = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
            if (mStart) { stats.caps++; return `${prefix}\uE000${capped}\uE001`; }
            if (rawWord.charAt(0) !== rawWord.charAt(0).toUpperCase()) {
                stats.caps++; return `${prefix}\uE002${capped}\uE003`; 
            }
            return match;
        });
    }

    // 3. DIALOGUE FORMAT
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

    // 4. QUÉT TỰ ĐỘNG THỰC THỂ (BẮT BUỘC TỪ 2 ÂM TIẾT TRỞ LÊN ĐỂ LOẠI RÁC ĐẦU CÂU)
    let existingNames = [];
    story.entities.forEach(e => { existingNames.push(e.name.toLowerCase()); e.aliases.forEach(a => existingNames.push(a.toLowerCase())); });
    
    let cleanTextForExtraction = text.replace(/\uE000.*?\uE001|\uE002.*?\uE003/g, ' '); 
    
    // Regex: Chỉ bắt các cụm có TỪ 2 CHỮ VIẾT HOA TRỞ LÊN (vd: Trần Phàm, Thiên Ma Tông). Bỏ qua "Hắn", "Nhưng", "Hôm".
    const extractRegex = /([\p{Lu}][\p{Ll}]*(?:[\s_]+[\p{Lu}][\p{Ll}]*)+)/gu;
    
    cleanTextForExtraction.replace(extractRegex, (match, p1) => {
        const entity = p1.trim();
        if (entity && !existingNames.includes(entity.toLowerCase())) extractedNames.add(entity);
        return match;
    });

    const newEntitiesArray = Array.from(extractedNames);
    if (newEntitiesArray.length > 0) {
        newEntitiesArray.forEach(name => {
            story.entities.unshift({ id: 'e-' + Date.now() + Math.random(), type: 'character', name: name, aliases: [], notes: 'Auto' });
        });
        window.saveLore();
        stats.entities = newEntitiesArray.length;
    }

    // 5. RENDER HTML
    text = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '').join('\n\n'); 
    let finalHTML = text;
    
    // Highlight Lore
    const allLoreNames = [];
    story.entities.forEach(e => { allLoreNames.push(e.name); allLoreNames.push(...e.aliases); });
    allLoreNames.sort((a,b) => b.length - a.length);

    if (allLoreNames.length > 0) {
        const escapedLore = allLoreNames.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const loreRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${escapedLore})(?![\\p{L}\\p{N}_])`, 'g');
        const parts = finalHTML.split(/(\uE000.*?\uE001|\uE002.*?\uE003)/);
        finalHTML = parts.map(part => {
            if (part.startsWith('\uE000') || part.startsWith('\uE002')) return part;
            return part.replace(loreRegex, '<mark class="hl-lore">$1</mark>');
        }).join('');
    }

    finalHTML = finalHTML
        .replace(/\n/g, '<br>')
        .replace(/\uE000(.*?)\uE001/g, '<mark class="hl-replaced">$1</mark>')
        .replace(/\uE002(.*?)\uE003/g, '<mark class="hl-new-entity">$1</mark>');

    const out = document.getElementById('processed-output');
    out.innerHTML = finalHTML;
    document.getElementById('count-replace').innerText = stats.replace;
    document.getElementById('count-caps').innerText = stats.caps;
    document.getElementById('count-new-entities').innerText = stats.entities;
    document.getElementById('count-result').innerText = out.innerText.trim().split(/\s+/).filter(x=>x).length;
    
    window.showNotify(`Hoàn tất! Cập nhật thêm ${stats.entities} danh từ vào Tab Thực Thể.`);
}

window.clearEditor = function() {
    document.getElementById('raw-text').value = '';
    document.getElementById('processed-output').innerHTML = '';
    ['original','replace','caps','new-entities','result'].forEach(id => document.getElementById(`count-${id}`).innerText = '0');
}

window.copyResult = function() {
    const t = document.getElementById('processed-output').innerText;
    if (t) navigator.clipboard.writeText(t).then(() => window.showNotify("Đã sao chép kết quả!"));
}

// ==========================================
// 5. CHIA CHƯƠNG LOGIC
// ==========================================
window.toggleSplitMode = function() {
    const isRegex = document.querySelector('input[name="split-type"][value="regex"]').checked;
    document.getElementById('split-type-count').classList.toggle('hidden', isRegex);
    document.getElementById('split-type-regex').classList.toggle('hidden', !isRegex);
    
    // Nếu chuyển sang số phần thì render lại khung trống
    if (!isRegex) {
        const activeBtn = document.querySelector('.split-mode-btn.active');
        if (activeBtn) renderSplitPlaceholders(parseInt(activeBtn.dataset.split));
    } else {
        document.getElementById('split-outputs-wrapper').innerHTML = ''; // Clear regex placeholders
    }
}

function renderSplitPlaceholders(count) {
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        wrapper.innerHTML += `
            <div class="split-card theme-panel flex-col">
                <div class="split-card-header flex-between">
                    <span>Phần ${i} (Chờ kết quả...)</span>
                    <span class="badge-theme gray">0 W</span>
                </div>
                <textarea class="custom-scrollbar flex-1" readonly placeholder="Kết quả phần ${i} sẽ hiện ở đây..."></textarea>
                <div class="box-footer p-15">
                    <button class="btn btn-outline theme-element w-100"><i class="fa-regular fa-copy"></i> Copy Phần ${i}</button>
                </div>
            </div>`;
    }
}

window.performSplit = function() {
    const text = document.getElementById('split-input-text').value.trim();
    if (!text) return window.showNotify("Chưa có nội dung để chia!", "error");
    
    const wrapper = document.getElementById('split-outputs-wrapper');
    const isRegex = document.querySelector('input[name="split-type"][value="regex"]').checked;
    
    let parts = [];
    if (isRegex) {
        const regexVal = document.getElementById('quick-regex-select').value;
        let regexObj;
        if (regexVal === 'chapter') regexObj = /(?:Chương|Chapter)\s+\d+(?:[:.-]\s*.*)?/gi;
        else if (regexVal === 'book') regexObj = /(?:Hồi|Quyển)\s+(?:\d+|[IVXLCDM]+)(?:[:.-]\s*.*)?/gi;
        else {
            try { regexObj = new RegExp(document.getElementById('custom-regex-input').value, 'gmi'); } 
            catch(e) { return window.showNotify("Regex Tự Chọn lỗi!", "error"); }
        }
        
        const matches = [...text.matchAll(regexObj)];
        if (matches.length === 0) return window.showNotify("Không tìm thấy chương nào trùng khớp!", "error");
        
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = (i < matches.length - 1) ? matches[i+1].index : text.length;
            const content = text.substring(start, end).trim();
            parts.push({ title: content.split('\n')[0].trim(), content });
        }
    } else {
        const numParts = parseInt(document.querySelector('.split-mode-btn.active').dataset.split);
        const paragraphs = text.split('\n').filter(p => p.trim());
        const targetWords = Math.ceil(text.split(/\s+/).length / numParts);
        
        let currentPart = [], currentCount = 0;
        for (let p of paragraphs) {
            const wCount = p.split(/\s+/).length;
            if (currentCount + wCount > targetWords && parts.length < numParts - 1) {
                parts.push({ title: `Phần ${parts.length + 1}`, content: currentPart.join('\n\n') });
                currentPart = [p]; currentCount = wCount;
            } else { currentPart.push(p); currentCount += wCount; }
        }
        if (currentPart.length) parts.push({ title: `Phần ${parts.length + 1}`, content: currentPart.join('\n\n') });
    }

    wrapper.innerHTML = '';
    parts.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'split-card theme-panel flex-col';
        const wCount = p.content.split(/\s+/).filter(x=>x).length;
        card.innerHTML = `
            <div class="split-card-header flex-between">
                <span title="${p.title}" class="bold text-primary">${p.title.substring(0,25)}...</span>
                <span class="badge-theme blue">${wCount} W</span>
            </div>
            <textarea class="custom-scrollbar flex-1" readonly style="border:none; padding:15px; resize:none; background:transparent;">${p.content}</textarea>
            <div class="box-footer p-15">
                <button class="btn btn-success theme-btn w-100 copy-split"><i class="fa-regular fa-copy"></i> Copy Phần ${i+1}</button>
            </div>
        `;
        card.querySelector('.copy-split').onclick = (e) => {
            navigator.clipboard.writeText(p.content).then(() => {
                const btn = e.target; const old = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã Copy';
                setTimeout(() => btn.innerHTML = old, 1500);
            });
        };
        wrapper.appendChild(card);
    });
    window.showNotify(`Đã chia thành ${parts.length} phần!`);
}

// ==========================================
// 6. UTILS (MODAL & IMPORT/EXPORT)
// ==========================================
window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); }
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); }

// Import/Export placeholder (Để tránh lỗi HTML gọi hàm thiếu)
window.triggerImport = function(type) { document.getElementById(`csv-upload-${type}`).click(); }
window.processImportEntity = function(input) { window.showNotify("Tính năng Import CSV đang cập nhật", "warning"); input.value = ''; }
window.exportEntityCSV = function() { window.showNotify("Tính năng Export CSV đang cập nhật", "warning"); }
window.processImportRelation = function(input) { window.showNotify("Tính năng Import CSV đang cập nhật", "warning"); input.value = ''; }
window.exportRelationCSV = function() { window.showNotify("Tính năng Export CSV đang cập nhật", "warning"); }
window.openRelationModal = function() { window.showNotify("Bảng Quan Hệ đang được nâng cấp", "warning"); }
window.saveRelation = function() { window.showNotify("Tính năng lưu quan hệ đang cập nhật", "warning"); }

window.resetAllData = function() {
    if (confirm("Lưu ý: XÓA TOÀN BỘ dữ liệu Truyện và Cài đặt. Bạn có chắc chắn?")) {
        localStorage.removeItem(LORE_KEY);
        localStorage.removeItem(SETTING_KEY);
        location.reload();
    }
}
