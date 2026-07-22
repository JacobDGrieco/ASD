import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminLoginPage.css';

export default function AdminLoginPage() {
	const { loading: authLoading, session, login } = useAdminAuth();
	const [password, setPassword] = useState('');
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);

	if (authLoading) return null;

	if (session) {
		return <Navigate to="/admin" replace />;
	}

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		try {
			await login(password);
		} catch {
			setError('Invalid password');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="admin-login-page-page">
			<div>
				<form className="admin-login-page-form" onSubmit={handleSubmit}>
					<h1 className="admin-login-page-title">ASD Admin</h1>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
						className="admin-login-page-input"
					/>
					{error && <p className="admin-login-page-error">{error}</p>}
					<button type="submit" disabled={loading} className="admin-login-page-button">
						{loading ? 'Entering…' : 'Enter'}
					</button>
				</form>
			</div>
		</div>
	);
}
