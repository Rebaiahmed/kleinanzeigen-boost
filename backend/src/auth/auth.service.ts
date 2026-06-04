import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly encryptionKey: Buffer;
  
  constructor(
    private readonly jwtService: JwtService,
    private readonly firebaseService: FirebaseService,
    private readonly automationService: AutomationService
  ) {
    // Derive 32-byte key from internal secret
    const secret = process.env.INTERNAL_SECRET || 'dev_secret_key';
    this.encryptionKey = crypto.createHash('sha256').update(secret).digest();
  }

  private encryptData(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decryptData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format');
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  async generateHandshakeToken(cookies: any[]): Promise<string> {
    const token = crypto.randomUUID();
    const encryptedCookies = this.encryptData(JSON.stringify(cookies));
    
    // Attempt to extract stable ID from cookies if possible
    let stableUserId = null;
    try {
      const uIdCookie = cookies.find((c: any) => c.name === 'kb_user_id' || c.name === 'user_id');
      if (uIdCookie) stableUserId = uIdCookie.value;
    } catch(e) {}
    
    await this.firebaseService.firestore.collection('handshakes').doc(token).set({
      encryptedCookies,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 60000, // 60 seconds
      stableUserId: stableUserId || crypto.randomUUID()
    });

    return token;
  }

  async exchangeHandshakeToken(token: string) {
    const docRef = this.firebaseService.firestore.collection('handshakes').doc(token);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new UnauthorizedException('Invalid or expired handshake token');
    }
    
    const data = doc.data()!;
    // Immediately delete the token to prevent replay attacks
    await docRef.delete();

    if (Date.now() > data.expiresAt) {
      throw new UnauthorizedException('Handshake token expired');
    }

    const decryptedJson = this.decryptData(data.encryptedCookies);
    const cookies = JSON.parse(decryptedJson);
    
    const userId = data.stableUserId;
    const jwtToken = this.jwtService.sign({ sub: userId, type: 'marketplace_session' });

    // Store permanent session
    await this.firebaseService.firestore.collection('sessions').doc(userId).set({
      token: jwtToken,
      status: 'active',
      lastLogin: new Date().toISOString(),
      marketplaceCookies: cookies
    }, { merge: true });

    return { accessToken: jwtToken, userId };
  }

  async login(email: string, passwordHash: string) {
    try {
      // Live Verification via Playwright Worker
      const workerResponse = await this.automationService.callAutomationWorker('login', { 
        email, 
        password: passwordHash 
      });

      if (workerResponse.requires_2fa) {
        return { requires_2fa: true, sessionId: workerResponse.sessionId };
      }

      if (!workerResponse.success) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate JWT for the frontend session
      // Using email as sub id since we don't have a structured user id yet
      const userId = Buffer.from(email).toString('base64');
      const payload = { email, sub: userId };
      const token = this.jwtService.sign(payload);
      
      try {
        // Save session info and the extracted Playwright cookies to Firestore
        await this.firebaseService.firestore.collection('sessions').doc(userId).set({
          token,
          status: 'active',
          lastLogin: new Date().toISOString(),
          marketplaceCookies: workerResponse.cookies || []
        }, { merge: true });
      } catch (e: any) {
        console.warn('Could not save session to Firestore (Check Firebase Credentials):', e.message);
      }

      return { accessToken: token };
    } catch (error: any) {
      if (error.response?.status === 401 || error.message.includes('401')) {
        throw new UnauthorizedException('Invalid credentials or CAPTCHA blocked the login');
      }
      throw error;
    }
  }

  async submit2FA(email: string, sessionId: string, code: string) {
    try {
      const workerResponse = await this.automationService.callAutomationWorker('login/2fa', { sessionId, code });
      if (!workerResponse.success) {
        throw new UnauthorizedException('Invalid 2FA code');
      }

      const userId = Buffer.from(email).toString('base64');
      const token = this.jwtService.sign({ email, sub: userId });
      
      try {
        await this.firebaseService.firestore.collection('sessions').doc(userId).set({
          token,
          status: 'active',
          lastLogin: new Date().toISOString(),
          marketplaceCookies: workerResponse.cookies || []
        }, { merge: true });
      } catch (e: any) {
        console.warn('Could not save 2FA session to Firestore:', e.message);
      }

      return { accessToken: token };
    } catch (error: any) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
  }

  async loginWithCookie(email: string, cookieJson: string) {
    try {
      const cookies = JSON.parse(cookieJson);
      if (!Array.isArray(cookies)) {
        throw new Error('Cookies must be a JSON array');
      }

      const userId = Buffer.from(email).toString('base64');
      const token = this.jwtService.sign({ email, sub: userId });
      
      await this.firebaseService.firestore.collection('sessions').doc(userId).set({
        token,
        status: 'active',
        lastLogin: new Date().toISOString(),
        marketplaceCookies: cookies
      }, { merge: true });

      return { accessToken: token };
    } catch (error: any) {
      throw new UnauthorizedException('Invalid cookie format: ' + error.message);
    }
  }

  async getStatus(userId: string) {
    const doc = await this.firebaseService.firestore.collection('sessions').doc(userId).get();
    if (doc.exists && doc.data()?.status === 'active') {
      return { status: 'active' };
    }
    return { status: 'expired' };
  }
}
