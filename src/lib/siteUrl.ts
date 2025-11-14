export const getSiteUrl = () => {
  const url = import.meta.env.VITE_PUBLIC_SITE_URL ?? 'https://copydrum.com';
  return url.replace(/\/$/, '');
};
