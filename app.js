// ==========================================
// 1. STATE & STORAGE MANAGEMENT
// ==========================================
const STORAGE_KEY = 'trinhhg_allinone_v1';

let appData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    currentProjectId: 'p-default',
    syncPass: "",
    projects: [
        {
            id: 'p-default',
            name: 'Dự án Mặc định',
            rules: { 
                pairs: [{find: 'hắn', replace: 'y'}], // Data mẫu
                matchCase: false, wholeWord: false, autoCaps: true, 
                dialogueMode: 1, abnormalCapsMode: 1 
            },
            lore: { entities: [], relations: [] }
        }
    ]
};

// Hàm lấy project hiện tại để thao tác
function getActiveProject() {
    return appData.projects.find(p => p.id === appData.currentProjectId) || appData.projects[0];
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// MARKERS
const MARK_REP_START  = '\uE000'; const MARK_REP_END    = '\uE001';
const MARK_CAP_START  = '\uE002'; const MARK_CAP_END    = '\uE003';
const MARK_BOTH_START = '\uE004'; const MARK_BOTH_END   = '\uE005';

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    
    // Khởi tạo data lên UI
    document.querySelector('.project-name').textContent = getActiveProject().name;
    renderRulesUI();

    // Sự kiện nút Thay Thế
    document.getElementById('btn-run-replace').addEventListener('click', performReplaceAll);
    
    // Nút đóng Toast
    document.getElementById('close-toast').addEventListener('click', () => {
        document.getElementById('scan-toast').classList.add('hidden');
    });
});

// ==========================================
// 2. UI ĐIỀU KHIỂN (SIDEBAR & TABS)
// ==========================================
function initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
        sidebar.classList.toggle('collapsed');
    });
}

function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(t => t.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('tab-' + item.dataset.tab).classList.add('active');
        });
    });
}

// ==========================================
// 3. TAB CÀI ĐẶT THAY THẾ (QUẢN LÝ PAIRS)
// ==========================================
function renderRulesUI() {
    // Tạm thời mình map cái logic render cặp từ vào đây. 
    // Trên giao diện HTML tab-settings bạn cần bổ sung 1 div id="punctuation-list"
    const rules = getActiveProject().rules;
    const tabSettings = document.getElementById('tab-settings');
    
    // Tạo UI nhanh cho tab setting nếu chưa có
    if (!document.getElementById('punctuation-list')) {
        tabSettings.innerHTML = `
            <div class="top-bar">
                <h2>Cài đặt quy tắc Thay thế</h2>
                <button class="btn btn-primary" id="add-pair-btn">+ Thêm Cặp</button>
            </div>
            <div id="punctuation-list" style="display:flex; flex-direction:column; gap:10px;"></div>
        `;
        document.getElementById('add-pair-btn').addEventListener('click', () => {
            getActiveProject().rules.pairs.push({find: '', replace: ''});
            saveData(); renderRulesUI();
        });
    }

    const list = document.getElementById('punctuation-list');
    list.innerHTML = '';
    
    rules.pairs.forEach((p, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex'; item.style.gap = '10px';
        item.innerHTML = `
            <input type="text" class="find-inp" placeholder="Tìm..." value="${p.find}" style="flex:1; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
            <input type="text" class="rep-inp" placeholder="Thay thế..." value="${p.replace}" style="flex:1; padding:8px; border-radius:6px; border:1px solid #cbd5e1;">
            <button class="btn del-pair" data-idx="${idx}" style="background:#fee2e2; color:#ef4444; border:none; padding:8px 12px; border-radius:6px;">X</button>
        `;
        
        // Bắt sự kiện gõ phím để lưu luôn
        item.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', () => {
                p.find = item.querySelector('.find-inp').value;
                p.replace = item.querySelector('.rep-inp').value;
                saveData();
            });
        });
        
        item.querySelector('.del-pair').addEventListener('click', (e) => {
            rules.pairs.splice(e.target.dataset.idx, 1);
            saveData(); renderRulesUI();
        });
        
        list.appendChild(item);
    });
}

// ==========================================
// 4. CORE ENGINE XỬ LÝ TEXT (WEB 2)
// ==========================================
function normalizeInput(text) {
    if (!text) return '';
    let normalized = text.normalize('NFC');
    normalized = normalized.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u275D\u275E\u301D-\u301F\uFF02\u02DD]/g, '"');
    normalized = normalized.replace(/[\u2018\u2019\u201A\u201B\u2039\u203A\u275B\u275C\u276E\u276F\uA78C\uFF07]/g, "'");
    normalized = normalized.replace(/\u00A0/g, ' ');
    normalized = normalized.replace(/\u2026/g, '...');
    return normalized;
}

function escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function preserveCase(o, r) {
    if (o === o.toUpperCase() && o !== o.toLowerCase()) return r.toUpperCase();
    if (o[0] === o[0].toUpperCase()) return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    return r;
}
function escapeHTML(str) { return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function performReplaceAll() {
    const rawText = document.querySelector('#tab-replace textarea').value;
    if (!rawText) return alert("Chưa có nội dung!");

    try {
        let processedText = normalizeInput(rawText);
        const rules = getActiveProject().rules;

        // B1: REPLACEMENT CỦA USER
        if (rules.pairs && rules.pairs.length > 0) {
            const validPairs = rules.pairs.filter(p => p.find && p.find.trim())
                .sort((a,b) => b.find.length - a.find.length);

            validPairs.forEach(rule => {
                const pattern = escapeRegExp(rule.find);
                const flags = rules.matchCase ? 'g' : 'gi';
                const regex = rules.wholeWord 
                    ? new RegExp(`(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])`, flags + 'u') 
                    : new RegExp(pattern, flags);
                
                processedText = processedText.replace(regex, (match) => {
                    let replacement = rule.replace;
                    if (!rules.matchCase) replacement = preserveCase(match, replacement);
                    return `${MARK_REP_START}${replacement}${MARK_REP_END}`;
                });
            });
        }

        // B2: AUTO CAPS CHỮ ĐẦU CÂU & SAU DẤU CÂU
        if (rules.autoCaps) {
            const autoCapsRegex = /(^|[.?!]\s+|:\s*["“]\s*)(?:(\uE000)(.*?)(\uE001)|([^\s\uE000\uE001]+))/gmu;
            processedText = processedText.replace(autoCapsRegex, (match, prefix, mStart, mContent, mEnd, rawWord) => {
                let targetWord = mContent || rawWord;
                if (!targetWord) return match;
                
                let cappedWord = targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
                
                if (mStart) {
                    return `${prefix}${MARK_BOTH_START}${cappedWord}${MARK_BOTH_END}`;
                } else {
                    if (rawWord.charAt(0) !== rawWord.charAt(0).toUpperCase()) {
                        return `${prefix}${MARK_CAP_START}${cappedWord}${MARK_CAP_END}`;
                    }
                    return match;
                }
            });
        }

        // B3: RENDER HTML & HIGHLIGHT (Màu highlight lấy từ Web 2)
        let finalHTML = ''; let buffer = '';
        for (let i = 0; i < processedText.length; i++) {
            const c = processedText[i];
            if (c === MARK_REP_START) { finalHTML += escapeHTML(buffer) + '<mark style="background:#fde047; padding: 0 2px; border-radius: 3px;">'; buffer = ''; }
            else if (c === MARK_REP_END || c === MARK_CAP_END || c === MARK_BOTH_END) { finalHTML += escapeHTML(buffer) + '</mark>'; buffer = ''; }
            else if (c === MARK_CAP_START) { finalHTML += escapeHTML(buffer) + '<mark style="background:#93c5fd; padding: 0 2px; border-radius: 3px;">'; buffer = ''; }
            else if (c === MARK_BOTH_START) { finalHTML += escapeHTML(buffer) + '<mark style="background:#fdba74; padding: 0 2px; border-radius: 3px;">'; buffer = ''; }
            else { buffer += c; }
        }
        finalHTML += escapeHTML(buffer);

        // Đổ kết quả ra màn hình
        document.querySelector('.output-div').innerHTML = finalHTML;
        
        // --- CHỖ NÀY DÀNH CHO PHASE 3: AUTO-SCAN TÊN RIÊNG ---
        // showScanToast(["Nhân Vật Test", "Địa Danh Mẫu"]);

    } catch (e) {
        console.error(e);
        alert("Lỗi: " + e.message);
    }
}
