export interface User {
  displayName: string;
  userName: string;
  email: string;
  password: string;
}

export interface InvitationCode {
  id?: number;
  code: string;
  createTime: number;
  updateTime: number;
  status: number;
  email: string;
}

export interface MSConfig {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  domain: string[];
  skuId: {
    title: string;
    skuId: string;
  }[];
}

export interface AdminConfig {
  username: string;
  password: string;
  invitationCodeLength: number;
}

export interface APIResponse<T = any> {
  code: number;
  msg: string;
  data?: T;
}