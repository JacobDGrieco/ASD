import {
	SiApplemusic,
	SiAudiomack,
	SiBandcamp,
	SiBluesky,
	SiDiscord,
	SiFacebook,
	SiGmail,
	SiInstagram,
	SiLinktree,
	SiPatreon,
	SiSnapchat,
	SiSoundcloud,
	SiSpotify,
	SiThreads,
	SiTidal,
	SiTiktok,
	SiTwitch,
	SiX,
	SiYoutube,
	SiYoutubemusic,
} from 'react-icons/si';

const PLATFORM_ICONS = {
	appleMusic: SiApplemusic,
	audiomack: SiAudiomack,
	bandcamp: SiBandcamp,
	bluesky: SiBluesky,
	discord: SiDiscord,
	email: SiGmail,
	facebook: SiFacebook,
	instagram: SiInstagram,
	linktree: SiLinktree,
	patreon: SiPatreon,
	snapchat: SiSnapchat,
	soundcloud: SiSoundcloud,
	spotify: SiSpotify,
	threads: SiThreads,
	tidal: SiTidal,
	tiktok: SiTiktok,
	twitch: SiTwitch,
	website: SiLinktree,
	x: SiX,
	youtube: SiYoutube,
	youtubeMusic: SiYoutubemusic,
};

export default function ProfileLinkIcon({ platform, ...props }) {
	const Icon = PLATFORM_ICONS[platform] ?? SiLinktree;
	return <Icon {...props} />;
}
