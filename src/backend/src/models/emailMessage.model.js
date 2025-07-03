// 这个文件将通过index.js自动加载，不需要直接引用sequelize实例
module.exports = (sequelize, DataTypes) => {

  /**
   * 邮件消息模型
   * 用于存储会话中的每条邮件消息
   */
  const EmailMessage = sequelize.define('EmailMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // 关联会话ID
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: '所属会话ID'
    },

    // 关联SubTask ID（如果是系统发送的邮件）
    subtask_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '关联的SubTask ID'
    },

    // 消息方向
    direction: {
      type: DataTypes.ENUM('outbound', 'inbound'),
      allowNull: false,
      comment: '消息方向：outbound-发出，inbound-收到'
    },

    // 邮件基本信息
    message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '邮件Message-ID'
    },

    in_reply_to: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '回复的邮件Message-ID'
    },

    references: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '邮件引用链'
    },

    // 发件人信息
    from_email: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '发件人邮箱'
    },

    from_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '发件人姓名'
    },

    // 收件人信息
    to_email: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: '收件人邮箱'
    },

    to_name: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '收件人姓名'
    },

    // 邮件内容
    subject: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: '邮件主题'
    },

    content_text: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '纯文本内容'
    },

    content_html: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'HTML内容'
    },

    // 邮件状态
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'read'),
      defaultValue: 'pending',
      comment: '消息状态'
    },

    // 时间戳
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '发送时间'
    },

    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '送达时间'
    },

    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '阅读时间'
    },

    // EngageLab相关信息
    engagelab_email_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'EngageLab邮件ID'
    },

    engagelab_message_id: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'EngageLab消息ID'
    },

    // 错误信息
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '错误信息'
    },

    // 附件信息
    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: '附件列表'
    },

    // 扩展数据
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: '扩展元数据'
    }
  }, {
    tableName: 'email_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['conversation_id']
      },
      {
        fields: ['subtask_id']
      },
      {
        fields: ['direction']
      },
      {
        fields: ['message_id']
      },
      {
        fields: ['from_email']
      },
      {
        fields: ['to_email']
      },
      {
        fields: ['status']
      },
      {
        fields: ['sent_at']
      },
      {
        fields: ['engagelab_email_id']
      }
    ]
  });

  return EmailMessage;
}; 