import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';

interface ApiRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  enableRetry?: boolean;
  showErrorMessage?: boolean;
  showSuccessMessage?: boolean;
  successMessage?: string;
  immediate?: boolean;
}

interface ApiRequestState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  success: boolean;
}

interface UseApiRequestReturn<T> extends ApiRequestState<T> {
  execute: (overrideOptions?: Partial<ApiRequestOptions>) => Promise<T | null>;
  refresh: () => Promise<T | null>;
  reset: () => void;
}

const useApiRequest = <T = any>(
  initialOptions: ApiRequestOptions
): UseApiRequestReturn<T> => {
  const [state, setState] = useState<ApiRequestState<T>>({
    data: null,
    loading: false,
    error: null,
    success: false
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(initialOptions);

  // 更新选项
  optionsRef.current = initialOptions;

  // 睡眠函数
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 执行API请求
  const execute = useCallback(async (
    overrideOptions: Partial<ApiRequestOptions> = {}
  ): Promise<T | null> => {
    const options = { ...optionsRef.current, ...overrideOptions };
    const {
      url,
      method = 'GET',
      data,
      headers = {},
      timeout = 10000,
      retryCount = 3,
      retryDelay = 1000,
      enableRetry = true,
      showErrorMessage = true,
      showSuccessMessage = false,
      successMessage
    } = options;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      success: false
    }));

    let currentAttempt = 0;
    const maxAttempts = enableRetry ? retryCount + 1 : 1;

    while (currentAttempt < maxAttempts) {
      try {
        // 创建超时Promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), timeout);
        });

        // 创建fetch Promise
        const fetchPromise = fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: abortControllerRef.current.signal
        });

        // 竞争超时和请求
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        setState(prev => ({
          ...prev,
          data: result,
          loading: false,
          error: null,
          success: true
        }));

        if (showSuccessMessage) {
          message.success(successMessage || '操作成功');
        }

        return result;

      } catch (error: any) {
        currentAttempt++;

        // 如果是中止错误，直接返回
        if (error.name === 'AbortError') {
          setState(prev => ({
            ...prev,
            loading: false
          }));
          return null;
        }

        // 如果是最后一次尝试或不启用重试
        if (currentAttempt >= maxAttempts) {
          setState(prev => ({
            ...prev,
            loading: false,
            error,
            success: false
          }));

          if (showErrorMessage) {
            const errorMessage = getErrorMessage(error);
            message.error(errorMessage);
          }

          console.error('API请求失败:', error);
          throw error;
        }

        // 等待重试延迟
        if (enableRetry && currentAttempt < maxAttempts) {
          console.warn(`API请求失败，${retryDelay}ms后进行第${currentAttempt + 1}次重试:`, error.message);
          await sleep(retryDelay * currentAttempt); // 指数退避
        }
      }
    }

    return null;
  }, []);

  // 刷新数据
  const refresh = useCallback(() => {
    return execute();
  }, [execute]);

  // 重置状态
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: null,
      loading: false,
      error: null,
      success: false
    });
  }, []);

  // 立即执行（如果启用）
  useEffect(() => {
    if (initialOptions.immediate !== false) {
      execute();
    }

    // 清理函数
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // 只在组件挂载时执行

  return {
    ...state,
    execute,
    refresh,
    reset
  };
};

// 获取错误消息
const getErrorMessage = (error: Error): string => {
  if (error.message.includes('请求超时')) {
    return '请求超时，请检查网络连接后重试';
  }
  
  if (error.message.includes('Failed to fetch')) {
    return '网络连接失败，请检查网络后重试';
  }
  
  if (error.message.includes('HTTP 401')) {
    return '身份验证失败，请重新登录';
  }
  
  if (error.message.includes('HTTP 403')) {
    return '权限不足，无法执行此操作';
  }
  
  if (error.message.includes('HTTP 404')) {
    return '请求的资源不存在';
  }
  
  if (error.message.includes('HTTP 500')) {
    return '服务器内部错误，请稍后重试';
  }
  
  if (error.message.includes('HTTP 502') || error.message.includes('HTTP 503')) {
    return '服务暂时不可用，请稍后重试';
  }

  return error.message || '请求失败，请稍后重试';
};

export default useApiRequest;
export type { ApiRequestOptions, ApiRequestState, UseApiRequestReturn }; 