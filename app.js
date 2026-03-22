// CẤU TRÚC DỮ LIỆU LÕI (Sẽ lưu thành file JSON để Sync Cloud)
let appData = {
    currentProjectId: null,
    syncPass: "",
    projects: [
        // Dummy data mẫu để bạn hình dung cấu trúc
        {
            id: "p-123456",
            name: "Truyện Bách Hợp Demo",
            desc: "Dự án đang dịch",
            lastUpdated: Date.now(),
            rules: { // Data của Web 2
                pairs: [],
                matchCase: false,
                wholeWord: false,
                autoCaps: true,
                dialogueMode: 1,
                regexMode: 'chapter'
            },
            lore: { // Data của Web 3
                entities: [],
                relations: []
            }
        }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Khởi tạo UI
    initSidebar();
    initTabs();
    
    // 2. Load dự án mặc định (Giả lập)
    if(appData.projects.length > 0) {
        appData.currentProjectId = appData.projects[0].id;
        document.querySelector('.project-name').textContent = appData.projects[0].name;
    }

    // 3. Giả lập luồng: Bấm Replace -> Quét tên -> Hiện Toast
    document.getElementById('btn-run-replace').addEventListener('click', () => {
        // ... (Logic Replace sẽ nhét vào đây ở Phase sau) ...
        console.log("Đã chạy Replace xong!");

        // Giả lập quét ra được vài tên riêng
        let fakeScannedNames = ["Lãnh Cung", "Tố Vấn", "Sư Tôn"];
        showScanToast(fakeScannedNames);
    });

    document.getElementById('close-toast').addEventListener('click', () => {
        document.getElementById('scan-toast').classList.add('hidden');
    });
});

// --- HÀM ĐIỀU KHIỂN SIDEBAR ---
function initSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    
    toggleBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('expanded')) {
            sidebar.classList.remove('expanded');
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('expanded');
        }
    });
}

// --- HÀM CHUYỂN TAB ---
function initTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Xóa active hiện tại
            navItems.forEach(n => n.classList.remove('active'));
            tabPanes.forEach(t => t.classList.remove('active'));

            // Set active cho tab mới
            item.classList.add('active');
            const targetId = 'tab-' + item.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// --- HÀM HIỂN THỊ TOAST GỢI Ý TÊN RIÊNG ---
function showScanToast(namesArray) {
    const toast = document.getElementById('scan-toast');
    const resultBox = document.getElementById('scan-results');
    
    resultBox.innerHTML = ''; // Xóa kết quả cũ
    
    namesArray.forEach((name, index) => {
        // Render checkbox cho từng tên
        const div = document.createElement('div');
        div.style.marginBottom = "8px";
        div.innerHTML = `
            <label style="cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" value="${name}" checked>
                <strong>${name}</strong>
            </label>
        `;
        resultBox.appendChild(div);
    });

    // Trượt panel lên
    toast.classList.remove('hidden');
}
