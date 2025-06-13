const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
//密钥和IV应从环境变量中安全获取
//确保密钥是32字节，IV是16字节
const ENCRYPTION_KEY = process.env.MAIL_SERVICE_ENC_KEY || '0123456789abcdef0123456789abcdef'; // 32 bytes
const IV_LENGTH = 16;
const ENCRYPTION_IV = process.env.MAIL_SERVICE_ENC_IV || 'abcdef9876543210'; // 16 bytes

if (Buffer.from(ENCRYPTION_KEY, 'utf8').length !== 32) {
  throw new Error('Encryption key must be 32 bytes long.');
}
if (Buffer.from(ENCRYPTION_IV, 'utf8').length !== 16) {
  throw new Error('Encryption IV must be 16 bytes long.');
}

function encrypt(text) {
  if (text === null || typeof text === 'undefined') {
    return text;
  }
  try {
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), Buffer.from(ENCRYPTION_IV, 'utf8'));
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    // 在生产中，可能需要更稳健的错误处理，而不是抛出或返回null
    // 但对于此上下文，如果加密失败，则是一个严重问题
    throw new Error('Failed to encrypt data.');
  }
}

function decrypt(encryptedText) {
  if (encryptedText === null || typeof encryptedText === 'undefined') {
    return encryptedText;
  }
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), Buffer.from(ENCRYPTION_IV, 'utf8'));
    let decrypted = decipher.update(String(encryptedText), 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // 如果解密失败，可能意味着数据损坏或密钥/IV不匹配
    // 返回null或抛出错误，取决于应用如何处理此类情况
    // 对于api_key，解密失败意味着服务不可用
    throw new Error('Failed to decrypt data. Data may be corrupt or key/IV mismatch.');
  }
}

module.exports = {
  encrypt,
  decrypt,
}; 