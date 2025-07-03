const express = require('express');
const { body, query, param } = require('express-validator');
const templateController = require('../controllers/template.controller');
const authMiddleware = require('../middlewares/auth.middleware');
// const roleMiddleware = require('../middlewares/role.middleware'); // For admin-only routes

const router = express.Router();

// --- Swagger Tags ---
/**
 * @swagger
 * tags:
 *   - name: EmailTemplates
 *     description: Email Template management (Section 3)
 *   - name: TemplateSets
 *     description: Template Set management (Section 4)
 *   - name: EmailVariables
 *     description: Email Variable management (Section 5, Admin)
 */

// --- EmailTemplate Routes (Section 3) ---
router.post('/templates',
  authMiddleware.verifyToken,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('body').notEmpty().withMessage('Body is required'),
    body('type').optional().isIn(['welcome', 'notification', 'marketing', 'custom']).withMessage('Invalid template type')
  ],
  templateController.createEmailTemplate
);

router.get('/',
  authMiddleware.verifyToken,
  templateController.getEmailTemplates
);

// --- TemplateSet Routes removed ---

// 预览路由也要在参数路由之前
router.post('/preview',
  authMiddleware.verifyToken,
  [
    body('body').optional().notEmpty().withMessage('Body is required'),
    body('variables').optional().isObject().withMessage('Variables must be an object')
  ],
  templateController.previewEmailTemplate
);

// EmailTemplate 参数路由放在最后
router.get('/:template_id',
  authMiddleware.verifyToken,
  templateController.getEmailTemplateById
);

router.put('/:template_id',
  authMiddleware.verifyToken,
  [
    body('name').optional().notEmpty().withMessage('Template name cannot be empty'),
    body('subject').optional().notEmpty().withMessage('Subject cannot be empty'),
    body('body').optional().notEmpty().withMessage('Body cannot be empty'),
    body('type').optional().isIn(['welcome', 'notification', 'marketing', 'custom']).withMessage('Invalid template type')
  ],
  templateController.updateEmailTemplate
);

router.delete('/:template_id',
  authMiddleware.verifyToken,
  templateController.deleteEmailTemplate
);

// --- EmailVariable Routes (Section 5, Admin) ---
// These routes should ideally be protected by an admin role check middleware, e.g., roleMiddleware.isAdmin
router.post('/variables',
  authMiddleware.verifyToken,
  authMiddleware.requireAdmin,
  [
    body('key').notEmpty().withMessage('Variable key is required'),
    body('name').notEmpty().withMessage('Variable name is required'),
    body('description').optional().isString(),
    body('default_value').optional()
  ],
  templateController.createEmailVariable
);

router.get('/variables',
  authMiddleware.verifyToken,
  authMiddleware.requireAdmin,
  templateController.getEmailVariables
);

router.get('/variables/:variable_id_or_key',
  authMiddleware.verifyToken,
  authMiddleware.requireAdmin,
  templateController.getEmailVariableByIdOrKey
);

router.put('/variables/:variable_id_or_key',
  authMiddleware.verifyToken,
  authMiddleware.requireAdmin,
  [
    body('key').optional().notEmpty().withMessage('Variable key cannot be empty'),
    body('name').optional().notEmpty().withMessage('Variable name cannot be empty'),
    body('description').optional().isString(),
    body('default_value').optional()
  ],
  templateController.updateEmailVariable
);

router.delete('/variables/:variable_id_or_key',
  authMiddleware.verifyToken,
  authMiddleware.requireAdmin,
  templateController.deleteEmailVariable
);

module.exports = router; 