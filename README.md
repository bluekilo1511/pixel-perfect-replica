# Blueliztasktracker

Nâng cấp toàn diện ứng dụng Task Tracker Pro với các tính năng sau:

1. Giao diện & Avatar:

- Đổi theme sang Glassmorphism nền động pastel sky blue (aurora flow bằng CSS keyframes nhẹ nhàng).

- Cho phép click vào Avatar trên HUD để tải ảnh từ máy, tự động nén kích thước tối đa 256px và lưu chuỗi Base64 vào file JSON dữ liệu.

2. Quản lý Task & Thời khóa biểu:

- Bổ sung nút Ghim 📌 cho từng task: Các task được ghim sẽ tự động giữ lại và reset trạng thái 'completed = false' khi sang ngày mới.

- Thêm nút "Đồng bộ nhanh lịch hôm nay": Nạp các tiết học trong ngày vào bảng Việc hôm nay kèm badge giờ (VD: "07:30 - 08:15").

- Smart Reminder: Dùng Web Audio API phát tiếng 'ting' nhẹ và hiển thị Toast/Web Notification trước tiết học đúng 5 phút.

3. Gamification - Thú cưng & Streak (Widget đặt ngay đầu bảng Việc hôm nay):

- Thú cưng đồng hành: Gồm thanh Độ no (🍖) và Hạnh phúc (💖) (0-100%). Tự giảm -5% No và -3% Vui mỗi giờ.

- 4 biểu cảm: Hưng phấn (>80%, nhảy nhót), Bình thường (40-80%), Đói lả (<40%), Hờn dỗi (<30%). Bấm vào Pet hoặc xong task sẽ hiện bong bóng thoại ngẫu nhiên.

- Pomodoro 25p: Đếm ngược cùng Pet, hoàn thành thưởng +5 😺.

- Pet Shop & Tủ đồ: Dùng 😺 mua thức ăn/đồ chơi; dùng 🦎 mở khóa linh thú mới (Thằn Lằn, Cún, Cú) và phụ kiện đội đầu (Mũ cử nhân, Kính râm, Vương miện).

- Daily Streak: Hoàn thành ≥3 task/ngày để tăng streak. Streak 2-3 ngày: x1.2 điểm; 4-6 ngày: x1.5; ≥7 ngày: x2.0 (MAX). Shop có thêm "Bình đóng băng 🧊" (15 🦎) để cứu chuỗi khi quên vào web 1 ngày.

4. Lưu trữ dữ liệu:

- Mở rộng schema dữ liệu để lưu toàn bộ trạng thái mới (avatarBase64, pinnedTasks, petState, streak, inventory) vào cùng file JSON hiện tại qua File System Access API.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://blueliztasktracker.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/05182070-a856-4780-bec3-3c957c91e616).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
