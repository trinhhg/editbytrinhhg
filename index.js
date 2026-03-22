// =========================================================================
// 1. CẤU TRÚC DỮ LIỆU & BIẾN TOÀN CỤC
// =========================================================================
const STORAGE_KEY = 'LoreMasterPro_Data_v1';
const MARK_REP_S = '\uE000', MARK_REP_E = '\uE001';
const MARK_CAP_S = '\uE002', MARK_CAP_E = '\uE003';
const MARK_B_S = '\uE004',   MARK_B_E = '\uE005';

const ENTITY_TYPES = {
    'character': { label: 'Nhân vật', css: 'character' },
    'location': { label: 'Địa danh', css: 'location' },
    'faction': { label: 'Thế lực', css: 'faction' },
    'org': { label: 'Tổ chức', css: 'org' },
    'title': { label: 'Danh hiệu', css: 'title' },
    'item': { label: 'Vật phẩm', css: 'item' }
};

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    currentProjectId: null,
    projects: []
};

let saveTimeout;

// =========================================================================
// 2. HELPER & UTILITIES (THÔNG BÁO, NORMALIZER, CSV PARSER)
// =========================================================================
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }
function getActiveProject() { return appData.projects.find(p => p.id === appData.currentProjectId); }

function showNotify(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    note.innerHTML = type === 'success' ? `<i class="fa-solid fa-check-circle"></i> ${msg}` : `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
    container.appendChild(note);
    setTimeout(() => { note.style.opacity = '0'; setTimeout(() => note.remove(), 300); }, 2500);
}

function normalizeInput(text) {
    if (!text) return '';
    let norm = text.normalize('NFC');
    norm = norm.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E]/g, '"');
    norm = norm.replace(/[\u2018\u2019\u201A\u201B\u275B\u275C]/g, "'");
    return norm.replace(/\u00A0/g, ' ').replace(/\u2026/g, '...');
}
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHTML(str) { return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function countWords(str) { return str.trim() ? str.trim().split(/\s+/).length : 0; }
function preserveCase(o, r) {
    if (o === o.toUpperCase() && o !== o.toLowerCase()) return r.toUpperCase();
    if (o[0] === o[0].toUpperCase()) return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    return r;
}

// Hàm Parse CSV xịn (Xử lý được dấu phẩy nằm trong ngoặc kép)
function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // Xóa BOM
    const lines = text.split(/\r\n|\n|\r/);
    const result = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue;
        const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
        let matches = [], match;
        while (match = regex.exec(line)) {
            let val = match[1];
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
            matches.push(val.trim());
        }
        result.push(matches);
    }
    return result;
}
function downloadCSV(content, fileName) {
    const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = fileName;
    link.click();
}

// =========================================================================
// 3. KHỞI TẠO VÀ ĐIỀU HƯỚNG GIAO DIỆN (UI NAV)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Nếu chưa có dự án nào, tạo sẵn 1 cái để trải nghiệm luôn
    if (appData.projects.length === 0) {
        createProject("Dự án Mặc định", "Hệ thống tự động tạo");
    } else if (!appData.currentProjectId) {
        selectProject(appData.projects[0].id);
    } else {
        selectProject(appData.currentProjectId);
    }

    initSidebar();
    initTabs();
    initGlobalEvents();
    renderDashboard();
    
    // Auto-update bộ đếm chữ khi gõ
    document.getElementById('input-text').addEventListener('input', updateBadges);
    document.getElementById('split-input-text').addEventListener('input', updateBadges);
});

function initSidebar() {
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        const sb = document.getElementById('app-sidebar');
        sb.classList.toggle('expanded');
        sb.classList.toggle('collapsed');
    });
}

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            
            // Re-render khi vào tab tương ứng
            if(btn.dataset.tab === 'settings') renderSettings();
            if(btn.dataset.tab === 'entities') renderEntities();
            if(btn.dataset.tab === 'relations') renderRelations();
        });
    });
}

// =========================================================================
// 4. QUẢN LÝ DỰ ÁN (DASHBOARD)
// =========================================================================
function createProject(name, desc) {
    const id = 'p-' + Date.now();
    appData.projects.push({
        id, name, desc,
        rules: { pairs: [], matchCase: false, wholeWord: false, autoCaps: false, dialogueMode: 0, abnormalCapsMode: 0, regexMode: 'chapter', customRegex: '' },
        lore: { entities: [], relations: [] }
    });
    saveData(); renderDashboard(); selectProject(id);
}

function selectProject(id) {
    appData.currentProjectId = id; saveData();
    const p = getActiveProject();
    if(p) document.getElementById('active-project-name').innerText = p.name;
    // Cập nhật mọi UI theo project mới
    renderSettings(); renderEntities(); renderRelations();
    clearEditor();
}

function renderDashboard() {
    const grid = document.getElementById('story-list'); grid.innerHTML = '';
    appData.projects.forEach(p => {
        const div = document.createElement('div');
        div.className = 'settings-card';
        div.style.cursor = 'pointer';
        div.style.transition = '0.2s';
        div.onmouseover = () => div.style.borderColor = 'var(--primary)';
        div.onmouseout = () => div.style.borderColor = 'var(--border)';
        
        div.innerHTML = `
            <h3>${p.name}</h3>
            <p style="color:var(--text-dim); margin-bottom:15px">${p.desc || 'Chưa có mô tả'}</p>
            <div style="display:flex; gap:10px; font-size:12px; font-weight:700; color:var(--text-dim)">
                <span class="badge badge-gray"><i class="fa-solid fa-users"></i> ${p.lore.entities.length} Thực thể</span>
                <span class="badge badge-gray"><i class="fa-solid fa-list"></i> ${p.rules.pairs.length} Quy tắc</span>
            </div>
            <div style="margin-top:15px; border-top:1px solid var(--border); padding-top:10px; text-align:right;">
                <button class="btn btn-outline btn-sm" style="color:red; border:none" onclick="event.stopPropagation(); deleteProject('${p.id}')"><i class="fa-solid fa-trash"></i> Xóa</button>
            </div>
        `;
        div.onclick = () => { selectProject(p.id); document.querySelector('[data-tab="replace"]').click(); };
        grid.appendChild(div);
    });
}

function saveStory() {
    const id = document.getElementById('story-id').value;
    const name = document.getElementById('story-name').value;
    const desc = document.getElementById('story-desc').value;
    if(!name) return showNotify('Tên truyện không được để trống!', 'error');
    
    if(id) {
        const p = appData.projects.find(x => x.id === id);
        p.name = name; p.desc = desc;
        if(appData.currentProjectId === id) document.getElementById('active-project-name').innerText = name;
        showNotify('Đã cập nhật Dự án!');
    } else {
        createProject(name, desc);
        showNotify('Đã tạo Dự án mới!');
    }
    saveData(); closeModal('modal-story'); renderDashboard();
}

function deleteProject(id) {
    if(confirm("Bạn có chắc chắn muốn xóa bộ truyện này và toàn bộ dữ liệu bên trong?")) {
        appData.projects = appData.projects.filter(p => p.id !== id);
        if(appData.currentProjectId === id) {
            appData.currentProjectId = appData.projects.length > 0 ? appData.projects[0].id : null;
            if(appData.currentProjectId) selectProject(appData.currentProjectId);
            else document.getElementById('active-project-name').innerText = "Chưa chọn dự án";
        }
        saveData(); renderDashboard(); showNotify('Đã xóa dự án!');
    }
}

// =========================================================================
// 5. CÀI ĐẶT THAY THẾ (RULES) & CSV PAIRS
// ==========================================
function renderSettings() {
    const p = getActiveProject(); if(!p) return;
    const list = document.getElementById('punctuation-list'); list.innerHTML = '';
    
    p.rules.pairs.forEach((pair, idx) => {
        const item = document.createElement('div');
        item.className = 'pair-item';
        item.innerHTML = `
            <span style="font-size:11px; font-weight:800; color:#94a3b8; width:20px; text-align:center">${idx + 1}</span>
            <input type="text" class="find-inp modern-input" style="margin:0" value="${pair.find.replace(/"/g, '&quot;')}" placeholder="Từ gốc cần tìm...">
            <input type="text" class="rep-inp modern-input" style="margin:0" value="${pair.replace.replace(/"/g, '&quot;')}" placeholder="Đổi thành...">
            <button class="btn btn-outline del-pair" data-idx="${idx}" style="color:var(--danger); border-color:var(--danger)"><i class="fa-solid fa-xmark"></i></button>
        `;
        
        // Cập nhật realtime khi gõ
        item.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                pair.find = item.querySelector('.find-inp').value;
                pair.replace = item.querySelector('.rep-inp').value;
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(saveData, 500); // Debounce save
            });
        });
        
        item.querySelector('.del-pair').onclick = () => {
            p.rules.pairs.splice(idx, 1); saveData(); renderSettings();
        };
        list.appendChild(item);
    });

    // Cập nhật UI Toggles
    const updBtn = (id, val, text) => {
        const btn = document.getElementById(id);
        btn.innerHTML = `${text}: ${val ? 'BẬT' : 'Tắt'}`;
        val ? btn.classList.add('active') : btn.classList.remove('active');
    };
    updBtn('match-case', p.rules.matchCase, 'Match Case');
    updBtn('whole-word', p.rules.wholeWord, 'Whole Word');
    updBtn('auto-caps', p.rules.autoCaps, 'Auto Caps');

    document.getElementById('setting-dialogue').value = p.rules.dialogueMode || 0;
    document.getElementById('setting-abnormal-caps').value = p.rules.abnormalCapsMode || 0;
    document.getElementById('setting-regex-mode').value = p.rules.regexMode || 'chapter';
    document.getElementById('custom-regex-input').value = p.rules.customRegex || '';
}

// =========================================================================
// 6. ENGINE XỬ LÝ TEXT (REPLACE PIPELINE & BADGES)
// =========================================================================
function updateBadges() {
    const raw = document.getElementById('input-text').value;
    const splitRaw = document.getElementById('split-input-text').value;
    document.getElementById('input-word-count').innerHTML = `<i class="fa-solid fa-font"></i> Words: ${countWords(raw)}`;
    document.getElementById('output-word-count').innerHTML = `Words: ${countWords(document.getElementById('output-text').innerText)}`;
}

function formatDialogue(text, mode) {
    if (mode == 0) return text;
    const regex = /(^|[\n])([^:\n]+):\s*(?:\n\s*)?([“"'])([\s\S]*?)([”"'])/gm;
    return text.replace(regex, (match, p1, p2, p3, p4, p5) => {
        const context = p2.trim(); let content = p4.trim();
        if (mode == 1) return `${p1}${context}: "${content}"`;
        if (mode == 2) return `${p1}${context}:\n\n"${content}"`;
        if (mode == 3) return `${p1}${context}:\n\n- ${content}`;
        return match;
    });
}

function performReplaceAll() {
    const p = getActiveProject(); if(!p) return showNotify('Vui lòng chọn hoặc tạo Dự án trước!', 'error');
    const rawText = document.getElementById('input-text').value;
    if (!rawText) return showNotify("Chưa có nội dung văn bản gốc!", "error");

    let processedText = normalizeInput(rawText);
    const rules = p.rules;
    let countReplace = 0, countCaps = 0;

    // BƯỚC 1: USER REPLACEMENTS
    if (rules.pairs && rules.pairs.length > 0) {
        const validPairs = rules.pairs.filter(x => x.find.trim()).sort((a,b) => b.find.length - a.find.length);
        validPairs.forEach(rule => {
            const pattern = escapeRegExp(rule.find);
            const flags = rules.matchCase ? 'g' : 'gi';
            const regex = rules.wholeWord ? new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, flags + 'u') : new RegExp(pattern, flags);
            
            processedText = processedText.replace(regex, (match) => {
                countReplace++; 
                let replacement = rule.replace;
                if (!rules.matchCase) replacement = preserveCase(match, replacement);
                return `${MARK_REP_S}${replacement}${MARK_REP_E}`;
            });
        });
    }

    // BƯỚC 2: ABNORMAL CAPS
    if (rules.abnormalCapsMode == 1) {
        const abnormalRegex = /(?<=[\p{Ll},;]\s+)([\p{Lu}][\p{Ll}]+)/gum;
        processedText = processedText.replace(abnormalRegex, (match, p1) => p1.toLowerCase());
    }

    // BƯỚC 3: AUTO CAPS
    if (rules.autoCaps) {
        const autoCapsRegex = /(^|[.?!]\s+|:\s*["“]\s*)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu;
        processedText = processedText.replace(autoCapsRegex, (match, prefix, mStart, mContent, mEnd, rawWord) => {
            let targetWord = mContent || rawWord;
            if (!targetWord) return match;
            let cappedWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
            
            if (mStart) { countCaps++; return `${prefix}${MARK_B_S}${cappedWord}${MARK_B_E}`; }
            if (rawWord.charAt(0) !== rawWord.charAt(0).toUpperCase()) { countCaps++; return `${prefix}${MARK_CAP_S}${cappedWord}${MARK_CAP_E}`; }
            return match;
        });
    }

    // BƯỚC 4: FORMAT HỘI THOẠI & DỌN DẸP DÒNG TRỐNG
    processedText = formatDialogue(processedText, rules.dialogueMode);
    processedText = processedText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '').join('\n\n');

    // BƯỚC 5: RENDER HTML HIGHLIGHT
    let finalHTML = '', buffer = '';
    for (let i = 0; i < processedText.length; i++) {
        const c = processedText[i];
        if (c === MARK_REP_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-yellow">'; buffer = ''; }
        else if (c === MARK_REP_E || c === MARK_CAP_E || c === MARK_B_E) { finalHTML += escapeHTML(buffer) + '</mark>'; buffer = ''; }
        else if (c === MARK_CAP_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-blue">'; buffer = ''; }
        else if (c === MARK_B_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-orange">'; buffer = ''; }
        else { buffer += c; }
    }
    finalHTML += escapeHTML(buffer);

    // Cập nhật giao diện & Badges
    document.getElementById('output-text').innerHTML = finalHTML;
    document.getElementById('count-replace').innerText = `Rep: ${countReplace}`;
    document.getElementById('count-caps').innerText = `Caps: ${countCaps}`;
    updateBadges();
    
    // BƯỚC 6: CHẠY AUTO-SCAN TÊN RIÊNG (TÍNH NĂNG ĂN TIỀN)
    runSmartLoreScan(document.getElementById('output-text').innerText);
    showNotify('Đã xử lý xong văn bản!');
}

function clearEditor() {
    document.getElementById('input-text').value = '';
    document.getElementById('output-text').innerHTML = '';
    document.getElementById('count-replace').innerText = 'Rep: 0';
    document.getElementById('count-caps').innerText = 'Caps: 0';
    updateBadges();
}

// =========================================================================
// 7. SMART SCAN LORE (TỰ ĐỘNG BẮT TÊN RIÊNG VÀ THÊM VÀO THỰC THỂ)
// =========================================================================
function runSmartLoreScan(cleanText) {
    const p = getActiveProject(); if(!p) return;
    
    // Regex bắt cụm từ viết hoa (2 từ trở lên). Hỗ trợ full tiếng Việt.
    // VD: "Trần Hạo Nam", "Lãnh Cung"
    const scanRegex = /(?<=[\p{Ll},;:]\s+|^)([\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+)+)/gum;
    const matches = cleanText.match(scanRegex) || [];
    
    // Lọc trùng trong mảng vừa quét
    let uniqueNames = [...new Set(matches.map(n => n.trim()))];
    
    // Lọc tiếp những tên ĐÃ CÓ trong Lore (cả Tên chuẩn và Tên khác)
    let newNames = uniqueNames.filter(name => {
        return !p.lore.entities.some(e => e.name === name || e.aliases.includes(name));
    });

    if (newNames.length > 0) {
        const resultBox = document.getElementById('scan-results');
        resultBox.innerHTML = ''; // Clear cũ
        
        newNames.forEach(name => {
            const div = document.createElement('div');
            div.style.marginBottom = "10px";
            div.innerHTML = `
                <label style="cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 14px; padding: 5px; border-radius: 6px; transition: 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" value="${name}" class="scan-checkbox" checked style="width: 16px; height: 16px;">
                    <strong style="color: var(--primary)">${name}</strong>
                </label>
            `;
            resultBox.appendChild(div);
        });
        document.getElementById('scan-toast').classList.remove('hidden');
    }
}

// =========================================================================
// 8. CHIA CHƯƠNG (SPLITTER)
// =========================================================================
function performSplit() {
    const text = document.getElementById('split-input-text').value;
    if(!text.trim()) return showNotify("Chưa có nội dung truyện để chia!", "error");
    
    const splitType = document.querySelector('input[name="split-type"]:checked').value;
    const count = parseInt(document.getElementById('split-count-select').value);
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = '';

    if (splitType === 'regex') {
        const p = getActiveProject();
        let regexStr = /(?:Chương|Chapter)\s+\d+(?:[:.-]\s*.*)?/gi;
        if (p.rules.regexMode === 'book') regexStr = /(?:Hồi|Quyển)\s+(?:\d+|[IVXLCDM]+)(?:[:.-]\s*.*)?/gi;
        if (p.rules.regexMode === 'custom' && p.rules.customRegex) {
            try { regexStr = new RegExp(p.rules.customRegex, 'gmi'); } catch(e) { return showNotify("Regex tự định nghĩa bị lỗi!", "error"); }
        }
        
        const matches = [...text.matchAll(regexStr)];
        if (matches.length === 0) return showNotify("Không tìm thấy dấu hiệu Chương theo Regex cài đặt!", "error");
        
        let parts = [];
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = (i < matches.length - 1) ? matches[i+1].index : text.length;
            let chunk = text.substring(start, end).trim();
            parts.push({ title: chunk.split('\n')[0].trim(), content: chunk });
        }
        renderSplitBoxes(parts);
        showNotify(`Đã chia thành ${parts.length} phần theo Chương!`);

    } else {
        // Chia theo số phần đều nhau
        const lines = normalizeInput(text).split('\n');
        let chapterHeader = '', contentBody = normalizeInput(text);
        if (/^(Chương|Chapter|Hồi)\s+\d+/.test(lines[0].trim())) { 
            chapterHeader = lines[0].trim(); 
            contentBody = lines.slice(1).join('\n'); 
        }
        
        const paragraphs = contentBody.split('\n').filter(p => p.trim());
        const targetWords = Math.ceil(countWords(contentBody) / count);
        
        let currentPart = [], currentCount = 0, rawParts = [];
        for (let p of paragraphs) {
            const wCount = countWords(p);
            if (currentCount + wCount > targetWords && rawParts.length < count - 1) { 
                rawParts.push(currentPart.join('\n\n')); 
                currentPart = [p]; currentCount = wCount; 
            } else { 
                currentPart.push(p); currentCount += wCount; 
            }
        }
        if (currentPart.length) rawParts.push(currentPart.join('\n\n'));
        
        let parts = rawParts.map((pContent, i) => {
            let h = `Phần ${i+1}`;
            if (chapterHeader && pContent) { 
                h = chapterHeader.replace(/(\d+)/, (m, n) => `${n}.${i+1}`); 
                pContent = h + '\n\n' + pContent; 
            }
            return { title: h, content: pContent || '' };
        });
        renderSplitBoxes(parts);
        showNotify(`Đã chia đều thành ${count} phần!`);
    }
}

function renderSplitBoxes(parts) {
    const wrapper = document.getElementById('split-outputs-wrapper');
    wrapper.innerHTML = '';
    parts.forEach((part, idx) => {
        const div = document.createElement('div');
        div.className = 'split-box';
        div.innerHTML = `
            <div class="split-header">
                <span>${part.title.substring(0, 30)}...</span>
                <span class="badge badge-gray">${countWords(part.content)} W</span>
            </div>
            <textarea id="out-split-${idx}" class="custom-scrollbar" readonly>${part.content}</textarea>
            <div class="split-footer">
                <button class="btn btn-success full-width copy-split-btn" data-target="out-split-${idx}"><i class="fa-solid fa-copy"></i> Sao chép Phần ${idx+1}</button>
            </div>
        `;
        wrapper.appendChild(div);
    });

    document.querySelectorAll('.copy-split-btn').forEach(btn => {
        btn.onclick = (e) => {
            const el = document.getElementById(e.target.dataset.target);
            if(el && el.value) { 
                navigator.clipboard.writeText(el.value).then(() => showNotify(`Đã copy Phần ${parseInt(e.target.dataset.target.split('-')[2])+1}`)); 
            }
        };
    });
}

// =========================================================================
// 9. QUẢN LÝ LORE (THỰC THỂ & QUAN HỆ) - CRUD FULL OPTION
// =========================================================================
function renderEntities() {
    const p = getActiveProject(); if(!p) return;
    const tbody = document.getElementById('entity-list-body'); tbody.innerHTML = '';
    
    p.lore.entities.forEach((e, idx) => {
        const tr = document.createElement('tr');
        const tag = ENTITY_TYPES[e.type] || {label: e.type, css: 'org'};
        tr.innerHTML = `
            <td style="color:var(--text-dim); font-weight:800; font-size:12px">${idx + 1}</td>
            <td><strong style="color:var(--primary); font-size:15px">${e.name}</strong></td>
            <td><span class="tag ${tag.css}">${tag.label}</span></td>
            <td>${e.aliases.join(', ')}</td>
            <td style="color:var(--text-dim); font-size:13px">${e.notes || ''}</td>
            <td>
                <div class="action-cell">
                    <button class="btn btn-outline btn-sm" onclick="editEntity('${e.id}')"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteEntity('${e.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Cập nhật các Dropdown ở Modal Quan hệ
    const opts = p.lore.entities.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    document.getElementById('rel-from').innerHTML = opts;
    document.getElementById('rel-to').innerHTML = opts;
}

function saveEntity() {
    const p = getActiveProject();
    const id = document.getElementById('ent-id').value;
    const name = document.getElementById('ent-name').value.trim();
    if(!name) return showNotify("Tên Chuẩn không được để trống!", "error");

    const entData = {
        id: id || 'e-' + Date.now(),
        name: name,
        type: document.getElementById('ent-type').value,
        aliases: document.getElementById('ent-aliases').value.split(',').map(x=>x.trim()).filter(x=>x),
        notes: document.getElementById('ent-notes').value
    };

    if(id) {
        const index = p.lore.entities.findIndex(x => x.id === id);
        p.lore.entities[index] = entData;
        showNotify("Cập nhật Thực thể thành công!");
    } else {
        p.lore.entities.push(entData);
        showNotify("Thêm Thực thể mới thành công!");
    }
    
    saveData(); closeModal('modal-entity'); renderEntities();
}

function editEntity(id) {
    const e = getActiveProject().lore.entities.find(x => x.id === id);
    document.getElementById('ent-id').value = e.id;
    document.getElementById('ent-name').value = e.name;
    document.getElementById('ent-type').value = e.type;
    document.getElementById('ent-aliases').value = e.aliases.join(', ');
    document.getElementById('ent-notes').value = e.notes || '';
    
    // Đổi tiêu đề modal
    document.querySelector('#modal-entity .modal-header h3').innerText = "Sửa Thực thể";
    openModal('modal-entity');
}

function deleteEntity(id) {
    if(confirm("Bạn có chắc chắn muốn xóa Thực thể này?")) {
        const p = getActiveProject();
        p.lore.entities = p.lore.entities.filter(x => x.id !== id);
        saveData(); renderEntities(); showNotify("Đã xóa Thực thể!");
    }
}

// --- QUAN HỆ (RELATIONS) ---
function renderRelations() {
    const p = getActiveProject(); if(!p) return;
    const tbody = document.getElementById('relation-list-body'); tbody.innerHTML = '';
    
    const getName = (id) => { const e = p.lore.entities.find(x => x.id === id); return e ? e.name : id; };

    p.lore.relations.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:var(--text-dim); font-weight:800; font-size:12px">${idx + 1}</td>
            <td><strong style="font-size:15px">${getName(r.from)}</strong><br><span style="color:var(--text-dim); font-size:12px">Xưng là: ${r.fromAddr || '?'}</span></td>
            <td style="color:var(--primary); font-weight:700; text-align:center"><i class="fa-solid fa-arrow-right-long"></i><br>${r.type}</td>
            <td><strong style="font-size:15px">${getName(r.to)}</strong><br><span style="color:var(--text-dim); font-size:12px">Được gọi là: ${r.toAddr || '?'}</span></td>
            <td style="color:var(--text-dim); font-size:13px">${r.note || ''}</td>
            <td>
                <div class="action-cell">
                    <button class="btn btn-outline btn-sm" onclick="editRelation('${r.id}')"><i class="fa-solid fa-pencil"></i></button>
                    <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:var(--danger)" onclick="deleteRelation('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function saveRelation() {
    const p = getActiveProject();
    const id = document.getElementById('rel-id').value;
    
    const relData = {
        id: id || 'r-' + Date.now(),
        from: document.getElementById('rel-from').value,
        fromAddr: document.getElementById('rel-from-addr').value,
        type: document.getElementById('rel-type').value,
        to: document.getElementById('rel-to').value,
        toAddr: document.getElementById('rel-to-addr').value,
        note: document.getElementById('rel-note').value
    };

    if(id) {
        const idx = p.lore.relations.findIndex(x => x.id === id);
        p.lore.relations[idx] = relData;
        showNotify("Đã cập nhật Quan hệ!");
    } else {
        p.lore.relations.push(relData);
        showNotify("Đã thêm Quan hệ mới!");
    }
    saveData(); closeModal('modal-relation'); renderRelations();
}

function editRelation(id) {
    const r = getActiveProject().lore.relations.find(x => x.id === id);
    document.getElementById('rel-id').value = r.id;
    document.getElementById('rel-from').value = r.from;
    document.getElementById('rel-from-addr').value = r.fromAddr || '';
    document.getElementById('rel-type').value = r.type;
    document.getElementById('rel-to').value = r.to;
    document.getElementById('rel-to-addr').value = r.toAddr || '';
    document.getElementById('rel-note').value = r.note || '';
    
    document.querySelector('#modal-relation .modal-header h3').innerText = "Sửa Quan hệ";
    openModal('modal-relation');
}

function deleteRelation(id) {
    if(confirm("Xóa mối quan hệ này?")) {
        getActiveProject().lore.relations = getActiveProject().lore.relations.filter(x => x.id !== id);
        saveData(); renderRelations(); showNotify("Đã xóa Quan hệ!");
    }
}


// =========================================================================
// 10. IMPORT/EXPORT CSV (ĐỘC LẬP TỪNG TAB)
// =========================================================================
// Xuất/Nhập Pairs
function exportPairsCSV() {
    const p = getActiveProject();
    let csv = "\uFEFFstt,find,replace,mode\n"; 
    p.rules.pairs.forEach((r, i) => { csv += `${i+1},"${r.find.replace(/"/g, '""')}","${r.replace.replace(/"/g, '""')}","${p.name}"\n`; });
    downloadCSV(csv, "ThayThe_" + p.name + ".csv");
}
function importPairsCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const rows = parseCSV(e.target.result);
        const p = getActiveProject();
        let count = 0;
        for(let i = 1; i < rows.length; i++) { // Bỏ dòng header
            const cols = rows[i];
            if(cols.length >= 3 && cols[1]) {
                p.rules.pairs.push({ find: cols[1], replace: cols[2] }); count++;
            }
        }
        saveData(); renderSettings(); showNotify(`Đã nhập thành công ${count} cặp thay thế!`);
    }; reader.readAsText(file);
}

// Xuất/Nhập Entities
function exportEntityCSV() {
    const p = getActiveProject();
    let csv = "\uFEFFSTT,TenChuan,Loai,TenKhac,GhiChu\n";
    p.lore.entities.forEach((e, i) => { csv += `${i+1},"${e.name}",${e.type},"${e.aliases.join(';') }","${e.notes||''}"\n`; });
    downloadCSV(csv, "ThucThe_" + p.name + ".csv");
}
function importEntityCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const rows = parseCSV(e.target.result);
        const p = getActiveProject();
        let count = 0;
        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if(cols.length >= 2 && cols[1]) {
                p.lore.entities.push({ id: 'e-'+Date.now()+Math.random(), name: cols[1], type: cols[2] || 'character', aliases: cols[3] ? cols[3].replace(/;/g, ',').split(',').map(x=>x.trim()).filter(x=>x) : [], notes: cols[4] || '' });
                count++;
            }
        }
        saveData(); renderEntities(); showNotify(`Đã nhập ${count} Thực thể!`);
    }; reader.readAsText(file);
}

// Xuất/Nhập Relations
function exportRelationCSV() {
    const p = getActiveProject();
    let csv = "\uFEFFSTT,ChuThe,XungHo(DuoiChuThe),QuanHe,DoiTuong,XungHo(DuoiDoiTuong)\n";
    const getName = (id) => { const e = p.lore.entities.find(x => x.id === id); return e ? e.name : id; };
    p.lore.relations.forEach((r, i) => { csv += `${i+1},"${getName(r.from)}","${r.fromAddr||''}","${r.type}","${getName(r.to)}","${r.toAddr||''}"\n`; });
    downloadCSV(csv, "QuanHe_" + p.name + ".csv");
}
function importRelationCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const rows = parseCSV(e.target.result);
        const p = getActiveProject();
        let count = 0;
        for(let i = 1; i < rows.length; i++) {
            const cols = rows[i];
            if(cols.length >= 5 && cols[1] && cols[4]) {
                p.lore.relations.push({ id: 'r-'+Date.now()+Math.random(), from: cols[1], fromAddr: cols[2], type: cols[3], to: cols[4], toAddr: cols[5] || '', note: '' });
                count++;
            }
        }
        saveData(); renderRelations(); showNotify(`Đã nhập ${count} Quan hệ!`);
    }; reader.readAsText(file);
}

// Hàm Trigger input hidden
function triggerImport(type) { document.getElementById(`csv-upload-${type}`).click(); }


// =========================================================================
// 11. ĐỒNG BỘ ĐÁM MÂY (JSON CLOUD MOCK - SYNC PASS)
// =========================================================================
// Vì đây là phiên bản Web tĩnh, hệ thống sẽ sử dụng tiền tố LocalStorage đặc biệt để mô phỏng Server Database
function pushSyncData() {
    const pass = document.getElementById('sync-pass-input').value.trim();
    if(!pass) return showNotify("Vui lòng nhập Sync Pass để đẩy lên mây!", "error");
    
    // Đóng gói thành file JSON và lưu vào "đám mây" (Mock)
    const backupData = JSON.stringify(appData);
    localStorage.setItem('CLOUD_MOCK_' + pass, backupData);
    
    document.getElementById('sync-status-msg').innerHTML = `<span style="color:var(--success)"><i class="fa-solid fa-cloud-arrow-up"></i> Đã đồng bộ lên Cloud lúc ${new Date().toLocaleTimeString()}</span>`;
    showNotify("Đã đẩy dữ liệu lên Cloud thành công!");
}

function pullSyncData() {
    const pass = document.getElementById('sync-pass-input').value.trim();
    if(!pass) return showNotify("Vui lòng nhập Sync Pass để kéo dữ liệu!", "error");
    
    const cloudData = localStorage.getItem('CLOUD_MOCK_' + pass);
    if(cloudData) {
        if(confirm("Hành động này sẽ ghi đè toàn bộ dữ liệu hiện tại trên máy. Bạn có chắc chắn?")) {
            appData = JSON.parse(cloudData);
            saveData();
            
            // Re-render UI
            renderDashboard();
            if(appData.currentProjectId) selectProject(appData.currentProjectId);
            
            document.getElementById('sync-status-msg').innerHTML = `<span style="color:var(--primary)"><i class="fa-solid fa-cloud-arrow-down"></i> Đã kéo dữ liệu mới nhất về máy</span>`;
            showNotify("Đã khôi phục dữ liệu từ Cloud!");
        }
    } else {
        showNotify("Không tìm thấy dữ liệu nào trên Cloud với mã này!", "error");
    }
}


// =========================================================================
// 12. GẮN SỰ KIỆN TỔNG HỢP (EVENTS)
// =========================================================================
function initGlobalEvents() {
    // Toggles trong Settings
    const toggleRules = (prop) => { getActiveProject().rules[prop] = !getActiveProject().rules[prop]; saveData(); renderSettings(); };
    document.getElementById('match-case').onclick = () => toggleRules('matchCase');
    document.getElementById('whole-word').onclick = () => toggleRules('wholeWord');
    document.getElementById('auto-caps').onclick = () => toggleRules('autoCaps');
    
    document.getElementById('add-pair').onclick = () => { getActiveProject().rules.pairs.unshift({find:'', replace:''}); saveData(); renderSettings(); };
    document.getElementById('save-settings-btn').onclick = () => showNotify('Đã lưu cài đặt Quy tắc!');

    // Các select box Settings
    ['dialogue', 'abnormal-caps', 'regex-mode'].forEach(id => {
        document.getElementById(`setting-${id}`).addEventListener('change', e => {
            let key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            getActiveProject().rules[key] = e.target.value; saveData();
        });
    });
    document.getElementById('custom-regex-input').addEventListener('input', e => { getActiveProject().rules.customRegex = e.target.value; saveData(); });

    // Các nút chức năng chính
    document.getElementById('replace-button').onclick = performReplaceAll;
    document.getElementById('copy-button').onclick = () => {
        const out = document.getElementById('output-text').innerText;
        if(out) { navigator.clipboard.writeText(out).then(() => showNotify('Đã copy kết quả!')); }
    };
    document.getElementById('split-action-btn').onclick = performSplit;

    // Toast Quét Lore
    document.getElementById('btn-save-scanned').onclick = () => {
        const p = getActiveProject();
        document.querySelectorAll('#scan-results input:checked').forEach(cb => {
            p.lore.entities.push({ id: 'e-'+Date.now()+Math.random(), name: cb.value, type: 'character', aliases: [], notes: 'Auto-scanned' });
        });
        saveData(); renderEntities();
        document.getElementById('scan-toast').classList.add('hidden');
        showNotify("Đã thêm Thực thể mới vào Lore!");
    };

    // CSV Events
    document.getElementById('export-pairs-csv').onclick = exportPairsCSV;
    document.getElementById('import-pairs-csv').onclick = () => document.getElementById('csv-upload-pairs').click();
    
    // Khởi tạo input file ẩn cho Pairs (Vì file HTML tôi quên chèn input hidden này, nên tôi tạo bằng JS luôn)
    const pairsFileInp = document.createElement('input');
    pairsFileInp.type = 'file'; pairsFileInp.id = 'csv-upload-pairs'; pairsFileInp.accept = '.csv'; pairsFileInp.style.display = 'none';
    document.body.appendChild(pairsFileInp);
    pairsFileInp.addEventListener('change', function() { if(this.files.length) importPairsCSV(this.files[0]); this.value = ''; });

    document.getElementById('csv-upload-entity').addEventListener('change', function() { if(this.files.length) importEntityCSV(this.files[0]); this.value = ''; });
    document.getElementById('csv-upload-relation').addEventListener('change', function() { if(this.files.length) importRelationCSV(this.files[0]); this.value = ''; });

    // Sync Events
    document.getElementById('btn-push-sync').onclick = pushSyncData;
    document.getElementById('btn-pull-sync').onclick = pullSyncData;
}

// Helpers gọi Modal
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function resetStoryForm() { 
    document.getElementById('story-id').value=''; 
    document.getElementById('story-name').value=''; 
    document.getElementById('story-desc').value=''; 
    document.querySelector('#modal-story .modal-header h3').innerText = "Thêm Dự Án Mới";
}
function openEntityModal() { 
    document.getElementById('ent-id').value=''; 
    document.getElementById('ent-name').value=''; 
    document.getElementById('ent-aliases').value=''; 
    document.getElementById('ent-notes').value=''; 
    document.querySelector('#modal-entity .modal-header h3').innerText = "Thêm Thực thể Mới";
    openModal('modal-entity'); 
}
function openRelationModal() { 
    document.getElementById('rel-id').value=''; 
    document.getElementById('rel-type').value=''; 
    document.getElementById('rel-from-addr').value=''; 
    document.getElementById('rel-to-addr').value=''; 
    document.getElementById('rel-note').value=''; 
    document.querySelector('#modal-relation .modal-header h3').innerText = "Thêm Quan hệ Mới";
    openModal('modal-relation'); 
}
