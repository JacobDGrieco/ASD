/**
 * Public legal-document route.
 *
 * Loads static third-party-generated HTML files from `public/legal/` and displays
 * them inside the site shell.
 */
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import '../styles/LegalPage.css';

export default function LegalPage({ title, documentSrc }) {
	return (
		<main className="page aurora-page legal-page">
			<AuroraBackground />
			<div className="aurora-page-content legal-page-content">
				<header className="legal-page-header">
					<h1>{title}</h1>
				</header>
				<section className="legal-page-document" aria-label={title}>
					<iframe
						className="legal-page-frame"
						src={documentSrc}
						title={title}
						sandbox=""
					/>
				</section>
			</div>
		</main>
	);
}
