const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const logger = require('../utils/logger');

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
// eslint-disable-next-line import/no-dynamic-require
let config = require(`${__dirname}/../config/config.js`)[env];

// 如果是 ci_test 环境且没有专门的 ci_test 配置，则回退到 test 配置
if (!config && env === 'ci_test') {
  logger.warn("⚠️ 'ci_test' specific config not found in config.js, falling back to 'test' config.");
  config = require(`${__dirname}/../config/config.js`)['test'];
}

if (!config) {
  logger.error(`❌ Configuration for environment '${env}' not found in config.js, and no fallback applicable.`);
  // 在无法加载配置时抛出错误或退出，以防止后续错误
  throw new Error(`Missing configuration for environment: ${env}`); 
}

const db = {};

// 增强数据库配置，添加连接池和重试策略
const enhancedConfig = {
  ...config,
  pool: {
    max: 20,                 // 最大连接数
    min: 5,                  // 最小连接数
    acquire: 60000,          // 获取连接最长等待时间
    idle: 10000              // 连接池中连接的最大空闲时间
  },
  retry: {
    max: 5,                  // 最大重试次数
    match: [                 // 哪些错误需要重试
      Sequelize.ConnectionError,
      Sequelize.ConnectionRefusedError,
      Sequelize.ConnectionTimedOutError,
      Sequelize.TimeoutError
    ]
  },
  logging: (msg) => logger.debug(msg)  // 使用日志系统记录SQL查询
};

let sequelize;
logger.info('[DEBUG] 开始初始化 Sequelize 实例...');
try {
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], enhancedConfig);
    logger.info(`Database connection initialized using ${config.use_env_variable}`);
  } else {
    sequelize = new Sequelize(
      config.database, 
      config.username, 
      config.password, 
      enhancedConfig
    );
    logger.info(`Database connection initialized for '${config.database}' on ${config.host}:${config.port}`);
  }
  
  // 设置全局事件处理器
  sequelize.afterConnect((connection) => {
    logger.info('New database connection established');
  });
  
  sequelize.beforeDisconnect(() => {
    logger.info('Database connection is about to be closed');
  });
  
  // 设置错误处理
  sequelize.authenticate()
    .then(() => {
      logger.info('Database connection has been established successfully.');
    })
    .catch(err => {
      logger.error('Unable to connect to the database:', err);
    });
} catch (error) {
  logger.error('Failed to initialize database:', error);
  throw error;
}

// 加载所有模型
logger.info('[DEBUG] 开始加载所有模型...');
try {
  fs
    .readdirSync(__dirname)
    .filter(file => (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-9) === '.model.js' && // Ensure we only load .model.js files
      file.indexOf('.test.js') === -1
    ))
    .forEach(file => {
      try {
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
        logger.info(`[DEBUG] 已加载模型: ${model.name}`);
      } catch (modelError) {
        logger.error(`[DEBUG] 加载模型失败: ${file}`, modelError);
        throw modelError;
      }
    });

  // IMPORTANT: Call associate methods AFTER all models are loaded into db object
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      try {
        db[modelName].associate(db); // Pass the db object containing all models
        logger.info(`[DEBUG] 已关联模型: ${modelName}`);
      } catch (associateError) {
        logger.error(`[DEBUG] 关联模型失败: ${modelName}`, associateError);
        throw associateError;
      }
    }
  });
  logger.info('[DEBUG] 所有模型加载与关联完成');
} catch (loadError) {
  logger.error('[DEBUG] 加载模型过程出错:', loadError);
  throw loadError;
}

// 添加全局钩子，用于监控和记录数据库操作
sequelize.addHook('beforeCreate', (instance, options) => {
  logger.debug(`[DEBUG] 创建新记录: ${instance.constructor.name}`);
});

sequelize.addHook('beforeBulkCreate', (instances, options) => {
  logger.debug(`Bulk creating ${instances.length} records in ${instances[0].constructor.name}`);
});

sequelize.addHook('beforeDestroy', (instance, options) => {
  logger.debug(`Deleting record ID:${instance.id} from ${instance.constructor.name}`);
});

sequelize.addHook('beforeBulkDestroy', (options) => {
  logger.debug(`Bulk deleting from ${options.model.name} with where:`, options.where);
});

sequelize.addHook('beforeUpdate', (instance, options) => {
  logger.debug(`Updating record ID:${instance.id} in ${instance.constructor.name}`);
});

sequelize.addHook('beforeBulkUpdate', (options) => {
  logger.debug(`Bulk updating in ${options.model.name} with where:`, options.where);
});

// 所有模型关联现在通过各模型的associate方法处理

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// 所有模型已通过自动加载添加到db对象中
// EmailConversation和EmailMessage现在通过.model.js文件自动加载

// 添加健康检查方法
db.checkHealth = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: 'Database connection is healthy',
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date()
    };
  }
};

// 添加事务帮助方法
db.transaction = async (callback) => {
  let transaction;
  
  try {
    // 创建事务
    transaction = await sequelize.transaction({
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
    
    // 执行回调
    const result = await callback(transaction);
    
    // 提交事务
    await transaction.commit();
    
    return result;
  } catch (error) {
    // 如果事务存在，则回滚
    if (transaction) {
      try {
        await transaction.rollback();
        logger.info('Transaction rolled back due to error');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
    }
    
    logger.error('Transaction failed:', error);
    throw error;
  }
};

// 添加connectDB函数用于初始化数据库连接
db.connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
    
    // 保留测试数据 - 不自动同步表结构
    // 只在必要时手动运行同步
    if (process.env.FORCE_DB_SYNC === 'true') {
      logger.info('Forcing database synchronization...');
      await sequelize.sync({ force: true });
      logger.info('Database tables synchronized with FORCE option.');
    } else if (process.env.ALTER_DB_SYNC === 'true') {
      logger.info('Altering database tables...');
      await sequelize.sync({ alter: true });
      logger.info('Database tables altered successfully.');
    } else {
      logger.info('Skipping database sync to preserve existing data.');
    }
    
    return true;
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = db; 