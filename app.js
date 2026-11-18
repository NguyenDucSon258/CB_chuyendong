/**
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ NGƯỜI RA VÀO BẰNG CẢM BIẾN HỒNG NGOẠI (PIR IoT)
 * Tác giả: Senior Front-end Developer & IoT Web Architect
 * Ngôn ngữ: JavaScript thuần (ES6+)
 * Chức năng: Quản lý trạng thái người ra vào qua cảm biến PIR, điều khiển đèn/tải Rơ-le,
 *             mô phỏng luồng tín hiệu ra vào, lưu trữ nhật ký JSON trong LocalStorage,
 *             tổng hợp âm thanh cảnh báo Web Audio API & hỗ trợ Chế độ Sáng / Tối.
 * ==============================================================================
 */

'use strict';

/* ==============================================================================
   1. CẤU TRÚC DỮ LIỆU & HẰNG SỐ HỆ THỐNG (DATA SCHEMAS & CONSTANTS)
   ============================================================================== */

// Khóa lưu trữ LocalStorage
const STORAGE_KEYS = {
    CONFIG: 'quanly_ra_vao_config',
    LOGS: 'quanly_ra_vao_logs',
    AUDIO_MUTED: 'quanly_ra_vao_audio_muted',
    HARDWARE_ONLINE: 'quanly_ra_vao_hw_online',
    THEME: 'quanly_ra_vao_theme'
};

// Cấu hình cảm biến & thiết bị cửa mặc định
const DEFAULT_CONFIG = {
    deviceId: 'ESP32-QUANLY-RAVAO-01',
    location: 'Cửa chính (Cổng A)',
    sensitivity: 'Trung bình (Tầm 5m - 90°)',
    timeoutSeconds: 15,
    autoLighting: true,
    manualOverride: false
};

// Định nghĩa từ điển loại sự kiện ra vào (Event Types)
const EVENT_TYPES = {
    MOTION_START: {
        code: 'MOTION_START',
        label: 'Phát hiện có người ra/vào',
        badgeClass: 'motion-start',
        statusText: 'Cảnh báo',
        statusClass: 'warning'
    },
    MOTION_STOP: {
        code: 'MOTION_STOP',
        label: 'Không có người (Cửa trống)',
        badgeClass: 'motion-stop',
        statusText: 'Cửa trống',
        statusClass: 'idle'
    },
    RELAY_ON: {
        code: 'RELAY_ON',
        label: 'Đèn cửa BẬT',
        badgeClass: 'relay-on',
        statusText: 'Đang chiếu sáng',
        statusClass: 'success'
    },
    RELAY_OFF: {
        code: 'RELAY_OFF',
        label: 'Đèn cửa TẮT',
        badgeClass: 'relay-off',
        statusText: 'Đã ngắt đèn',
        statusClass: 'idle'
    }
};

/* ==============================================================================
   2. TRẠNG THÁI ỨNG DỤNG (APPLICATION RUNTIME STATE)
   ============================================================================== */

const AppState = {
    // Chế độ giao diện (mặc định là 'light' cho nền sáng êm dịu)
    currentTheme: 'light',

    // Dữ liệu cấu hình tải từ LocalStorage
    config: { ...DEFAULT_CONFIG },

    // Danh sách bản ghi nhật ký người ra vào
    logs: [],

    // Trạng thái phần cứng & cảm biến thời gian thực
    isHardwareOnline: true,
    isMotionActive: false,
    isRelayOn: false,
    lastDetectedTimestamp: null,

    // Bộ đếm đếm lùi thời gian tự tắt đèn
    countdownSeconds: 0,
    countdownTimerInterval: null,

    // Bộ giả lập luồng người ra vào tự động (Auto Stream Simulator)
    autoStreamTimer: null,
    isAutoStreamRunning: false,

    // Cài đặt âm thanh Web Audio
    isAudioMuted: false,
    audioCtx: null
};

/* ==============================================================================
   3. KHỞI TẠO HỆ THỐNG KHI TẢI TRANG (BOOTSTRAP & INITIALIZATION)
   ============================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    console.log('%c[Quản Lý Người Ra Vào] Khởi tạo hệ thống IoT...', 'color: #2563eb; font-weight: bold;');
    
    // 1. Tải cấu hình, theme và nhật ký từ LocalStorage
    loadStoredConfig();
    loadStoredLogs();

    // 2. Liên kết các phần tử DOM giao diện
    bindDOMElements();

    // 3. Áp dụng Theme giao diện sáng/tối
    applyThemeToUI();

    // 4. Khởi chạy Đồng hồ thời gian thực
    startRealtimeClock();

    // 5. Khởi chạy bộ cập nhật thời gian tương đối
    startRelativeTimeUpdater();

    // 6. Cập nhật giao diện ban đầu
    applyConfigToUI();
    renderMetrics();
    renderLogsTable();

    // Thông báo chào mừng
    showToast('Hệ thống Quản Lý Người Ra Vào đã sẵn sàng hoạt động', 'info');
});

/* ==============================================================================
   4. THAO TÁC LOCALSTORAGE & QUẢN LÝ DỮ LIỆU JSON
   ============================================================================== */

/**
 * Tải cấu hình từ LocalStorage
 */
function loadStoredConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
        if (stored) {
            AppState.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
        } else {
            AppState.config = { ...DEFAULT_CONFIG };
            saveConfigToStorage();
        }
    } catch (err) {
        console.error('Lỗi khi tải sensor_config từ LocalStorage:', err);
        AppState.config = { ...DEFAULT_CONFIG };
    }

    // Tải trạng thái theme (mặc định 'light' theo yêu cầu nền sáng)
    const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    AppState.currentTheme = storedTheme ? storedTheme : 'light';

    // Tải trạng thái còi báo âm thanh
    AppState.isAudioMuted = localStorage.getItem(STORAGE_KEYS.AUDIO_MUTED) === 'true';

    // Tải trạng thái phần cứng (mặc định online)
    const storedHw = localStorage.getItem(STORAGE_KEYS.HARDWARE_ONLINE);
    AppState.isHardwareOnline = storedHw !== null ? storedHw === 'true' : true;
}

/**
 * Lưu cấu hình JSON vào LocalStorage
 */
function saveConfigToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(AppState.config, null, 2));
    } catch (err) {
        console.error('Lỗi khi lưu cấu hình vào LocalStorage:', err);
    }
}

/**
 * Tải danh sách nhật ký từ LocalStorage
 */
function loadStoredLogs() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
        if (stored) {
            AppState.logs = JSON.parse(stored);
            // Lấy timestamp của lượt ra vào gần nhất nếu có
            const lastMotion = AppState.logs.find(log => log.eventType === 'MOTION_START');
            if (lastMotion) {
                AppState.lastDetectedTimestamp = new Date(lastMotion.timestamp);
            }
        } else {
            // Nếu chưa có nhật ký nào, tạo mẫu một vài bản ghi ban đầu
            seedInitialSampleLogs();
        }
    } catch (err) {
        console.error('Lỗi khi tải access_logs từ LocalStorage:', err);
        AppState.logs = [];
    }
}

/**
 * Lưu danh sách nhật ký JSON vào LocalStorage
 */
function saveLogsToStorage() {
    try {
        // Giới hạn lưu trữ tối đa 300 bản ghi mới nhất để tối ưu hiệu năng
        if (AppState.logs.length > 300) {
            AppState.logs = AppState.logs.slice(0, 300);
        }
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(AppState.logs));
    } catch (err) {
        console.error('Lỗi khi lưu nhật ký vào LocalStorage:', err);
    }
}

/**
 * Tạo dữ liệu mẫu ban đầu nếu máy khách lần đầu mở ứng dụng
 */
function seedInitialSampleLogs() {
    const now = new Date();
    const sampleEvents = [
        {
            offsetMin: 22,
            eventType: 'RELAY_OFF',
            duration: '15s',
            status: 'idle',
            details: 'Đèn cửa tự tắt khi không còn người qua lại'
        },
        {
            offsetMin: 22.25,
            eventType: 'MOTION_STOP',
            duration: '15s',
            status: 'idle',
            details: 'Khu vực cửa kiểm soát trở lại trạng thái trống'
        },
        {
            offsetMin: 22.5,
            eventType: 'RELAY_ON',
            duration: '15s',
            status: 'success',
            details: 'Đèn cửa tự động bật khi có người vào'
        },
        {
            offsetMin: 22.5,
            eventType: 'MOTION_START',
            duration: '15s',
            status: 'warning',
            details: 'Phát hiện có người ra vào qua cảm biến hồng ngoại'
        }
    ];

    AppState.logs = sampleEvents.map((item, index) => {
        const time = new Date(now.getTime() - item.offsetMin * 60 * 1000);
        return {
            id: `LOG-${time.getFullYear()}${String(time.getMonth() + 1).padStart(2, '0')}${String(time.getDate()).padStart(2, '0')}-${String(100 - index).padStart(3, '0')}`,
            timestamp: time.toISOString(),
            formattedTime: formatTimestamp(time),
            eventType: item.eventType,
            duration: item.duration,
            location: AppState.config.location,
            status: item.status,
            details: item.details
        };
    });

    AppState.lastDetectedTimestamp = new Date(now.getTime() - 22.5 * 60 * 1000);
    saveLogsToStorage();
}

/**
 * Ghi nhận một sự kiện người ra vào mới và cập nhật LocalStorage
 */
function appendAccessLog(eventType, duration = '-', details = '') {
    const now = new Date();
    const eventDef = EVENT_TYPES[eventType] || {
        code: eventType,
        label: eventType,
        badgeClass: 'motion-stop',
        statusClass: 'idle'
    };

    // Tạo ID theo định dạng: LOG-YYYYMMDD-HHMMSS
    const id = `LOG-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const newLog = {
        id,
        timestamp: now.toISOString(),
        formattedTime: formatTimestamp(now),
        eventType: eventType,
        duration: duration,
        location: AppState.config.location,
        status: eventDef.statusClass,
        details: details || eventDef.label
    };

    // Chèn lên đầu danh sách (mới nhất lên trên)
    AppState.logs.unshift(newLog);
    saveLogsToStorage();

    // Chèn trực tiếp một dòng DOM lên đầu bảng để hiệu ứng mượt mà
    insertRowToTable(newLog);

    // Cập nhật lại số liệu thống kê
    renderMetrics();

    return newLog;
}

/* ==============================================================================
   5. LOGIC ĐIỀU KHIỂN CẢM BIẾN & RƠ-LE CỬA (PIR & RELAY LOGIC)
   ============================================================================== */

/**
 * Kích hoạt mô phỏng tín hiệu có người ra/vào qua Cảm biến PIR
 */
function triggerMotionDetection() {
    // Kiểm tra xem phần cứng có đang kết nối không
    if (!AppState.isHardwareOnline) {
        showToast('Không thể kích hoạt! Phần cứng ESP32 Quản lý đang OFFLINE.', 'danger');
        playBeepSound(220, 200, 'sawtooth');
        return;
    }

    const now = new Date();
    AppState.lastDetectedTimestamp = now;
    AppState.isMotionActive = true;

    // Phát âm thanh cảnh báo âm bổng công nghệ cao
    playBeepSound(880, 150, 'sine');

    // Thông báo toast
    showToast(`Phát hiện người ra/vào tại: ${AppState.config.location}!`, 'info');

    // Ghi nhật ký phát hiện người ra/vào
    appendAccessLog('MOTION_START', `${AppState.config.timeoutSeconds}s`, 'Cảm biến hồng ngoại phát hiện có người ra/vào');

    // Xử lý bật rơ-le / đèn nếu chế độ tự động chiếu sáng được kích hoạt
    if (AppState.config.autoLighting || AppState.config.manualOverride) {
        turnRelayOn(`${AppState.config.timeoutSeconds}s`);
    }

    // Cập nhật giao diện cảm biến
    updateSensorUI();
    renderMetrics();

    // Thiết lập / Đặt lại bộ đếm lùi thời gian trễ tự tắt (Delay Time)
    startRelayCountdown();
}

/**
 * Bắt đầu hoặc làm mới bộ đếm lùi thời gian tự tắt đèn cửa
 */
function startRelayCountdown() {
    // Nếu đang ở chế độ Manual Override (Bật cưỡng bức), không chạy đếm lùi tự tắt
    if (AppState.config.manualOverride) {
        clearInterval(AppState.countdownTimerInterval);
        AppState.countdownSeconds = 0;
        updateRelayUI();
        return;
    }

    // Đặt lại số giây đếm lùi bằng cấu hình timeoutSeconds
    AppState.countdownSeconds = AppState.config.timeoutSeconds;
    const initialTimeout = AppState.config.timeoutSeconds;

    // Xóa interval cũ nếu đang chạy (trường hợp người di chuyển liên tục, làm mới bộ đếm)
    if (AppState.countdownTimerInterval) {
        clearInterval(AppState.countdownTimerInterval);
    }

    updateRelayUI();

    AppState.countdownTimerInterval = setInterval(() => {
        AppState.countdownSeconds--;

        // Cập nhật tiến trình phần trăm thanh progress bar
        const percent = (AppState.countdownSeconds / initialTimeout) * 100;
        const progressBar = document.getElementById('relayProgressBar');
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, percent)}%`;
        }

        const countdownNumber = document.getElementById('relayCountdownNumber');
        if (countdownNumber) {
            countdownNumber.textContent = `${AppState.countdownSeconds}s`;
        }

        // Khi thời gian đếm lùi chạm mức 0 -> Tắt tải & chuyển trạng thái về tĩnh
        if (AppState.countdownSeconds <= 0) {
            clearInterval(AppState.countdownTimerInterval);
            AppState.countdownTimerInterval = null;

            handleMotionAndRelayTimeout();
        }
    }, 1000);
}

/**
 * Xử lý khi hết thời gian trễ sau khi người ra vào
 */
function handleMotionAndRelayTimeout() {
    // Nếu Manual Override bật, đèn không tắt
    if (AppState.config.manualOverride) return;

    AppState.isMotionActive = false;
    updateSensorUI();

    // Ghi nhật ký hết người ra vào
    appendAccessLog('MOTION_STOP', '-', 'Khu vực cửa trở lại trạng thái trống');

    // Tắt đèn & ghi nhật ký
    turnRelayOff('Hết thời gian trễ sau khi người ra/vào');

    // Phát âm thanh tắt tải trầm nhẹ
    playBeepSound(440, 120, 'triangle');
}

/**
 * Bật Rơ-le tải đèn
 */
function turnRelayOn(durationText = '-') {
    if (!AppState.isRelayOn) {
        AppState.isRelayOn = true;
        appendAccessLog('RELAY_ON', durationText, 'Rơ-le đóng tiếp điểm, đèn chiếu sáng cửa được bật');
    }
    updateRelayUI();
}

/**
 * Tắt Rơ-le tải đèn
 */
function turnRelayOff(reason = '') {
    if (AppState.isRelayOn) {
        AppState.isRelayOn = false;
        appendAccessLog('RELAY_OFF', '-', reason || 'Rơ-le nhả tiếp điểm, ngắt đèn chiếu sáng cửa');
    }
    updateRelayUI();
}

/**
 * Xử lý công tắc Bật cưỡng bức Rơ-le (Manual Override)
 */
function handleManualOverrideToggle(isChecked) {
    AppState.config.manualOverride = isChecked;
    saveConfigToStorage();

    if (isChecked) {
        // Bật cưỡng bức ngay lập tức
        if (AppState.countdownTimerInterval) {
            clearInterval(AppState.countdownTimerInterval);
        }
        turnRelayOn('Thủ công (Override)');
        showToast('Đã kích hoạt BẬT CƯỠNG BỨC đèn cửa (Manual Override)', 'warning');
    } else {
        showToast('Đã chuyển về chế độ Tự Động theo Cảm Biến Ra Vào', 'info');
        // Nếu hiện tại không có người thì tắt relay ngay
        if (!AppState.isMotionActive) {
            turnRelayOff('Hủy chế độ cưỡng bức');
        } else {
            // Nếu đang có người, chạy lại đếm lùi
            startRelayCountdown();
        }
    }
    updateRelayUI();
}

/**
 * Chuyển đổi trạng thái Phần cứng ESP32 Online / Offline
 */
function toggleHardwareConnection() {
    AppState.isHardwareOnline = !AppState.isHardwareOnline;
    localStorage.setItem(STORAGE_KEYS.HARDWARE_ONLINE, String(AppState.isHardwareOnline));

    updateHardwareConnectionUI();

    if (AppState.isHardwareOnline) {
        showToast('Kết nối phần cứng ESP32 / Cảm biến: ONLINE', 'success');
        playBeepSound(600, 100, 'sine');
    } else {
        showToast('Mất kết nối phần cứng ESP32 Quản lý: OFFLINE', 'danger');
        playBeepSound(300, 250, 'sawtooth');
        // Nếu offline và đang có tín hiệu, ngắt
        if (AppState.isMotionActive && !AppState.config.manualOverride) {
            AppState.isMotionActive = false;
            updateSensorUI();
        }
    }
}

/**
 * Chuyển đổi chế độ Tự động mô phỏng luồng người ra vào (Auto Stream)
 */
function toggleAutoStreamSimulator(isChecked) {
    AppState.isAutoStreamRunning = isChecked;

    if (isChecked) {
        showToast('Đã bật mô phỏng luồng người ra vào tự động', 'info');
        runAutoStreamLoop();
    } else {
        if (AppState.autoStreamTimer) {
            clearTimeout(AppState.autoStreamTimer);
            AppState.autoStreamTimer = null;
        }
        showToast('Đã dừng mô phỏng luồng người ra vào', 'warning');
    }
}

function runAutoStreamLoop() {
    if (!AppState.isAutoStreamRunning) return;

    // Tạo thời gian ngẫu nhiên giữa các lượt người ra vào (8s đến 18s)
    const randomDelay = Math.floor(Math.random() * (18000 - 8000 + 1)) + 8000;

    AppState.autoStreamTimer = setTimeout(() => {
        if (AppState.isAutoStreamRunning) {
            triggerMotionDetection();
            runAutoStreamLoop(); // Tiếp tục vòng lặp
        }
    }, randomDelay);
}

/* ==============================================================================
   6. CẬP NHẬT GIAO DIỆN NGƯỜI DÙNG (DOM MANIPULATION & UI RENDERING)
   ============================================================================= */

let DOM = {};

function bindDOMElements() {
    DOM = {
        // Header & Theme
        themeToggleBtn: document.getElementById('themeToggleBtn'),
        themeIconSun: document.getElementById('themeIconSun'),
        themeIconMoon: document.getElementById('themeIconMoon'),
        hwConnectionBadge: document.getElementById('hwConnectionBadge'),
        hwStatusText: document.getElementById('hwStatusText'),
        audioToggleBtn: document.getElementById('audioToggleBtn'),
        audioIconOn: document.getElementById('audioIconOn'),
        audioIconOff: document.getElementById('audioIconOff'),
        realtimeClock: document.getElementById('realtimeClock'),
        realtimeDate: document.getElementById('realtimeDate'),

        // Metrics
        metricTotalDetections: document.getElementById('metricTotalDetections'),
        todayDetectionTag: document.getElementById('todayDetectionTag'),
        sensorStatusBadge: document.getElementById('sensorStatusBadge'),
        sensorStatusText: document.getElementById('sensorStatusText'),
        sensorIconBubble: document.getElementById('sensorIconBubble'),
        sensorModeText: document.getElementById('sensorModeText'),
        relayStateText: document.getElementById('relayStateText'),
        relayCountdownBadge: document.getElementById('relayCountdownBadge'),
        relayCountdownNumber: document.getElementById('relayCountdownNumber'),
        relayProgressBar: document.getElementById('relayProgressBar'),
        metricLastDetectedTime: document.getElementById('metricLastDetectedTime'),
        metricLastDetectedRelative: document.getElementById('metricLastDetectedRelative'),
        metricCurrentLocation: document.getElementById('metricCurrentLocation'),

        // Controls
        btnTriggerMotion: document.getElementById('btnTriggerMotion'),
        autoStreamToggle: document.getElementById('autoStreamToggle'),
        manualRelayToggle: document.getElementById('manualRelayToggle'),
        autoLightingToggle: document.getElementById('autoLightingToggle'),
        timeoutSlider: document.getElementById('timeoutSlider'),
        timeoutDisplay: document.getElementById('timeoutDisplay'),
        locationSelect: document.getElementById('locationSelect'),
        sensitivitySelect: document.getElementById('sensitivitySelect'),
        btnSaveConfig: document.getElementById('btnSaveConfig'),
        btnViewConfigJson: document.getElementById('btnViewConfigJson'),
        presetBtns: document.querySelectorAll('.preset-btn'),

        // Logs
        accessLogsTable: document.getElementById('accessLogsTable'),
        logsTableBody: document.getElementById('logsTableBody'),
        logsEmptyState: document.getElementById('logsEmptyState'),
        logCounterTag: document.getElementById('logCounterTag'),
        logSearchInput: document.getElementById('logSearchInput'),
        logFilterSelect: document.getElementById('logFilterSelect'),
        btnClearLogs: document.getElementById('btnClearLogs'),
        btnExportJson: document.getElementById('btnExportJson'),
        btnSeedSampleData: document.getElementById('btnSeedSampleData'),

        // Modal JSON
        configJsonModal: document.getElementById('configJsonModal'),
        configJsonContent: document.getElementById('configJsonContent'),
        btnCloseConfigModal: document.getElementById('btnCloseConfigModal'),
        btnCloseConfigModal2: document.getElementById('btnCloseConfigModal2'),
        btnCopyConfigJson: document.getElementById('btnCopyConfigJson'),

        // Toast Container
        toastContainer: document.getElementById('toastContainer')
    };

    attachEventListeners();
}

/**
 * Đăng ký tất cả các sự kiện tương tác
 */
function attachEventListeners() {
    // 0. Chuyển đổi Theme Sáng / Tối
    DOM.themeToggleBtn.addEventListener('click', toggleTheme);

    // 1. Nút kích hoạt mô phỏng
    DOM.btnTriggerMotion.addEventListener('click', () => {
        triggerMotionDetection();
    });

    // Phím tắt Spacebar để kích hoạt mô phỏng nhanh khi đang test
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
            triggerMotionDetection();
        }
    });

    // 2. Chuyển đổi trạng thái phần cứng (Click vào badge trên topbar)
    DOM.hwConnectionBadge.addEventListener('click', toggleHardwareConnection);

    // 3. Nút bật/tắt âm thanh
    DOM.audioToggleBtn.addEventListener('click', toggleAudioMute);

    // 4. Toggle luồng người ra vào tự động
    DOM.autoStreamToggle.addEventListener('change', (e) => {
        toggleAutoStreamSimulator(e.target.checked);
    });

    // 5. Toggle Manual Override
    DOM.manualRelayToggle.addEventListener('change', (e) => {
        handleManualOverrideToggle(e.target.checked);
    });

    // 6. Toggle Auto Lighting
    DOM.autoLightingToggle.addEventListener('change', (e) => {
        AppState.config.autoLighting = e.target.checked;
        saveConfigToStorage();
        showToast(`Tự động bật đèn khi có người: ${e.target.checked ? 'ĐÃ BẬT' : 'ĐÃ TẮT'}`, 'info');
    });

    // 7. Slider thời gian trễ (Delay Time)
    DOM.timeoutSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        DOM.timeoutDisplay.textContent = `${val}s`;
        updateActivePresetButton(val);
    });

    DOM.timeoutSlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        AppState.config.timeoutSeconds = val;
        saveConfigToStorage();
    });

    // Các nút preset thời gian nhanh (10s, 15s, 30s, 60s, 120s)
    DOM.presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const time = parseInt(btn.dataset.time, 10);
            DOM.timeoutSlider.value = time;
            DOM.timeoutDisplay.textContent = `${time}s`;
            AppState.config.timeoutSeconds = time;
            saveConfigToStorage();
            updateActivePresetButton(time);
        });
    });

    // 8. Chọn Vị trí cửa giám sát
    DOM.locationSelect.addEventListener('change', (e) => {
        AppState.config.location = e.target.value;
        DOM.metricCurrentLocation.textContent = e.target.value;
        saveConfigToStorage();
    });

    // 9. Chọn Độ nhạy cảm biến
    DOM.sensitivitySelect.addEventListener('change', (e) => {
        AppState.config.sensitivity = e.target.value;
        saveConfigToStorage();
    });

    // 10. Nút Lưu Cấu Hình Thủ Công
    DOM.btnSaveConfig.addEventListener('click', () => {
        saveConfigToStorage();
        showToast('Đã lưu cấu hình thiết bị ra vào vào LocalStorage thành công!', 'success');
    });

    // 11. Modal Xem JSON Cấu hình
    DOM.btnViewConfigJson.addEventListener('click', openConfigJsonModal);
    DOM.btnCloseConfigModal.addEventListener('click', closeConfigJsonModal);
    DOM.btnCloseConfigModal2.addEventListener('click', closeConfigJsonModal);
    DOM.btnCopyConfigJson.addEventListener('click', copyConfigJson);

    // Đóng modal khi bấm ra nền ngoài
    DOM.configJsonModal.addEventListener('click', (e) => {
        if (e.target === DOM.configJsonModal) closeConfigJsonModal();
    });

    // 12. Tìm kiếm và lọc Nhật ký ra vào
    DOM.logSearchInput.addEventListener('input', () => {
        renderLogsTable();
    });

    DOM.logFilterSelect.addEventListener('change', () => {
        renderLogsTable();
    });

    // 13. Xóa nhật ký ra vào
    DOM.btnClearLogs.addEventListener('click', () => {
        if (AppState.logs.length === 0) {
            showToast('Nhật ký ra vào hiện đang trống!', 'warning');
            return;
        }
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử quản lý người ra vào?')) {
            AppState.logs = [];
            saveLogsToStorage();
            renderLogsTable();
            renderMetrics();
            showToast('Đã xóa toàn bộ nhật ký người ra vào thành công!', 'info');
        }
    });

    // 14. Xuất file JSON
    DOM.btnExportJson.addEventListener('click', exportLogsAsJsonFile);

    // 15. Nạp dữ liệu mẫu
    DOM.btnSeedSampleData.addEventListener('click', () => {
        seedInitialSampleLogs();
        renderLogsTable();
        renderMetrics();
        showToast('Đã nạp thành công 4 bản ghi nhật ký người ra vào mẫu!', 'success');
    });
}

/**
 * Xử lý chuyển đổi Theme Giao Diện Sáng / Tối
 */
function toggleTheme() {
    AppState.currentTheme = AppState.currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem(STORAGE_KEYS.THEME, AppState.currentTheme);
    applyThemeToUI();
    showToast(`Đã chuyển sang ${AppState.currentTheme === 'light' ? 'Chế độ Sáng' : 'Chế độ Tối'}`, 'info');
}

/**
 * Áp dụng Theme lên HTML và cập nhật Icon
 */
function applyThemeToUI() {
    document.body.setAttribute('data-theme', AppState.currentTheme);
    if (AppState.currentTheme === 'light') {
        DOM.themeIconSun.classList.add('hidden');
        DOM.themeIconMoon.classList.remove('hidden');
        DOM.themeToggleBtn.title = 'Chuyển sang Chế độ Tối (Dark Mode)';
    } else {
        DOM.themeIconSun.classList.remove('hidden');
        DOM.themeIconMoon.classList.add('hidden');
        DOM.themeToggleBtn.title = 'Chuyển sang Chế độ Sáng (Light Mode)';
    }
}

/**
 * Cập nhật cấu hình hiện hành lên các trường form giao diện
 */
function applyConfigToUI() {
    DOM.timeoutSlider.value = AppState.config.timeoutSeconds;
    DOM.timeoutDisplay.textContent = `${AppState.config.timeoutSeconds}s`;
    DOM.locationSelect.value = AppState.config.location;
    DOM.sensitivitySelect.value = AppState.config.sensitivity;
    DOM.autoLightingToggle.checked = AppState.config.autoLighting;
    DOM.manualRelayToggle.checked = AppState.config.manualOverride;
    DOM.metricCurrentLocation.textContent = AppState.config.location;

    updateActivePresetButton(AppState.config.timeoutSeconds);
    updateAudioUI();
    updateHardwareConnectionUI();
    updateSensorUI();
    updateRelayUI();
}

/**
 * Đổi trạng thái hiển thị của các nút Preset thời gian
 */
function updateActivePresetButton(currentTime) {
    DOM.presetBtns.forEach(btn => {
        const val = parseInt(btn.dataset.time, 10);
        if (val === currentTime) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

/**
 * Cập nhật hiển thị Trạng thái Phần cứng (Online / Offline)
 */
function updateHardwareConnectionUI() {
    const dot = DOM.hwConnectionBadge.querySelector('.status-dot');
    if (AppState.isHardwareOnline) {
        dot.className = 'status-dot online';
        DOM.hwStatusText.textContent = 'ONLINE (CONNECTED)';
        DOM.hwStatusText.className = 'status-val text-success';
    } else {
        dot.className = 'status-dot offline';
        DOM.hwStatusText.textContent = 'OFFLINE (DISCONNECTED)';
        DOM.hwStatusText.className = 'status-val text-danger';
    }
}

/**
 * Cập nhật hiển thị Trạng thái Cảm biến Cửa PIR
 */
function updateSensorUI() {
    if (AppState.isMotionActive) {
        DOM.sensorStatusBadge.className = 'status-indicator-badge detected';
        DOM.sensorStatusText.textContent = 'PHÁT HIỆN CÓ NGƯỜI RA/VÀO';
        DOM.sensorModeText.textContent = 'Cảm biến đang phát hiện đối tượng ra/vào khu vực';
        DOM.sensorIconBubble.style.color = 'var(--color-primary)';
        DOM.sensorIconBubble.style.background = 'rgba(37, 99, 235, 0.2)';
    } else {
        DOM.sensorStatusBadge.className = 'status-indicator-badge idle';
        DOM.sensorStatusText.textContent = 'KHÔNG CÓ NGƯỜI (CỬA TRỐNG)';
        DOM.sensorModeText.textContent = 'Đang quét hồng ngoại giám sát lối ra vào';
        DOM.sensorIconBubble.style.color = 'var(--text-muted)';
        DOM.sensorIconBubble.style.background = 'rgba(148, 163, 184, 0.15)';
    }
}

/**
 * Cập nhật hiển thị Trạng thái Rơ-le / Đèn cửa
 */
function updateRelayUI() {
    if (AppState.isRelayOn) {
        DOM.relayStateText.textContent = 'ĐANG BẬT';
        DOM.relayStateText.className = 'relay-state-text on';

        if (AppState.config.manualOverride) {
            DOM.relayCountdownBadge.classList.remove('hidden');
            DOM.relayCountdownBadge.innerHTML = '⚡ Thủ công (Override)';
            DOM.relayProgressBar.style.width = '100%';
        } else if (AppState.countdownSeconds > 0) {
            DOM.relayCountdownBadge.classList.remove('hidden');
            DOM.relayCountdownNumber.textContent = `${AppState.countdownSeconds}s`;
        } else {
            DOM.relayCountdownBadge.classList.add('hidden');
        }
    } else {
        DOM.relayStateText.textContent = 'ĐANG TẮT';
        DOM.relayStateText.className = 'relay-state-text';
        DOM.relayCountdownBadge.classList.add('hidden');
        DOM.relayProgressBar.style.width = '0%';
    }
}

/**
 * Cập nhật số liệu trên 4 Thẻ Thống Kê (Metric Cards)
 */
function renderMetrics() {
    // 1. Tổng lượt ra vào trong ngày
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const totalToday = AppState.logs.filter(log => {
        return log.eventType === 'MOTION_START' && log.timestamp.startsWith(todayStr);
    }).length;

    DOM.metricTotalDetections.textContent = totalToday;

    // 2. Thời gian lượt ra vào gần nhất
    if (AppState.lastDetectedTimestamp) {
        const timePart = formatOnlyTime(AppState.lastDetectedTimestamp);
        DOM.metricLastDetectedTime.textContent = timePart;
        DOM.metricLastDetectedRelative.textContent = getRelativeTime(AppState.lastDetectedTimestamp);
    } else {
        DOM.metricLastDetectedTime.textContent = '--:--:--';
        DOM.metricLastDetectedRelative.textContent = 'Chưa có lượt ra vào';
    }
}

/**
 * Render toàn bộ Bảng Nhật Ký Ra Vào với bộ lọc và tìm kiếm
 */
function renderLogsTable() {
    const searchTerm = DOM.logSearchInput.value.trim().toLowerCase();
    const filterType = DOM.logFilterSelect.value;

    const filteredLogs = AppState.logs.filter(log => {
        // Lọc theo loại sự kiện
        if (filterType !== 'ALL' && log.eventType !== filterType) {
            return false;
        }

        // Tìm kiếm theo từ khóa (ID, vị trí, chi tiết)
        if (searchTerm) {
            const combinedStr = `${log.id} ${log.details} ${log.location} ${log.eventType} ${log.formattedTime}`.toLowerCase();
            return combinedStr.includes(searchTerm);
        }

        return true;
    });

    // Cập nhật nhãn đếm
    DOM.logCounterTag.textContent = `${filteredLogs.length}/${AppState.logs.length} bản ghi`;

    // Kiểm tra empty state
    if (filteredLogs.length === 0) {
        DOM.logsTableBody.innerHTML = '';
        DOM.logsEmptyState.classList.remove('hidden');
        return;
    }

    DOM.logsEmptyState.classList.add('hidden');

    // Tạo HTML cho từng dòng
    const html = filteredLogs.map(log => createTableRowHTML(log)).join('');
    DOM.logsTableBody.innerHTML = html;
}

/**
 * Chèn một dòng mới vào đỉnh bảng kèm hiệu ứng highlight
 */
function insertRowToTable(log) {
    const filterType = DOM.logFilterSelect.value;
    if (filterType !== 'ALL' && log.eventType !== filterType) return;

    DOM.logsEmptyState.classList.add('hidden');

    const tempDiv = document.createElement('tbody');
    tempDiv.innerHTML = createTableRowHTML(log, true);
    const newTr = tempDiv.firstElementChild;

    if (DOM.logsTableBody.firstChild) {
        DOM.logsTableBody.insertBefore(newTr, DOM.logsTableBody.firstChild);
    } else {
        DOM.logsTableBody.appendChild(newTr);
    }

    DOM.logCounterTag.textContent = `${AppState.logs.length} bản ghi`;
}

/**
 * Tạo thẻ tr cho bảng dữ liệu nhật ký người ra vào
 */
function createTableRowHTML(log, isNew = false) {
    const eventDef = EVENT_TYPES[log.eventType] || {
        label: log.eventType,
        badgeClass: 'motion-stop',
        statusText: 'Thông tin',
        statusClass: 'idle'
    };

    return `
        <tr class="${isNew ? 'row-new' : ''}">
            <td><strong class="font-mono" style="color: var(--color-cyan); font-weight: 700;">${log.id}</strong></td>
            <td class="font-mono" style="font-size: 0.8rem; color: var(--text-muted);">${log.formattedTime}</td>
            <td>
                <span class="event-badge ${eventDef.badgeClass}">
                    ${getEventIconSvg(log.eventType)}
                    ${eventDef.label}
                </span>
            </td>
            <td>
                <span style="color: var(--text-white); font-weight: 600;">${log.location}</span>
            </td>
            <td class="font-mono" style="color: var(--text-light);">${log.duration || '-'}</td>
            <td>
                <span class="status-cell-badge ${eventDef.statusClass}">
                    ● ${eventDef.statusText}
                </span>
            </td>
        </tr>
    `;
}

/**
 * Lấy Icon SVG nhỏ cho từng loại sự kiện
 */
function getEventIconSvg(eventType) {
    switch (eventType) {
        case 'MOTION_START':
            return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
        case 'MOTION_STOP':
            return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>`;
        case 'RELAY_ON':
            return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>`;
        case 'RELAY_OFF':
            return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        default:
            return '';
    }
}

/* ==============================================================================
   7. XUẤT & XEM DỮ LIỆU JSON (JSON EXPORT & MODAL VIEWER)
   ============================================================================== */

/**
 * Tải file JSON nhật ký ra máy người dùng
 */
function exportLogsAsJsonFile() {
    if (AppState.logs.length === 0) {
        showToast('Không có dữ liệu nhật ký để xuất!', 'warning');
        return;
    }

    const exportData = {
        system: 'Hệ Thống Quản Lý Người Ra Vào (Access Control & PIR Motion System)',
        exportedAt: new Date().toISOString(),
        deviceConfig: AppState.config,
        totalRecords: AppState.logs.length,
        logs: AppState.logs
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `QuanLy_NguoiRaVao_Logs_${dateStr}.json`;

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    showToast(`Đã xuất ${AppState.logs.length} bản ghi nhật ký ra vào thành file ${filename}`, 'success');
}

/**
 * Mở modal hiển thị JSON cấu hình thiết bị (sensor_config)
 */
function openConfigJsonModal() {
    DOM.configJsonContent.textContent = JSON.stringify(AppState.config, null, 2);
    DOM.configJsonModal.classList.remove('hidden');
}

function closeConfigJsonModal() {
    DOM.configJsonModal.classList.add('hidden');
}

function copyConfigJson() {
    const jsonStr = JSON.stringify(AppState.config, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('Đã sao chép JSON cấu hình thiết bị vào bộ nhớ tạm!', 'success');
    }).catch(() => {
        showToast('Không thể sao chép tự động, vui lòng chọn và bôi đen!', 'warning');
    });
}

/* ==============================================================================
   8. ĐỒNG HỒ THỜI GIAN THỰC & TIỆN ÍCH THỜI GIAN (REALTIME CLOCK & UTILS)
   ============================================================================== */

function startRealtimeClock() {
    updateClockDisplay();
    setInterval(updateClockDisplay, 1000);
}

function updateClockDisplay() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    DOM.realtimeClock.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    DOM.realtimeDate.textContent = `${dayName}, ${date}/${month}/${year}`;
}

function startRelativeTimeUpdater() {
    setInterval(() => {
        if (AppState.lastDetectedTimestamp) {
            DOM.metricLastDetectedRelative.textContent = getRelativeTime(AppState.lastDetectedTimestamp);
        }
    }, 5000);
}

function formatTimestamp(d) {
    const date = new Date(d);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

function formatOnlyTime(d) {
    const date = new Date(d);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function getRelativeTime(date) {
    if (!date) return 'Chưa có lượt ra vào';
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffSeconds < 5) return 'Vừa xong';
    if (diffSeconds < 60) return `${diffSeconds} giây trước`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${Math.floor(diffHours / 24)} ngày trước`;
}

/* ==============================================================================
   9. HỆ THỐNG ÂM THANH CÔNG NGHỆ CAO (WEB AUDIO API SYNTHESIZER)
   ============================================================================== */

function toggleAudioMute() {
    AppState.isAudioMuted = !AppState.isAudioMuted;
    localStorage.setItem(STORAGE_KEYS.AUDIO_MUTED, String(AppState.isAudioMuted));
    updateAudioUI();

    showToast(`Âm thanh còi Beep: ${AppState.isAudioMuted ? 'ĐÃ TẮT' : 'ĐÃ BẬT'}`, 'info');
    if (!AppState.isAudioMuted) {
        playBeepSound(800, 100, 'sine');
    }
}

function updateAudioUI() {
    if (AppState.isAudioMuted) {
        DOM.audioIconOn.classList.add('hidden');
        DOM.audioIconOff.classList.remove('hidden');
    } else {
        DOM.audioIconOn.classList.remove('hidden');
        DOM.audioIconOff.classList.add('hidden');
    }
}

/**
 * Tự tổng hợp âm thanh Beep bằng Web Audio API mà không cần file MP3 bên ngoài
 */
function playBeepSound(freq = 880, durationMs = 150, type = 'sine') {
    if (AppState.isAudioMuted) return;

    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!AppState.audioCtx) {
            AppState.audioCtx = new AudioContextClass();
        }

        if (AppState.audioCtx.state === 'suspended') {
            AppState.audioCtx.resume();
        }

        const osc = AppState.audioCtx.createOscillator();
        const gain = AppState.audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, AppState.audioCtx.currentTime);

        gain.gain.setValueAtTime(0.08, AppState.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, AppState.audioCtx.currentTime + durationMs / 1000);

        osc.connect(gain);
        gain.connect(AppState.audioCtx.destination);

        osc.start();
        osc.stop(AppState.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
        // Trình duyệt có thể chặn autoplay audio nếu chưa có tương tác người dùng
    }
}

/* ==============================================================================
   10. HỆ THỐNG THÔNG BÁO NỔI (TOAST NOTIFICATION ENGINE)
   ============================================================================== */

function showToast(message, type = 'info') {
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    switch (type) {
        case 'success':
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
            break;
        case 'danger':
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
            break;
        case 'warning':
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            break;
        default:
            iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
            break;
    }

    toast.innerHTML = `
        <span class="toast-icon">${iconSvg}</span>
        <span class="toast-msg">${message}</span>
    `;

    DOM.toastContainer.appendChild(toast);

    // Tự động gỡ bỏ sau khi kết thúc animation (4s)
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 4000);
}
