const TemplateService = require('../services/core/template.service');
const { AppError } = require('../utils/errorHandler');
const { validationResult } = require('express-validator');

// 🚀 性能优化：添加简单缓存
const cache = new Map();
const CACHE_TTL = 2 * 60 * 1000; // 2分钟缓存

const sendSuccess = (res, data, statusCode = 200) => res.status(statusCode).json(data);
const handleError = (err, next) => {
  if (err instanceof AppError) return next(err);
  console.error("Unexpected error in TemplateController:", err);
  return next(new AppError(err.message || "An unexpected error occurred in template operations.", 500));
};

class TemplateController {
  // --- EmailTemplate Controllers ---
  async createEmailTemplate(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError("Validation failed.", 400, errors.array());
      const template = await TemplateService.createEmailTemplate(req.body, req.user.id);

      // 🚀 清除相关缓存
      this.clearTemplateCache(req.user.id);

      sendSuccess(res, template, 201);
    } catch (err) { handleError(err, next); }
  }

  async getEmailTemplates(req, res, next) {
    try {
      // 🚀 缓存键
      const cacheKey = `templates_${req.user.id}_${JSON.stringify(req.query)}`;

      // 检查缓存
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return sendSuccess(res, { ...cached.data, cached: true });
        }
        cache.delete(cacheKey);
      }

      const templates = await TemplateService.getEmailTemplates(req.query, req.user.id);

      // 🚀 缓存结果
      cache.set(cacheKey, {
        data: templates,
        timestamp: Date.now()
      });

      sendSuccess(res, templates);
    } catch (err) { handleError(err, next); }
  }

  async getEmailTemplateById(req, res, next) {
    try {
      // 🔧 添加参数验证，防止undefined ID
      const templateId = req.params.template_id;
      if (!templateId || templateId === 'undefined' || templateId === 'null') {
        return res.status(400).json({
          success: false,
          message: 'Invalid template ID provided.'
        });
      }

      // 🚀 缓存键
      const cacheKey = `template_${templateId}_${req.user.id}`;

      // 检查缓存
      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return sendSuccess(res, { ...cached.data, cached: true });
        }
        cache.delete(cacheKey);
      }

      const template = await TemplateService.getEmailTemplateById(templateId, req.user.id);

      // 🚀 缓存结果
      cache.set(cacheKey, {
        data: template,
        timestamp: Date.now()
      });

      sendSuccess(res, template);
    } catch (err) { handleError(err, next); }
  }

  async updateEmailTemplate(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError("Validation failed.", 400, errors.array());
      const template = await TemplateService.updateEmailTemplate(req.params.template_id, req.body, req.user.id);

      // 🚀 清除相关缓存
      this.clearTemplateCache(req.user.id);

      sendSuccess(res, template);
    } catch (err) { handleError(err, next); }
  }

  async deleteEmailTemplate(req, res, next) {
    try {
      await TemplateService.deleteEmailTemplate(req.params.template_id, req.user.id);

      // 🚀 清除相关缓存
      this.clearTemplateCache(req.user.id);

      sendSuccess(res, { message: "Email template deleted successfully." });
    } catch (err) { handleError(err, next); }
  }

  // 🚀 性能优化：缓存清理方法
  clearTemplateCache(userId) {
    const keysToDelete = [];
    for (const key of cache.keys()) {
      if (key.includes(`templates_${userId}`) || key.includes(`template_`) && key.includes(`_${userId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => cache.delete(key));
  }

  async previewEmailTemplate(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError("Validation failed.", 400, errors.array());
      const previewData = { ...req.body, user_id: req.user.id };
      const preview = await TemplateService.previewEmailTemplate(previewData);
      sendSuccess(res, preview);
    } catch (err) { handleError(err, next); }
  }

  // --- TemplateSet Controllers removed ---

  // --- EmailVariable Controllers (Admin) ---
  async createEmailVariable(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError("Validation failed.", 400, errors.array());
      const variable = await TemplateService.createEmailVariable(req.body);
      sendSuccess(res, variable, 201);
    } catch (err) { handleError(err, next); }
  }

  async getEmailVariables(req, res, next) {
    try {
      const variables = await TemplateService.getEmailVariables(req.query);
      sendSuccess(res, variables);
    } catch (err) { handleError(err, next); }
  }

  async getEmailVariableByIdOrKey(req, res, next) {
    try {
      const variable = await TemplateService.getEmailVariableByIdOrKey(req.params.variable_id_or_key);
      sendSuccess(res, variable);
    } catch (err) { handleError(err, next); }
  }

  async updateEmailVariable(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) throw new AppError("Validation failed.", 400, errors.array());
      const variable = await TemplateService.updateEmailVariable(req.params.variable_id_or_key, req.body);
      sendSuccess(res, variable);
    } catch (err) { handleError(err, next); }
  }

  async deleteEmailVariable(req, res, next) {
    try {
      await TemplateService.deleteEmailVariable(req.params.variable_id_or_key);
      sendSuccess(res, { message: "Email variable deleted successfully." });
    } catch (err) { handleError(err, next); }
  }
}

// Create a singleton instance
const controller = new TemplateController();

// 导出所有方法
module.exports = {
  createEmailTemplate: controller.createEmailTemplate.bind(controller),
  getEmailTemplates: controller.getEmailTemplates.bind(controller),
  getEmailTemplateById: controller.getEmailTemplateById.bind(controller),
  updateEmailTemplate: controller.updateEmailTemplate.bind(controller),
  deleteEmailTemplate: controller.deleteEmailTemplate.bind(controller),
  previewEmailTemplate: controller.previewEmailTemplate.bind(controller),
  createEmailVariable: controller.createEmailVariable.bind(controller),
  getEmailVariables: controller.getEmailVariables.bind(controller),
  getEmailVariableByIdOrKey: controller.getEmailVariableByIdOrKey.bind(controller),
  updateEmailVariable: controller.updateEmailVariable.bind(controller),
  deleteEmailVariable: controller.deleteEmailVariable.bind(controller)
};

