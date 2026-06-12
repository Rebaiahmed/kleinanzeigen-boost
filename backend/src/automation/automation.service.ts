import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly workerUrl = process.env.AUTOMATION_WORKER_URL || 'http://localhost:3001';
  private readonly internalSecret = process.env.INTERNAL_SECRET || 'dev_secret_key';

  constructor() {
    // Session cookies are POSTed to the worker. In production that transport
    // MUST be HTTPS — unless it's a same-box loopback URL, which never leaves
    // the machine and so needs no TLS.
    const isLoopback = /^http:\/\/(127\.0\.0\.1|localhost)([:/]|$)/.test(this.workerUrl);
    if (process.env.NODE_ENV === 'production' && this.workerUrl.startsWith('http://') && !isLoopback) {
      this.logger.error(
        `SECURITY: AUTOMATION_WORKER_URL is non-HTTPS (${this.workerUrl}) in production. ` +
        `Session cookies would be sent unencrypted. Set an https:// URL.`,
      );
    }
  }

  /** Standard POST — long timeout (120s) for browser automation tasks. */
  async callAutomationWorker(endpoint: string, payload: any): Promise<any> {
    try {
      this.logger.log(`Calling automation worker: ${endpoint}`);
      const response = await axios.post(`${this.workerUrl}/${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        timeout: 120000, // Browser automation can take a while
      });

      return response.data;
    } catch (error: any) {
      // The worker returns its real reason in the response body ({ error, step }).
      // Surface that instead of axios's opaque "Request failed with status code 500".
      const workerError = error.response?.data?.error;
      const workerStep = error.response?.data?.step;
      this.logger.error(
        `Automation worker '${endpoint}' failed: ${workerError || error.message}` +
        (workerStep ? ` (step=${workerStep})` : ''),
      );
      if (workerError === 'SESSION_EXPIRED') {
        throw new Error('SESSION_EXPIRED');
      }
      throw new InternalServerErrorException(
        workerError ? `${workerError}${workerStep ? ` (step=${workerStep})` : ''}` : error.message,
      );
    }
  }

  /**
   * Short-timeout POST for endpoints that respond immediately with 202 Accepted.
   * Used for the visible login handshake so we fail fast if the worker is down.
   * Throws a plain Error (not InternalServerErrorException) so callers can
   * inspect the message without NestJS wrapping it.
   */
  async callAutomationWorkerFast(endpoint: string, payload: any): Promise<any> {
    try {
      this.logger.log(`Fast-calling automation worker: ${endpoint}`);
      const response = await axios.post(`${this.workerUrl}/${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        timeout: 5000, // Must respond within 5 seconds
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Automation worker fast call failed: ${error.message}`);
      throw new Error(error.message);
    }
  }

  /** GET request to the worker — used for job status polling. */
  async getFromAutomationWorker(endpoint: string): Promise<any> {
    try {
      this.logger.log(`GET automation worker: ${endpoint}`);
      const response = await axios.get(`${this.workerUrl}/${endpoint}`, {
        headers: {
          'X-Internal-Secret': this.internalSecret,
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Automation worker GET failed: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
  }
}
