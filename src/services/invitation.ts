import { InvitationCode } from '../types';

export class InvitationService {
  private db: D1Database;
  private codeLength: number;

  constructor(db: D1Database, codeLength: number = 8) {
    this.db = db;
    this.codeLength = codeLength;
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < this.codeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createCodes(count: number): Promise<InvitationCode[]> {
    const codes: InvitationCode[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 0; i < count; i++) {
      const code = this.generateCode();
      try {
        const result = await this.db.prepare(
          'INSERT INTO invitation_code (code, create_time, update_time, status, email) VALUES (?, ?, ?, 0, "")'
        ).bind(code, now, now).run();

        if (result.success) {
          codes.push({
            code,
            createTime: now,
            updateTime: now,
            status: 0,
            email: ''
          });
        }
      } catch (error) {
        console.error('Failed to create invitation code:', error);
      }
    }

    return codes;
  }

  async verifyCode(code: string): Promise<InvitationCode | null> {
    const result = await this.db.prepare(
      'SELECT * FROM invitation_code WHERE code = ? LIMIT 1'
    ).bind(code).first<InvitationCode>();

    if (!result) return null;

    return {
      id: result.id,
      code: result.code,
      createTime: result.create_time,
      updateTime: result.update_time,
      status: result.status,
      email: result.email
    };
  }

  async useCode(code: string, email: string): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db.prepare(
      'UPDATE invitation_code SET status = 1, email = ?, update_time = ? WHERE code = ? AND status = 0'
    ).bind(email, now, code).run();

    return result.success && result.changes > 0;
  }

  async listCodes(status?: number): Promise<InvitationCode[]> {
    let query = 'SELECT * FROM invitation_code';
    const params: any[] = [];

    if (typeof status !== 'undefined') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY create_time DESC';

    const result = await this.db.prepare(query).bind(...params).all<InvitationCode>();
    return result.results?.map(code => ({
      id: code.id,
      code: code.code,
      createTime: code.create_time,
      updateTime: code.update_time,
      status: code.status,
      email: code.email
    })) || [];
  }

  async deleteCode(id: number): Promise<boolean> {
    const result = await this.db.prepare(
      'DELETE FROM invitation_code WHERE id = ?'
    ).bind(id).run();

    return result.success && result.changes > 0;
  }
}