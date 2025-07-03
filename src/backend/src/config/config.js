require('dotenv').config(); // Ensure environment variables are loaded

module.exports = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'amt_mail_system',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: console.log, // Можно настроить на false или другую функцию логирования
    dialectOptions: {
      // SSL options can be configured here if needed for production
      // ssl: {
      //   require: true, // This will help you. But if you want to connect without SSL, you should remove it.
      //   rejectUnauthorized: false // This line will fix new error
      // }
    },
    define: {
      underscored: true, // Globally set table names and column names to snake_case
      timestamps: true, // Globally enable createdAt and updatedAt timestamps
    },
    // Sequelize-specific options
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  // 🔧 【环境统一规范】删除test配置，强制使用development环境
  // test: {
  //   username: process.env.DB_USER_TEST || 'postgres',
  //   password: process.env.DB_PASSWORD_TEST || 'postgres',
  //   database: process.env.DB_NAME_TEST || 'amt_mail_test',
  //   host: process.env.DB_HOST_TEST || 'localhost',
  //   port: process.env.DB_PORT_TEST || 5432,
  //   dialect: 'postgres',
  //   logging: false,
  //   define: {
  //     underscored: true,
  //     timestamps: true,
  //   }
  // },
  // 🔧 【环境统一规范】test环境指向development，严禁环境分离
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'amt_mail_system',  // 强制使用开发环境数据库
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,  // 测试时关闭日志
    define: {
      underscored: true,
      timestamps: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    username: process.env.DB_USER || 'edm_user',
    password: process.env.DB_PASSWORD || 'edm_secure_2025_tk',
    database: process.env.DB_NAME || 'amt_mail_system',
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false, // Or a custom logger for production
    dialectOptions: {
      // ssl: {
      //   require: true,
      //   rejectUnauthorized: true, // Important for production
      //   // ca: [fs.readFileSync(__dirname + '/path/to/prod-ca-cert.pem')]
      // }
    },
    define: {
      underscored: true,
      timestamps: true,
    },
    pool: {
      max: 10,
      min: 1,
      acquire: 60000,
      idle: 20000
    }
  }
}; 