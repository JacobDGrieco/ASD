/**
 * Static fallback content for the About page, used by `api/public.js`'s
 * `getCompanyAbout` when the `CompanyProfile`/`CompanyMember` tables are missing
 * (Prisma error codes P2021/P2022 — i.e. a pre-migration deploy) or simply empty,
 * so the page never renders completely blank.
 */
export const COMPANY_LEADERS = [
	{
		id: 'alex-rivers',
		name: 'Alex Rivers',
		role: 'Founder / Executive Director',
		imageUrl: 'https://picsum.photos/seed/asd-founder-alex/720/720',
		blurb: 'Alex guides A.S.D. as an independent house for artists who need room to build a complete world around their releases. Their work spans artist development, release planning, and the long-term shape of the company.',
	},
	{
		id: 'mara-vale',
		name: 'Mara Vale',
		role: 'Creative Director',
		imageUrl: 'https://picsum.photos/seed/asd-founder-mara/720/720',
		blurb: 'Mara leads the visual language across music, fashion, campaigns, and live presentation. She connects the label sound to the imagery, styling, and editorial systems that make each project feel distinct.',
	},
	{
		id: 'theo-knox',
		name: 'Theo Knox',
		role: 'Head of Operations',
		imageUrl: 'https://picsum.photos/seed/asd-founder-theo/720/720',
		blurb: 'Theo keeps the company moving from backend systems to release logistics. His role is to make sure the creative side has the structure, timing, and production support it needs.',
	},
];

export const COMPANY_SUMMARY = {
	title: 'A.S.D. builds the world around independent artists.',
	description: 'A.S.D. is a music label, fashion vertical, and creative operations company for artists who move outside the expected lane. The company pairs releases, visuals, editorial work, and live-facing media into one connected platform.',
};

/** Resolves a display image URL for a company member, preferring a resolved `previewUrl` over the raw stored value. */
export function getCompanyMemberImage(member) {
	return member?.image?.previewUrl || member?.image?.url || member?.imageUrl || '';
}
