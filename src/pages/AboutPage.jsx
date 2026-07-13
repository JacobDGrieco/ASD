import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import { useCompanyProfile } from '../hooks/useCompanyProfile.js';
import { getCompanyMemberImage } from '../lib/companyProfile.js';
import '../styles/AboutPage.css';

export default function AboutPage() {
	const { summary, members, loading } = useCompanyProfile();

	if (loading) {
		return (
			<div className="page aurora-page about-page about-page-loading" aria-busy="true">
				<AuroraBackground />
			</div>
		);
	}

	return (
		<div className="page aurora-page about-page">
			<AuroraBackground />
			<div className="aurora-page-content about-page-content">
				<header className="about-hero">
					<h1>{summary.title}</h1>
					<p>{summary.description}</p>
				</header>

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
