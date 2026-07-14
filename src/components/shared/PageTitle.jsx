import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatPageTitle } from '../../lib/pageTitle.js';

const EXACT_ROUTE_TITLES = {
	'/': [],
	'/music': ['Music'],
	'/about': ['About Us'],
	'/board': ['The Board'],
	'/shelf': ['The Shelf'],
	'/crosshair': ['The Crosshair'],
	'/fashion': ['Fashion'],
	'/fashion/talent': ['The Talent'],
	'/fashion/catalogue': ['The Catalogue'],
	'/terms-of-service': ['Terms of Service'],
	'/privacy-policy': ['Privacy Policy'],
	'/admin/login': ['Admin Login'],
	'/admin': ['Admin'],
	'/admin/accounts': ['Accounts', 'Admin'],
	'/admin/about': ['About', 'Admin'],
	'/admin/artists': ['Artists', 'Music', 'Admin'],
	'/admin/outside-artists': ['Outside Artists', 'Music', 'Admin'],
	'/admin/albums': ['Albums', 'Music', 'Admin'],
	'/admin/board': ['The Board', 'Admin'],
	'/admin/crosshair': ['The Crosshair', 'Music', 'Admin'],
	'/admin/songs': ['Songs', 'Music', 'Admin'],
	'/admin/record-player': ['Record Player', 'Music', 'Admin'],
	'/admin/fashion/talent': ['Talent', 'Fashion', 'Admin'],
	'/admin/fashion/outside_talent': ['Outside Talent', 'Fashion', 'Admin'],
	'/admin/fashion/looks': ['Looks', 'Fashion', 'Admin'],
	'/admin/fashion/collections': ['Collections', 'Fashion', 'Admin'],
};

const DYNAMIC_ROUTE_PREFIXES = [
	'/artists/',
	'/albums/',
	'/songs/',
	'/fashion/talent/',
	'/fashion/looks/',
	'/fashion/collections/',
	'/admin/lyrics/',
];

function getRouteTitleParts(pathname) {
	if (Object.prototype.hasOwnProperty.call(EXACT_ROUTE_TITLES, pathname)) {
		return EXACT_ROUTE_TITLES[pathname];
	}

	if (DYNAMIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return null;
	}

	return ['Not Found'];
}

export default function PageTitle() {
	const { pathname } = useLocation();

	useEffect(() => {
		const titleParts = getRouteTitleParts(pathname);
		if (titleParts === null) return;

		document.title = formatPageTitle(titleParts);
	}, [pathname]);

	return null;
}
