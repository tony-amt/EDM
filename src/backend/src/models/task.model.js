const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class Task extends Model { }

  Task.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // V2.0: 调度时间字段 (重命名 + 新增)
    schedule_time: {  // 保持兼容性，但不是主要调度字段，草稿任务可以为空
      type: DataTypes.DATE,
      allowNull: true,
    },
    scheduled_at: {  // V2.0主要调度字段
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'V2.0调度器使用的调度时间'
    },
    // V2.0: 优先级
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'V2.0任务优先级，数字越大优先级越高'
    },
    actual_start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actual_finish_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'scheduled', 'queued', 'sending', 'paused', 'completed', 'failed', 'cancelled', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    pause_reason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: '暂停原因：manual(手动暂停)、insufficient_balance(余额不足)、service_error(服务错误)等'
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '任务完成时间'
    },
    recipient_rule: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      /* V2.0 规范:
        {
          "type": "specific|tag_based|all_contacts",
          "contact_ids": ["UUID"],
          "include_tags": ["标签名"],
          "exclude_tags": ["标签名"]
        }
      */
    },
    // V2.0: 必需的关联字段
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'senders',
        key: 'id'
      }
    },
    // 🔧 移除template_set_id，改用TaskTemplate关联表
    // template_set_id 字段已移除，现在通过TaskTemplate表关联多个模板
    created_by: {  // V2.0: 重命名自user_id
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // V2.0: 统计字段
    total_subtasks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'V2.0总SubTask数量'
    },
    allocated_subtasks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'V2.0已分配发信服务的SubTask数量'
    },
    pending_subtasks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'V2.0待分配发信服务的SubTask数量'
    },
    contacts: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '任务关联的联系人ID数组'
    },
    templates: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: '任务关联的模板ID数组'
    },
    // SubTask汇总统计字段
    total_opens: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '累计打开数'
    },
    total_clicks: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '累计点击数'
    },
    total_errors: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '累计错误数'
    },
    summary_stats: {
      type: DataTypes.JSONB,
      allowNull: true,
      /* V2.0 统计结构:
         {
           total_recipients: 0,
           pending: 0,
           allocated: 0,
           sending: 0,
           sent: 0,
           delivered: 0,
           bounced: 0,
           opened: 0,
           clicked: 0,
           failed: 0
         }
      */
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Task',
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['status']
      },
      {
        fields: ['scheduled_at'] // V2.0调度索引
      },
      {
        fields: ['priority'] // V2.0优先级索引
      },
      {
        fields: ['created_by']
      }
    ]
  });

  Task.associate = (models) => {
    // V3.0: 关联关系
    Task.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'user',
    });

    Task.belongsTo(models.Sender, {
      foreignKey: 'sender_id',
      as: 'sender',
    });

    // V3.0: SubTask关联
    Task.hasMany(models.SubTask, {
      foreignKey: 'task_id',
      as: 'subTasks',
    });

    // 注意：V3.0不再使用TaskTemplate关联表
    // 模板关系通过task.templates JSONB字段管理
  };

  return Task;
}; 