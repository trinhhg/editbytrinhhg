// ==========================================
// 1. DATA CORE (WEB 3 + WEB 2 MERGED)
// ==========================================
const STORAGE_KEY = 'trinhhg_allinone_v2';
const MARK_REP_S = '\uE000', MARK_REP_E = '\uE001', MARK_CAP_S = '\uE002', MARK_CAP_E = '\uE003', MARK_B_S = '\uE004', MARK_B_E = '\uE005';

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    currentId: null,
    projects: []
};

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }
function getActive() { return appData.projects.find(p => p.id === appData.currentId); }

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    if(appData.projects.length === 0) createProject("Dự án đầu tiên", "Tạo tự động");
    else if(!appData.currentId) selectProject(appData.projects[0].id);
    else selectProject(appData.currentId);
    
    renderDashboard();
    initEvents();
});

// ==========================================
// 2. UI & SIDEBAR
// ==========================================
function initUI() {
    document.getElementById('toggle-sidebar').onclick = () => {
        const sb = document.getElementById('app-sidebar');
        sb.classList.toggle('expanded'); sb.classList.toggle('collapsed');
    };
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            if(btn.dataset.tab === 'settings') renderSettings();
            if(btn.dataset.tab === 'entities') renderEntities();
            if(btn.dataset.tab === 'relations') renderRelations();
        };
    });
    document.getElementById('close-toast').onclick = () => document.getElementById('scan-toast').classList.add('hidden');
}

// ==========================================
// 3. DASHBOARD & PROJECT MANAGEMENT
// ==========================================
function createProject(name, desc) {
    const id = 'p-' + Date.now();
    appData.projects.push({
        id, name, desc,
        rules: { pairs: [], matchCase: false, wholeWord: false, autoCaps: false, dialogue: 0, abnormalCaps: 0, regexMode: 'chapter', customRegex: '' },
        lore: { entities: [], relations: [] }
    });
    saveData(); renderDashboard(); selectProject(id);
}
function selectProject(id) {
    appData.currentId = id; saveData();
    const p = getActive();
    if(p) document.getElementById('active-project-name').innerText = p.name;
    renderSettings(); renderEntities(); renderRelations();
}
function renderDashboard() {
    const grid = document.getElementById('story-list'); grid.innerHTML = '';
    appData.projects.forEach(p => {
        const div = document.createElement('div');
        div.className = 'settings-card'; div.style.cursor = 'pointer';
        div.innerHTML = `<h3>${p.name}</h3><p>${p.desc}</p><br><small>Thực thể: ${p.lore.entities.length}</small>`;
        div.onclick = () => { selectProject(p.id); document.querySelector('[data-tab="replace"]').click(); };
        grid.appendChild(div);
    });
}
function saveStory() {
    const id = document.getElementById('story-id').value;
    const name = document.getElementById('story-name').value;
    const desc = document.getElementById('story-desc').value;
    if(!name) return;
    if(id) { const p = appData.projects.find(x=>x.id===id); p.name=name; p.desc=desc; }
    else createProject(name, desc);
    closeModal('modal-story'); renderDashboard();
}

// ==========================================
// 4. SETTINGS (WEB 2 PAIRS)
// ==========================================
function renderSettings() {
    const p = getActive(); if(!p) return;
    const list = document.getElementById('punctuation-list'); list.innerHTML = '';
    p.rules.pairs.forEach((pair, idx) => {
        const item = document.createElement('div'); item.style.display = 'flex'; item.style.gap = '8px';
        item.innerHTML = `
            <input type="text" class="find-inp full-width-input" style="margin:0" value="${pair.find}" placeholder="Tìm">
            <input type="text" class="rep-inp full-width-input" style="margin:0" value="${pair.replace}" placeholder="Thay">
            <button class="btn btn-outline del-pair" data-idx="${idx}" style="color:red">X</button>
        `;
        item.querySelectorAll('input').forEach(inp => inp.oninput = () => { pair.find = item.querySelector('.find-inp').value; pair.replace = item.querySelector('.rep-inp').value; saveData(); });
        item.querySelector('.del-pair').onclick = (e) => { p.rules.pairs.splice(idx, 1); saveData(); renderSettings(); };
        list.appendChild(item);
    });
    
    const updBtn = (id, val, txt) => { const b = document.getElementById(id); b.innerText = `${txt}: ${val?'BẬT':'Tắt'}`; val ? b.classList.add('active') : b.classList.remove('active'); };
    updBtn('match-case', p.rules.matchCase, 'Match Case');
    updBtn('whole-word', p.rules.wholeWord, 'Whole Word');
    updBtn('auto-caps', p.rules.autoCaps, 'Auto Caps');
    document.getElementById('setting-dialogue').value = p.rules.dialogue;
    document.getElementById('setting-abnormal-caps').value = p.rules.abnormalCaps;
    document.getElementById('setting-regex-mode').value = p.rules.regexMode;
    document.getElementById('custom-regex-input').value = p.rules.customRegex;
}

// ==========================================
// 5. CORE REPLACE & SMART SCAN (WEB 2 + LORE)
// ==========================================
function normalizeInput(t) { return t ? t.normalize('NFC').replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E]/g, '"').replace(/[\u2018\u2019\u201A\u201B\u275B\u275C]/g, "'").replace(/\u00A0/g, ' ') : ''; }
function escapeHTML(s) { return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function formatDialogue(t, mode) {
    if(mode==0) return t;
    return t.replace(/(^|[\n])([^:\n]+):\s*(?:\n\s*)?([“"'])([\s\S]*?)([”"'])/gm, (m, p1, p2, p3, p4, p5) => {
        if(mode==1) return `${p1}${p2.trim()}: "${p4.trim()}"`;
        if(mode==2) return `${p1}${p2.trim()}:\n\n"${p4.trim()}"`;
        if(mode==3) return `${p1}${p2.trim()}:\n\n- ${p4.trim()}`;
        return m;
    });
}

function runReplace() {
    const p = getActive(); if(!p) return;
    let txt = normalizeInput(document.getElementById('input-text').value);
    if(!txt) return alert("Chưa có chữ!");
    let countR = 0, countC = 0;
    
    // 1. User Replace
    const validPairs = p.rules.pairs.filter(x => x.find.trim()).sort((a,b)=>b.find.length-a.find.length);
    validPairs.forEach(r => {
        const flag = p.rules.matchCase ? 'g' : 'gi';
        const pat = r.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = p.rules.wholeWord ? new RegExp(`(?<![\\p{L}\\p{N}_])${pat}(?![\\p{L}\\p{N}_])`, flag+'u') : new RegExp(pat, flag);
        txt = txt.replace(reg, m => { countR++; return `${MARK_REP_S}${r.replace}${MARK_REP_E}`; });
    });

    // 2. Abnormal Caps
    if(p.rules.abnormalCaps == 1) txt = txt.replace(/(?<=[\p{Ll},;]\s+)([\p{Lu}][\p{Ll}]+)/gum, m => m.toLowerCase());

    // 3. Auto Caps
    if(p.rules.autoCaps) {
        txt = txt.replace(/(^|[.?!]\s+|:\s*["“]\s*)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu, (m, pre, mS, mC, mE, rW) => {
            let tw = mC || rW; if(!tw) return m;
            let cw = tw.charAt(0).toUpperCase() + tw.slice(1);
            if(mS) { countC++; return `${pre}${MARK_B_S}${cw}${MARK_B_E}`; }
            if(rW.charAt(0) !== rW.charAt(0).toUpperCase()) { countC++; return `${pre}${MARK_CAP_S}${cw}${MARK_CAP_E}`; }
            return m;
        });
    }

    // 4. Format & Cleanup
    txt = formatDialogue(txt, p.rules.dialogue).split(/\r?\n/).map(l=>l.trim()).filter(l=>l!=='').join('\n\n');

    // 5. Render HTML
    let out = '', buf = '';
    for(let i=0; i<txt.length; i++) {
        let c = txt[i];
        if(c===MARK_REP_S) { out += escapeHTML(buf) + '<mark class="hl-yellow">'; buf=''; }
        else if(c===MARK_REP_E || c===MARK_CAP_E || c===MARK_B_E) { out += escapeHTML(buf) + '</mark>'; buf=''; }
        else if(c===MARK_CAP_S) { out += escapeHTML(buf) + '<mark class="hl-blue">'; buf=''; }
        else if(c===MARK_B_S) { out += escapeHTML(buf) + '<mark class="hl-orange">'; buf=''; }
        else buf += c;
    }
    out += escapeHTML(buf);
    document.getElementById('output-text').innerHTML = out;
    document.getElementById('count-replace').innerText = `Rep: ${countR}`;
    document.getElementById('count-caps').innerText = `Caps: ${countC}`;

    // 6. SMART SCAN TÊN RIÊNG (Logic cốt lõi)
    // Bắt cụm 2 từ viết hoa trở lên nằm giữa câu
    const scanReg = /(?<=[\p{Ll}]\s+)([\p{Lu}][\p{Ll}]+\s+[\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+)?)(?=\s+[\p{Ll}\p{P}]|[\p{P}])/gum;
    let rawResultText = document.getElementById('output-text').innerText;
    let matches = rawResultText.match(scanReg) || [];
    
    // Lọc trùng và kiểm tra xem đã có trong Entities chưa
    let uniqueNames = [...new Set(matches)];
    let newNames = uniqueNames.filter(name => {
        let exist = p.lore.entities.some(e => e.name === name || e.aliases.includes(name));
        return !exist;
    });

    if(newNames.length > 0) {
        const tBody = document.getElementById('scan-results'); tBody.innerHTML = '';
        newNames.forEach(n => {
            tBody.innerHTML += `<label style="display:block; margin-bottom:5px; cursor:pointer;"><input type="checkbox" value="${n}" checked> <strong>${n}</strong></label>`;
        });
        document.getElementById('scan-toast').classList.remove('hidden');
    }
}

// ==========================================
// 6. CHIA CHƯƠNG (WEB 2)
// ==========================================
function performSplit() {
    const txt = document.getElementById('split-input-text').value; if(!txt) return;
    const type = document.querySelector('input[name="split-type"]:checked').value;
    const count = parseInt(document.getElementById('split-count-select').value);
    const wrap = document.getElementById('split-outputs-wrapper'); wrap.innerHTML = '';

    if(type === 'count') {
        const pars = txt.split('\n').filter(p=>p.trim());
        const target = Math.ceil(pars.length / count);
        let cur = [], res = [];
        for(let p of pars) {
            if(cur.length >= target && res.length < count-1) { res.push(cur.join('\n\n')); cur = [p]; }
            else cur.push(p);
        }
        if(cur.length) res.push(cur.join('\n\n'));
        res.forEach((r, i) => {
            wrap.innerHTML += `<div class="split-box"><div class="pane-header">Phần ${i+1}</div><textarea readonly>${r}</textarea></div>`;
        });
    } else {
        const p = getActive();
        let regStr = /(?:Chương|Chapter)\s+\d+/gi;
        if(p.rules.regexMode === 'book') regStr = /(?:Hồi|Quyển)\s+(?:\d+|[IVXLCDM]+)/gi;
        if(p.rules.regexMode === 'custom' && p.rules.customRegex) regStr = new RegExp(p.rules.customRegex, 'gmi');
        
        const matches = [...txt.matchAll(regStr)];
        if(!matches.length) return alert("Không tìm thấy chương!");
        for(let i=0; i<matches.length; i++) {
            let start = matches[i].index;
            let end = i < matches.length-1 ? matches[i+1].index : txt.length;
            let chunk = txt.substring(start, end).trim();
            wrap.innerHTML += `<div class="split-box"><div class="pane-header">Chương ${i+1}</div><textarea readonly>${chunk}</textarea></div>`;
        }
    }
}

// ==========================================
// 7. LORE CRUD (WEB 3)
// ==========================================
function renderEntities() {
    const p = getActive(); if(!p) return;
    const tb = document.getElementById('entity-list-body'); tb.innerHTML = '';
    p.lore.entities.forEach(e => {
        tb.innerHTML += `<tr><td><strong>${e.name}</strong></td><td>${e.type}</td><td>${e.aliases.join(', ')}</td><td></td>
        <td><button class="btn btn-outline" style="color:red; padding:4px 8px;" onclick="delEnt('${e.id}')">Xóa</button></td></tr>`;
    });
    // Update select options cho Relations
    const opts = p.lore.entities.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    document.getElementById('rel-from').innerHTML = opts; document.getElementById('rel-to').innerHTML = opts;
}
function saveEntity() {
    const p = getActive(); const name = document.getElementById('ent-name').value; if(!name) return;
    p.lore.entities.push({
        id: 'e-'+Date.now(), name, type: document.getElementById('ent-type').value,
        aliases: document.getElementById('ent-aliases').value.split(',').map(x=>x.trim()).filter(x=>x)
    });
    saveData(); closeModal('modal-entity'); renderEntities();
}
function delEnt(id) { getActive().lore.entities = getActive().lore.entities.filter(x=>x.id!==id); saveData(); renderEntities(); }

function renderRelations() {
    const p = getActive(); if(!p) return;
    const tb = document.getElementById('relation-list-body'); tb.innerHTML = '';
    const getName = id => { const e = p.lore.entities.find(x=>x.id===id); return e ? e.name : id; };
    p.lore.relations.forEach(r => {
        tb.innerHTML += `<tr><td><strong>${getName(r.from)}</strong></td><td>${r.type}</td><td><strong>${getName(r.to)}</strong></td><td></td>
        <td><button class="btn btn-outline" style="color:red; padding:4px 8px;" onclick="delRel('${r.id}')">Xóa</button></td></tr>`;
    });
}
function saveRelation() {
    getActive().lore.relations.push({
        id: 'r-'+Date.now(), from: document.getElementById('rel-from').value,
        type: document.getElementById('rel-type').value, to: document.getElementById('rel-to').value
    });
    saveData(); closeModal('modal-relation'); renderRelations();
}
function delRel(id) { getActive().lore.relations = getActive().lore.relations.filter(x=>x.id!==id); saveData(); renderRelations(); }

// ==========================================
// 8. EVENTS & MODALS
// ==========================================
function initEvents() {
    // Buttons setting
    const tg = (prop) => { getActive().rules[prop] = !getActive().rules[prop]; saveData(); renderSettings(); };
    document.getElementById('match-case').onclick = () => tg('matchCase');
    document.getElementById('whole-word').onclick = () => tg('wholeWord');
    document.getElementById('auto-caps').onclick = () => tg('autoCaps');
    document.getElementById('add-pair').onclick = () => { getActive().rules.pairs.unshift({find:'', replace:''}); saveData(); renderSettings(); };
    
    // Selects setting
    ['dialogue', 'abnormal-caps', 'regex-mode'].forEach(id => {
        document.getElementById(`setting-${id}`).onchange = e => {
            let key = id.replace(/-([a-z])/g, g => g[1].toUpperCase());
            getActive().rules[key] = e.target.value; saveData();
        };
    });
    document.getElementById('custom-regex-input').oninput = e => { getActive().rules.customRegex = e.target.value; saveData(); };
    
    // Actions
    document.getElementById('replace-button').onclick = runReplace;
    document.getElementById('split-action-btn').onclick = performSplit;
    document.getElementById('copy-button').onclick = () => navigator.clipboard.writeText(document.getElementById('output-text').innerText);
    
    // Scan Save
    document.getElementById('btn-save-scanned').onclick = () => {
        const p = getActive();
        document.querySelectorAll('#scan-results input:checked').forEach(cb => {
            p.lore.entities.push({ id: 'e-'+Date.now()+Math.random(), name: cb.value, type: 'character', aliases: [] });
        });
        saveData(); renderEntities();
        document.getElementById('scan-toast').classList.add('hidden');
    };
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function resetStoryForm() { document.getElementById('story-id').value=''; document.getElementById('story-name').value=''; document.getElementById('story-desc').value=''; }
function openEntityModal() { document.getElementById('ent-id').value=''; document.getElementById('ent-name').value=''; document.getElementById('ent-aliases').value=''; openModal('modal-entity'); }
function openRelationModal() { document.getElementById('rel-type').value=''; openModal('modal-relation'); }
