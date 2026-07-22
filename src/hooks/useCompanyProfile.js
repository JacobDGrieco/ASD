/**
 * Public company-profile hook used by shared footer/about surfaces.
 *
 * Wraps `useApi` around the `/api/public?resource=about` payload so consumers can
 * read the singleton profile and member list without duplicating endpoint details.
 */
import { useApi } from './useApi.js';
import { COMPANY_LEADERS, COMPANY_SUMMARY } from '../lib/companyProfile.js';

const ABOUT_API_URL = '/api/public?resource=about';

export function useCompanyProfile() {
	const { data, loading, error } = useApi(ABOUT_API_URL);

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
