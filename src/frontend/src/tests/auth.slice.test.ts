import authReducer, {
  login,
  logout,
  fetchCurrentUser,
  clearError,
  AuthState
} from '../store/auth.slice';
import { configureStore } from '@reduxjs/toolkit';
import authService from '../services/auth.service';

// 模拟authService
jest.mock('../services/auth.service');

describe('Auth Slice Tests', () => {
  let store: any;

  beforeEach(() => {
    // 重置mock
    jest.clearAllMocks();
    
    // 设置默认返回值
    (authService.getStoredUser as jest.Mock).mockReturnValue(null);
    (authService.isLoggedIn as jest.Mock).mockReturnValue(false);
    
    // 创建测试store
    store = configureStore({
      reducer: {
        auth: authReducer
      }
    });
  });

  test('初始状态', () => {
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBeFalsy();
    expect(state.isLoading).toBeFalsy();
    expect(state.error).toBeNull();
  });

  test('清除错误', () => {
    // 设置初始错误状态
    const initialState: AuthState = {
      user: null,
      isLoggedIn: false,
      isLoading: false,
      error: '测试错误'
    };
    
    store = configureStore({
      reducer: {
        auth: authReducer
      },
      preloadedState: {
        auth: initialState
      }
    });

    // 清除错误
    store.dispatch(clearError());
    
    // 验证错误已清除
    const state = store.getState().auth;
    expect(state.error).toBeNull();
  });

  test('登录成功', async () => {
    // 模拟登录成功
    const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', name: '测试用户', role: 'operator' };
    (authService.login as jest.Mock).mockResolvedValue({ 
      user: mockUser, 
      token: 'test-token' 
    });

    // 执行登录操作
    await store.dispatch(login({ usernameOrEmail: 'testuser', password: 'password123' }));
    
    // 验证状态更新
    const state = store.getState().auth;
    expect(state.user).toEqual(mockUser);
    expect(state.isLoggedIn).toBeTruthy();
    expect(state.isLoading).toBeFalsy();
    expect(state.error).toBeNull();
  });

  test('登录失败', async () => {
    // 模拟登录失败
    const errorMessage = '用户名或密码不正确';
    (authService.login as jest.Mock).mockRejectedValue({
      response: { data: { message: errorMessage } }
    });

    // 执行登录操作
    await store.dispatch(login({ usernameOrEmail: 'testuser', password: 'wrongpassword' }));
    
    // 验证状态更新
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBeFalsy();
    expect(state.isLoading).toBeFalsy();
    expect(state.error).toEqual(errorMessage);
  });

  test('登出功能', async () => {
    // 先设置登录状态
    const loggedInState: AuthState = {
      user: { id: '1', username: 'testuser', email: 'test@example.com', name: '测试用户', role: 'operator' },
      isLoggedIn: true,
      isLoading: false,
      error: null
    };
    
    store = configureStore({
      reducer: {
        auth: authReducer
      },
      preloadedState: {
        auth: loggedInState
      }
    });

    // 执行登出操作
    await store.dispatch(logout());
    
    // 验证登出后状态
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBeFalsy();
    
    // 验证authService.logout被调用
    expect(authService.logout).toHaveBeenCalled();
  });

  test('获取当前用户成功', async () => {
    // 模拟获取用户成功
    const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', name: '测试用户', role: 'operator' };
    (authService.getCurrentUser as jest.Mock).mockResolvedValue({ user: mockUser });

    // 执行获取当前用户操作
    await store.dispatch(fetchCurrentUser());
    
    // 验证状态更新
    const state = store.getState().auth;
    expect(state.user).toEqual(mockUser);
    expect(state.isLoggedIn).toBeTruthy();
    expect(state.isLoading).toBeFalsy();
  });

  test('获取当前用户失败', async () => {
    // 模拟获取用户失败
    (authService.getCurrentUser as jest.Mock).mockRejectedValue({
      response: { data: { message: '获取用户信息失败' } }
    });

    // 执行获取当前用户操作
    await store.dispatch(fetchCurrentUser());
    
    // 验证状态更新
    const state = store.getState().auth;
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBeFalsy();
    expect(state.isLoading).toBeFalsy();
  });
}); 