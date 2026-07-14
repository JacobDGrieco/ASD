import { Link } from 'react-router-dom';
import '../../styles/PublicLegalFooter.css';

const LEGAL_POLICIES = [
	{
		key: 'privacy',
		label: 'Privacy Policy',
		to: '/privacy-policy',
	},
];

export default function PublicLegalFooter({ variant = 'default' }) {
	const currentYear = new Date().getFullYear();

	return (
		<footer className={`public-legal public-legal--${variant}`} aria-label="Site legal">
			<nav className="public-legal-links" aria-label="Legal links">
				<a href="#" className="public-legal-link termly-display-preferences">Consent Preferences</a>
				{LEGAL_POLICIES.map((policy) => (
					<Link
						key={policy.key}
						className="public-legal-link"
						to={policy.to}
					>
						{policy.label}
					</Link>
				))}
			</nav>
			<p className="public-legal-copy">&copy; {currentYear} ASD Records | All site content &copy; respective artists | Built by HeadInTheCloudsHaven LLC</p>
		</footer>
	);
}
