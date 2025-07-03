module.exports = (sequelize, DataTypes) => {
  const TaskWaitMetric = sequelize.define('TaskWaitMetric', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'task_id',
      comment: '任务ID'
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      comment: '用户ID'
    },
    queue_entry_time: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'queue_entry_time',
      comment: '进入队列时间'
    },
    first_send_time: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'first_send_time',
      comment: '首次发送时间'
    },
    wait_duration_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'wait_duration_seconds',
      comment: '等待时长（秒）'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'waiting',
      allowNull: false,
      validate: {
        isIn: [['waiting', 'processing', 'completed']]
      },
      comment: '状态: waiting, processing, completed'
    }
  }, {
    tableName: 'task_wait_metrics',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true,
    indexes: [
      {
        fields: ['task_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['status', 'created_at']
      },
      {
        fields: ['wait_duration_seconds']
      }
    ]
  });

  // 关联关系
  TaskWaitMetric.associate = function (models) {
    // 与Task表关联
    TaskWaitMetric.belongsTo(models.Task, {
      foreignKey: 'task_id',
      as: 'task'
    });

    // 与User表关联
    TaskWaitMetric.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  // 实例方法
  TaskWaitMetric.prototype.calculateWaitDuration = function () {
    if (this.first_send_time && this.queue_entry_time) {
      return Math.floor((this.first_send_time - this.queue_entry_time) / 1000);
    }
    return null;
  };

  // 类方法
  TaskWaitMetric.getAverageWaitTime = async function (userId = null, hours = 24) {
    const whereClause = {
      status: 'completed',
      wait_duration_seconds: {
        [sequelize.Sequelize.Op.not]: null
      },
      created_at: {
        [sequelize.Sequelize.Op.gte]: new Date(Date.now() - hours * 60 * 60 * 1000)
      }
    };

    if (userId) {
      whereClause.user_id = userId;
    }

    const result = await this.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn('AVG', sequelize.col('wait_duration_seconds')), 'avg_wait'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_tasks']
      ],
      raw: true
    });

    return {
      average_wait_seconds: parseFloat(result[0].avg_wait) || 0,
      total_tasks: parseInt(result[0].total_tasks) || 0
    };
  };

  TaskWaitMetric.getLongWaitingTasks = async function (thresholdSeconds = 600) {
    return await this.findAll({
      where: {
        status: 'waiting',
        created_at: {
          [sequelize.Sequelize.Op.lte]: new Date(Date.now() - thresholdSeconds * 1000)
        }
      },
      include: [
        {
          model: sequelize.models.Task,
          as: 'task',
          attributes: ['id', 'title', 'status']
        },
        {
          model: sequelize.models.User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['created_at', 'ASC']]
    });
  };

  return TaskWaitMetric;
}; 