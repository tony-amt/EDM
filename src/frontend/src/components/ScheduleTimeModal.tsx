import React, { useState } from 'react';
import { Modal, Radio, DatePicker, Space, message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

interface ScheduleTimeModalProps {
  visible: boolean;
  onOk: (scheduleTime: string, isImmediate: boolean) => void;
  onCancel: () => void;
  title?: string;
}

const ScheduleTimeModal: React.FC<ScheduleTimeModalProps> = ({
  visible,
  onOk,
  onCancel,
  title = '设置计划发送时间'
}) => {
  const [sendType, setSendType] = useState<'immediate' | 'delayed'>('immediate');
  const [scheduleTime, setScheduleTime] = useState<Dayjs | null>(null);

  const handleOk = () => {
    if (sendType === 'immediate') {
      // 立即发送：当前时间+10秒，转换为ISO格式（UTC时间）
      const immediateTime = dayjs().add(10, 'seconds').toISOString();
      onOk(immediateTime, true);
    } else {
      // 延迟发送：检查时间有效性
      if (!scheduleTime) {
        message.error('请选择发送时间');
        return;
      }
      
      // 🔧 时区处理：确保使用本地时间
      const now = dayjs();
      if (scheduleTime.isBefore(now)) {
        message.error('计划时间不能早于当前时间，请重新设置');
        return;
      }
      
      // 转换为ISO格式（UTC时间），后端会正确处理
      const delayedTime = scheduleTime.toISOString();
      onOk(delayedTime, false);
    }
  };

  const handleCancel = () => {
    // 重置状态
    setSendType('immediate');
    setScheduleTime(null);
    onCancel();
  };

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="确认"
      cancelText="取消"
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Radio.Group 
          value={sendType} 
          onChange={(e) => setSendType(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Radio value="immediate">
              <strong>立即发送</strong>
              <div style={{ color: '#666', fontSize: '12px', marginLeft: '24px' }}>
                任务将在10秒后开始执行
              </div>
            </Radio>
            
            <Radio value="delayed">
              <strong>延迟发送</strong>
              <div style={{ color: '#666', fontSize: '12px', marginLeft: '24px' }}>
                选择具体的发送时间
              </div>
            </Radio>
          </Space>
        </Radio.Group>

        {sendType === 'delayed' && (
          <div style={{ marginLeft: '24px', marginTop: '16px' }}>
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择发送时间"
              style={{ width: '100%' }}
              value={scheduleTime}
              onChange={setScheduleTime}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
              disabledTime={(current) => {
                if (!current) return {};
                
                const now = dayjs();
                if (current.isSame(now, 'day')) {
                  return {
                    disabledHours: () => {
                      const hours = [];
                      for (let i = 0; i < now.hour(); i++) {
                        hours.push(i);
                      }
                      return hours;
                    },
                    disabledMinutes: (selectedHour: number) => {
                      if (selectedHour === now.hour()) {
                        const minutes = [];
                        for (let i = 0; i <= now.minute(); i++) {
                          minutes.push(i);
                        }
                        return minutes;
                      }
                      return [];
                    }
                  };
                }
                return {};
              }}
            />
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default ScheduleTimeModal; 