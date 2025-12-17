/**
 * Dynamic Sitemap Endpoint
 * 
 * This endpoint serves sitemap.xml for each language subdomain.
 * It detects the language from the Host header and generates
 * a locale-specific sitemap with actual page URLs.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Language to domain mapping (must match scripts/generate-sitemaps.ts)
const languageDomainMap: Record<string, string> = {
  ko: 'https://www.copydrum.com',
  en: 'https://en.copydrum.com',
  ja: 'https://jp.copydrum.com',
  de: 'https://de.copydrum.com',
  fr: 'https://fr.copydrum.com',
  es: 'https://es.copydrum.com',
  'zh-CN': 'https://zh-cn.copydrum.com',
  'zh-TW': 'https://zh-tw.copydrum.com',
  vi: 'https://vi.copydrum.com',
  id: 'https://id.copydrum.com',
  th: 'https://th.copydrum.com',
  pt: 'https://pt.copydrum.com',
  ru: 'https://ru.copydrum.com',
  ar: 'https://ar.copydrum.com',
  it: 'https://it.copydrum.com',
  nl: 'https://nl.copydrum.com',
  pl: 'https://pl.copydrum.com',
};

interface DrumSheet {
  id: string;
  updated_at: string | null;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
}

/**
 * Get locale from host header
 * Matches the logic from src/i18n/getLocaleFromHost.ts
 */
function getLocaleFromHost(host: string | undefined): string {
  if (!host) return 'ko';

  const normalizedHost = host.toLowerCase();
  const hostWithoutWww = normalizedHost.replace(/^www\./, '');

  if (hostWithoutWww === 'copydrum.com') return 'ko';
  if (hostWithoutWww.startsWith('en.')) return 'en';
  if (hostWithoutWww.startsWith('jp.') || hostWithoutWww.startsWith('ja.')) return 'ja';
  if (hostWithoutWww.startsWith('de.')) return 'de';
  if (hostWithoutWww.startsWith('es.')) return 'es';
  if (hostWithoutWww.startsWith('fr.')) return 'fr';
  if (hostWithoutWww.startsWith('hi.')) return 'hi';
  if (hostWithoutWww.startsWith('id.')) return 'id';
  if (hostWithoutWww.startsWith('it.')) return 'it';
  if (hostWithoutWww.startsWith('pt.')) return 'pt';
  if (hostWithoutWww.startsWith('ru.')) return 'ru';
  if (hostWithoutWww.startsWith('th.')) return 'th';
  if (hostWithoutWww.startsWith('tr.')) return 'tr';
  if (hostWithoutWww.startsWith('uk.')) return 'uk';
  if (hostWithoutWww.startsWith('vi.')) return 'vi';
  if (hostWithoutWww.startsWith('zh-cn.') || hostWithoutWww.startsWith('zhcn.')) return 'zh-CN';
  if (hostWithoutWww.startsWith('zh-tw.') || hostWithoutWww.startsWith('zhtw.')) return 'zh-TW';
  if (hostWithoutWww.startsWith('ar.')) return 'ar';
  if (hostWithoutWww.startsWith('nl.')) return 'nl';
  if (hostWithoutWww.startsWith('pl.')) return 'pl';

  return 'ko';
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format date for sitemap (YYYY-MM-DD)
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Generate a single URL entry
 */
function generateUrlEntry(
  url: string,
  lastmod?: string,
  changefreq: string = 'daily',
  priority: string = '0.8'
): string {
  let entry = '    <url>\n';
  entry += `      <loc>${escapeXml(url)}</loc>\n`;
  if (lastmod) {
    entry += `      <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
  }
  entry += `      <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
  entry += `      <priority>${escapeXml(priority)}</priority>\n`;
  entry += '    </url>\n';
  return entry;
}

/**
 * Generate sitemap for a single locale
 */
function generateLocaleSitemap(
  baseUrl: string,
  sheets: DrumSheet[],
  categories: Category[]
): string {
  // XML must start with <?xml declaration, no leading whitespace or comments
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage (priority 1.0)
  xml += generateUrlEntry(`${baseUrl}/`, undefined, 'daily', '1.0');

  // Categories main page
  xml += generateUrlEntry(`${baseUrl}/categories`, undefined, 'daily', '0.8');

  // Category pages with ID
  categories.forEach((category) => {
    const categoryUrl = `${baseUrl}/categories?category=${category.id}`;
    xml += generateUrlEntry(categoryUrl, undefined, 'daily', '0.8');
  });

  // Product detail pages (only active sheets)
  const activeSheets = sheets.filter((sheet) => sheet.is_active);
  activeSheets.forEach((sheet) => {
    const sheetUrl = `${baseUrl}/sheet-detail/${sheet.id}`;
    const lastmod = formatDate(sheet.updated_at);
    xml += generateUrlEntry(sheetUrl, lastmod, 'daily', '0.8');
  });

  // Policy page
  xml += generateUrlEntry(`${baseUrl}/policy/refund`, undefined, 'daily', '0.8');

  // About page
  xml += generateUrlEntry(`${baseUrl}/company/about`, undefined, 'daily', '0.8');

  xml += '</urlset>';
  return xml;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Get locale from Host header
    const host = req.headers.host;
    const locale = getLocaleFromHost(host);
    const baseUrl = languageDomainMap[locale] || languageDomainMap.ko;

    // Get Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing required environment variables');
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>Error</loc></url></urlset>');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch all drum sheets
    const { data: sheets, error: sheetsError } = await supabase
      .from('drum_sheets')
      .select('id, updated_at, is_active')
      .order('updated_at', { ascending: false });

    if (sheetsError) {
      console.error('Error fetching drum sheets:', sheetsError);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>Error</loc></url></urlset>');
    }

    // Fetch all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .order('name');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>Error</loc></url></urlset>');
    }

    // Generate sitemap
    const sitemapXml = generateLocaleSitemap(
      baseUrl,
      sheets || [],
      categories || []
    );

    // Return XML with proper headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(sitemapXml);
  } catch (error) {
    console.error('Fatal error:', error);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>Error</loc></url></urlset>');
  }
}

