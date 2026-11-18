# Hệ Thống Quản Lý Người Ra Vào (Smart Access Control & PIR IoT Dashboard)

Hệ thống Dashboard giao diện web hiện đại giám sát người ra vào cửa và điều khiển chiếu sáng/khóa thông minh dựa trên cảm biến chuyển động hồng ngoại thụ động (PIR Motion Sensor) kết hợp vi điều khiển ESP32 / CYD (Cheap Yellow Display).

---

## 📁 Cấu Trúc Mã Nguồn Dự Án

```text
d:\Appcode\vsc\Quanlinguoiravao/
├── index.html       # Giao diện HTML5 ngữ nghĩa: Quản lý người ra vào & Giám sát cửa
├── style.css        # CSS3 thuần Dark Mode hiện đại, hiệu ứng radar, animation cảnh báo
├── app.js           # Xử lý logic phát hiện người ra/vào, đếm lùi Rơ-le, LocalStorage & Web Audio
└── README.md        # Hướng dẫn kiến trúc, sơ đồ phần cứng và cách vận hành
```

---

## 🚀 Các Tính Năng Quản Lý Người Ra Vào

1. **Giao diện Tiêu chuẩn Công nghệ cao (Dark Mode & Cyber Glassmorphism):**
   - Tiêu đề thương hiệu: **HỆ THỐNG QUẢN LÝ NGƯỜI RA VÀO**.
   - Bảng màu chuẩn: Nền tối `#121824`, Card `#1E293B`, điểm nhấn Xanh dương `#3B82F6` (Phát hiện người), Xanh ngọc `#10B981` (Online/Bình thường), Cam/Vàng `#F59E0B` (Đèn cửa/Cảnh báo).
   - Tối ưu hóa hiển thị Responsive hoàn chỉnh trên Máy tính, Máy tính bảng và Điện thoại.

2. **Chỉ số Giám sát Cửa Thời gian thực (Metric Cards):**
   - **Tổng lượt ra vào hôm nay:** Tự động đếm và cộng dồn số lượt người qua cửa trong ngày.
   - **Trạng thái Cảm biến Cửa:** Huy hiệu nhấp nháy chuyển động (`PHÁT HIỆN CÓ NGƯỜI RA/VÀO`) hoặc trạng thái tĩnh (`KHÔNG CÓ NGƯỜI - CỬA TRỐNG`).
   - **Trạng thái Rơ-le & Đèn chiếu sáng cửa:** BẬT/TẮT tự động kèm đồng hồ đếm lùi thời gian tự ngắt và thanh tiến trình trực quan.
   - **Lượt ra vào gần nhất:** Hiển thị mốc giờ cùng khoảng thời gian tương đối ("Vừa xong", "15 giây trước").

3. **Bộ Giả Lập & Điều Khiển Thiết Bị Cửa (Control & Simulator Panel):**
   - **Nút "MÔ PHỎNG CÓ NGƯỜI RA/VÀO (TRIGGER)":** Click chuột hoặc nhấn **Phím cách (Spacebar)** để giả lập có người bước qua cửa.
   - **Mô phỏng luồng người ra vào tự động (Auto Stream):** Tự phát sinh người di chuyển qua cửa sau mỗi 8–18 giây.
   - **Bật cưỡng bức (Manual Override):** Giữ đèn/khóa cửa luôn mở, bỏ qua cảm biến.
   - **Thời gian trễ tự ngắt đèn (Delay Time: 5s – 300s):** Đi kèm các nút Preset nhanh (`10s`, `15s`, `30s`, `1m`, `2m`).
   - **Khu vực giám sát:** Hỗ trợ chọn Cửa chính (Cổng A), Cửa sau / Lối thoát hiểm, Hành lang, Kho thiết bị, Cổng bảo vệ.

4. **Nhật Ký Quản Lý Người Ra Vào (Access & Entry Logs):**
   - Cấu trúc JSON chuẩn hóa: `sensor_config` và `access_logs`.
   - Tìm kiếm thời gian thực theo mã lượt, vị trí cửa, loại sự kiện.
   - Chèn bản ghi mới lên đầu bảng kèm hiệu ứng chuyển màu sáng (Row Highlight Animation).
   - Nút **Xuất JSON (Download File `QuanLy_NguoiRaVao_Logs_YYYYMMDD_HHMM.json`)** và **Xóa nhật ký**.
   - Lưu trữ bền vững trên trình duyệt qua `LocalStorage`.

5. **Âm thanh Cảnh báo Độc lập (Web Audio API Synthesizer):**
   - Không cần file MP3 bên ngoài, tự động phát âm thanh chirp công nghệ cao khi phát hiện có người qua cửa.

---

## 🛠️ Sơ Đồ Đấu Nối Phần Cứng (ESP32 + PIR + Relay Cửa)

| Linh Kiện | Chân Linh Kiện | Chân ESP32 / NodeMCU | Chú Thích |
| :--- | :--- | :--- | :--- |
| **Cảm biến PIR (HC-SR501 / AM312)** | VCC | 5V (hoặc 3.3V với AM312) | Nguồn cấp |
| | GND | GND | Nối mass chung |
| | OUT (DATA) | GPIO 27 (hoặc GPIO 13) | Mức CAO (3.3V) khi có người qua cửa |
| **Module Rơ-le 5V 1-Kênh (Đèn/Khóa Cửa)** | VCC | 5V | Nguồn nuôi cuộn hút |
| | GND | GND | Nối mass chung |
| | IN | GPIO 26 | Kích mức Thấp hoặc Cao |
| | NO / COM | Nguồn 220V AC / 12V DC | Đấu nối tiếp với đèn hành lang hoặc khóa cửa điện từ |

---

## 💻 Cách Khởi Chạy

Chỉ cần mở file `index.html` trực tiếp bằng trình duyệt web (Google Chrome, Microsoft Edge, Firefox):
```bash
# Không cần cài đặt dependencies phức tạp, chạy trực tiếp file HTML thuần
start index.html
```
