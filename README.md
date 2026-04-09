# 随迹（trace）

旅行路线与行程规划应用：管理行程（Trip）、按天路线（Route）、兴趣点（POI），支持地图展示、路况/出行方式参考，以及基于 LLM 的 **智能行程草案生成** 与 **确认落库**（结合百度地图 POI 检索解析坐标）。

## 技术栈


| 部分   | 技术                                                                      |
| ---- | ----------------------------------------------------------------------- |
| 后端   | Python 3.11+、Django 4.2、Django REST Framework、MySQL（PyMySQL）、Pydantic   |
| 前端   | React 18、TypeScript、Vite 5、Ant Design 5、Tailwind、react-map-gl（MapLibre） |
| 外部能力 | 百度地图 Place API、OpenAI 兼容 LLM、OSRM（路线时间等）                                |


## 仓库结构

```text
backend/          # Django 项目（API：/api/v1/...）
frontend/         # Vite + React 单页应用
```

## 环境要求

- Python 3.11+
- Node.js 18+（建议）
- MySQL 5.7+ / 8.x（与 `backend/config/settings.py` 或你的 `.env` 配置一致）

## 后端（backend）

### 1. 虚拟环境与依赖

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `backend/.env.example` 为 `backend/.env`（或放在仓库根目录 `.env`，Django 会按顺序加载）。

至少建议设置：

- `DJANGO_SECRET_KEY`：生产环境务必改为随机字符串  
- `BAIDU_MAP_AK`：POI 搜索与智能行程落库  
- `LLM_API_BASE`、`LLM_API_KEY`：智能行程草案（OpenAI 兼容接口）

可选：`OSRM_URL`、`BAIDU_SMART_COMMIT_INTERVAL_SEC`（智能行程确认时百度请求间隔，缓解限流）。

> 说明：默认 `settings.py` 中的数据库连接可能与示例 `.env` 不完全一致，请以你本机 MySQL 为准修改 `DATABASES` 或后续改为读取环境变量。

### 3. 数据库

创建数据库后，可选用项目内 SQL 初始化表结构：

```bash
mysql -u root -p < backend/init.sql
```

若使用 Django 迁移（在已存在 `migrations` 的情况下）：

```bash
cd backend
python manage.py migrate
```

### 4. 启动开发服务

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

API 根路径前缀：`/api/v1/`。

### 5. 测试

```bash
cd backend
pytest
```

## 前端（frontend）

### 1. 安装与开发

```bash
cd frontend
npm install
npm run dev
```

默认开发地址：[http://localhost:5173](http://localhost:5173)。Vite 已将 `/api` 代理到 `http://localhost:8000`，与后端联调时需同时启动 Django。

### 2. 环境变量

复制 `frontend/.env.example` 为 `frontend/.env`（可选）。默认通过 `VITE_API_URL` 指向 `http://localhost:8000/api/v1`；若走 Vite 代理，也可按需在 `src/services/api.ts` 中保持与现网一致。

### 3. 构建与 E2E

```bash
npm run build
npm run test:e2e    # 需已安装 Playwright 浏览器依赖
```

## 主要页面路由（前端）


| 路径                    | 说明             |
| --------------------- | -------------- |
| `/`、`/trips`          | 行程列表           |
| `/trips/:id`          | 行程详情（地图、按天路线等） |
| `/trips/smart-create` | 智能创建行程         |
| `/routes/create`      | 规划路线           |
| `/pois`               | 标点与列表          |


## 许可证

未在仓库中统一声明时，以项目所有者后续补充的 `LICENSE` 为准。