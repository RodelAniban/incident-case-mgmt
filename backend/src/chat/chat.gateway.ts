import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CasesService, RequestUser } from '../cases/cases.service';
import { Permission, roleHasPermission } from '../common/permissions';
import { ChatMessage } from '../entities';

interface JoinPayload {
  caseId: number;
  token: string;
}

/**
 * Real-time push for chat messages. Persistence and permission checks happen
 * in ChatService/ChatController via the normal REST path; this gateway's only
 * job is delivering already-authorized messages to already-authorized sockets.
 * A socket only receives a case's messages after `join` verifies the same
 * CHAT_ON_CASE permission + case-team scope the REST endpoints enforce — a
 * raw WebSocket connection carries no session by itself.
 */
@WebSocketGateway({ cors: { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' } })
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly casesService: CasesService,
  ) {}

  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: JoinPayload) {
    try {
      const payload = this.jwtService.verify<{ sub: number; email: string; role: string; teamId: number | null }>(
        data.token,
      );
      const actor: RequestUser = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role as RequestUser['role'],
        teamId: payload.teamId,
      };
      if (!roleHasPermission(actor.role, Permission.CHAT_ON_CASE)) {
        throw new Error('Role cannot access case chat');
      }
      await this.casesService.findOneScoped(data.caseId, actor);

      await client.join(`case:${data.caseId}`);
      client.emit('joined', { caseId: data.caseId });
    } catch (err) {
      this.logger.warn(`Rejected chat join for case ${data?.caseId}: ${err instanceof Error ? err.message : err}`);
      client.emit('join-error', { message: 'Unable to join this case chat.' });
    }
  }

  broadcastMessage(caseId: number, message: ChatMessage) {
    this.server.to(`case:${caseId}`).emit('message', message);
  }
}
