#!/usr/bin/env node

/**
 * 配置健康检查脚本
 * 用于验证系统配置的完整性和正确性
 */

const path = require('path');
const fs = require('fs');

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bold}${colors.blue}${msg}${colors.reset}\n`)
};

class ConfigHealthChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = 0;
    this.passed = 0;
  }

  check(condition, successMsg, errorMsg) {
    this.checks++;
    if (condition) {
      log.success(successMsg);
      this.passed++;
      return true;
    } else {
      log.error(errorMsg);
      this.errors.push(errorMsg);
      return false;
    }
  }

  warn(condition, successMsg, warningMsg) {
    if (condition) {
      log.success(successMsg);
    } else {
      log.warning(warningMsg);
      this.warnings.push(warningMsg);
    }
  }

  // 检查文件是否存在
  checkFileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    this.check(
      exists,
      `${description} 存在: ${filePath}`,
      `${description} 不存在: ${filePath}`
    );
    return exists;
  }

  // 检查后端配置
  checkBackendConfig() {
    log.header('检查后端配置');

    // 检查配置文件
    const configPath = path.join(process.cwd(), 'src/config/index.js');
    if (!this.checkFileExists(configPath, '后端配置文件')) {
      return;
    }

    try {
      // 清除require缓存
      delete require.cache[require.resolve('../src/config/index.js')];
      const config = require('../src/config/index.js');

      // 基础配置检查
      this.check(
        config.env,
        '环境配置已设置',
        '环境配置缺失'
      );

      this.check(
        config.port && typeof config.port === 'number',
        '端口配置正确',
        '端口配置错误或缺失'
      );

      // 数据库配置检查
      this.check(
        config.database && config.database.host,
        '数据库主机配置存在',
        '数据库主机配置缺失'
      );

      // JWT配置检查
      this.check(
        config.jwt && config.jwt.secret,
        'JWT密钥配置存在',
        'JWT密钥配置缺失'
      );

      // Redis配置检查
      this.check(
        config.redis && config.redis.url,
        'Redis连接配置存在',
        'Redis连接配置缺失'
      );

    } catch (error) {
      log.error(`加载后端配置失败: ${error.message}`);
      this.errors.push(`配置文件语法错误: ${error.message}`);
    }
  }

  // 检查前端配置
  checkFrontendConfig() {
    log.header('检查前端配置');

    // 检查前端配置文件
    const frontendConfigPath = path.join(process.cwd(), 'src/frontend/src/config/index.ts');
    this.checkFileExists(frontendConfigPath, '前端配置文件');

    // 检查环境配置文件
    const devEnvPath = path.join(process.cwd(), 'config/frontend.env.development');
    const prodEnvPath = path.join(process.cwd(), 'config/frontend.env.production');

    this.checkFileExists(devEnvPath, '开发环境配置文件');
    this.checkFileExists(prodEnvPath, '生产环境配置文件');
  }

  // 检查Docker配置
  checkDockerConfig() {
    log.header('检查Docker配置');

    const dockerComposePath = path.join(process.cwd(), 'docker-compose.yml');
    this.checkFileExists(dockerComposePath, 'Docker Compose配置文件');
  }

  // 运行所有检查
  async runAllChecks() {
    console.log(`${colors.bold}EDM系统配置健康检查${colors.reset}`);
    console.log('='.repeat(50));

    this.checkBackendConfig();
    this.checkFrontendConfig();
    this.checkDockerConfig();

    // 输出总结
    log.header('检查总结');
    
    log.info(`总检查项: ${this.checks}`);
    log.success(`通过检查: ${this.passed}`);
    
    if (this.errors.length > 0) {
      log.error(`失败检查: ${this.errors.length}`);
    }

    if (this.warnings.length > 0) {
      log.warning(`警告数量: ${this.warnings.length}`);
    }

    const score = this.checks > 0 ? Math.round((this.passed / this.checks) * 100) : 0;
    console.log(`\n${colors.bold}配置健康度: ${score}%${colors.reset}`);

    return {
      score,
      errors: this.errors.length,
      warnings: this.warnings.length,
      passed: this.passed,
      total: this.checks
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const checker = new ConfigHealthChecker();
  checker.runAllChecks()
    .then(result => {
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('配置检查过程中发生错误:', error);
      process.exit(1);
    });
}

module.exports = ConfigHealthChecker; 