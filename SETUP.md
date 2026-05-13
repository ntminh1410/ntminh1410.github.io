# Setup — từng bước từ A đến Z

Tài liệu này dành cho **Tùng** — chủ portfolio. Nếu bạn đang đọc và không biết Tùng là ai, cứ làm theo các bước, chúng đúng cho mọi người. Tổng thời gian: ~15 phút.

## Tổng quan kiến trúc

```
Google Sheet  ─►  GitHub Actions (mỗi 30 phút)  ─►  Build HTML tĩnh  ─►  GitHub Pages
                  (fetch CSV của từng tab)             (Node script)        (https://...github.io)
```

Bạn chỉ sửa nội dung trong Google Sheet. Mọi thứ khác chạy tự động.

---

## Bước 1 — Push code lên GitHub

Repo: `https://github.com/ntminh1410/vuongtung`

Từ thư mục `site/`:

```bash
cd /Users/minhminh/Projects/tungporfolio/site
git init
git add -A
git commit -m "Initial commit — chat-bubble portfolio sourced from Google Sheets"
git branch -M main
git remote add origin https://github.com/ntminh1410/vuongtung.git
git push -u origin main
```

Nếu repo đã có sẵn nội dung mâu thuẫn, cần `git pull --rebase origin main` rồi push lại.

## Bước 2 — Bật GitHub Pages

1. Vào repo trên GitHub: **Settings → Pages**.
2. Mục **Source** chọn **GitHub Actions** (không phải "Deploy from a branch").
3. Lưu lại.

Lần đầu tiên push code, workflow `build-deploy.yml` sẽ chạy tự động. Theo dõi ở tab **Actions** trên GitHub.

Sau khoảng 1–2 phút, site sẽ live ở: `https://ntminh1410.github.io/vuongtung/`

> ⚠️ Site được deploy ở subpath `/vuongtung/`. Nếu thấy CSS không load (vì link `/static/...` không đúng), xem mục **Bước 6 — Custom domain hoặc subpath**.

## Bước 3 — Publish toàn bộ Google Sheet ra web

URL bạn đang dùng (`/pub?output=csv`) chỉ publish tab đầu tiên. Để site lấy được data từ Settings / Writings / Projects / ..., bạn cần **publish toàn bộ workbook**:

1. Mở Google Sheet [Tung Portfolio - Content Management](https://docs.google.com/spreadsheets/d/e/2PACX-1vTdmVNmNEOUk0gK8R2fE47WFDsJYJnq0sT-sLI9Af-XvQzC_HnipWWcKwuQvBUBkgmuR0unlriv86mE/pub).
2. **File → Share → Publish to web**.
3. Tab **Link**: chọn **Entire Document** + **Comma-separated values (.csv)**.
4. Bấm **Publish** → **OK**.

Bây giờ mọi tab đều có thể fetch bằng URL pattern:
```
.../pub?gid=<GID>&single=true&output=csv
```

## Bước 4 — Tìm `gid` của từng tab và điền vào config

`gid` là số định danh của mỗi tab trong workbook. Cách tìm:

1. Mở Google Sheet bình thường (chế độ edit, không phải public URL).
2. Click vào tab **Settings**. Nhìn URL trên thanh địa chỉ — sẽ có dạng:
   ```
   https://docs.google.com/spreadsheets/d/<long-id>/edit#gid=1234567890
   ```
   Copy số sau `gid=` (vd: `1234567890`).
3. Lặp lại cho 6 tab: **Settings, Writings, Projects, Recommendations, Tags, Navigation**.

Mở file `config/sources.json` trong repo, điền gid vào:

```json
{
  "publishedBase": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdmVNmNEOUk0gK8R2fE47WFDsJYJnq0sT-sLI9Af-XvQzC_HnipWWcKwuQvBUBkgmuR0unlriv86mE/pub",
  "tabs": {
    "settings":        { "gid": 1234567890 },
    "writings":        { "gid": 2345678901 },
    "projects":        { "gid": 3456789012 },
    "recommendations": { "gid": 4567890123 },
    "tags":            { "gid": 5678901234 },
    "navigation":      { "gid": 6789012345 }
  }
}
```

Commit và push:
```bash
git add config/sources.json
git commit -m "config: wire up sheet gids"
git push
```

GitHub Actions sẽ tự rebuild với data từ sheet thật.

> 🛟 **Fallback an toàn**: nếu bạn quên điền gid hoặc fetch lỗi, build vẫn chạy với data demo trong `data/fallback/`. Site không bao giờ trắng vì lỗi config.

## Bước 5 — Sửa nội dung site qua Google Sheet

Sau khi config xong, mọi thay đổi trên sheet sẽ hiện ra web trong **tối đa 30 phút** (theo lịch cron). Muốn publish ngay:

- Vào tab **Actions** trên GitHub → **Build and deploy** → **Run workflow**.

### Quy tắc khi sửa sheet

| Việc cần làm | Nơi sửa |
|---|---|
| Đổi tên, bio, avatar, mạng xã hội | Tab **Settings** |
| Viết bài blog mới | Thêm row mới vào tab **Writings**, đặt `status = published` |
| Thêm project | Thêm row vào **Projects** |
| Thêm tool recommend | Thêm row vào **Recommendations** |
| Đổi menu top bar / footer | Sửa tab **Navigation** |
| Đổi màu/icon của tag | Sửa tab **Tags** |

**Quan trọng:**
- Cột `status` phải là `published` để hiện ra web. Để `draft` nếu muốn ẩn.
- Cột `slug` là URL: bài viết `power-of-whitespace` sẽ ở `/writings/power-of-whitespace/`. Dùng chữ thường + dấu nối, không có space hay dấu tiếng Việt.
- `body_md` hỗ trợ **Markdown đầy đủ** (heading, list, code, ảnh, link...).
- Không xóa hàng header (hàng đầu tiên).

## Bước 6 — Custom domain hoặc subpath

Site sẽ deploy tới `https://ntminh1410.github.io/vuongtung/`. Có 2 vấn đề khả thi:

**Vấn đề A — CSS/JS không load do subpath sai**:
File HTML link tới `/static/css/styles.css`, nhưng trên GitHub Pages subpath đường dẫn thực là `/vuongtung/static/css/styles.css`. Có 2 cách giải:

1. **Dễ nhất**: dùng repo `<username>.github.io` (vd `ntminh1410.github.io`) — Pages serve ở root, không subpath. Đổi tên repo trong **Settings → Repository name**.

2. **Cấu hình base path**: nếu giữ tên `vuongtung`, sửa trong `scripts/build.js`:
   - Thêm biến `const BASE_PATH = '/vuongtung';` ở đầu file
   - Tìm các đường dẫn cứng `"/static/..."`, `"/writings/..."`, `"/projects/..."` trong templates và prefix `BASE_PATH`
   - Hoặc nói tôi (Claude) làm hộ.

**Vấn đề B — Bạn có domain riêng** (vd `tung.dev`):
1. Trong **Settings → Pages → Custom domain**, nhập `tung.dev`, lưu.
2. Tại nơi quản lý DNS, thêm CNAME `tung.dev` → `ntminh1410.github.io`.
3. Đợi DNS propagate (~10 phút), bật **Enforce HTTPS**.

## Bước 7 — Cập nhật `site_url` trong Settings

Sau khi biết URL cuối cùng, vào tab **Settings** trong sheet → sửa hàng `site_url`. Giá trị này được dùng cho:
- Thẻ OG / Twitter share preview
- Sitemap, RSS feed
- Canonical URLs

Ví dụ: `https://ntminh1410.github.io/vuongtung` hoặc `https://tung.dev` (không có `/` cuối).

---

## Khắc phục sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|---|---|---|
| Site hiện data "Tony Carter" | Sheet chưa publish entire document, hoặc gid sai | Bước 3 + 4 |
| GitHub Action chạy nhưng site chưa update | Cache CDN | Đợi 5–10 phút hoặc Ctrl+Shift+R |
| Action lỗi "fetch failed" | Sheet chuyển sang private | Re-publish public |
| Bài viết không hiện | `status` không phải `published`, hoặc thiếu `id`/`title`/`slug` | Kiểm tra row trong sheet |
| Trang detail 404 | Slug có ký tự lạ | Đổi slug sang dạng `chu-thuong-co-dau-noi` |
| CSS load fail | Subpath sai | Xem Bước 6, Vấn đề A |

## Dev local

```bash
cd site/
npm install              # 1 lần
npm run dev              # Build + serve tại http://localhost:4173
npm run build            # Fetch sheet thật (cần config gid)
npm run build:offline    # Build với data fallback (không fetch sheet)
```

## Cấu trúc file

```
site/
├── .github/workflows/   # GitHub Actions
├── config/              # sources.json — URL/gid của các tab
├── data/fallback/       # CSV dự phòng, dùng khi sheet chưa publish
├── scripts/             # Build + serve script (Node)
├── static/              # CSS + JS không qua template
├── templates/           # HTML templates (mini-mustache)
└── dist/                # Output build (gitignored)
```
