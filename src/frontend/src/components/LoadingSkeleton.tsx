import React from 'react';
import { Skeleton, Card, Row, Col } from 'antd';

interface LoadingSkeletonProps {
  type?: 'table' | 'cards' | 'form' | 'dashboard' | 'detail';
  rows?: number;
  columns?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'table', 
  rows = 5,
  columns = 4 
}) => {
  const renderTableSkeleton = () => (
    <div>
      {/* 表格头部骨架 */}
      <div style={{ marginBottom: 16 }}>
        <Skeleton.Button style={{ width: 100, marginRight: 8 }} />
        <Skeleton.Button style={{ width: 100, marginRight: 8 }} />
        <Skeleton.Button style={{ width: 100 }} />
      </div>
      
      {/* 表格行骨架 */}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 8
        }}>
          <Row gutter={16}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Col key={colIndex} span={24 / columns}>
                <Skeleton.Input style={{ width: '100%', height: 20 }} />
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );

  const renderCardsSkeleton = () => (
    <Row gutter={[16, 16]}>
      {Array.from({ length: rows * 2 }).map((_, index) => (
        <Col key={index} span={12}>
          <Card>
            <Skeleton
              loading={true}
              avatar
              active
              paragraph={{ rows: 2 }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderFormSkeleton = () => (
    <div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} style={{ marginBottom: 24 }}>
          <Skeleton.Input style={{ width: 100, marginBottom: 8 }} />
          <Skeleton.Input style={{ width: '100%', height: 32 }} />
        </div>
      ))}
      <div style={{ textAlign: 'right', marginTop: 24 }}>
        <Skeleton.Button style={{ width: 80, marginRight: 8 }} />
        <Skeleton.Button style={{ width: 80 }} />
      </div>
    </div>
  );

  const renderDashboardSkeleton = () => (
    <div>
      {/* 统计卡片骨架 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Col key={index} span={6}>
            <Card>
              <Skeleton
                loading={true}
                active
                paragraph={{ rows: 1 }}
                title={{ width: '60%' }}
              />
            </Card>
          </Col>
        ))}
      </Row>
      
      {/* 图表骨架 */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title={<Skeleton.Input style={{ width: 150 }} />}>
            <Skeleton.Image style={{ width: '100%', height: 200 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<Skeleton.Input style={{ width: 150 }} />}>
            <Skeleton.Image style={{ width: '100%', height: 200 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderDetailSkeleton = () => (
    <div>
      {/* 详情头部 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={16}>
            <Skeleton
              loading={true}
              active
              paragraph={{ rows: 3 }}
              title={{ width: '40%' }}
            />
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'right' }}>
              <Skeleton.Button style={{ width: 80, marginRight: 8 }} />
              <Skeleton.Button style={{ width: 80 }} />
            </div>
          </Col>
        </Row>
      </Card>

      {/* 详情内容 */}
      <Card>
        <Skeleton
          loading={true}
          active
          paragraph={{ rows: 8 }}
          title={{ width: '30%' }}
        />
      </Card>
    </div>
  );

  switch (type) {
    case 'table':
      return renderTableSkeleton();
    case 'cards':
      return renderCardsSkeleton();
    case 'form':
      return renderFormSkeleton();
    case 'dashboard':
      return renderDashboardSkeleton();
    case 'detail':
      return renderDetailSkeleton();
    default:
      return <Skeleton loading={true} active />;
  }
};

export default LoadingSkeleton; 