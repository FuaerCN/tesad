import { User, MSConfig } from '../types';

export class MicrosoftService {
  private token: string = '';
  private config: MSConfig;

  constructor(config: MSConfig) {
    this.config = config;
  }

  async getToken(): Promise<string> {
    if (this.token) return this.token;

    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default'
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error('Failed to get Microsoft token');
    }

    this.token = data.access_token;
    return this.token;
  }

  async createUser(user: User, domain: string, skuId: string): Promise<string> {
    const token = await this.getToken();
    const userEmail = `${user.userName}@${domain}`;

    const createUserUrl = 'https://graph.microsoft.com/v1.0/users';
    const userData = {
      accountEnabled: true,
      displayName: user.displayName,
      mailNickname: user.userName,
      passwordPolicies: 'DisablePasswordExpiration, DisableStrongPassword',
      passwordProfile: {
        password: user.password,
        forceChangePasswordNextSignIn: true
      },
      userPrincipalName: userEmail,
      usageLocation: 'CN'
    };

    const response = await fetch(createUserUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.error?.message === 'Another object with the same value for property userPrincipalName already exists.') {
        throw new Error('用户名已被占用，请修改后重试');
      }
      throw new Error(data.error?.message || '创建用户失败');
    }

    await this.assignLicense(userEmail, skuId);
    return userEmail;
  }

  private async assignLicense(userEmail: string, skuId: string): Promise<void> {
    const token = await this.getToken();
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}/assignLicense`;
    const data = {
      addLicenses: [{
        disabledPlans: [],
        skuId: skuId
      }],
      removeLicenses: []
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('分配许可证失败');
    }
  }

  async deleteUser(userEmail: string): Promise<void> {
    const token = await this.getToken();
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error('删除用户失败');
    }
  }

  async enableUser(userEmail: string): Promise<void> {
    const token = await this.getToken();
    const url = `https://graph.microsoft.com/v1.0/users/${userEmail}`;
    const data = {
      accountEnabled: true
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('启用用户失败');
    }
  }
}