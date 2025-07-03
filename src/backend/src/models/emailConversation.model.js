// 这个文件将通过index.js自动加载，不需要直接引用sequelize实例
module.exports = (sequelize, DataTypes) => {

  /**
   * 邮件会话模型
   * 用于管理邮件往来的对话
   */
  const EmailConversation = sequelize.define('EmailConversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // 会话标识符（基于发件人和收件人邮箱生成）
    conversation_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: '会话唯一标识，格式：sender_email:recipient_email'
    },

    // 关联用户ID
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '会话所属用户ID'
    },

    // 发件人信息
    sender_email: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '发件人邮箱地址'
    },

    sender_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '发件人姓名'
    },

    // 收件人信息
    recipient_email: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '收件人邮箱地址'
    },

    recipient_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '收件人姓名'
    },

    // 会话主题
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '邮件主题'
    },

    // 会话状态
    status: {
      type: DataTypes.ENUM('active', 'closed', 'archived'),
      defaultValue: 'active',
      comment: '会话状态：active-活跃，closed-已关闭，archived-已归档'
    },

    // 最后消息时间
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后一条消息的时间'
    },

    // 消息统计
    message_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '消息总数'
    },

    unread_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: '未读消息数'
    },

    // 关联的发信服务信息
    email_service_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '使用的发信服务ID'
    },

    api_user: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'EngageLab API_USER'
    },

    // 扩展数据
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: '扩展元数据'
    }
  }, {
    tableName: 'email_conversations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['conversation_key']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['sender_email']
      },
      {
        fields: ['recipient_email']
      },
      {
        fields: ['status']
      },
      {
        fields: ['last_message_at']
      }
    ]
  });

  return EmailConversation;
}; 