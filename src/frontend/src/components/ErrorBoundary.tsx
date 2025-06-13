import React, { Component, ReactNode } from 'react';
import { Result, Button, Alert, Collapse } from 'antd';
import { BugOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    });

    // 调用外部错误处理函数
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 在开发环境下打印错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRefresh = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <Result
            status="error"
            title="页面出错了"
            subTitle="抱歉，页面运行时发生了错误。请尝试刷新页面或联系管理员。"
            icon={<BugOutlined />}
            extra={[
              <Button type="primary" key="refresh" icon={<ReloadOutlined />} onClick={this.handleRefresh}>
                刷新页面
              </Button>,
              <Button key="home" icon={<HomeOutlined />} onClick={this.handleGoHome}>
                返回首页
              </Button>
            ]}
          />

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <Alert
                message="开发模式 - 错误详情"
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
              
              <Collapse>
                <Panel header="错误信息" key="error">
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '12px', 
                    overflow: 'auto',
                    fontSize: '12px',
                    textAlign: 'left'
                  }}>
                    {this.state.error.toString()}
                  </pre>
                </Panel>
                
                {this.state.errorInfo && (
                  <Panel header="组件堆栈" key="stack">
                    <pre style={{ 
                      background: '#f5f5f5', 
                      padding: '12px', 
                      overflow: 'auto',
                      fontSize: '12px',
                      textAlign: 'left'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Panel>
                )}
              </Collapse>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 