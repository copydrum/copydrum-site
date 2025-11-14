const envSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');

export const getSiteUrl = (): string => {
  if (envSiteUrl) {
    return normalizeUrl(envSiteUrl);
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return normalizeUrl(window.location.origin);
  }

  return 'http://localhost:5173';
};

