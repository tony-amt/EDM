const { Template, TemplateSet, TemplateSetItem, EmailVariable, User, Task, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { AppError, handleServiceError } = require('../../utils/errorHandler');
const crypto = require('crypto'); // For generating unique link IDs
// const VariableRenderer = require('../utils/variableRenderer'); // For preview logic

// Helper function to extract links and generate unique IDs
const processTemplateLinks = (htmlBody) => {
  if (!htmlBody || typeof htmlBody !== 'string') {
    return {};
  }
  const links = {};
  const A_TAG_REGEX = new RegExp('<a\\s+(?:[^>]*?\\s+)?href=(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]*))', 'gi');
  let match;
  let url_counter = 0; // to help ensure unique ids for identical urls

  while ((match = A_TAG_REGEX.exec(htmlBody)) !== null) {
    const originalUrl = match[1] || match[2] || match[3];
    if (originalUrl && (originalUrl.startsWith('http://') || originalUrl.startsWith('https://'))) {
      // Avoid processing mailto, tel, javascript:, etc. links or already tracked links
      if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('tel:') || originalUrl.includes('{{unsubscribe_url}}') || originalUrl.includes('/track/click/')) {
          continue;
      }
      // Generate a short, somewhat unique ID. Using a hash of the URL + a counter for duplicates.
      // For better uniqueness and collision avoidance, a more robust system (e.g., UUIDs or DB sequence) might be needed for high-volume scenarios.
      const hash = crypto.createHash('sha256').update(originalUrl + url_counter++).digest('hex');
      const linkId = hash.substring(0, 8); // Take the first 8 chars for a short ID
      links[linkId] = originalUrl;
    }
  }
  return links;
};

// --- Formatters ---
const formatEmailTemplateOutput = (template) => {
  if (!template) return null;
  const json = template.toJSON ? template.toJSON() : template;
  return {
    id: json.id,
    name: json.name,
    subject: json.subject,
    body: json.body,
    created_by: json.user_id, // from association
    created_at: json.created_at,
    updated_at: json.updated_at,
  };
};

const formatTemplateSetOutput = async (templateSet) => {
  if (!templateSet) return null;
  const json = templateSet.toJSON ? templateSet.toJSON() : templateSet;

  const items = await TemplateSetItem.findAll({
      where: { template_set_id: json.id },
      include: [{ model: Template, as: 'template', attributes: ['id', 'name', 'subject'] }],
      order: [['order', 'ASC']],
  });

  return {
    id: json.id,
    name: json.name,
    user_id: json.user_id,
    created_at: json.created_at,
    updated_at: json.updated_at,
    item_count: items.length, // API spec
    items: items.map(item => ({
      template_set_item_id: item.id, // If needed
      template_id: item.template.id,
      order: item.order,
      template_name: item.template.name, // For convenience, from API spec example
      template_subject_preview: item.template.subject, // For convenience
    })),
  };
};

const formatEmailVariableOutput = (variable) => {
    if (!variable) return null;
    const json = variable.toJSON ? variable.toJSON() : variable;
    return {
        id: json.id,
        variable_key: json.variable_key,
        display_name: json.display_name,
        description: json.description,
        source_type: json.source_type,
        source_details: json.source_details,
        is_system_defined: json.is_system_defined,
        created_at: json.created_at,
        updated_at: json.updated_at,
    };
};


class TemplateService {
  // --- EmailTemplate Methods (Section 3.1 - 3.6) ---
  async createEmailTemplate(data, userId) {
    try {
      let { name, subject, body, ...restData } = data; // Destructure body to process it
      if (!name || !subject || !body) { // TC_TPL_3.1.2, 3.1.3, 3.1.4
        throw new AppError('Name, subject, and body are required for email template.', 400);
      }
      // TC_TPL_3.1.5 (malicious HTML) - sanitize 'body' if needed, or rely on frontend editor
      
      const processedLinks = processTemplateLinks(body);
      
      const template = await Template.create({ 
        name,
        subject,
        body, // Store original body
        links: processedLinks, // Store processed link mappings
        user_id: userId,
        ...restData 
      });
      return formatEmailTemplateOutput(template);
    } catch (error) {
      handleServiceError(error, 'Error creating email template');
    }
  }

  async getEmailTemplates(filters, userId) {
    try {
      const { page = 1, limit = 20, name, subject, sort_by = 'created_at', order = 'desc' } = filters;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const whereClause = { user_id: userId };
      if (name) whereClause.name = { [Op.iLike]: `%${name}%` };
      if (subject) whereClause.subject = { [Op.iLike]: `%${subject}%` }; // TC_TPL_3.2.2

      const { count, rows } = await Template.findAndCountAll({
        where: whereClause,
        order: [[sort_by, order.toUpperCase()]],
        limit: parseInt(limit, 10),
        offset,
      });
      return {
        total_items: count, total_pages: Math.ceil(count / limit), current_page: parseInt(page, 10), limit: parseInt(limit, 10),
        items: rows.map(formatEmailTemplateOutput),
      };
    } catch (error) {
      handleServiceError(error, 'Error fetching email templates');
    }
  }

  async getEmailTemplateById(id, userId) {
    try {
      const template = await Template.findOne({ where: { id, user_id: userId } });
      if (!template) throw new AppError('Email template not found or access denied.', 404); // TC_TPL_3.3.2
      return formatEmailTemplateOutput(template);
    } catch (error) {
      handleServiceError(error, 'Error fetching email template by ID');
    }
  }

  async updateEmailTemplate(id, data, userId) {
    try {
      const template = await Template.findOne({ where: { id, user_id: userId } });
      if (!template) throw new AppError('Email template not found or access denied.', 404);

      // TC_TPL_3.4.2: check for empty required fields if they are being updated
      if (data.name === '' || data.subject === '' || data.body === '') {
          throw new AppError('Name, subject, and body cannot be empty if provided for update.', 400);
      }

      // If body is being updated, re-process links
      if (data.body) {
        data.links = processTemplateLinks(data.body);
      }

      await template.update(data);
      return formatEmailTemplateOutput(template);
    } catch (error) {
      handleServiceError(error, 'Error updating email template');
    }
  }

  async deleteEmailTemplate(id, userId) {
    try {
      const template = await Template.findOne({ where: { id, user_id: userId } });
      if (!template) throw new AppError('Email template not found or access denied.', 404); // TC_TPL_3.5.3

      // TC_TPL_3.5.2: Check if template is used in TemplateSetItems
      const usageCount = await TemplateSetItem.count({ where: { template_id: id } });
      if (usageCount > 0) {
        throw new AppError('Cannot delete template: it is currently used in one or more template sets.', 409); // 409 Conflict
      }
      await template.destroy();
      return true;
    } catch (error) {
      handleServiceError(error, 'Error deleting email template');
    }
  }

  async previewEmailTemplate(previewData) { // TC_TPL_3.6
    try {
        let { template_id, template_content, sample_contact_data, user_id } = previewData;
        let subjectToRender, bodyToRender;

        if (template_id) {
            const template = await this.getEmailTemplateById(template_id, user_id); 
            if(!template) throw new AppError("Template not found for preview.", 404);
            subjectToRender = template.subject;
            bodyToRender = template.body;
        } else if (template_content && template_content.subject && template_content.body) {
            subjectToRender = template_content.subject;
            bodyToRender = template_content.body;
        } else {
            throw new AppError("Either template_id or template_content (subject, body) is required for preview.", 400);
        }
        
        const render = (text, data_payload) => {
            if (!data_payload || typeof text !== "string") return text;
            let renderedText = text;
            
            const placeholderRegex = /\{\{([^{}]+?)\}\}/g;
            let match;
            
            // Store replacements to avoid issues with replacing substrings that affect future matches
            const replacements = [];

            while ((match = placeholderRegex.exec(text)) !== null) {
                const fullMatch = match[0]; 
                const key = match[1];       

                const keyParts = key.split(".");
                let resolvedValue = data_payload;
                let found = true;
                for (const part of keyParts) {
                    if (resolvedValue && typeof resolvedValue === "object" && part in resolvedValue) {
                        resolvedValue = resolvedValue[part];
                    } else {
                        found = false;
                        break;
                    }
                }
                
                if (found && resolvedValue !== undefined) {
                    replacements.push({ placeholder: fullMatch, value: String(resolvedValue) });
                }
            }

            // Apply replacements from longest placeholder to shortest to handle nested cases if any, or just iterate
            // For simple {{key}} non-overlapping, order doesn't strictly matter.
            // To be safe with multiple identical placeholders, replace them all.
            for(const rep of replacements) {
                // Escape the placeholder for use in a new RegExp, as its content can vary
                const escapedPlaceholder = rep.placeholder.replace(/[.*+?^${}()|[\]\/\\]/g, "\\$&");
                renderedText = renderedText.replace(new RegExp(escapedPlaceholder, 'g'), rep.value);
            }
            return renderedText;
        };

        return {
            rendered_subject: render(subjectToRender, sample_contact_data),
            rendered_body: render(bodyToRender, sample_contact_data),
        };
    } catch (error) {
        handleServiceError(error, "Error previewing email template");
    }
  }

  // --- TemplateSet Methods (Section 4.1 - 4.5) ---
  async createTemplateSet(data, userId) {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { name, items } = data;
      if (!name || !items || items.length === 0) { // TC_TSET_4.1.2, 4.1.3
        throw new AppError('Name and at least one item are required for template set.', 400);
      }

      const templateSet = await TemplateSet.create({ name, user_id: userId }, { transaction });

      const itemOrders = new Set();
      for (const item of items) {
        if (item.order === undefined || item.order < 0 || itemOrders.has(item.order)) { // TC_TSET_4.1.5, 4.1.6
          throw new AppError(`Invalid or duplicate order for template item: ${item.template_id}. Order: ${item.order}`, 400);
        }
        itemOrders.add(item.order);
        const templateExists = await Template.findOne({ where: { id: item.template_id, user_id: userId } }); // Ensure template exists and user owns it
        if (!templateExists) { // TC_TSET_4.1.4
          throw new AppError(`Template with ID ${item.template_id} not found or not accessible.`, 400); // or 404
        }
        await TemplateSetItem.create({
          template_set_id: templateSet.id,
          template_id: item.template_id,
          order: item.order,
        }, { transaction });
      }
      await transaction.commit();
      return formatTemplateSetOutput(await TemplateSet.findByPk(templateSet.id));
    } catch (error) {
      if (transaction) await transaction.rollback();
      handleServiceError(error, 'Error creating template set');
    }
  }

    async getTemplateSets(filters, userId) {
        try {
            const { page = 1, limit = 20, name, sort_by = 'created_at', order = 'desc' } = filters;
            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            const whereClause = { user_id: userId };
            if (name) whereClause.name = { [Op.iLike]: `%${name}%` }; // TC_TSET_4.2.2

            const { count, rows } = await TemplateSet.findAndCountAll({
                where: whereClause,
                order: [[sort_by, order.toUpperCase()]],
                limit: parseInt(limit, 10),
                offset,
            });
            
            const formattedItems = [];
            for(const row of rows) {
                formattedItems.push(await formatTemplateSetOutput(row));
            }

            return {
                total_items: count, total_pages: Math.ceil(count / limit), current_page: parseInt(page, 10), limit: parseInt(limit, 10),
                items: formattedItems, // TC_TSET_4.2.1 (item_count in formatted output)
            };
        } catch (error) {
            handleServiceError(error, 'Error fetching template sets');
        }
    }

    async getTemplateSetById(id, userId) {
        try {
            const templateSet = await TemplateSet.findOne({ where: { id, user_id: userId } });
            if (!templateSet) throw new AppError('Template set not found or access denied.', 404); // TC_TSET_4.3.2
            return formatTemplateSetOutput(templateSet); // TC_TSET_4.3.3 (items populated by formatter)
        } catch (error) {
            handleServiceError(error, 'Error fetching template set by ID');
        }
    }

    async updateTemplateSet(id, data, userId) {
        let transaction;
        try {
            transaction = await sequelize.transaction();
            const templateSet = await TemplateSet.findOne({ where: { id, user_id: userId }, transaction });
            if (!templateSet) throw new AppError('Template set not found or access denied.', 404);

            const { name, items } = data;
            if (name) await templateSet.update({ name }, { transaction });

            if (items) { // If items are provided, replace all existing items
                await TemplateSetItem.destroy({ where: { template_set_id: id }, transaction });
                if (items.length === 0) throw new AppError('Template set items cannot be empty if provided for update.', 400);
                
                const itemOrders = new Set();
                for (const item of items) {
                    if (item.order === undefined || item.order < 0 || itemOrders.has(item.order)) {
                        throw new AppError(`Invalid or duplicate order for template item: ${item.template_id}. Order: ${item.order}`, 400); // TC_TSET_4.4.2
                    }
                    itemOrders.add(item.order);
                    const templateExists = await Template.findOne({ where: { id: item.template_id, user_id: userId }, transaction });
                    if (!templateExists) {
                        throw new AppError(`Template with ID ${item.template_id} not found or not accessible for update.`, 400); // TC_TSET_4.4.2

                    }
                    await TemplateSetItem.create({
                        template_set_id: id,
                        template_id: item.template_id,
                        order: item.order,
                    }, { transaction });
                }
            }
            await transaction.commit();
            return formatTemplateSetOutput(await TemplateSet.findByPk(id)); // Re-fetch to get updated items
        } catch (error) {
            if (transaction) await transaction.rollback();
            handleServiceError(error, 'Error updating template set');
        }
    }

    async deleteTemplateSet(id, userId) {
        try {
            const templateSet = await TemplateSet.findOne({ where: { id, user_id: userId } });
            if (!templateSet) throw new AppError('Template set not found or access denied.', 404); // TC_TSET_4.5.3

            // TC_TSET_4.5.2: Check if used by Tasks
            const taskUsage = await Task.count({ where: { template_set_id: id } });
            if (taskUsage > 0) {
                throw new AppError('Cannot delete template set: it is currently used by one or more tasks.', 409);
            }

            await TemplateSetItem.destroy({ where: { template_set_id: id } }); // Delete items first
            await templateSet.destroy();
            return true;
        } catch (error) {
            handleServiceError(error, 'Error deleting template set');
        }
    }

  // --- EmailVariable Methods (Section 5.1 - 5.5, Admin Operations) ---
  async createEmailVariable(data) { // No userId here, assuming admin context
    try {
      // TC_VAR_5.1.3: variable_key duplicate check done by DB unique constraint
      // TC_VAR_5.1.4, 5.1.5: Validate source_type and source_details
      if (!data.variable_key || !data.display_name || !data.source_type) {
          throw new AppError('Variable key, display name, and source type are required.', 400);
      }
      // Add specific validation for source_details based on source_type
      if (data.source_type === 'CONTACT_FIELD' && (!data.source_details || !data.source_details.field_name)) {
          throw new AppError('Source details (field_name) required for CONTACT_FIELD type.', 400);
      }
      if (data.source_type === 'SYSTEM' && (!data.source_details || !data.source_details.generator)) {
          throw new AppError('Source details (generator) required for SYSTEM type.', 400);
      }

      const variable = await EmailVariable.create(data);
      return formatEmailVariableOutput(variable);
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('Variable key already exists.', 409); // TC_VAR_5.1.3 (400 or 409)
      }
      handleServiceError(error, 'Error creating email variable');
    }
  }

  async getEmailVariables(filters) {
    try {
      const { page = 1, limit = 20, source_type, sort_by = 'variable_key', order = 'asc' } = filters;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const whereClause = {};
      if (source_type) whereClause.source_type = source_type; // TC_VAR_5.2.2

      const { count, rows } = await EmailVariable.findAndCountAll({
        where: whereClause,
        order: [[sort_by, order.toUpperCase()]],
        limit: parseInt(limit, 10),
        offset,
      });
      return {
        total_items: count, total_pages: Math.ceil(count / limit), current_page: parseInt(page, 10), limit: parseInt(limit, 10),
        items: rows.map(formatEmailVariableOutput),
      };
    } catch (error) {
      handleServiceError(error, 'Error fetching email variables');
    }
  }

  async getEmailVariableByIdOrKey(idOrKey) {
    try {
      const variable = await EmailVariable.findOne({
        where: { [Op.or]: [{ id: idOrKey }, { variable_key: idOrKey }] }
      });
      if (!variable) throw new AppError('Email variable not found.', 404); // TC_VAR_5.3.2
      return formatEmailVariableOutput(variable);
    } catch (error) {
      handleServiceError(error, 'Error fetching email variable by ID/key');
    }
  }

  async updateEmailVariable(idOrKey, data) {
    try {
      const variable = await EmailVariable.findOne({
        where: { [Op.or]: [{ id: idOrKey }, { variable_key: idOrKey }] }
      });
      if (!variable) throw new AppError('Email variable not found.', 404);

      // TC_VAR_5.4.2: usually variable_key is not updatable.
      if (data.variable_key && data.variable_key !== variable.variable_key) {
          throw new AppError('Variable key cannot be changed.', 400);
      }
      // TC_VAR_5.4.3: Validate source_details with source_type if updated
      const newSourceType = data.source_type || variable.source_type;
      const newSourceDetails = data.source_details !== undefined ? data.source_details : variable.source_details;

      if (newSourceType === 'CONTACT_FIELD' && (!newSourceDetails || !newSourceDetails.field_name)) {
          throw new AppError('Source details (field_name) required for CONTACT_FIELD type.', 400);
      }
      if (newSourceType === 'SYSTEM' && (!newSourceDetails || !newSourceDetails.generator)) {
          throw new AppError('Source details (generator) required for SYSTEM type.', 400);
      }

      await variable.update(data);
      return formatEmailVariableOutput(variable);
    } catch (error) {
      handleServiceError(error, 'Error updating email variable');
    }
  }

  async deleteEmailVariable(idOrKey) {
    try {
      const variable = await EmailVariable.findOne({
        where: { [Op.or]: [{ id: idOrKey }, { variable_key: idOrKey }] }
      });
      if (!variable) throw new AppError('Email variable not found.', 404); // TC_VAR_5.5.3
      // TC_VAR_5.5.2: Deleting widely used variable - system allows, but UI should warn.
      await variable.destroy();
      return true;
    } catch (error) {
      handleServiceError(error, 'Error deleting email variable');
    }
  }
}

// End of file - export properly bound methods
const templateService = new TemplateService();

// Export the service instance with properly bound methods
module.exports = {
  // EmailTemplate methods
  createEmailTemplate: templateService.createEmailTemplate.bind(templateService),
  getEmailTemplates: templateService.getEmailTemplates.bind(templateService),
  getEmailTemplateById: templateService.getEmailTemplateById.bind(templateService),
  updateEmailTemplate: templateService.updateEmailTemplate.bind(templateService),
  deleteEmailTemplate: templateService.deleteEmailTemplate.bind(templateService),
  previewEmailTemplate: templateService.previewEmailTemplate.bind(templateService),
  
  // TemplateSet methods
  createTemplateSet: templateService.createTemplateSet.bind(templateService),
  getTemplateSets: templateService.getTemplateSets.bind(templateService),
  getTemplateSetById: templateService.getTemplateSetById.bind(templateService),
  updateTemplateSet: templateService.updateTemplateSet.bind(templateService),
  deleteTemplateSet: templateService.deleteTemplateSet.bind(templateService),
  
  // EmailVariable methods
  createEmailVariable: templateService.createEmailVariable.bind(templateService),
  getEmailVariables: templateService.getEmailVariables.bind(templateService),
  getEmailVariableByIdOrKey: templateService.getEmailVariableByIdOrKey.bind(templateService),
  updateEmailVariable: templateService.updateEmailVariable.bind(templateService),
  deleteEmailVariable: templateService.deleteEmailVariable.bind(templateService)
};