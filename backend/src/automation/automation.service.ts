import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private readonly workerUrl = process.env.AUTOMATION_WORKER_URL || 'http://localhost:3001';
  private readonly internalSecret = process.env.INTERNAL_SECRET || 'dev_secret_key';

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
      this.logger.error(`Automation worker call failed: ${error.message}`);
      // Pass through specific worker errors like SESSION_EXPIRED
      if (error.response?.data?.error === 'SESSION_EXPIRED') {
        throw new Error('SESSION_EXPIRED');
      }
      throw new InternalServerErrorException(error.message);
    }
  }
}
