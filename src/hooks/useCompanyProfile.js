import { useMemo } from 'react';
import { useApi } from './useApi.js';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { COMPANY_LEADERS, COMPANY_SUMMARY } from '../lib/companyProfile.js';
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js';

const ABOUT_API_URL = '/api/public?resource=about';

export function useCompanyProfile() {
	const { session, token } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);
	const headers = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token]);
	const { data, loading, error } = useApi(ABOUT_API_URL, {
		headers,
		cacheKey: publicPreviewCacheKey(ABOUT_API_URL, adminPreview),
	});

	return {
		summary: {
			...COMPANY_SUMMARY,
			title: data?.profile?.title ?? COMPANY_SUMMARY.title,
			description: data?.profile?.bio ?? COMPANY_SUMMARY.description,
		},
		members: data ? (data.members ?? []) : COMPANY_LEADERS,
		loading,
		error,
	};
}
