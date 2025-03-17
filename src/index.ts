import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MSConfig, AdminConfig, User, APIResponse } from './types';
import { MicrosoftService } from './services/microsoft';
import { InvitationService } from './services/invitation';

type Bindings = {
  DB: D1Database;
  CLIENT_ID: string;
  TENANT_ID: string;
  CLIENT_SECRET: string;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// 根路由返回静态HTML
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Microsoft Office 365 账号管理</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
      <div class="min-h-screen flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 class="text-2xl font-bold text-center mb-6">Office 365 账号管理</h1>
          <div class="space-y-4">
            <button onclick="window.location.href='/api/login'" class="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition duration-200">管理员登录</button>
            <button onclick="window.location.href='/api/account/create'" class="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 transition duration-200">创建账号</button>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 配置信息
const config: MSConfig = {
  clientId: '',
  tenantId: '',
  clientSecret: '',
  domain: ['onmicrosoft.com'],
  skuId: [
    {
      title: 'A3(桌面版office + onedrive 5t)',
      skuId: ''
    }
  ]
};

const adminConfig: AdminConfig = {
  username: '',
  password: '',
  invitationCodeLength: 8
};

// 中间件：验证管理员登录
const authMiddleware = async (c: any, next: any) => {
  const token = c.req.header('Authorization');
  if (!token || token !== `Bearer ${c.env.ADMIN_PASSWORD}`) {
    return c.json<APIResponse>({ code: 1, msg: '未登录或登录已失效' });
  }
  await next();
};

// 初始化服务
const initServices = (c: any) => {
  config.clientId = c.env.CLIENT_ID;
  config.tenantId = c.env.TENANT_ID;
  config.clientSecret = c.env.CLIENT_SECRET;
  adminConfig.username = c.env.ADMIN_USERNAME;
  adminConfig.password = c.env.ADMIN_PASSWORD;

  const msService = new MicrosoftService(config);
  const invitationService = new InvitationService(c.env.DB);
  return { msService, invitationService };
};

// 管理员登录
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  if (username === c.env.ADMIN_USERNAME && password === c.env.ADMIN_PASSWORD) {
    return c.json<APIResponse>({ code: 0, msg: '登录成功', data: { token: c.env.ADMIN_PASSWORD } });
  }
  return c.json<APIResponse>({ code: 1, msg: '登录失败' });
});

// 创建邀请码
app.post('/api/invitation/create', authMiddleware, async (c) => {
  const { num } = await c.req.json<{ num: number }>();
  const { invitationService } = initServices(c);
  const codes = await invitationService.createCodes(num);
  return c.json<APIResponse>({ code: 0, msg: '创建成功', data: codes });
});

// 获取邀请码列表
app.get('/api/invitation/list', authMiddleware, async (c) => {
  const status = c.req.query('status');
  const { invitationService } = initServices(c);
  const codes = await invitationService.listCodes(status ? parseInt(status) : undefined);
  return c.json<APIResponse>({ code: 0, msg: '获取成功', data: codes });
});

// 删除邀请码
app.post('/api/invitation/delete', authMiddleware, async (c) => {
  const { id, email } = await c.req.json<{ id: number; email?: string }>();
  const { msService, invitationService } = initServices(c);

  if (email) {
    await msService.deleteUser(email);
  }
  await invitationService.deleteCode(id);

  return c.json<APIResponse>({ code: 0, msg: '删除成功' });
});

// 启用账号
app.post('/api/account/enable', authMiddleware, async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  const { msService } = initServices(c);
  await msService.enableUser(email);
  return c.json<APIResponse>({ code: 0, msg: '启用成功' });
});

// 创建账号
app.post('/api/account/create', async (c) => {
  const data = await c.req.json<{
    invitation_code?: string;
    display_name: string;
    user_name: string;
    domain: string;
    sku_id: string;
  }>();

  const { msService, invitationService } = initServices(c);

  // 验证邀请码
  if (data.invitation_code) {
    const code = await invitationService.verifyCode(data.invitation_code);
    if (!code) {
      return c.json<APIResponse>({ code: 1, msg: '邀请码不存在' });
    }
    if (code.status !== 0) {
      return c.json<APIResponse>({ code: 1, msg: '邀请码已被使用' });
    }
  }

  // 生成随机密码
  const password = Math.random().toString(36).slice(-8);

  const user: User = {
    displayName: data.display_name,
    userName: data.user_name,
    email: '',
    password
  };

  try {
    // 创建用户
    const email = await msService.createUser(user, data.domain, data.sku_id);

    // 更新邀请码状态
    if (data.invitation_code) {
      await invitationService.useCode(data.invitation_code, email);
    }

    return c.json<APIResponse>({
      code: 0,
      msg: '申请账号成功',
      data: { email, password }
    });
  } catch (error: any) {
    return c.json<APIResponse>({ code: 1, msg: error.message });
  }
});

export default app;
