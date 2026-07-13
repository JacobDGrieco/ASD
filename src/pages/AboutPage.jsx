import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';
import { getCompanyMemberImage } from '../lib/companyProfile.js';
import '../styles/AboutPage.css';

export default function AboutPage() {
	const { summary, members } = useCompanyProfile();

	return (
		<div className="page aurora-page about-page">
			<AuroraBackground />
			<div className="aurora-page-content about-page-content">
				<header className="about-hero">
					<h1>{summary.title}</h1>
					<p>{summary.description}</p>
				</header>

				<section className="about-company" aria-labelledby="about-company-title">
					<div className="about-company-label">Company</div>
					<div className="about-company-copy">
						<h2 id="about-company-title">A label, a fashion desk, and a creative system.</h2>
						<p>
							The company exists to give independent artists a sharper infrastructure: release strategy, music presentation,
							visual direction, fashion storytelling, and a home for the work after launch. ASD is built around people, not lanes.
						</p>
					</div>
				</section>

				<section className="about-leadership" aria-label="Leadership">
					{members.map((leader, index) => {
						const imageSrc = getCompanyMemberImage(leader);

						return (
							<article
								key={leader.id}
								className={`about-leader ${index % 2 === 1 ? 'about-leader-reverse' : ''}`}
							>
								<div className="about-leader-image-wrap">
									{imageSrc ? (
										<img src={imageSrc} alt={`${leader.name}, ${leader.role}`} className="about-leader-image" />
									) : null}
								</div>
								<div className="about-leader-copy">
									<p className="about-leader-role">{leader.role}</p>
									<h2>{leader.name}</h2>
									<p>{leader.bio ?? leader.blurb}</p>
								</div>
							</article>
						);
					})}
				</section>
			</div>
		</div>
	);
}
