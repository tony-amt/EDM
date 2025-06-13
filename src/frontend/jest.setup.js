// 添加DOM断言匹配器
import '@testing-library/jest-dom';

// 模拟文件和样式导入
global.__mocks__ = {
  fileMock: 'test-file-stub',
  styleMock: {}
};

// 模拟浏览器环境中的一些全局变量
global.matchMedia = global.matchMedia || function() {
  return {
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
};

// 模拟ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverMock; 