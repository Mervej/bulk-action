import { 
  WebSocketGateway, 
  WebSocketServer, 
  OnGatewayConnection, 
  OnGatewayDisconnect,
  SubscribeMessage 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BulkAction } from '../schemas/bulk-action.schema';

@WebSocketGateway({ cors: true })
export class BulkActionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  
  private clients: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Clean up subscriptions
    this.clients.forEach((clientIds, actionId) => {
      if (clientIds.has(client.id)) {
        clientIds.delete(client.id);
        if (clientIds.size === 0) {
          this.clients.delete(actionId);
        }
      }
    });
  }

  @SubscribeMessage('subscribe')
  handleSubscription(client: Socket, actionId: string): void {
    this.subscribeToAction(client.id, actionId);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscription(client: Socket, actionId: string): void {
    this.unsubscribeFromAction(client.id, actionId);
  }

  subscribeToAction(clientId: string, actionId: string) {
    if (!this.clients.has(actionId)) {
      this.clients.set(actionId, new Set());
    }
    this.clients.get(actionId).add(clientId);
  }

  unsubscribeFromAction(clientId: string, actionId: string) {
    if (this.clients.has(actionId)) {
      const clients = this.clients.get(actionId);
      clients.delete(clientId);
      if (clients.size === 0) {
        this.clients.delete(actionId);
      }
    }
  }

  broadcastActionUpdate(action: BulkAction) {
    const actionId = action._id.toString();
    if (this.clients.has(actionId)) {
      const clientIds = Array.from(this.clients.get(actionId));
      
      // Debug logging
      console.log(`Broadcasting update for action ${actionId} to ${clientIds.length} clients`);
      
      clientIds.forEach(clientId => {
        this.server.to(clientId).emit('actionUpdate', {
          id: actionId,
          status: action.status,
          stats: action.stats
        });
      });
    }
  }
}
