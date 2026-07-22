/**
 * Admin route guards for authenticated, super-admin, and page-access-gated routes.
 */
import { Outlet, Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';

export default function AdminRoute() {
	const { loading, session } = useAdminAuth();
	if (loading) return null;
	return session ? <Outlet /> : <Navigate to="/admin/login" replace />;
}
