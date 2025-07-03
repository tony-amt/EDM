// EDM系统 JSONB查询修复补丁
// 修复问题：operator does not exist: jsonb && unknown

const { Op, Sequelize } = require('sequelize');

/**
 * 修复contact.service.js中的JSONB查询问题
 * 原问题：Op.overlap 操作符在PostgreSQL中转换为 && 时类型不匹配
 * 解决方案：使用原生SQL或确保类型转换正确
 */

// 修复方案1：使用Sequelize.literal进行原生JSONB查询
const getContactsByTagsFixed = async (includeTagIds, excludeTagIds = []) => {
  let whereClause = {};

  if (includeTagIds && includeTagIds.length > 0) {
    // 使用?|操作符检查JSONB数组是否包含任一指定标签
    const tagIdsJson = JSON.stringify(includeTagIds);
    whereClause[Op.and] = whereClause[Op.and] || [];
    whereClause[Op.and].push(
      Sequelize.literal(`tags ?| array[${includeTagIds.map(id => `'${id}'`).join(',')}]`)
    );
  }

  if (excludeTagIds && excludeTagIds.length > 0) {
    // 使用NOT操作符排除包含指定标签的联系人
    whereClause[Op.and] = whereClause[Op.and] || [];
    whereClause[Op.and].push(
      Sequelize.literal(`NOT (tags ?| array[${excludeTagIds.map(id => `'${id}'`).join(',')}])`)
    );
  }

  return whereClause;
};

// 修复方案2：使用@>操作符进行包含查询
const getContactsByTagsAlternative = async (includeTagIds, excludeTagIds = []) => {
  let whereClause = {};

  if (includeTagIds && includeTagIds.length > 0) {
    // 为每个标签创建独立的包含查询，然后用OR连接
    const orConditions = includeTagIds.map(tagId =>
      Sequelize.literal(`tags @> '["${tagId}"]'`)
    );

    if (orConditions.length === 1) {
      whereClause[Op.and] = whereClause[Op.and] || [];
      whereClause[Op.and].push(orConditions[0]);
    } else {
      whereClause[Op.and] = whereClause[Op.and] || [];
      whereClause[Op.and].push({ [Op.or]: orConditions });
    }
  }

  if (excludeTagIds && excludeTagIds.length > 0) {
    // 排除包含任一排除标签的联系人
    const notConditions = excludeTagIds.map(tagId =>
      Sequelize.literal(`NOT tags @> '["${tagId}"]'`)
    );

    whereClause[Op.and] = whereClause[Op.and] || [];
    whereClause[Op.and].push(...notConditions);
  }

  return whereClause;
};

// 修复方案3：强制类型转换的Op.overlap
const getContactsByTagsCast = async (includeTagIds, excludeTagIds = []) => {
  let whereClause = {};

  if (includeTagIds && includeTagIds.length > 0) {
    // 强制将数组转换为JSONB类型
    whereClause.tags = {
      [Op.overlap]: Sequelize.cast(JSON.stringify(includeTagIds), 'jsonb')
    };
  }

  if (excludeTagIds && excludeTagIds.length > 0) {
    if (whereClause.tags) {
      whereClause[Op.and] = [
        { tags: whereClause.tags },
        {
          [Op.not]: {
            tags: {
              [Op.overlap]: Sequelize.cast(JSON.stringify(excludeTagIds), 'jsonb')
            }
          }
        }
      ];
      delete whereClause.tags;
    } else {
      whereClause[Op.not] = {
        tags: {
          [Op.overlap]: Sequelize.cast(JSON.stringify(excludeTagIds), 'jsonb')
        }
      };
    }
  }

  return whereClause;
};

module.exports = {
  getContactsByTagsFixed,
  getContactsByTagsAlternative,
  getContactsByTagsCast
}; 