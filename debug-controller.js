const path = require('path');

try {
  console.log('Current directory:', process.cwd());
  
  const controllerPath = './src/backend/src/controllers/emailConversation.controller';
  console.log('Loading controller from:', controllerPath);
  
  const controller = require(controllerPath);
  
  console.log('Controller loaded successfully');
  console.log('Controller type:', typeof controller);
  console.log('Controller methods:', Object.keys(controller));
  
  // 检查关键方法
  console.log('\nMethod types:');
  console.log('getConversations:', typeof controller.getConversations);
  console.log('createConversation:', typeof controller.createConversation);
  console.log('getConversationDetail:', typeof controller.getConversationDetail);
  console.log('sendReply:', typeof controller.sendReply);
  console.log('updateConversationStatus:', typeof controller.updateConversationStatus);
  console.log('markAsRead:', typeof controller.markAsRead);
  console.log('getConversationStats:', typeof controller.getConversationStats);
  
} catch (error) {
  console.error('Error loading controller:', error.message);
  console.error('Stack:', error.stack);
} 