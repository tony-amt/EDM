import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Spin } from 'antd';
import { RootState } from '../store';
import { fetchCurrentUser } from '../store/auth.slice';
import authService from '../services/auth.service';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { isLoggedIn, user, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!user && authService.isLoggedIn()) {
      dispatch(fetchCurrentUser() as any);
    }
  }, [dispatch, user]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!isLoggedIn) {
    // 保存当前URL，登录后重定向回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果指定了角色限制，检查用户角色
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute; 