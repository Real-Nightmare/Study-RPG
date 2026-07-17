import { Logger, UseGuards, UseFilters } from '@nestjs/common';
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';

@WebSocketGateway({ namespace: 'teach-back', cors: { origin: process.env.CORS_ORIGIN?.split(',') || ['*'], credentials: true } })
@UseGuards(WsAuthGuard)
@UseFilters(WsExceptionFilter)
export class TeachBackGateway {
  private readonly logger = new Logger(TeachBackGateway.name);

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`teach-back:${data.sessionId}`);
    return { event: 'subscribed', data: { sessionId: data.sessionId } };
  }

  notifyEvaluationComplete(sessionId: string, evaluation: unknown) {
    this.server.to(`teach-back:${sessionId}`).emit('evaluation:complete', evaluation);
  }
}
