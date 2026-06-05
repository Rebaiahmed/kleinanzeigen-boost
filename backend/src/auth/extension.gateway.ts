import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as url from 'url';

@WebSocketGateway({
  path: '/ws/extension',
})
@Injectable()
export class ExtensionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ExtensionGateway.name);
  
  @WebSocketServer()
  server!: Server;

  // Maps userId to active WebSocket connection
  private clients = new Map<string, WebSocket>();

  // Store active command promises
  private pendingCommands = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: WebSocket, request: any) {
    try {
      const parsedUrl = url.parse(request.url || '', true);
      const token = parsedUrl.query.token as string;
      if (!token) {
        this.logger.warn('Connection rejected: No token provided.');
        client.close(1008, 'Authentication token required');
        return;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub;

      if (!userId) {
        this.logger.warn('Connection rejected: Invalid token payload.');
        client.close(1008, 'Invalid token payload');
        return;
      }

      this.clients.set(userId, client);
      this.logger.log(`Chrome Extension connected for user: ${userId}`);

      client.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          if (message.type === 'COMMAND_RESPONSE' && message.commandId) {
            const pending = this.pendingCommands.get(message.commandId);
            if (pending) {
              this.pendingCommands.delete(message.commandId);
              if (message.success) {
                pending.resolve(message.payload);
              } else {
                pending.reject(new Error(message.error || 'Command failed'));
              }
            }
          }
        } catch (e: any) {
          this.logger.warn(`Failed to parse WebSocket message: ${e.message}`);
        }
      });
    } catch (err: any) {
      this.logger.warn(`Connection authentication failed: ${err.message}`);
      client.close(1008, 'Authentication failed');
    }
  }

  handleDisconnect(client: WebSocket) {
    for (const [userId, conn] of this.clients.entries()) {
      if (conn === client) {
        this.clients.delete(userId);
        this.logger.log(`Chrome Extension disconnected for user: ${userId}`);
        break;
      }
    }
  }

  /**
   * Sends a command to the user's Chrome Extension and awaits the result.
   */
  async sendCommand(userId: string, action: string, payload: any = {}): Promise<any> {
    const client = this.clients.get(userId);
    if (!client || client.readyState !== WebSocket.OPEN) {
      throw new Error(`Chrome Extension for user ${userId} is not connected.`);
    }

    const commandId = Math.random().toString(36).substring(2, 15);
    
    return new Promise((resolve, reject) => {
      this.pendingCommands.set(commandId, { resolve, reject });

      // Set command timeout (3 minutes)
      setTimeout(() => {
        if (this.pendingCommands.has(commandId)) {
          this.pendingCommands.delete(commandId);
          reject(new Error('Extension command timed out.'));
        }
      }, 180000);

      client.send(JSON.stringify({
        commandId,
        action,
        payload
      }));
    });
  }

  isUserConnected(userId: string): boolean {
    const client = this.clients.get(userId);
    return !!client && client.readyState === WebSocket.OPEN;
  }
}
