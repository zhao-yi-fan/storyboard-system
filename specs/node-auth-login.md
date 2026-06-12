# Node 后端真实登录与会话落库

## 用户目标

为当前 `backend-node/` 补齐真实登录能力，让用户通过账号密码登录，服务端创建并持久化会话，前端后续请求通过 Cookie 自动带上登录态。

## 范围

本期只做：

1. 登录
2. 登出
3. 获取当前登录用户
4. API 鉴权中间件
5. 用户表、会话表自动建表
6. 启动时自动引导一个管理员账号

本期不做：

1. 注册
2. 忘记密码
3. 多角色权限系统
4. 账号设置页面

## 数据结构

### 用户表 `auth_users`

- `id`
- `account`
- `password_hash`
- `password_salt`
- `display_name`
- `role_label`
- `is_active`
- `last_login_at`
- `created_at`
- `updated_at`

约束：
- `account` 唯一

### 会话表 `auth_sessions`

- `id`
- `user_id`
- `session_token_hash`
- `expires_at`
- `last_seen_at`
- `user_agent`
- `ip_address`
- `revoked_at`
- `created_at`
- `updated_at`

约束：
- `session_token_hash` 唯一

## 环境变量

- `AUTH_BOOTSTRAP_ACCOUNT`
- `AUTH_BOOTSTRAP_PASSWORD`
- `AUTH_BOOTSTRAP_DISPLAY_NAME`
- `AUTH_BOOTSTRAP_ROLE_LABEL`
- `AUTH_SESSION_COOKIE_NAME`
- `AUTH_SESSION_TTL_DAYS`

规则：
- 启动时如果 `AUTH_BOOTSTRAP_ACCOUNT` 和 `AUTH_BOOTSTRAP_PASSWORD` 存在，则自动创建或更新该管理员账号
- 生产环境默认通过 `.env` 手动配置

## 接口

### `POST /api/auth/login`

请求：

```json
{
  "account": "admin",
  "password": "123456"
}
```

返回：

```json
{
  "code": 200,
  "data": {
    "id": 1,
    "account": "admin",
    "display_name": "创作者",
    "role_label": "分镜工作室"
  },
  "message": ""
}
```

行为：
- 校验账号密码
- 生成随机 session token
- 数据库存一份 token hash
- 响应写入 HttpOnly Cookie

### `POST /api/auth/logout`

行为：
- 清理当前 session
- 删除 Cookie

### `GET /api/auth/me`

行为：
- 从 Cookie 解析 session
- 返回当前登录用户

## 鉴权规则

以下接口不鉴权：

- `/api/health`
- `/api/auth/login`
- `/api/auth/logout`

其他 `/api/*` 默认要求登录。

未登录时返回：

```json
{ "code": 0, "data": null, "message": "请先登录" }
```

## 前端行为

1. 登录页调用 `POST /api/auth/login`
2. 登录成功后本地仅缓存用户展示信息
3. 刷新页面时通过 `GET /api/auth/me` 恢复登录态
4. 退出登录调用 `POST /api/auth/logout`
5. 未登录访问业务页时跳回 `/login`

## 验收标准

1. Node 服务启动后可自动建表
2. 配置了 bootstrap 账号后可直接登录
3. 登录成功后关闭刷新页面仍保持登录
4. 登出后无法继续访问业务接口
5. `backend-node` 构建通过
6. `storyboard-app` 构建通过
