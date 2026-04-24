import { Outlet, Navigate } from 'react-router-dom'
import { useAdminAuth } from '../../lib/adminAuth.jsx'

export default function AdminRoute() {
  const { token } = useAdminAuth()
  return token ? <Outlet /> : <Navigate to="/admin/login" replace />
}
