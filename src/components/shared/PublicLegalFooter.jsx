/**
 * Public footer with links to the static legal document routes.
 */
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
	return (
		<footer className={`public-legal public-legal--${variant}`} aria-label="Site legal" hidden>
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
			<p className="public-legal-copy">© {new Date().getFullYear()} A.S.D | All site content © respective creators | Website built by {' '}
				<a href="https://www.headinthecloudshaven.com">HeadInTheCloudsHaven LLC</a>
			</p>
		</footer>
	);
}
