// =========================================================================
// 1. CẤU TRÚC DỮ LIỆU TỔNG HỢP (STATE)
// =========================================================================
const STORAGE_KEY = 'LoreMasterPro_MegaSync_V1';

// Markers dùng cho Engine Thay Thế (Web 2)
const MARK_REP_S = '\uE000', MARK_REP_E = '\uE001';
const MARK_CAP_S = '\uE002', MARK_CAP_E = '\uE003';
const MARK_B_S = '\uE004',   MARK_B_E = '\uE005';

const defaultState = {
    activeStoryId: null,
    stories: [], // Quản lý Web 3 (Truyện, Thực thể, Quan hệ)
    v27Settings: { // Quản lý Web 2
        pairs: [],
        matchCase: false, wholeWord: false, autoCaps: false,
        dialogueMode: 0, abnormalCapsMode: 0,
        regexMode: 'chapter', customRegex: ''
    }
};

let appState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState;
let saveTimeout;

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); }

// =========================================================================
// 2. KHỞI TẠO & ĐIỀU HƯỚNG (NAVIGATION)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    loadV27Settings();
    renderV27Pairs();
    
    // Gắn event tự động đếm chữ khi gõ vào ô Textarea
    const textInputs = document.querySelectorAll('textarea');
    textInputs.forEach(inp => {
        inp.addEventListener('input', () => {
            updateBadges();
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveData, 500);
        });
    });

    // Khởi tạo các event chức năng
    initV27Events();
    initWeb3Events();
});

// Điều hướng 1 Dòng Header + Thư mục xổ xuống
function initNav() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            e.target.classList.add('active');
            const targetId = e.target.dataset.tab;
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
            
            // Render data khi chuyển tab
            if (targetId === 'w2-settings') renderV27Pairs();
            if (targetId === 'w3-dashboard') renderStories();
            if (targetId === 'w3-entities') renderEntities();
            if (targetId === 'w3-relations') renderRelations();
        });
    });
}

// =========================================================================
// 3. ENGINE WEB 2 (V27) - THAY THẾ, FORMAT, REGEX, SPLIT
// =========================================================================

// --- Helper Functions ---
function countWords(str) { return str.trim() ? str.trim().split(/\s+/).length : 0; }
function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHTML(str) { return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function preserveCase(o, r) {
    if (o === o.toUpperCase() && o !== o.toLowerCase()) return r.toUpperCase();
    if (o[0] === o[0].toUpperCase()) return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    return r;
}
function normalizeInput(text) {
    if (!text) return '';
    let norm = text.normalize('NFC');
    norm = norm.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E\u301D-\u301F\uFF02\u02DD]/g, '"');
    norm = norm.replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u275B\u275C\u276E\u276F\uA78C\uFF07]/g, "'");
    return norm.replace(/\u00A0/g, ' ').replace(/\u2026/g, '...');
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

function updateBadges() {
    const rawBox = document.querySelector('#w2-replace textarea');
    const outBox = document.querySelector('#w2-replace .output-box');
    const splitRawBox = document.querySelector('#w2-split textarea');
    
    if (rawBox) rawBox.previousElementSibling.querySelector('.badge').innerText = `Words: ${countWords(rawBox.value)}`;
    if (outBox) outBox.previousElementSibling.querySelector('.badge.gray').innerText = `Words: ${countWords(outBox.innerText)}`;
    if (splitRawBox) splitRawBox.previousElementSibling.querySelector('.badge').innerText = `Words: ${countWords(splitRawBox.value)}`;
}

// --- Cài đặt (V27) ---
function loadV27Settings() {
    const s = appState.v27Settings;
    const toggleBtn = (id, val) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.innerText = `${btn.innerText.split(':')[0]}: ${val ? 'BẬT' : 'Tắt'}`;
        val ? btn.classList.add('active') : btn.classList.remove('active');
    };
    toggleBtn('match-case', s.matchCase);
    toggleBtn('whole-word', s.wholeWord);
    toggleBtn('auto-caps', s.autoCaps);
    
    document.querySelectorAll('.option-card[data-type="dialogue"]').forEach(c => c.classList.toggle('active', parseInt(c.dataset.val) === s.dialogueMode));
    document.querySelectorAll('.option-card[data-type="abnormal"]').forEach(c => c.classList.toggle('active', parseInt(c.dataset.val) === s.abnormalCapsMode));
    
    const radio = document.querySelector(`input[name="regex-preset"][value="${s.regexMode}"]`);
    if (radio) radio.checked = true;
    const customReg = document.getElementById('custom-regex-input');
    if (customReg) customReg.value = s.customRegex;
}

function renderV27Pairs() {
    const list = document.getElementById('punctuation-list');
    if (!list) return;
    list.innerHTML = '';
    appState.v27Settings.pairs.forEach((p, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex'; item.style.gap = '10px'; item.style.marginBottom = '10px';
        item.innerHTML = `
            <input type="text" class="modern-input find-inp" style="margin:0" value="${p.find.replace(/"/g, '&quot;')}" placeholder="Tìm">
            <input type="text" class="modern-input rep-inp" style="margin:0" value="${p.replace.replace(/"/g, '&quot;')}" placeholder="Thay thế">
            <button class="btn btn-outline del-pair" style="color:red" data-idx="${idx}">X</button>
        `;
        item.querySelectorAll('input').forEach(inp => inp.addEventListener('input', () => {
            p.find = item.querySelector('.find-inp').value;
            p.replace = item.querySelector('.rep-inp').value;
            clearTimeout(saveTimeout); saveTimeout = setTimeout(saveData, 500);
        }));
        item.querySelector('.del-pair').onclick = () => {
            appState.v27Settings.pairs.splice(idx, 1); saveData(); renderV27Pairs();
        };
        list.appendChild(item);
    });
}

// --- Engine Xử Lý Text ---
function performV27Replace() {
    const rawBox = document.querySelector('#w2-replace textarea');
    const outBox = document.querySelector('#w2-replace .output-box');
    if (!rawBox || !rawBox.value) return alert("Chưa có nội dung văn bản gốc!");

    let processedText = normalizeInput(rawBox.value);
    const rules = appState.v27Settings;
    let countReplace = 0, countCaps = 0;

    // 1. Thay thế cặp từ
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

    // 2. Viết hoa bất thường giữa câu
    if (rules.abnormalCapsMode == 1) {
        const abnormalRegex = /(?<=[\p{Ll},;]\s+)([\p{Lu}][\p{Ll}]+)/gum;
        processedText = processedText.replace(abnormalRegex, match => match.toLowerCase());
    }

    // 3. Auto Caps (Sau dấu câu và ngoặc kép hội thoại)
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

    // 4. Format Hội Thoại & Xuống dòng
    processedText = formatDialogue(processedText, rules.dialogueMode);
    processedText = processedText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '').join('\n\n');

    // 5. Render Highlights
    let finalHTML = '', buffer = '';
    for (let i = 0; i < processedText.length; i++) {
        const c = processedText[i];
        if (c === MARK_REP_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-yellow" style="background:#fef08a; border-bottom:2px solid #eab308; color:#000;">'; buffer = ''; }
        else if (c === MARK_REP_E || c === MARK_CAP_E || c === MARK_B_E) { finalHTML += escapeHTML(buffer) + '</mark>'; buffer = ''; }
        else if (c === MARK_CAP_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-blue" style="background:#bfdbfe; border-bottom:2px solid #3b82f6; color:#000;">'; buffer = ''; }
        else if (c === MARK_B_S) { finalHTML += escapeHTML(buffer) + '<mark class="hl-orange" style="background:#fed7aa; border-bottom:2px solid #f97316; color:#000;">'; buffer = ''; }
        else { buffer += c; }
    }
    finalHTML += escapeHTML(buffer);

    outBox.innerHTML = finalHTML;
    
    // Cập nhật Badge Web 2
    const paneHead = outBox.previousElementSibling;
    if(paneHead) {
        paneHead.querySelector('.badge.yellow').innerText = `Replace: ${countReplace}`;
        paneHead.querySelector('.badge.blue').innerText = `Auto-Caps: ${countCaps}`;
    }
    updateBadges();
}

// --- Splitter ---
function performV27Split() {
    const rawBox = document.querySelector('#w2-split textarea');
    if(!rawBox || !rawBox.value.trim()) return alert("Trống!");
    const text = rawBox.value;
    
    const splitType = document.querySelector('input[name="split-type"]:checked').value;
    const wrapper = document.createElement('div'); 
    wrapper.style.display = 'grid'; wrapper.style.gridTemplateColumns = '1fr 1fr'; wrapper.style.gap = '20px';
    
    // Logic tương tự aulapro (giữ nguyên độ chuẩn)
    if (splitType === 'regex' || splitType === 'on') {
        const rules = appState.v27Settings;
        let regexStr = /(?:Chương|Chapter)\s+\d+(?:[:.-]\s*.*)?/gi;
        if (rules.regexMode === 'book') regexStr = /(?:Hồi|Quyển)\s+(?:\d+|[IVXLCDM]+)(?:[:.-]\s*.*)?/gi;
        if (rules.regexMode === 'custom' && rules.customRegex) {
            try { regexStr = new RegExp(rules.customRegex, 'gmi'); } catch(e) { return alert("Lỗi Regex custom!"); }
        }
        
        const matches = [...text.matchAll(regexStr)];
        if (!matches.length) return alert("Không tìm thấy chương!");
        
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index;
            const end = (i < matches.length - 1) ? matches[i+1].index : text.length;
            let chunk = text.substring(start, end).trim();
            const div = document.createElement('div'); div.className = 'pane-box'; div.style.height = '350px';
            div.innerHTML = `<div class="pane-head"><span>Phần ${i+1}</span><span class="badge gray">Words: ${countWords(chunk)}</span></div><textarea class="textarea-box" readonly>${chunk}</textarea><div class="pane-foot"><button class="btn btn-success w-full copy-split-btn">Sao Chép</button></div>`;
            wrapper.appendChild(div);
        }
    } else {
        // Lấy số phần từ các nút bấm (tìm nút có class active trong split)
        const activeBtn = document.querySelector('#w2-split .btn-outline.active');
        const count = activeBtn ? parseInt(activeBtn.innerText) : 2;
        
        const paragraphs = normalizeInput(text).split('\n').filter(p => p.trim());
        const targetWords = Math.ceil(countWords(text) / count);
        
        let currentPart = [], currentCount = 0, rawParts = [];
        for (let p of paragraphs) {
            const wCount = countWords(p);
            if (currentCount + wCount > targetWords && rawParts.length < count - 1) { 
                rawParts.push(currentPart.join('\n\n')); currentPart = [p]; currentCount = wCount; 
            } else { currentPart.push(p); currentCount += wCount; }
        }
        if (currentPart.length) rawParts.push(currentPart.join('\n\n'));
        
        rawParts.forEach((chunk, i) => {
            const div = document.createElement('div'); div.className = 'pane-box'; div.style.height = '350px';
            div.innerHTML = `<div class="pane-head"><span>Phần ${i+1}</span><span class="badge gray">Words: ${countWords(chunk)}</span></div><textarea class="textarea-box" readonly>${chunk}</textarea><div class="pane-foot"><button class="btn btn-success w-full copy-split-btn">Sao Chép</button></div>`;
            wrapper.appendChild(div);
        });
    }
    
    // Gắn vào giao diện
    const container = document.querySelector('#w2-split .grid') || document.querySelector('#w2-split > div:last-child');
    container.innerHTML = ''; container.appendChild(wrapper);
    
    // Gắn event copy
    document.querySelectorAll('.copy-split-btn').forEach(btn => {
        btn.onclick = (e) => {
            const textToCopy = e.target.parentElement.previousElementSibling.value;
            navigator.clipboard.writeText(textToCopy).then(() => alert('Đã sao chép!'));
        };
    });
}

function initV27Events() {
    // Buttons setting
    const tg = (prop) => { appState.v27Settings[prop] = !appState.v27Settings[prop]; saveData(); loadV27Settings(); };
    const btnMatch = document.getElementById('match-case'); if(btnMatch) btnMatch.onclick = () => tg('matchCase');
    const btnWord = document.getElementById('whole-word'); if(btnWord) btnWord.onclick = () => tg('wholeWord');
    const btnCaps = document.getElementById('auto-caps'); if(btnCaps) btnCaps.onclick = () => tg('autoCaps');
    
    // Format Hội thoại
    document.querySelectorAll('.option-card[data-type="dialogue"]').forEach(c => {
        c.onclick = () => { appState.v27Settings.dialogueMode = parseInt(c.dataset.val); saveData(); loadV27Settings(); };
    });
    
    // Viết hoa bất thường
    document.querySelectorAll('.option-card[data-type="abnormal"]').forEach(c => {
        c.onclick = () => { appState.v27Settings.abnormalCapsMode = parseInt(c.dataset.val); saveData(); loadV27Settings(); };
    });

    // Regex mode
    document.querySelectorAll('input[name="regex-preset"]').forEach(r => {
        r.addEventListener('change', e => { appState.v27Settings.regexMode = e.target.value; saveData(); });
    });
    const customRegexInp = document.getElementById('custom-regex-input');
    if(customRegexInp) customRegexInp.addEventListener('input', e => { appState.v27Settings.customRegex = e.target.value; saveData(); });

    // Buttons
    const addPairBtn = document.querySelector('#w2-settings .btn-success');
    if(addPairBtn) addPairBtn.onclick = () => { appState.v27Settings.pairs.unshift({find:'', replace:''}); saveData(); renderV27Pairs(); };
    
    const replaceBtn = document.querySelector('#w2-replace .btn-primary');
    if(replaceBtn) replaceBtn.onclick = performV27Replace;

    const copyRepBtn = document.querySelector('#w2-replace .btn-success');
    if(copyRepBtn) copyRepBtn.onclick = () => {
        const out = document.querySelector('#w2-replace .output-box').innerText;
        if(out) navigator.clipboard.writeText(out).then(() => alert('Đã sao chép kết quả!'));
    };

    const splitBtn = document.querySelector('#w2-split .btn-primary');
    if(splitBtn) splitBtn.onclick = performV27Split;
    
    // Split count buttons
    document.querySelectorAll('#w2-split .btn-outline').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#w2-split .btn-outline').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
}


// =========================================================================
// 4. HỆ THỐNG LORE (WEB 3 BIGPRO)
// =========================================================================
function getCurrentStory() {
    return appState.stories.find(s => s.id === appState.activeStoryId);
}

function renderStories() {
    const list = document.querySelector('#w3-dashboard .card-box').parentElement;
    if(!list) return;
    list.innerHTML = '';
    appState.stories.forEach(s => {
        const div = document.createElement('div');
        div.className = 'card-box';
        div.style.cursor = 'pointer';
        div.innerHTML = `
            <h3>${s.name}</h3><p style="color:#64748b; margin-bottom: 15px;">${s.desc}</p>
            <div style="display:flex; gap:10px; font-size:12px; font-weight:600;">
                <span class="badge gray">${s.entities.length} Thực thể</span>
                <span class="badge gray">${s.relations.length} Quan hệ</span>
            </div>
            <button class="btn btn-outline w-full" style="margin-top:15px; color:red; border:none;" onclick="event.stopPropagation(); deleteStory('${s.id}')">Xóa Truyện</button>
        `;
        div.onclick = () => {
            appState.activeStoryId = s.id; saveData();
            document.querySelector('[data-tab="w3-entities"]').click();
        };
        list.appendChild(div);
    });
}

function deleteStory(id) {
    if(confirm("Xóa truyện này?")) {
        appState.stories = appState.stories.filter(s => s.id !== id);
        if(appState.activeStoryId === id) appState.activeStoryId = null;
        saveData(); renderStories();
    }
}

function renderEntities() {
    const s = getCurrentStory(); if(!s) return;
    const tbody = document.querySelector('#w3-entities tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    s.entities.forEach((e, i) => {
        tbody.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><strong>${e.name}</strong></td>
                <td><span class="badge blue">${e.type}</span></td>
                <td>${e.aliases.join(', ')}</td>
                <td>${e.notes}</td>
                <td><button class="btn btn-outline" style="color:red; padding:4px 8px; border:none" onclick="delEntity('${e.id}')">Xóa</button></td>
            </tr>
        `;
    });
}
function delEntity(id) {
    if(confirm("Xóa thực thể?")) {
        const s = getCurrentStory(); s.entities = s.entities.filter(e => e.id !== id);
        saveData(); renderEntities();
    }
}

function renderRelations() {
    const s = getCurrentStory(); if(!s) return;
    const tbody = document.querySelector('#w3-relations tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const getName = id => { const ent = s.entities.find(e => e.id === id); return ent ? ent.name : id; };
    s.relations.forEach((r, i) => {
        tbody.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><strong>${getName(r.from)}</strong></td>
                <td style="color:var(--primary); font-weight:700">${r.type}</td>
                <td><strong>${getName(r.to)}</strong></td>
                <td>${r.note}</td>
                <td><button class="btn btn-outline" style="color:red; padding:4px 8px; border:none" onclick="delRelation('${r.id}')">Xóa</button></td>
            </tr>
        `;
    });
}
function delRelation(id) {
    if(confirm("Xóa quan hệ?")) {
        const s = getCurrentStory(); s.relations = s.relations.filter(r => r.id !== id);
        saveData(); renderRelations();
    }
}

function initWeb3Events() {
    // Add Story
    const addStoryBtn = document.querySelector('#w3-dashboard .btn-primary');
    if(addStoryBtn) addStoryBtn.onclick = () => {
        const name = prompt("Nhập tên truyện mới:");
        if(name) {
            appState.stories.push({ id: 's-'+Date.now(), name, desc: '', entities: [], relations: [] });
            saveData(); renderStories();
        }
    };

    // Add Entity
    const addEntBtn = document.querySelector('#w3-entities .btn-primary');
    if(addEntBtn) addEntBtn.onclick = () => {
        const s = getCurrentStory(); if(!s) return alert("Chọn truyện ở Dashboard trước!");
        const name = prompt("Nhập tên Thực thể chuẩn:");
        if(name) {
            s.entities.push({ id: 'e-'+Date.now(), name, type: 'Nhân vật', aliases: [], notes: '' });
            saveData(); renderEntities();
        }
    };

    // Add Relation
    const addRelBtn = document.querySelector('#w3-relations .btn-primary');
    if(addRelBtn) addRelBtn.onclick = () => {
        const s = getCurrentStory(); if(!s) return alert("Chọn truyện ở Dashboard trước!");
        s.relations.push({ id: 'r-'+Date.now(), from: 'A', type: 'Quan hệ', to: 'B', note: '' });
        saveData(); renderRelations();
    };
    
    // Editor đồng bộ
    const editorRaw = document.querySelector('#w3-editor textarea');
    if(editorRaw) {
        editorRaw.addEventListener('input', () => {
            const s = getCurrentStory(); if(!s) return;
            let text = editorRaw.value;
            let found = 0;
            // Scan and highlight entities
            s.entities.forEach(e => {
                const reg = new RegExp(`(${e.name})`, 'gi');
                text = text.replace(reg, m => { found++; return `<mark style="background:#bfdbfe; color:#000;">${m}</mark>`; });
            });
            document.querySelector('#w3-editor .output-box').innerHTML = text.replace(/\n/g, '<br>');
            document.querySelector('#w3-editor .badge.yellow').innerText = `Tìm: ${found}`;
        });
    }
}
