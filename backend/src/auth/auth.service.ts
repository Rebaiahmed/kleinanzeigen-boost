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
    // Short, non-sensitive fingerprint of the key (a hash of the key, not the key)
    // — used to detect when cookies were encrypted with a DIFFERENT key/backend.
    this.keyId = crypto.createHash('sha256').update(this.encryptionKey).digest('hex').slice(0, 8);
    this.logger.log(`[handshake] auth encryption keyId=${this.keyId} (INTERNAL_SECRET ${process.env.INTERNAL_SECRET ? 'set' : 'DEFAULT dev key'})`);
  }

  private readonly keyId: string;

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
      // 1. zpstorage identity cookie — contains {"email":"..."}
      const identityCookie = cookies.find((c: any) => c.name.includes('identity'));
      if (identityCookie) {
        try {
          const decoded = JSON.parse(Buffer.from(identityCookie.value, 'base64').toString('utf8'));
          username = decoded.email || decoded.username || decoded.displayName || null;
          this.logger.log(`identity cookie keys: ${Object.keys(decoded).join(', ')} | username: ${username}`);
        } catch { /* not decodable */ }
      }

      // 2. Kleinanzeigen access_token JWT
      if (!username) {
        const atCookie = cookies.find((c: any) => c.name === 'access_token');
        if (atCookie) {
          try {
            const parts = atCookie.value.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
              username = payload.username || payload.displayName || payload.name || payload.email || null;
              stableUserId = payload.sub || stableUserId;
              this.logger.log(`access_token payload keys: ${Object.keys(payload).join(', ')} | username: ${username}`);
            }
          } catch { /* not decodable */ }
        }
      }

      // 3. Named username cookies fallback
      if (!username) {
        const usernameCookie = cookies.find((c: any) =>
          ['user.username', 'username', 'ka_username'].includes(c.name)
        );
        if (usernameCookie) username = decodeURIComponent(usernameCookie.value);
      }

      // Stable user ID fallback
      if (!stableUserId) {
        const userIdCookie = cookies.find((c: any) =>
          ['user.id', 'aid', 'kb_user_id', 'user_id', 'userId'].includes(c.name)
        );
        if (userIdCookie) stableUserId = userIdCookie.value;
      }

      // Log available cookie names for debugging
      this.logger.log(`Cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);
    } catch (e: any) {
      this.logger.warn(`Could not extract user info from cookies: ${e.message}`);
    }

    await this.firebaseService.firestore.collection('handshakes').doc(token).set({
      encryptedCookies,
      keyId: this.keyId, // which key encrypted these cookies (for mismatch detection)
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 1800000,
      stableUserId: stableUserId || crypto.randomUUID(),
      username: username || null,
      used: false,
    });
    this.logger.log(`[handshake] created token (keyId=${this.keyId})`);

    return token;
  }

  async exchangeHandshakeToken(token: string, authHeader?: string) {
    const db = this.firebaseService.firestore;
    const linkUserId = this.userIdFromAuthHeader(authHeader);
    const docRef = db.collection('handshakes').doc(token);
    this.logger.log(`[handshake] exchange-token received (token=${token?.slice(0, 8)}…, linkUser=${linkUserId ? 'yes' : 'no'})`);

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
      // Otherwise it's an unexpected (Firestore/transaction) error — log it so the
      // real cause is visible instead of a silent generic 500.
      this.logger.error(`[handshake] transaction failed: ${err?.message}`, err?.stack);
      throw new HttpException(
        { message: `Handshake konnte nicht verarbeitet werden (${err?.message || 'tx'})` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Delete the document now that the transaction succeeded
    await docRef.delete().catch(() => {});

    // Post-transaction work — wrapped so the failing step is visible in logs
    // (decrypt key mismatch, malformed cookies, Firestore write, etc.) instead
    // of a generic "interner Serverfehler".
    // Detect the most common cause of a decrypt failure: the cookies were
    // encrypted by a backend with a DIFFERENT key (e.g. extension hit a different
    // API, or INTERNAL_SECRET changed) than the one decrypting now.
    const storedKeyId = data!.keyId || '(none)';
    if (data!.keyId && data!.keyId !== this.keyId) {
      this.logger.error(`[handshake] KEY MISMATCH — cookies encrypted with keyId=${storedKeyId} but this backend uses keyId=${this.keyId}. The handshake was created by a different backend/secret.`);
      throw new HttpException(
        { message: 'Verbindung fehlgeschlagen (Schlüssel passt nicht — bitte Erweiterung neu laden und erneut verbinden).' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    let step = 'decrypt';
    try {
      const decryptedJson = this.decryptData(data!.encryptedCookies);
      step = 'json_parse';
      const cookies = JSON.parse(decryptedJson);

      const userId = data!.stableUserId;
      const username = data!.username || null;
      step = 'jwt_sign';
      const jwtToken = this.jwtService.sign({
        sub: userId,
        type: 'marketplace_session',
        ...(username && { username }),
      });

      // Store permanent session — cookies encrypted at rest
      step = 'session_write';
      const encryptedCookieBlob = this.encryptData(JSON.stringify(cookies));
      await db.collection('sessions').doc(userId).set({
        status: 'active',
        lastLogin: new Date().toISOString(),
        marketplaceCookies: encryptedCookieBlob,
      }, { merge: true });

      // Fresh cookies → clear any prior 'expired' flag so the scheduler resumes this user.
      step = 'clear_expired';
      await this.clearExpiredStatus(userId);

      // IMPORTANT: if the user is already logged in to the dashboard (e.g. via
      // email/Auth0) when they connect, their ads + reposts run under THAT id —
      // not the marketplace stableUserId. Store the cookies under that id too, so
      // repost/scrape/scheduler (which look up sessions/{ownerId}) find them.
      if (linkUserId && linkUserId !== userId) {
        step = 'link_write';
        await db.collection('sessions').doc(linkUserId).set({
          status: 'active',
          lastLogin: new Date().toISOString(),
          marketplaceCookies: encryptedCookieBlob,
        }, { merge: true });
        await this.clearExpiredStatus(linkUserId);
        this.logger.log(`[handshake] also linked marketplace cookies to authenticated user ${linkUserId}`);
      }

      return { accessToken: jwtToken, userId };
    } catch (err: any) {
      this.logger.error(`[handshake] exchange failed at step='${step}': ${err?.message}`, err?.stack);
      throw new HttpException(
        { message: `Verbindung fehlgeschlagen (${step}). Bitte erneut verbinden.` },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Extract a userId from an optional "Bearer <jwt>" header, or null if absent/invalid. */
  private userIdFromAuthHeader(authHeader?: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
      return this.jwtService.verify(authHeader.slice(7))?.sub || null;
    } catch {
      return null;
    }
  }

  /**
   * Resets a user's accountStatus after a successful (re-)login so the scheduler
   * stops skipping them. The scheduler marks users 'expired' on confirmed session
   * loss; only a fresh login should clear it.
   */
  private async clearExpiredStatus(userId: string): Promise<void> {
    try {
      await this.firebaseService.firestore
        .collection('users').doc(userId)
        .set({ accountStatus: 'active' }, { merge: true });
    } catch (e: any) {
      this.logger.warn(`Could not reset accountStatus for ${userId}: ${e.message}`);
    }
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

      await this.clearExpiredStatus(userId);
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

      await this.clearExpiredStatus(userId);
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

      await this.clearExpiredStatus(userId);
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
