import { EventEmitter } from 'events';

export interface WebSocketMessage {
  type: 'new_message' | 'message_read' | 'conversation_updated' | 'notification' | 'error';
  data: any;
  timestamp: string;
}

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  conversation_id?: string;
  message_id?: string;
  auto_dismiss?: boolean;
  dismiss_after?: number; // 毫秒
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // 1秒
  private isConnecting = false;
  private isManualClose = false;
  private token: string | null = null;

  constructor() {
    super();
    this.setMaxListeners(50); // 增加最大监听器数量
  }

  /**
   * 连接WebSocket
   */
  connect(token: string) {
    // 暂时禁用WebSocket连接，避免生产环境错误
    console.log('WebSocket服务暂时禁用，跳过连接');
    return;
  }

  /**
   * 断开连接
   */
  disconnect() {
    // WebSocket已禁用，无需断开
    console.log('WebSocket服务已禁用，无需断开');
  }

  /**
   * 发送消息
   */
  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'closed';
    }
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return false; // WebSocket已禁用，始终返回false
  }

  private handleOpen() {
    console.log('WebSocket连接已建立');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.emit('connected');
  }

  private handleMessage(event: MessageEvent) {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log('收到WebSocket消息:', message);

      // 触发对应的事件
      this.emit('message', message);
      this.emit(message.type, message.data);

      // 处理特定类型的消息
      switch (message.type) {
        case 'new_message':
          this.handleNewMessage(message.data);
          break;
        case 'message_read':
          this.handleMessageRead(message.data);
          break;
        case 'conversation_updated':
          this.handleConversationUpdated(message.data);
          break;
        case 'notification':
          this.handleNotification(message.data);
          break;
        case 'error':
          this.handleServerError(message.data);
          break;
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error);
    }
  }

  private handleClose(event: CloseEvent) {
    console.log('WebSocket连接已关闭:', event.code, event.reason);
    this.isConnecting = false;
    this.ws = null;
    this.emit('disconnected', { code: event.code, reason: event.reason });

    // 如果不是手动关闭，尝试重连
    if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event) {
    console.error('WebSocket错误:', error);
    this.isConnecting = false;
    // 确保error对象不为undefined
    const errorData = error || new Error('WebSocket连接错误');
    this.emit('error', errorData);
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1); // 指数退避
    
    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连...`);
    
    setTimeout(() => {
      if (!this.isManualClose && this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private handleNewMessage(data: any) {
    console.log('收到新消息:', data);
    
    // 显示桌面通知（如果用户允许）
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`新邮件 - ${data.subject}`, {
        body: `来自: ${data.from_email}`,
        icon: '/favicon.ico',
        tag: `message-${data.id}`,
      });
    }
  }

  private handleMessageRead(data: any) {
    console.log('消息已读:', data);
  }

  private handleConversationUpdated(data: any) {
    console.log('会话已更新:', data);
  }

  private handleNotification(data: NotificationData) {
    console.log('收到通知:', data);
    
    // 如果设置了自动消失，则设置定时器
    if (data.auto_dismiss && data.dismiss_after) {
      setTimeout(() => {
        this.emit('notification_dismiss', data.id);
      }, data.dismiss_after);
    }
  }

  private handleServerError(data: any) {
    console.error('服务器错误:', data);
  }

  /**
   * 请求桌面通知权限
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('此浏览器不支持桌面通知');
      return 'denied';
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission;
    }

    return Notification.permission;
  }

  /**
   * 订阅特定会话的更新
   */
  subscribeToConversation(conversationId: string) {
    this.send({
      type: 'subscribe',
      data: {
        conversation_id: conversationId
      }
    });
  }

  /**
   * 取消订阅特定会话的更新
   */
  unsubscribeFromConversation(conversationId: string) {
    this.send({
      type: 'unsubscribe',
      data: {
        conversation_id: conversationId
      }
    });
  }

  /**
   * 发送心跳包
   */
  sendHeartbeat() {
    this.send({
      type: 'ping',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat(interval: number = 30000) {
    setInterval(() => {
      if (this.isConnected()) {
        this.sendHeartbeat();
      }
    }, interval);
  }
}

export default new WebSocketService(); 