# THỜI GIAN CỦA TÔI – v1.3.1: Web · Android APK · iPhone PWA

**Một bộ mã nguồn, ba nơi sử dụng:** Chrome/Edge trên Windows, APK Android và Safari/PWA trên iPhone. Mọi tính năng ở bản Web/iPhone v1.3 được chuyển sang APK Android; đây là bản đóng gói chung nhằm bảo đảm ba phiên bản luôn cùng tính năng.

## Các tính năng

- Tổng quan, công việc hằng ngày, lịch tuần/tháng; mục tiêu và thói quen, định hướng, thống kê.
- **Lưu công việc đã sửa:** sửa xung đột `form.id` với input `name=id`; lưu qua nút lưu trực tiếp; bấm ngoài hộp thoại không tự đóng; thông báo rõ nếu lưu thất bại.
- **Làm chủ mối quan hệ:** họ tên, liên hệ, thông tin nghề nghiệp/đơn vị, nhóm, sinh nhật, lịch liên lạc, ghi chú.
- **Quản trị tài chính cá nhân:** ngày, hoạt động, thu, chi, danh mục, ghi chú, tổng kết và báo cáo tháng/6 tháng.
- **Ghi chú sáng tạo:** giấy ô ly / kẻ ngang / trắng, nhập chữ, viết/vẽ trên màn hình cảm ứng, lưu nội dung.
- Thanh bên thu gọn, ghi **Designed by Hoàng ĐC**.
- Sao lưu JSON, khôi phục từ JSON; xuất CSV. Không có tài khoản/máy chủ và **không có tự đồng bộ thiết bị**.

## 1. Cách đưa lên GitHub để tự build APK Android

1. Giải nén ZIP này **vào thư mục repository mới**, hoặc sao chép tất cả nội dung (bao gồm thư mục `.github` bị ẩn) vào repository cũ đã clone. Không đưa file ZIP nguyên khối lên GitHub.
2. Đối với repository mới: tạo repository rỗng trên <https://github.com/new>; chạy `day-len-github.bat` và nhập URL `https://github.com/TEN-TAI-KHOAN/TEN-REPO.git`.
3. Đối với repository đã clone: giữ thư mục `.git` của repo, sao chép/ghi đè mã nguồn từ ZIP vào đó, sau đó chạy `cap-nhat-github.bat` ở gốc repo (hoặc `git add -A; git commit -m "Update GOTINO v1.3.1"; git push`). **Không sao chép đè thư mục `.git`**.
4. Mở GitHub → **Actions → Build APK - Thoi Gian Cua Toi**. Workflow tự chạy sau push, hoặc bấm **Run workflow**.
5. Khi build thành công, bấm vào lần chạy → **Artifacts → ThoiGianCuaToi-APK** → tải ZIP artifact → giải nén lấy `ThoiGianCuaToi-debug.apk`.

GitHub Actions dùng **JDK 17**, **Gradle 8.10.2**, **Android Gradle Plugin 8.8.1**, SDK 35. Nó tự sao chép nguồn từ `site/` vào `app/src/main/assets/` **trước khi build**, tránh phát hành APK chứa phiên bản cũ. Mã nguồn cũng có sẵn tài nguyên Android đồng bộ để mở bằng Android Studio. Build sử dụng mạng để tải SDK/Gradle/phụ thuộc.

**Quan trọng khi cập nhật APK:** APK debug có thể được ký bằng khóa debug khác giữa các lần chạy GitHub. Có thể không cài đè được bản cũ. Hãy **xuất sao lưu JSON** trước khi nâng cấp/gỡ APK; nếu cần cập nhật không gỡ ứng dụng, nên cấu hình keystore release cố định và lưu bảo mật bằng GitHub Secrets. Gói này chưa tự cấu hình chữ ký release.

## 2. Chạy Web trên Windows

- Nhấp đúp `chay-web-windows.bat` (yêu cầu Python 3, mở `http://localhost:8000`).
- Hoặc vào `site/` rồi chạy `python -m http.server 8000`.
- Trên Chrome/Edge truy cập `http://localhost:8000`.

## 3. Chạy trên iPhone bằng GitHub Pages

1. Sau khi push, trong GitHub → **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Tab **Actions → Website iPhone - GitHub Pages** → chờ chạy thành công.
3. Mở `https://TEN-TAI-KHOAN.github.io/TEN-REPO/` bằng Safari.
4. Chọn **Chia sẻ → Thêm vào Màn hình chính**. Nếu Safari có tùy chọn **Mở dưới dạng ứng dụng**, hãy bật.
5. Có thể mở lại khi mất mạng sau lần tải đầu thành công và cache hoàn tất (khả năng offline phụ thuộc bộ nhớ cache iOS).

## 4. Lần sau cập nhật cùng lúc ba nền tảng

`site/` là **mã nguồn chuẩn**. Khi chỉnh giao diện hoặc chức năng web, sửa `site/index.html`, `site/styles.css`, `site/app.js`, ... rồi đồng bộ Android bằng:

```powershell
python tools/sync_web_to_android.py
node tests/web-storage.test.cjs
node tests/web-assets.test.cjs
node tests/android-assets-sync.test.cjs
```

Trên Windows có thể chạy `dong-bo-android.bat`. Sau đó push: GitHub chạy **hai workflow độc lập**: website/PWA cập nhật trực tiếp, APK mới xuất hiện trong Artifacts. Cấu hình build APK vẫn giữ trong `.github/workflows/build-apk.yml`, web/iPhone trong `.github/workflows/deploy-pages.yml`.

## 5. Dữ liệu và quyền riêng tư

- Web Windows, iPhone PWA, Android APK lưu **cục bộ riêng từng thiết bị**. Không có đồng bộ thời gian thực hoặc tài khoản.
- Dữ liệu từ phiên bản 1.3 trên cùng địa chỉ GitHub Pages vẫn sử dụng khoá `gotino.timeplanner.v1`, vì vậy bình thường được giữ sau khi website cập nhật. Dù vậy **hãy xuất JSON trước mỗi lần nâng cấp**.
- Chuyển thiết bị bằng **Cài đặt & dữ liệu → Sao lưu JSON**, sau đó **Nhập JSON** trên thiết bị đích. Safari và ứng dụng thêm màn hình chính có thể có vùng lưu riêng.
- Không đưa thông tin bí mật hoặc hồ sơ nhạy cảm lên bản này: dữ liệu không được mã hóa và không có cơ chế đăng nhập.
- Bản Android đóng gói web offline bằng WebView, không cần Internet để sử dụng. Bản iPhone **không phải IPA/App Store** mà là PWA qua GitHub Pages.

## 6. Cấu trúc thư mục

```text
site/                        ← mã nguồn chuẩn cho Web + iPhone
app/src/main/assets/         ← bản sao site cho Android WebView
app/src/main/java/...        ← Android Activity + nhập/xuất tệp
.github/workflows/build-apk.yml
.github/workflows/deploy-pages.yml
tools/sync_web_to_android.py
tests/web-storage.test.cjs
tests/web-assets.test.cjs
tests/android-assets-sync.test.cjs
day-len-github.bat          ← repo mới
cap-nhat-github.bat         ← repo đã clone
chay-web-windows.bat
README.md
```

**Giới hạn kiểm thử:** đã kiểm tra JavaScript và tính nhất quán tài nguyên; chưa thực hiện build APK thật trong môi trường tạo gói. Nếu workflow lỗi, lưu log ở GitHub Actions và sử dụng để chỉnh tiếp.
