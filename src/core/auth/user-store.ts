import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { User, SafeUser, AuthSession } from '../types';
import { getDefaultStorageDir } from '../memory/storage-dir';
import { AtomicFileWriter } from '../memory/atomic-file-writer';

/**
 * User & Authentication Store
 * Provides secure multi-user distinction with salted PBKDF2 password hashing,
 * token-based sessions, and pre-seeded benchmark test accounts.
 */
export class UserStore {
  private usersFile: string;
  private tokensFile: string;
  private users: User[] = [];
  private tokens: AuthSession[] = [];
  private isLoaded = false;

  constructor(storageDir: string = getDefaultStorageDir()) {
    this.usersFile = path.join(storageDir, 'users.json');
    this.tokensFile = path.join(storageDir, 'tokens.json');
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, combined: string): boolean {
    const [salt, hash] = combined.split(':');
    if (!salt || !hash) return false;
    const testHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return testHash === hash;
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  public async init(): Promise<void> {
    if (this.isLoaded) return;
    const dir = path.dirname(this.usersFile);
    await fs.mkdir(dir, { recursive: true });

    // Load users
    try {
      const raw = await fs.readFile(this.usersFile, 'utf-8');
      this.users = JSON.parse(raw);
    } catch {
      this.users = [];
    }

    // Load tokens
    try {
      const rawTokens = await fs.readFile(this.tokensFile, 'utf-8');
      this.tokens = JSON.parse(rawTokens);
    } catch {
      this.tokens = [];
    }

    // If no users exist, seed default accounts
    if (this.users.length === 0) {
      await this.seedDefaultUsers();
    }

    this.isLoaded = true;
  }

  private async persistUsers(): Promise<void> {
    await AtomicFileWriter.write(this.usersFile, this.users);
  }

  private async persistTokens(): Promise<void> {
    await AtomicFileWriter.write(this.tokensFile, this.tokens);
  }

  private async seedDefaultUsers(): Promise<void> {
    const defaults: Array<{ id: string; username: string; password: string; name: string; role: string }> = [
      {
        id: 'usr_demo',
        username: 'demo',
        password: 'password123',
        name: 'Demo Evaluator',
        role: 'reviewer',
      },
      {
        id: 'usr_alice',
        username: 'alice',
        password: 'password123',
        name: 'Alice Chen',
        role: 'product_lead',
      },
      {
        id: 'usr_bob',
        username: 'bob',
        password: 'password123',
        name: 'Bob Martinez',
        role: 'data_engineer',
      },
      {
        id: 'default_user',
        username: 'default_user',
        password: 'password123',
        name: 'Default User',
        role: 'standard',
      },
    ];

    const nowIso = new Date().toISOString();
    for (const d of defaults) {
      this.users.push({
        id: d.id,
        username: d.username,
        passwordHash: this.hashPassword(d.password),
        name: d.name,
        role: d.role,
        createdAt: nowIso,
      });
    }

    await this.persistUsers();
  }

  public async register(username: string, password: string, name?: string): Promise<{ user: SafeUser; token: string }> {
    await this.init();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length < 2) {
      throw new Error('Username must be at least 2 characters long');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    const existing = this.users.find((u) => u.username.toLowerCase() === cleanUsername);
    if (existing) {
      throw new Error(`Username "${cleanUsername}" is already taken`);
    }

    const id = `usr_${cleanUsername}_${Date.now().toString(36)}`;
    const newUser: User = {
      id,
      username: cleanUsername,
      passwordHash: this.hashPassword(password),
      name: name?.trim() || cleanUsername,
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    await this.persistUsers();

    const token = await this.createToken(newUser.id);
    return {
      user: this.toSafeUser(newUser),
      token,
    };
  }

  public async login(username: string, password: string): Promise<{ user: SafeUser; token: string }> {
    await this.init();
    const cleanUsername = username.trim().toLowerCase();
    const user = this.users.find((u) => u.username.toLowerCase() === cleanUsername);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const valid = this.verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid username or password');
    }

    const token = await this.createToken(user.id);
    return {
      user: this.toSafeUser(user),
      token,
    };
  }

  public async createToken(userId: string): Promise<string> {
    await this.init();
    const token = `tok_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    this.tokens.push({
      token,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    await this.persistTokens();
    return token;
  }

  public async verifyToken(token: string): Promise<SafeUser | null> {
    await this.init();
    if (!token) return null;

    const session = this.tokens.find((t) => t.token === token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      // Expired
      this.tokens = this.tokens.filter((t) => t.token !== token);
      await this.persistTokens();
      return null;
    }

    const user = this.users.find((u) => u.id === session.userId);
    return user ? this.toSafeUser(user) : null;
  }

  public async revokeToken(token: string): Promise<void> {
    await this.init();
    this.tokens = this.tokens.filter((t) => t.token !== token);
    await this.persistTokens();
  }

  public async getUserById(userId: string): Promise<SafeUser | null> {
    await this.init();
    const user = this.users.find((u) => u.id === userId || u.username === userId);
    return user ? this.toSafeUser(user) : null;
  }

  public async listDemoUsers(): Promise<SafeUser[]> {
    await this.init();
    return this.users.map((u) => this.toSafeUser(u));
  }
}

export const userStore = new UserStore();
