import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Button, Space, Alert, Divider, message, Modal, Switch } from 'antd';
import { SaveOutlined, ReloadOutlined, PictureOutlined, CodeOutlined, EyeOutlined } from '@ant-design/icons';
import { Editor } from 'react-draft-wysiwyg';
import { EditorState, ContentState, convertToRaw } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import axios from '../../../utils/axios';
import { API_URL } from '../../../config/constants';

interface TemplateFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
}

const TemplateForm: React.FC<TemplateFormProps> = ({
  initialValues,
  onSubmit
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [editorState, setEditorState] = useState(() => EditorState.createEmpty());
  const editorRef = useRef<any>(null);
  
  // 富文本编辑器初始化
  useEffect(() => {
    if (initialValues && initialValues.body) {
      setHtmlContent(initialValues.body);
      // 将HTML转换为EditorState
      const contentBlock = htmlToDraft(initialValues.body);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
        const editorState = EditorState.createWithContent(contentState);
        setEditorState(editorState);
      }
    }
  }, [initialValues]);

  // 监听表单初始值变化
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  // EDM专用编辑器配置
  const editorConfig = {
    options: ['inline', 'blockType', 'fontSize', 'list', 'textAlign', 'colorPicker', 'link', 'embedded', 'image', 'remove', 'history'],
    inline: {
      inDropdown: false,
      className: undefined,
      component: undefined,
      dropdownClassName: undefined,
      options: ['bold', 'italic', 'underline', 'strikethrough'],
    },
    blockType: {
      inDropdown: true,
      options: ['Normal', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'Blockquote'],
      className: undefined,
      component: undefined,
      dropdownClassName: undefined,
    },
    fontSize: {
      options: [8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 96],
      className: undefined,
      component: undefined,
      dropdownClassName: undefined,
    },
    list: {
      inDropdown: false,
      className: undefined,
      component: undefined,
      dropdownClassName: undefined,
      options: ['unordered', 'ordered'],
    },
    textAlign: {
      inDropdown: false,
      className: undefined,
      component: undefined,
      dropdownClassName: undefined,
      options: ['left', 'center', 'right', 'justify'],
    },
    colorPicker: {
      className: undefined,
      component: undefined,
      popupClassName: undefined,
      colors: ['rgb(97,189,109)', 'rgb(26,188,156)', 'rgb(84,172,210)', 'rgb(44,130,201)',
        'rgb(147,101,184)', 'rgb(71,85,119)', 'rgb(204,204,204)', 'rgb(65,168,95)', 'rgb(0,168,133)',
        'rgb(61,142,185)', 'rgb(41,105,176)', 'rgb(85,57,130)', 'rgb(40,50,78)', 'rgb(0,0,0)',
        'rgb(247,218,100)', 'rgb(251,160,38)', 'rgb(235,107,86)', 'rgb(226,80,65)', 'rgb(163,143,132)',
        'rgb(239,239,239)', 'rgb(255,255,255)', 'rgb(250,197,28)', 'rgb(243,121,52)', 'rgb(209,72,65)',
        'rgb(184,49,47)', 'rgb(124,112,107)', 'rgb(209,213,216)'],
    },
    link: {
      inDropdown: false,
      className: undefined,
      component: undefined,
      popupClassName: undefined,
      dropdownClassName: undefined,
      showOpenOptionOnHover: true,
      defaultTargetOption: '_self',
      options: ['link', 'unlink'],
    },
    image: {
      className: undefined,
      component: undefined,
      popupClassName: undefined,
      urlEnabled: true,
      uploadEnabled: true,
      alignmentEnabled: true,
      uploadCallback: async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
          const response = await axios.post(`${API_URL}/upload/image`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          return { data: { link: response.data.url } };
        } catch (error) {
          console.error('图片上传失败:', error);
          return { error: { error: { message: '图片上传失败' } } };
        }
      },
      previewImage: true,
      inputAccept: 'image/gif,image/jpeg,image/jpg,image/png,image/svg',
      alt: { present: false, mandatory: false },
      defaultSize: {
        height: 'auto',
        width: 'auto',
      },
    },
  };

  // 占位符变量管理
  const placeholders = [
    { name: '收件人姓名', value: '{{name}}' },
    { name: '收件人邮箱', value: '{{email}}' },
    { name: '当前日期', value: '{{date}}' },
    { name: '公司名称', value: '{{company}}' },
    { name: '退订链接', value: '{{unsubscribe}}' }
  ];

  // 修复表单提交 - 获取最新的编辑器内容
  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      let bodyContent = '';
      if (isHtmlMode) {
        bodyContent = htmlContent;
      } else {
        // 从Draft.js编辑器获取HTML内容
        bodyContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
      }

      const submitData = {
        name: values.name,
        subject: values.subject,
        body: bodyContent
      };

      await onSubmit(submitData);
      message.success('模板保存成功！');
    } catch (error) {
      console.error('保存模板失败', error);
      message.error('保存模板失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.resetFields();
    setHtmlContent('');
    setEditorState(EditorState.createEmpty());
  };

  const insertPlaceholder = (placeholder: string) => {
    if (isHtmlMode) {
      // HTML模式下直接插入到textarea
      const newContent = htmlContent + placeholder;
      setHtmlContent(newContent);
      form.setFieldValue('body', newContent);
    } else {
      // Draft.js模式下插入到编辑器
      const currentContent = editorState.getCurrentContent();
      const html = draftToHtml(convertToRaw(currentContent)) + placeholder;
      const contentBlock = htmlToDraft(html);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
        const newEditorState = EditorState.createWithContent(contentState);
        setEditorState(newEditorState);
        form.setFieldValue('body', html);
      }
    }
  };

  // 简化模式切换逻辑
  const handleModeChange = (checked: boolean) => {
    
    if (checked) {
      // 切换到HTML模式
      const htmlContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
      setHtmlContent(htmlContent);
      form.setFieldValue('body', htmlContent);
      setIsHtmlMode(true);
    } else {
      // 切换到富文本模式
      setIsHtmlMode(false);
      const contentBlock = htmlToDraft(htmlContent);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(contentBlock.contentBlocks);
        const newEditorState = EditorState.createWithContent(contentState);
        setEditorState(newEditorState);
        form.setFieldValue('body', htmlContent);
      }
    }
  };

  const handlePreview = () => {
    let previewContent = '';
    if (isHtmlMode) {
      previewContent = htmlContent;
    } else {
      previewContent = draftToHtml(convertToRaw(editorState.getCurrentContent()));
    }
    setPreviewHtml(previewContent);
    setPreviewVisible(true);
  };

  const onEditorStateChange = (newEditorState: EditorState) => {
    setEditorState(newEditorState);
    const htmlContent = draftToHtml(convertToRaw(newEditorState.getCurrentContent()));
    form.setFieldValue('body', htmlContent);
  };

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues || {}}
        onFinish={handleFinish}
      >
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="请输入模板名称" />
        </Form.Item>

        <Form.Item
          name="subject"
          label="邮件主题"
          rules={[{ required: true, message: '请输入邮件主题' }]}
        >
          <Input placeholder="请输入邮件主题" />
        </Form.Item>

        <Alert
          message="可用占位符"
          description={
            <Space wrap>
              {placeholders.map(p => (
                <Button 
                  key={p.value} 
                  size="small" 
                  onClick={() => insertPlaceholder(p.value)}
                >
                  {p.name}
                </Button>
              ))}
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>邮件内容</label>
          <Space>
            <span>富文本编辑</span>
            <Switch 
              checked={isHtmlMode} 
              onChange={handleModeChange}
              checkedChildren={<CodeOutlined />}
              unCheckedChildren={<PictureOutlined />}
            />
            <span>HTML源码</span>
          </Space>
        </div>

        {isHtmlMode ? (
          <Form.Item
            name="body"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <Input.TextArea
              value={htmlContent}
              onChange={(e) => {
                setHtmlContent(e.target.value);
                form.setFieldValue('body', e.target.value);
              }}
              placeholder="请输入HTML代码，支持直接粘贴HTML模板"
              autoSize={{ minRows: 15, maxRows: 25 }}
              style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="body"
            rules={[{ required: true, message: '请输入邮件内容' }]}
          >
            <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', minHeight: '400px' }}>
              <Editor
                editorState={editorState}
                onEditorStateChange={onEditorStateChange}
                ref={editorRef}
                toolbar={editorConfig}
                editorStyle={{ minHeight: '350px', padding: '16px' }}
                toolbarStyle={{ border: 'none', borderBottom: '1px solid #d9d9d9' }}
              />
            </div>
          </Form.Item>
        )}

        <Divider />

        <Form.Item>
          <Space>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SaveOutlined />}
            >
              {initialValues ? '更新' : '创建'}
            </Button>
            <Button 
              htmlType="button" 
              onClick={handleReset}
              icon={<ReloadOutlined />}
            >
              重置
            </Button>
            <Button 
              type="default" 
              onClick={handlePreview}
              icon={<EyeOutlined />}
            >
              预览
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* 预览模态框 */}
      <Modal
        title="模板预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <div
          style={{ 
            border: '1px solid #e8e8e8', 
            padding: '16px', 
            borderRadius: '4px',
            minHeight: '200px',
            backgroundColor: '#fff'
          }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Modal>
    </>
  );
};

export default TemplateForm; 