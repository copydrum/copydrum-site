import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  canonicalUrl?: string;
  locale?: string;
}

const DEFAULT_TITLE = 'COPYDRUM | Drum Sheet Music Store';
const DEFAULT_DESCRIPTION = 'High-quality drum sheet music and drum scores for pop, rock, K-POP, CCM and more.';

export default function Seo({
  title,
  description,
  keywords,
  ogTitle,
  ogDescription,
  ogImageUrl,
  canonicalUrl,
  locale,
}: SeoProps) {
  // Use provided values or fallbacks
  const finalTitle = title || DEFAULT_TITLE;
  const finalDescription = description || DEFAULT_DESCRIPTION;
  const finalOgTitle = ogTitle || title || DEFAULT_TITLE;
  const finalOgDescription = ogDescription || description || DEFAULT_DESCRIPTION;
  const finalLocale = locale || 'en';
  
  // Build full canonical URL if only path provided
  let finalCanonicalUrl = canonicalUrl;
  if (canonicalUrl && !canonicalUrl.startsWith('http')) {
    const hostname = typeof window !== 'undefined' ? window.location.origin : '';
    finalCanonicalUrl = hostname ? `${hostname}${canonicalUrl}` : canonicalUrl;
  } else if (!finalCanonicalUrl && typeof window !== 'undefined') {
    finalCanonicalUrl = window.location.href.split('?')[0]; // Remove query params
  }

  // Build full OG image URL if only path provided
  let finalOgImageUrl = ogImageUrl;
  if (ogImageUrl && !ogImageUrl.startsWith('http')) {
    const hostname = typeof window !== 'undefined' ? window.location.origin : '';
    finalOgImageUrl = hostname ? `${hostname}${ogImageUrl}` : ogImageUrl;
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Canonical URL */}
      {finalCanonicalUrl && <link rel="canonical" href={finalCanonicalUrl} />}
      
      {/* Open Graph Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={finalOgTitle} />
      <meta property="og:description" content={finalOgDescription} />
      {finalOgImageUrl && <meta property="og:image" content={finalOgImageUrl} />}
      {finalCanonicalUrl && <meta property="og:url" content={finalCanonicalUrl} />}
      <meta property="og:site_name" content="COPYDRUM" />
      <meta property="og:locale" content={finalLocale} />
    </Helmet>
  );
}

