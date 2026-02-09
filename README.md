# 🧪 MAPIT — Công cụ Testing UI & API tự động

> **MAPIT** (Map + API + Test) giúp team **ghi lại**, **so sánh**, và **kiểm tra tự động** giao diện (UI) cùng dữ liệu API của website — không cần viết code test.

---

# 📘 GIỚI THIỆU TÍNH NĂNG

> _Dành cho tất cả mọi người: Product Owner, QA, Designer, Developer._

---

## MAPIT giải quyết vấn đề gì?

Khi phát triển website, team thường gặp các vấn đề:

| ❌ Vấn đề                                   | ✅ MAPIT giải quyết                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| Không biết UI bị thay đổi ở đâu khi fix bug | **So sánh giao diện** giữa phiên bản cũ và mới, highlight chính xác vùng thay đổi |
| API trả về dữ liệu khác sau khi deploy      | **So sánh API response** chi tiết: field nào thêm, sửa, xóa                       |
| QA phải test lại toàn bộ flow thủ công      | **Replay tự động** toàn bộ thao tác đã ghi, phát hiện lỗi regression              |
| Không có tài liệu về flow người dùng        | **Tạo sitemap tự động** từ flow thao tác, dạng flowchart trực quan                |
| Khó chia sẻ kết quả test cho team           | **Share qua WiFi hoặc Google Drive**, ai cũng xem được                            |

---

## Cách hoạt động (3 bước đơn giản)

```
 Bước 1              Bước 2              Bước 3
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  📹 GHI  │ ──▶ │  🔄 SO SÁNH  │ ──▶ │  📊 BÁO CÁO  │
│          │     │              │     │              │
│ Duyệt web│     │ UI + API diff│     │ Pass / Fail  │
│ như bình │     │ tự động      │     │ chi tiết     │
│ thường   │     │              │     │              │
└──────────┘     └──────────────┘     └──────────────┘
```

1. **GHI LẠI** — Mở website và thao tác bình thường (login, click, nhập form...). MAPIT tự động ghi toàn bộ: screenshot, HTML/CSS, API request/response.
2. **SO SÁNH** — Khi có thay đổi (sửa code, deploy mới), ghi lại lần nữa rồi so sánh 2 phiên bản.
3. **BÁO CÁO** — Xem kết quả: màn hình nào giống, khác, lỗi.

---

## 🚀 Danh sách tính năng

### 1. 📹 Capture — Ghi lại thao tác

**Mô tả:** Tự động ghi lại **mọi thứ** khi bạn duyệt website.

**MAPIT ghi lại gì?**

- 🖼️ **Screenshot** toàn trang (auto-scroll chụp hết)
- 🏗️ **HTML + CSS** của mỗi trang (để so sánh DOM cấu trúc)
- 🌐 **API requests/responses** (mọi request gửi đi/nhận về)
- 🖱️ **Thao tác người dùng** (click, gõ phím, scroll, chuyển trang)

**Luồng hoạt động:**

```
Bạn                          MAPIT
────                          ─────
Tạo project "my-app"    ──▶  Tạo thư mục lưu trữ
Nhấn "New Section"       ──▶  Mở trình duyệt
Truy cập website         ──▶  Bắt đầu theo dõi
Login, click, thao tác   ──▶  Ghi lại mọi action + API
Nhấn ESC                 ──▶  Chụp screenshot + lưu DOM/CSS
Tiếp tục thao tác...     ──▶  Tiếp tục ghi
Đóng trình duyệt         ──▶  Lưu toàn bộ vào section
```

**Kết quả lưu trữ:**

```
📁 my-app/
  📁 1707123456789/          ← Section (phiên ghi)
    📁 start/
      📁 login/              ← Màn hình login
        📄 screen.html       ← HTML đầy đủ
        📄 meta.json         ← Thông tin trang
        📄 actions.json      ← Các thao tác
        📄 apis.json         ← API requests
      📁 dashboard/          ← Màn hình dashboard
        📄 screen.html
        📄 meta.json
        ...
    📄 flow.json             ← Sơ đồ luồng thao tác
```

---

### 2. 🗺️ Sitemap — Sơ đồ luồng thao tác

**Mô tả:** Tự động tạo **flowchart** từ các màn hình đã ghi.

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  Login   │ ──▶ │Dashboard │ ──▶ │ Settings │
└─────────┘     └──────────┘     └──────────┘
                     │
                     ▼
                ┌──────────┐     ┌──────────┐
                │ Products │ ──▶ │  Detail  │
                └──────────┘     └──────────┘
```

**Tính năng:**

- 🔍 Zoom in/out và tìm kiếm screen
- 🖱️ Click vào node để xem chi tiết (screenshot, API, actions)
- ↔️ Drag & drop để sắp xếp lại layout
- 🔗 Hiển thị quan hệ chuyển trang giữa các screen

---

### 3. 🔍 So sánh UI (UI Comparison)

**Mô tả:** So sánh **giao diện** giữa 2 phiên bản để phát hiện thay đổi.

**Ví dụ kết quả:**

```
So sánh: Phiên bản cũ (Main) vs Phiên bản mới (Section)

═══════════════════════════════════════════════
  Tổng: 20 màn hình
  ✅ Giống nhau:  15 màn hình
  ⚠️  Thay đổi:    3 màn hình
  ❌ Bị mất:       1 màn hình
  ➕ Thêm mới:     1 màn hình
═══════════════════════════════════════════════

Chi tiết thay đổi — màn hình "/products":
  🏗️ DOM: Thêm <div class="promo-banner">
  🎨 CSS: .product-card { padding: 20px → 24px }
```

**Ai dùng?**

- **QA:** Kiểm tra nhanh UI có bị ảnh hưởng không sau khi dev sửa code
- **Designer:** Xác nhận giao diện đúng với thiết kế
- **Product Owner:** Xem trực quan thay đổi trước khi release

---

### 4. 🔗 So sánh API (API Diff)

**Mô tả:** So sánh **API requests/responses** giữa 2 phiên bản.

**Ví dụ kết quả:**

```
API: GET /api/products

  Request : Không đổi
  Response:
    ✅ Giữ nguyên: 45 fields
    ⚠️  Sửa đổi:    2 fields
      • price: 100,000 → 120,000
      • discount: null → "10%"
    ➕ Thêm mới:   1 field
      • rating: 4.5
    ❌ Xóa:        0 fields

────────────────────────────────────────
Tổng kết:
  12 APIs  │  8 khớp  │  3 sửa  │  1 thêm
```

---

### 5. ▶️ Replay — Phát lại thao tác

**Mô tả:** Tự động **phát lại** toàn bộ flow đã ghi để kiểm tra regression.

**Luồng hoạt động:**

```
1. Chọn Section đã ghi trước đó
2. Nhấn "Replay"
3. MAPIT tự động:
   ├── Mở trình duyệt
   ├── Thực hiện lại: click, nhập form, scroll...
   ├── Chụp screenshot + lưu DOM/API mới
   └── So sánh tự động với dữ liệu cũ

4. Kết quả:
   ✅ Login:     PASS (UI 100%, API 100%)
   ⚠️  Products:  WARNING (UI 95%, API có thay đổi)
   ❌ Checkout:  FAIL (API trả 500 error)
```

**Regression Test:** Replay kết hợp so sánh tự động, cho kết quả PASS/FAIL cho từng màn hình. Hỗ trợ chạy trên desktop, mobile, tablet.

---

### 6. 🔀 Merge — Cập nhật baseline

**Mô tả:** Khi phiên bản mới đã ổn định, **merge** dữ liệu vào Main (baseline) để làm chuẩn cho các lần test sau.

```
Ví dụ: Phiên bản v2.0 đã test OK

1. Chọn Section v2.0
2. Nhấn "Merge to Main"
3. Chọn màn hình muốn merge:
   ☑ login        (merge)
   ☑ products     (merge)
   ☐ checkout     (bỏ qua — còn bug)
4. Tùy chọn: Xóa section sau merge
5. Nhấn "Merge"

→ Main được cập nhật → lần test sau dùng data mới làm baseline
```

**Hỗ trợ:**

- Merge chọn lọc (chỉ merge một số screen)
- Merge toàn bộ section
- Preview trước khi merge (dry-run)
- Tự động xóa section sau merge

---

### 7. 📤 Share — Chia sẻ dữ liệu

**Mô tả:** Chia sẻ kết quả test với team qua **WiFi nội bộ** hoặc **Google Drive**.

**Cách 1 — WiFi nội bộ:**

```
1. Nhấn "Share" → Chọn Main hoặc Section
2. MAPIT tạo link:
   http://192.168.1.100:8888/share/abc123xyz
3. Gửi link cho đồng nghiệp (cùng WiFi)
4. Đồng nghiệp mở link → Download ZIP → Import vào project
```

**Cách 2 — Google Drive:**

```
1. Kết nối Google Account
2. Upload data lên Drive
3. Share Drive link cho team
4. Team import từ Drive link
```

**Tính năng nâng cao:**

- 🔍 Quét mạng tìm MAPIT instance khác
- 📥 Import từ share link hoặc file ZIP
- 📡 Liệt kê shares từ instance từ xa

---

### 8. 📄 Document Management — Quản lý tài liệu

**Mô tả:** Upload, lưu version, và **so sánh** nội dung tài liệu.

**Định dạng hỗ trợ:** `DOCX`, `DOC`, `XLSX`, `XLS`, `PDF`, `TXT`, `CSV`

```
Ví dụ:
1. Upload "requirements_v1.docx"
2. Một tuần sau, upload "requirements_v2.docx"
3. MAPIT tự động:
   ├── Lưu kèm version number
   ├── Extract text từ file
   └── So sánh nội dung 2 version

4. Kết quả:
   ➕ Thêm: "Feature: Dark mode support"
   ❌ Xóa:  "Feature: IE11 support"
   ⚠️  Sửa:  "Deadline: Q1 → Q2"
```

---

### 9. 🔐 Authentication — Tự động đăng nhập

**Mô tả:** Lưu session (cookies, localStorage) để replay tự động đăng nhập mà không cần nhập lại mật khẩu.

```
1. Capture lần đầu: login thủ công → MAPIT lưu session
2. Các lần replay sau: tự động inject cookies + localStorage
3. Không cần cấu hình username/password → an toàn hơn
```

**Tính năng:**

- Lưu cookies, localStorage, sessionStorage
- Refresh session khi hết hạn
- Xóa session khi không cần

---

### 10. 📊 Reporting & Comments

**Reports:** Tạo báo cáo dạng HTML/PDF từ kết quả so sánh.

**Comments:** Gắn comment vào từng screen để team trao đổi.

```
Ví dụ comment:
  🏷️ Screen: /checkout
  💬 "Button thanh toán bị lệch trên mobile"
  👤 QA-Linh
  📌 Status: Chưa resolve
    ↳ Reply: "Đã fix, check lại"   — Dev-Hùng
```

---

### 11. 📦 Version Control

**Mô tả:** Lưu lịch sử các phiên bản Main, hỗ trợ rollback.

- **Commit**: Lưu snapshot hiện tại của Main kèm message
- **History**: Xem lại danh sách các phiên bản đã commit
- **Rollback**: Quay về phiên bản cũ nếu cần
- **Diff**: So sánh 2 phiên bản đã commit
- **Tag**: Gắn nhãn cho phiên bản (v1.0, release-2024...)

---

## 💻 Cài đặt & Chạy

### Yêu cầu hệ thống

| Thành phần  | Yêu cầu                  |
| ----------- | ------------------------ |
| **Node.js** | >= 16.x                  |
| **npm**     | >= 8.x                   |
| **RAM**     | >= 4GB (khuyến nghị 8GB) |
| **Disk**    | >= 2GB trống             |
| **OS**      | macOS, Windows, Linux    |

### Cài đặt

```bash
# 1. Clone repository
git clone <repository-url>
cd test_tool_backup

# 2. Cài dependencies
npm install

# 3. (Tùy chọn) Cài Playwright browser cho capture
npx playwright install chromium
```

### Chạy server

```bash
# Chạy web server (dùng browser)
npm start
# → mở http://localhost:8888

# HOẶC chạy desktop app (Electron)
npm run electron
```

### Deploy Production

**Các lựa chọn deploy:**

- **Node.js + PM2 + Nginx** — cho server Linux/VPS
- **Docker** — cho cloud/container
- **Electron** — cho desktop app (macOS, Windows, Linux)

---

## Hướng dẫn sử dụng nhanh

```
1. Mở http://localhost:8888
2. Tạo project mới → đặt tên (vd: "my-website")
3. Nhấn "+ New Section" → nhập URL website cần test
4. Duyệt website, nhấn ESC để capture mỗi màn hình
5. Đóng browser → dữ liệu tự động lưu
6. Lặp lại bước 3-5 khi có thay đổi
7. Tab "So sánh UI" hoặc "API Diff" → chọn 2 sections → xem kết quả
8. Khi phiên bản ổn định → "Merge to Main"
```

---

---

# 📗 API DOCUMENTATION

> _Dành cho Developer. Tài liệu chi tiết các API endpoint để tích hợp hoặc mở rộng._

---

## Tổng quan

- **Base URL:** `http://localhost:8888/api`
- **Content-Type:** `application/json` (trừ upload file dùng `multipart/form-data`)
- **Authentication:** Chưa có auth token. Phân biệt local/external user qua IP
- **Body size limit:** 50MB

### Response format chung

```json
{
  "success": true,
  "...": "data tùy endpoint"
}
```

Khi lỗi:

```json
{
  "error": "Mô tả lỗi"
}
```

### Danh sách Route Groups

| Group            | Prefix             | Mô tả                      |
| ---------------- | ------------------ | -------------------------- |
| **Projects**     | `/api/projects`    | Quản lý projects           |
| **Capture**      | `/api/capture`     | Ghi lại thao tác           |
| **Replay**       | `/api/replay`      | Phát lại & regression test |
| **Compare**      | `/api/compare`     | So sánh UI/API             |
| **Merge**        | `/api/merge`       | Merge section vào main     |
| **Auth**         | `/api/auth`        | Quản lý session đăng nhập  |
| **Share**        | `/api/share`       | Chia sẻ dữ liệu            |
| **Google Drive** | `/api/gdrive`      | Kết nối Google Drive       |
| **Documents**    | `/api/documents`   | Quản lý tài liệu           |
| **Test Runner**  | `/api/test-runner` | Chạy test tự động          |
| **Reports**      | `/api/reports`     | Tạo & quản lý báo cáo      |
| **Comments**     | `/api/comments`    | Comment trên screens       |
| **Versions**     | `/api/versions`    | Version control cho Main   |

---

## 1. Projects APIs

### `GET /api/projects`

Lấy danh sách tất cả projects.

**Response:**

```json
{
  "success": true,
  "projects": [
    {
      "name": "ecommerce-test",
      "createdAt": "2024-01-15T10:30:00Z",
      "mainSize": "15.2 MB",
      "sectionsCount": 3
    }
  ]
}
```

---

### `POST /api/projects`

Tạo project mới.

**Request Body:**

```json
{ "name": "my-project" }
```

**Response:**

```json
{
  "success": true,
  "project": { "name": "my-project", "path": "/storage/my-project" }
}
```

---

### `GET /api/projects/:name`

Lấy chi tiết project: danh sách sections, main tree.

---

### `DELETE /api/projects/:name`

Xóa project.

---

### `GET /api/projects/:name/sections`

Lấy danh sách sections của project.

---

### `PUT /api/projects/:name/sections/:timestamp/rename`

Đổi tên section.

**Request Body:**

```json
{ "newName": "Version 2.0 Test" }
```

---

### `GET /api/projects/:name/sections/:timestamp`

Lấy chi tiết một section cụ thể.

---

### `GET /api/projects/:name/snapshot`

Lấy UI snapshot data (DOM/CSS).

**Query Params:**

- `path` — Đường dẫn screen
- `type` — Loại section (`main` hoặc timestamp)

---

### `GET /api/projects/:name/apis`

Lấy danh sách API requests đã capture.

**Query Params:**

- `path` — Đường dẫn đến folder API

---

### `GET /api/projects/:name/size`

Lấy dung lượng project (main + sections).

---

### `GET /api/projects/:name/flow`

Lấy flow graph của main.

---

### `POST /api/projects/:name/flow/positions`

Lưu vị trí nodes trên sitemap (drag & drop).

**Request Body:**

```json
{
  "positions": {
    "nodeId1": { "x": 100, "y": 200 },
    "nodeId2": { "x": 300, "y": 400 }
  }
}
```

---

### `DELETE /api/projects/:name/node`

Xóa một node (file/directory) trong project.

**Request Body:**

```json
{ "nodePath": "main/login/screenId" }
```

---

### `PUT /api/projects/:name/node/move`

Di chuyển node trong project.

**Request Body:**

```json
{
  "sourcePath": "folder1/screenA",
  "targetPath": "folder2/screenA",
  "sectionTimestamp": "1707123456789"
}
```

---

### `GET /api/projects/:name/config`

Lấy cấu hình project.

---

### `PUT /api/projects/:name/config`

Lưu cấu hình project.

---

### `POST /api/projects/:name/config/auth-pages`

Thêm trang auth vào config (trang cần login khi replay).

---

### `DELETE /api/projects/:name/config/auth-pages`

Xóa trang auth khỏi config.

**Request Body:**

```json
{ "pagePath": "/login" }
```

---

## 2. Capture APIs

### `POST /api/capture/start`

Bắt đầu capture session — mở browser và bắt đầu ghi.

**Request Body:**

```json
{
  "projectName": "my-project",
  "startUrl": "https://example.com"
}
```

**Response:**

```json
{
  "success": true,
  "sessionId": "1707123456789",
  "sectionPath": "/storage/my-project/1707123456789"
}
```

---

### `POST /api/capture/stop`

Dừng capture session — đóng browser và lưu dữ liệu.

---

### `POST /api/capture/trigger-screenshot`

Chụp screenshot thủ công (tương đương nhấn ESC).

---

### `GET /api/capture/status`

Lấy trạng thái capture hiện tại.

**Response:**

```json
{
  "success": true,
  "isCapturing": true,
  "currentUrl": "https://example.com/products",
  "screensCount": 3
}
```

---

### `GET /api/capture/history`

Lấy URL history đã capture.

**Query Params:**

- `projectName` — Tên project

---

### `GET /api/capture/screen/:projectName/:section/:screenId`

Lấy HTML đầy đủ của screen (dùng cho iframe preview).

**Response:** `Content-Type: text/html` — HTML đầy đủ của screen

---

### `GET /api/capture/screen-info/:projectName/:section/:screenId`

Lấy metadata chi tiết: thông tin trang, số actions, số APIs, navigation info.

**Response:**

```json
{
  "success": true,
  "id": "abc123",
  "section": "1707123456789",
  "metadata": { "url": "https://example.com/products", "title": "Products" },
  "actions": { "count": 15, "summary": { "total": 15 } },
  "apis": { "count": 8, "summary": { "total": 8 } },
  "hasPreview": true
}
```

---

### `GET /api/capture/actions/:projectName/:section/:screenId`

Lấy danh sách actions (click, input, scroll...) của screen.

---

### `GET /api/capture/apis/:projectName/:section/:screenId`

Lấy danh sách API requests/responses của screen.

---

### `GET /api/capture/flow/:projectName/:section`

Lấy flow graph (nodes + edges) của section.

**Response:**

```json
{
  "success": true,
  "nodes": [
    { "id": "start", "name": "Start", "type": "start" },
    {
      "id": "abc123",
      "name": "Login",
      "type": "screen",
      "nestedPath": "start/login"
    }
  ],
  "edges": [{ "from": "start", "to": "abc123" }]
}
```

---

### `POST /api/capture/update-domain/:projectName/:section`

Đổi domain trong flow data (dùng khi chuyển môi trường staging → production).

**Request Body:**

```json
{ "domain": "https://production.example.com" }
```

---

### `GET /api/capture/preview/:projectName/:section/:screenId`

Lấy HTML preview của screen (render trong iframe).

---

### `GET /api/capture/screens/:projectName/:section`

Liệt kê tất cả screens trong section (scan đệ quy thư mục lồng nhau).

**Response:**

```json
{
  "success": true,
  "screens": [
    {
      "id": "abc123",
      "url": "https://example.com/login",
      "title": "Login",
      "time": "2024-01-15T10:30:00Z"
    },
    {
      "id": "def456",
      "url": "https://example.com/dashboard",
      "title": "Dashboard",
      "time": "2024-01-15T10:31:00Z"
    }
  ]
}
```

---

## 3. Replay APIs

### `POST /api/replay/start`

Bắt đầu replay session — mở browser và chuẩn bị phát lại.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionId": "1707123456789",
  "options": {}
}
```

---

### `POST /api/replay/run/:projectName/:sectionId`

Chạy full replay (có hỗ trợ mock API).

**Request Body:**

```json
{
  "mode": "mock",
  "deviceProfile": "desktop"
}
```

> - `mode`: `"mock"` (dùng API đã ghi) hoặc `"live"` (gọi API thật)
> - `deviceProfile`: `"desktop"`, `"mobile"`, `"tablet"`

---

### `POST /api/replay/regression/:projectName/:sectionId`

🧪 **Chạy regression test** — replay + capture mới + so sánh tự động + tạo report.

**Request Body:**

```json
{
  "deviceProfile": "desktop",
  "keepBrowserOpen": false
}
```

**Response:** Báo cáo chi tiết PASS/FAIL cho từng screen.

---

### `POST /api/replay/stop`

Dừng replay session.

---

### `GET /api/replay/status`

Lấy trạng thái replay hiện tại (running, progress...).

---

### `POST /api/replay/navigate`

Điều hướng đến screen cụ thể trong replay session.

**Request Body:**

```json
{ "screenId": "abc123" }
```

---

### `POST /api/replay/replay-actions`

Phát lại actions trên screen hiện tại.

**Request Body:**

```json
{ "screenId": "abc123" }
```

---

### `POST /api/replay/compare`

So sánh 2 captures trong replay.

**Request Body:**

```json
{
  "projectName": "my-project",
  "section1": "main",
  "screen1": "abc123",
  "section2": "1707123456789",
  "screen2": "def456"
}
```

---

### `GET /api/replay/capture/:projectName/:sectionId/:screenId`

Lấy capture data của screen (metadata, actions, apis — không bao gồm full HTML).

---

### `GET /api/replay/flow/:projectName/:sectionId`

Lấy flow data cho replay.

---

### `GET /api/replay/history/:projectName/:sectionId`

Lấy lịch sử các lần test run.

---

### `DELETE /api/replay/replay/:projectName/:originalSection/:replaySection`

Xóa một test run.

---

## 4. Compare APIs

### `POST /api/compare/sections`

So sánh 2 sections (hoặc section vs main).

**Request Body:**

```json
{
  "projectName": "my-project",
  "section1": "main",
  "section2": "1707123456789"
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "summary": { "matched": 15, "changed": 3, "missing": 1, "added": 2 },
    "details": [
      {
        "path": "/products",
        "status": "changed",
        "domDiff": { "added": 5, "removed": 2, "modified": 3 },
        "cssDiff": { "changed": ["padding", "margin"] }
      }
    ]
  }
}
```

---

### `POST /api/compare/all`

So sánh Section vs Main.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionTimestamp": "1707123456789"
}
```

---

### `POST /api/compare/page-diff`

Lấy chi tiết diff của 1 page cụ thể.

**Request Body:**

```json
{
  "projectName": "my-project",
  "section1": "main",
  "section2": "1707123456789",
  "path1": "/products",
  "path2": "/products"
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "domChanges": [
      {
        "type": "added",
        "selector": ".promo-banner",
        "html": "<div class=\"promo-banner\">Sale 50%</div>"
      }
    ],
    "cssChanges": [
      {
        "selector": ".product-card",
        "property": "padding",
        "oldValue": "20px",
        "newValue": "24px"
      }
    ]
  }
}
```

---

### `GET /api/compare/screenshot/:projectName/:section/*`

Lấy screenshot của screen (dùng trong so sánh).

---

## 5. Merge APIs

### `POST /api/merge`

Merge **các screens được chọn** từ section vào main.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionTimestamp": "1707123456789",
  "folders": ["login", "products"],
  "deleteAfter": true
}
```

**Response:**

```json
{
  "success": true,
  "result": { "merged": 2, "overwritten": 1, "errors": 0 }
}
```

---

### `POST /api/merge/all`

Merge **toàn bộ** section vào main.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionTimestamp": "1707123456789",
  "deleteAfter": true
}
```

---

### `POST /api/merge/preview`

**Preview merge (dry-run)** — xem trước kết quả merge mà không thực sự merge.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionTimestamp": "1707123456789",
  "folders": ["login", "products"]
}
```

---

## 6. Auth APIs

### `GET /api/auth/session/:projectName`

Lấy trạng thái session đã lưu.

**Response:**

```json
{
  "hasSession": true,
  "isValid": true,
  "savedAt": "2024-01-15T10:30:00Z",
  "loginMethod": "manual",
  "cookieCount": 5,
  "localStorageKeys": 3
}
```

---

### `GET /api/auth/:projectName`

Lấy full auth data (cookies ẩn giá trị nhạy cảm).

---

### `POST /api/auth/:projectName`

Lưu auth data (cookies, localStorage, sessionStorage).

**Request Body:**

```json
{
  "cookies": [
    { "name": "session_id", "value": "abc123", "domain": ".example.com" }
  ],
  "localStorage": { "token": "jwt_token_here" },
  "sessionStorage": {},
  "loginMethod": "manual"
}
```

---

### `DELETE /api/auth/session/:projectName`

Xóa session đã lưu.

---

### `POST /api/auth/session/:projectName/refresh`

Force refresh session (sau khi login thủ công lại).

---

## 7. Share APIs

### `GET /api/share/network`

Lấy thông tin mạng (IPs, WiFi SSID, port).

---

### `POST /api/share/create`

Tạo share link.

**Request Body:**

```json
{
  "projectName": "my-project",
  "type": "main",
  "sectionId": "1707123456789"
}
```

> `type`: `"main"` hoặc `"section"`

---

### `GET /api/share/list`

Liệt kê tất cả shares đang hoạt động.

---

### `GET /api/share/info/:token`

Lấy thông tin share + danh sách files.

---

### `GET /api/share/file/:token/*`

Download một file cụ thể từ share.

---

### `GET /api/share/download/:token`

Download toàn bộ share dưới dạng ZIP.

---

### `DELETE /api/share/:token`

Xóa share.

---

### `POST /api/share/import/link`

Import data từ share link (từ MAPIT instance khác).

**Request Body:**

```json
{
  "projectName": "my-project",
  "targetType": "section",
  "shareUrl": "http://192.168.1.100:8888/share/abc123xyz"
}
```

---

### `POST /api/share/import/upload`

Import từ file ZIP upload trực tiếp.

**Query Params:**

- `projectName` — Tên project
- `targetType` — `"main"` hoặc `"section"`

**Body:** Raw binary ZIP data

---

### `GET /api/share/scan`

Quét mạng tìm các MAPIT instance khác.

---

### `GET /api/share/remote-shares`

Liệt kê shares từ MAPIT instance từ xa.

**Query Params:**

- `host` — Địa chỉ host (vd: `192.168.1.100:8888`)

---

## 8. Google Drive APIs

### `GET /api/gdrive/status`

Kiểm tra trạng thái kết nối Google Drive.

---

### `GET /api/gdrive/auth-url`

Lấy URL OAuth2 để redirect user đăng nhập Google.

---

### `GET /api/gdrive/callback`

Callback OAuth2 (tự động xử lý, không cần gọi thủ công).

---

### `POST /api/gdrive/upload`

Upload data lên Google Drive.

**Request Body:**

```json
{
  "projectName": "my-project",
  "type": "main",
  "sectionId": "1707123456789"
}
```

---

### `GET /api/gdrive/files/:projectName`

Liệt kê files trên Drive của project.

---

### `POST /api/gdrive/download`

Download từ Drive và import vào project.

**Request Body:**

```json
{
  "projectName": "my-project",
  "fileId": "drive_file_id",
  "targetType": "section"
}
```

---

### `POST /api/gdrive/import-link`

Import từ Drive share link.

**Request Body:**

```json
{
  "projectName": "my-project",
  "targetType": "section",
  "driveLink": "https://drive.google.com/file/d/xxx/view"
}
```

---

### `POST /api/gdrive/disconnect`

Ngắt kết nối Google Drive.

---

## 9. Documents APIs

### `POST /api/documents/:project/upload`

Upload tài liệu.

**Content-Type:** `multipart/form-data`

**Form Fields:**

- `file` — Tệp cần upload (DOCX, XLSX, PDF, TXT, CSV — tối đa 50MB)

**Response:**

```json
{
  "success": true,
  "document": { "id": "doc123", "name": "requirements.docx", "version": 1 }
}
```

---

### `GET /api/documents/:project`

Liệt kê tất cả tài liệu của project.

---

### `GET /api/documents/:project/:docId`

Lấy thông tin chi tiết tài liệu.

---

### `GET /api/documents/:project/:docId/:version/download`

Download một version cụ thể của tài liệu.

---

### `GET /api/documents/:project/:docId/:version/preview`

Preview nội dung tài liệu (extracted text).

---

### `GET /api/documents/:project/:docId/compare?v1=1&v2=2`

So sánh 2 versions của tài liệu.

**Query Params:**

- `v1` — Version 1 (number)
- `v2` — Version 2 (number)

**Response:**

```json
{
  "success": true,
  "added": ["Feature: Dark mode"],
  "removed": ["Feature: IE11 support"],
  "modified": ["Deadline: Q1 → Q2"]
}
```

---

### `DELETE /api/documents/:project/:docId`

Xóa tài liệu (tất cả versions).

---

### `DELETE /api/documents/:project/:docId/:version`

Xóa một version cụ thể.

---

## 10. Test Runner APIs

### `POST /api/test-runner/run`

Chạy regression test.

**Request Body:**

```json
{
  "projectName": "my-project",
  "sectionTimestamp": "1707123456789",
  "baselineTimestamp": "main",
  "threshold": 90
}
```

> `threshold`: Ngưỡng phần trăm match (mặc định 90%). Dưới ngưỡng = FAIL.

**Response:**

```json
{
  "success": true,
  "result": {
    "passed": 4,
    "failed": 1,
    "warnings": 2,
    "details": [
      {
        "screen": "checkout",
        "status": "failed",
        "uiMatch": 85,
        "apiMatch": 0,
        "error": "API returned 500"
      }
    ]
  }
}
```

---

### `GET /api/test-runner/:projectName/results`

Lấy lịch sử test.

**Query Params (optional):**

- `page` — Trang (mặc định 1)
- `limit` — Số kết quả/trang (mặc định 20)
- `status` — Lọc theo status (`passed`, `failed`)

---

### `GET /api/test-runner/:projectName/results/:testId`

Lấy kết quả test cụ thể.

---

### `DELETE /api/test-runner/:projectName/results/:testId`

Xóa kết quả test.

---

### `GET /api/test-runner/:projectName/statistics`

Lấy thống kê test tổng quan.

---

## 11. Reports APIs

### `POST /api/reports/generate`

Tạo báo cáo.

**Request Body:**

```json
{
  "projectName": "my-project",
  "type": "comparison",
  "section1": "main",
  "section2": "1707123456789",
  "format": "html",
  "includeScreenshots": true,
  "includeCharts": true
}
```

---

### `GET /api/reports/:projectName/list`

Liệt kê tất cả báo cáo.

---

### `GET /api/reports/:projectName/:reportId`

Lấy metadata báo cáo.

---

### `GET /api/reports/:projectName/:reportId/html`

Lấy báo cáo dạng HTML (render trực tiếp).

---

### `GET /api/reports/:projectName/:reportId/pdf`

Download báo cáo dạng PDF.

---

### `DELETE /api/reports/:projectName/:reportId`

Xóa báo cáo.

---

## 12. Comments APIs

### `POST /api/comments/:projectName/comments`

Tạo comment mới.

**Request Body:**

```json
{
  "screenId": "abc123",
  "content": "Button bị lệch trên mobile",
  "author": "QA-Linh",
  "section": "1707123456789",
  "annotations": [{ "x": 100, "y": 200, "width": 50, "height": 30 }]
}
```

---

### `GET /api/comments/:projectName/comments`

Lấy tất cả comments của project.

---

### `GET /api/comments/:projectName/comments/search?q=keyword`

Tìm kiếm comments.

---

### `GET /api/comments/:projectName/screens/:screenId/comments`

Lấy comments của screen cụ thể.

---

### `GET /api/comments/:projectName/comments/:commentId`

Lấy chi tiết comment.

---

### `PUT /api/comments/:projectName/comments/:commentId`

Cập nhật comment.

---

### `DELETE /api/comments/:projectName/comments/:commentId`

Xóa comment.

---

### `POST /api/comments/:projectName/comments/:commentId/reply`

Thêm reply cho comment.

**Request Body:**

```json
{ "content": "Đã fix, check lại", "author": "Dev-Hùng" }
```

---

### `PUT /api/comments/:projectName/comments/:commentId/replies/:replyId`

Cập nhật reply.

---

### `DELETE /api/comments/:projectName/comments/:commentId/replies/:replyId`

Xóa reply.

---

### `PATCH /api/comments/:projectName/comments/:commentId/resolve`

Đánh dấu resolved/unresolved.

**Request Body:**

```json
{ "resolved": true }
```

---

## 13. Versions APIs

### `POST /api/versions/:projectName/commit`

Commit snapshot hiện tại của Main.

**Request Body:**

```json
{ "message": "Release v2.0 - stable", "author": "Dev-Hùng" }
```

---

### `GET /api/versions/:projectName/history`

Lấy lịch sử versions.

**Query Params (optional):**

- `page`, `limit`, `search`

---

### `GET /api/versions/:projectName/versions/:versionId`

Lấy chi tiết version.

---

### `POST /api/versions/:projectName/rollback/:versionId`

Rollback Main về version cũ.

---

### `GET /api/versions/:projectName/diff/:v1/:v2`

So sánh 2 versions.

---

### `POST /api/versions/:projectName/versions/:versionId/tag`

Gắn tag cho version.

**Request Body:**

```json
{ "tagName": "v2.0-release" }
```

---

### `DELETE /api/versions/:projectName/versions/:versionId`

Xóa version.

---

## ⚙️ Cấu hình Server

### Port & Body Limit

```javascript
// server.js
const PORT = 8888; // Đổi port nếu cần
app.use(express.json({ limit: "50mb" })); // Tăng nếu file lớn
```

### Compression

```javascript
app.use(compression({ level: 6 })); // 0-9, cao hơn = nén nhiều hơn nhưng chậm
```

### Storage Path

```javascript
// src/services/storage.service.js
const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");
```

### Access Control (Local vs External)

```javascript
// Khi truy cập từ localhost → Full app
// Khi truy cập từ IP khác → Chỉ xem share listing
```

### Environment Variables (`.env`)

```bash
PORT=8888
NODE_ENV=production
STORAGE_PATH=/var/app/storage

# Google Drive (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8888/api/gdrive/callback
```

---

## 🔧 Troubleshooting

| Vấn đề                       | Giải pháp                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| Browser không mở khi capture | `npx playwright install chromium`                                |
| Out of memory                | `NODE_OPTIONS="--max-old-space-size=4096" npm start`             |
| Port 8888 đã dùng            | Sửa `const PORT = 9999;` trong `server.js`                       |
| Google Drive không connect   | Kiểm tra `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` trong `.env` |

---

## 📝 License

MIT License

---

**Made with ❤️ by MAPIT Team**
