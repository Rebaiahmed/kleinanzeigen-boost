import { Injectable, UnauthorizedException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FirebaseService } from '../firebase/firebase.service';
import { AutomationService } from '../automation/automation.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
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

  /**
   * Derives a stable, case-normalised userId from an email address.
   * Uses SHA-256 so it is one-way and consistent across case variants.
   */
  private deriveUserId(email: string): string {
    return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
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

    let stableUserId: string | null = null;
    let username: string | null = null;
    try {
      // 'up' = user profile cookie — stable Kleinanzeigen user identifier
      // 'access_token' can also be decoded to get user info
      const upCookie = cookies.find((c: any) => c.name === 'up');
      if (upCookie) {
        try {
          // Try URL-encoded JSON first (Kleinanzeigen encodes the 'up' cookie this way)
          const decoded = JSON.parse(decodeURIComponent(upCookie.value));
          stableUserId = decoded.userId || decoded.id || decoded.sub || decoded.uid || null;
          username = decoded.username || decoded.displayName || decoded.name || decoded.nickName || null;
          this.logger.log(`Extracted from 'up' cookie (url-encoded) — userId: ${stableUserId}, username: ${username}`);
          this.logger.log(`'up' cookie keys: ${Object.keys(decoded).join(', ')}`);
        } catch {
          try {
            // Fallback: try base64 JSON
            const decoded = JSON.parse(Buffer.from(upCookie.value, 'base64').toString('utf8'));
            stableUserId = decoded.userId || decoded.id || decoded.sub || null;
            username = decoded.username || decoded.displayName || decoded.name || null;
            this.logger.log(`Extracted from 'up' cookie (base64) — userId: ${stableUserId}, username: ${username}`);
          } catch {
            // Raw value as stable ID
            stableUserId = upCookie.value;
          }
        }
        if (!stableUserId) stableUserId = upCookie.value;
      }

      // Fallback: try common userId cookie names
      if (!stableUserId) {
        const userIdCookie = cookies.find((c: any) =>
          ['user.id', 'aid', 'kb_user_id', 'user_id', 'userId'].includes(c.name)
        );
        if (userIdCookie) stableUserId = userIdCookie.value;
      }

      // Username fallback
      if (!username) {
        const usernameCookie = cookies.find((c: any) =>
          ['user.username', 'username', 'ka_username'].includes(c.name)
        );
        if (usernameCookie) username = decodeURIComponent(usernameCookie.value);
      }

      // Log available cookie names for debugging
      this.logger.log(`Cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);
    } catch (e: any) {
      this.logger.warn(`Could not extract user info from cookies: ${e.message}`);
    }

    await this.firebaseService.firestore.collection('handshakes').doc(token).set({
      encryptedCookies,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 1800000,
      stableUserId: stableUserId || crypto.randomUUID(),
      username: username || null,
      used: false,
    });

    return token;
  }

  async exchangeHandshakeToken(token: string) {
    const db = this.firebaseService.firestore;
    const docRef = db.collection('handshakes').doc(token);

    // Atomically claim the token inside a Firestore transaction.
    // This prevents a race condition where two concurrent requests both
    // pass the `used === false` check before either writes `used = true`.
    let data: FirebaseFirestore.DocumentData;
    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);

        if (!doc.exists) {
          throw new HttpException(
            { message: 'Handshake abgelaufen — bitte erneut verbinden' },
            HttpStatus.UNAUTHORIZED,
          );
        }

        const d = doc.data()!;

        if (d.used === true) {
          throw new HttpException(
            { message: 'Handshake bereits verwendet' },
            HttpStatus.UNAUTHORIZED,
          );
        }

        if (Date.now() > d.expiresAt) {
          t.delete(docRef);
          throw new HttpException(
            { message: 'Handshake abgelaufen — bitte erneut verbinden' },
            HttpStatus.UNAUTHORIZED,
          );
        }

        // Atomically mark as used within the same transaction
        t.update(docRef, { used: true });
        data = d;
      });
    } catch (err: any) {
      // Re-throw HttpExceptions from inside the transaction directly
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { message: 'Handshake konnte nicht verarbeitet werden' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Delete the document now that the transaction succeeded
    await docRef.delete().catch(() => {});

    const decryptedJson = this.decryptData(data!.encryptedCookies);
    const cookies = JSON.parse(decryptedJson);

    const userId = data!.stableUserId;
    const username = data!.username || null;
    const jwtToken = this.jwtService.sign({
      sub: userId,
      type: 'marketplace_session',
      ...(username && { username }),
    });

    // Store permanent session — cookies encrypted at rest
    await db.collection('sessions').doc(userId).set({
      status: 'active',
      lastLogin: new Date().toISOString(),
      marketplaceCookies: this.encryptData(JSON.stringify(cookies)),
    }, { merge: true });

    return { accessToken: jwtToken, userId };
  }

  async login(email: string, passwordHash: string) {
    try {
      // Live Verification via Playwright Worker
      const generatedUserId = this.deriveUserId(email);
      const workerResponse = await this.automationService.callAutomationWorker('login', { 
        userId: generatedUserId,
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
      const userId = generatedUserId;
      const payload = { email, sub: userId };
      const token = this.jwtService.sign(payload);
      
      try {
        // Save session info and the extracted Playwright cookies to Firestore (cookies encrypted at rest)
        await this.firebaseService.firestore.collection('sessions').doc(userId).set({
          status: 'active',
          lastLogin: new Date().toISOString(),
          marketplaceCookies: this.encryptData(JSON.stringify(workerResponse.cookies || [])),
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

      const userId = this.deriveUserId(email);
      const token = this.jwtService.sign({ email, sub: userId });
      
      try {
        await this.firebaseService.firestore.collection('sessions').doc(userId).set({
          status: 'active',
          lastLogin: new Date().toISOString(),
          marketplaceCookies: this.encryptData(JSON.stringify(workerResponse.cookies || [])),
        }, { merge: true });
      } catch (e: any) {
        console.warn('Could not save 2FA session to Firestore:', e.message);
      }

      return { accessToken: token };
    } catch (error: any) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
  }

  async loginWithCookie(email: string, cookies: any[] | string) {
    try {
      // Accept either a pre-parsed array (new) or a legacy JSON string (old extension)
      const parsedCookies: any[] = Array.isArray(cookies) ? cookies : JSON.parse(cookies as string);
      if (!Array.isArray(parsedCookies)) {
        throw new Error('Cookies must be a JSON array');
      }

      const userId = this.deriveUserId(email);
      const token = this.jwtService.sign({ email, sub: userId });
      
      await this.firebaseService.firestore.collection('sessions').doc(userId).set({
        status: 'active',
        lastLogin: new Date().toISOString(),
        marketplaceCookies: this.encryptData(JSON.stringify(parsedCookies)),
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

  /**
   * Starts a visible browser login job on the automation worker.
   * Awaits the 202 handshake from the worker (5s timeout) so we can fail fast
   * if the worker is not available, rather than returning a jobId that instantly fails.
   */
  async initiateVisibleLogin(email: string): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID();

    // Create job record in Firestore
    await this.firebaseService.firestore.collection('loginJobs').doc(jobId).set({
      jobId,
      email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Await the worker's 202 acceptance (short timeout — the worker should respond
    // immediately with { accepted: true } and then run the browser in background)
    try {
      await this.automationService.callAutomationWorkerFast('login/visible', { jobId, email });
    } catch (err: any) {
      // Clean up the Firestore job so we don't leave orphaned docs
      await this.firebaseService.firestore
        .collection('loginJobs')
        .doc(jobId)
        .delete()
        .catch(() => {});

      const isUnavailable =
        err.message?.includes('404') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('timeout');

      throw new HttpException(
        {
          message: isUnavailable
            ? 'Der Browser-Login-Service ist nicht verfügbar. Bitte nutze den Cookie Bypass-Tab.'
            : `Login-Dienst Fehler: ${err.message}`,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { jobId };
  }

  /**
   * Polls the automation worker for the job status and, on success,
   * converts the cookies into a JWT session.
   */
  async getLoginJobStatus(jobId: string): Promise<{
    status: 'pending' | 'waiting-for-user' | 'success' | 'failed';
    accessToken?: string;
    error?: string;
  }> {
    // Forward the status poll to the automation worker
    let workerJob: any;
    try {
      workerJob = await this.automationService.getFromAutomationWorker(`login/visible/${jobId}`);
    } catch (err: any) {
      // Fallback: read from Firestore job doc
      const jobDoc = await this.firebaseService.firestore.collection('loginJobs').doc(jobId).get();
      if (!jobDoc.exists) {
        throw new HttpException({ message: 'Job nicht gefunden' }, HttpStatus.NOT_FOUND);
      }
      workerJob = jobDoc.data();
    }

    if (workerJob.status === 'success' && workerJob.cookies) {
      // Finalise: build JWT, persist session
      const jobDoc = await this.firebaseService.firestore.collection('loginJobs').doc(jobId).get();
      const email = jobDoc.data()?.email || 'unknown';
      const userId = this.deriveUserId(email);
      const token = this.jwtService.sign({ email, sub: userId });

      await this.firebaseService.firestore.collection('sessions').doc(userId).set({
        status: 'active',
        lastLogin: new Date().toISOString(),
        marketplaceCookies: this.encryptData(JSON.stringify(workerJob.cookies)),
      }, { merge: true });

      // Clean up the job doc
      await this.firebaseService.firestore.collection('loginJobs').doc(jobId).delete().catch(() => {});

      return { status: 'success', accessToken: token };
    }

    return {
      status: workerJob.status,
      // Sanitize raw axios/network errors so they don't leak to the user
      error: sanitizeWorkerError(workerJob.error),
    };
  }

  async logout(userId: string) {
    try {
      if (!userId) return;
      await this.firebaseService.firestore.collection('sessions').doc(userId).update({
        status: 'expired'
      });
    } catch (e) {
      // Ignored: session might not exist or already be deleted
    }
  }
}

function sanitizeWorkerError(raw?: string): string | undefined {
  if (!raw) return undefined;
  if (
    raw.includes('404') ||
    raw.includes('ECONNREFUSED') ||
    raw.includes('ECONNRESET') ||
    raw.includes('status code')
  ) {
    return 'Der Browser-Login-Service ist nicht verfügbar. Bitte nutze den Cookie Bypass-Tab.';
  }
  return raw;
}
