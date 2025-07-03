import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Table, Spin } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';

interface VirtualTableProps<T> extends Omit<TableProps<T>, 'dataSource' | 'pagination'> {
  dataSource: T[];
  height: number;
  itemHeight?: number;
  overscan?: number;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const VirtualTable = <T extends Record<string, any>>({
  dataSource,
  columns,
  height,
  itemHeight = 54,
  overscan = 5,
  loading = false,
  onLoadMore,
  hasMore = false,
  ...tableProps
}: VirtualTableProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(height);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  // 计算可见项目范围
  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount + overscan, dataSource.length);
    
    return {
      start: Math.max(0, start - overscan),
      end,
      visibleCount
    };
  }, [scrollTop, containerHeight, itemHeight, overscan, dataSource.length]);

  // 计算虚拟化数据
  const virtualData = useMemo(() => {
    return dataSource.slice(visibleRange.start, visibleRange.end);
  }, [dataSource, visibleRange.start, visibleRange.end]);

  // 计算总高度和偏移量
  const totalHeight = dataSource.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setScrollTop(scrollTop);

    // 检查是否需要加载更多数据
    if (
      onLoadMore &&
      hasMore &&
      !loading &&
      !loadingRef.current &&
      scrollTop + clientHeight >= scrollHeight - 100
    ) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loading]);

  // 重置加载状态
  useEffect(() => {
    if (!loading) {
      loadingRef.current = false;
    }
  }, [loading]);

  // 监听容器大小变化
  useEffect(() => {
    const handleResize = () => {
      if (scrollElementRef.current) {
        setContainerHeight(scrollElementRef.current.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (scrollElementRef.current) {
      resizeObserver.observe(scrollElementRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 自定义行渲染
  const customRow = (record: T, index: number) => {
    const actualIndex = visibleRange.start + index;
    return {
      style: {
        height: itemHeight,
        boxSizing: 'border-box' as const,
      },
      'data-row-key': record.key || actualIndex,
    };
  };

  return (
    <div
      ref={scrollElementRef}
      style={{
        height,
        overflow: 'auto',
        border: '1px solid #f0f0f0',
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <Table
            {...tableProps}
            columns={columns}
            dataSource={virtualData}
            pagination={false}
            scroll={{ y: undefined }}
            onRow={(record: T, index?: number) => ({
              style: {
                height: itemHeight,
                boxSizing: 'border-box' as const,
              },
              'data-row-key': record.key || (index !== undefined ? visibleRange.start + index : 0),
            })}
            size="small"
            showHeader={visibleRange.start === 0}
          />
        </div>

        {/* 固定表头 */}
        {visibleRange.start > 0 && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              backgroundColor: '#fafafa',
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            <Table
              columns={columns}
              dataSource={[]}
              pagination={false}
              showHeader={true}
              size="small"
            />
          </div>
        )}

        {/* 加载更多指示器 */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '20px',
              textAlign: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            <Spin size="small" />
            <span style={{ marginLeft: 8 }}>加载中...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VirtualTable; 