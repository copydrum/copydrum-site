/**
 * Sitemap Generation Script
 * 
 * This script generates XML sitemaps for all 17 locales including:
 * - Home pages
 * - Categories main page
 * - Category-specific pages
 * - Product detail pages
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run generate:sitemaps
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Language domain mapping - must match src/config/languageDomainMap.ts
const languageDomainMap: Record<string, string> = {
  ko: 'https://copydrum.com',
  en: 'https://en.copydrum.com',
  ja: 'https://jp.copydrum.com',
  de: 'https://de.copydrum.com',
  es: 'https://es.copydrum.com',
  fr: 'https://fr.copydrum.com',
  hi: 'https://hi.copydrum.com',
  id: 'https://id.copydrum.com',
  it: 'https://it.copydrum.com',
  pt: 'https://pt.copydrum.com',
  ru: 'https://ru.copydrum.com',
  th: 'https://th.copydrum.com',
  tr: 'https://tr.copydrum.com',
  uk: 'https://uk.copydrum.com',
  vi: 'https://vi.copydrum.com',
  'zh-CN': 'https://zh-cn.copydrum.com',
  'zh-TW': 'https://zh-tw.copydrum.com',
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
 * Format date for sitemap (YYYY-MM-DD or ISO 8601)
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
 * Generate sitemap XML for a single URL
 */
function generateUrlEntry(url: string, lastmod?: string, changefreq?: string, priority?: string): string {
  let entry = '    <url>\n';
  entry += `      <loc>${escapeXml(url)}</loc>\n`;
  if (lastmod) {
    entry += `      <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
  }
  if (changefreq) {
    entry += `      <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
  }
  if (priority) {
    entry += `      <priority>${escapeXml(priority)}</priority>\n`;
  }
  entry += '    </url>\n';
  return entry;
}

/**
 * Generate sitemap for a single locale
 */
function generateLocaleSitemap(
  locale: string,
  baseUrl: string,
  sheets: DrumSheet[],
  categories: Category[]
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Home page
  xml += generateUrlEntry(`${baseUrl}/`, undefined, 'daily', '1.0');

  // Categories main page
  xml += generateUrlEntry(`${baseUrl}/categories`, undefined, 'weekly', '0.8');

  // Category-specific pages
  categories.forEach((category) => {
    const categoryUrl = `${baseUrl}/categories?category=${category.id}`;
    xml += generateUrlEntry(categoryUrl, undefined, 'weekly', '0.7');
  });

  // Product detail pages (only active sheets)
  const activeSheets = sheets.filter((sheet) => sheet.is_active);
  activeSheets.forEach((sheet) => {
    const sheetUrl = `${baseUrl}/sheet-detail/${sheet.id}`;
    const lastmod = formatDate(sheet.updated_at);
    xml += generateUrlEntry(sheetUrl, lastmod, 'monthly', '0.6');
  });

  xml += '</urlset>';
  return xml;
}

/**
 * Generate sitemap index
 */
function generateSitemapIndex(locales: string[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  locales.forEach((locale) => {
    const baseUrl = languageDomainMap[locale];
    if (!baseUrl) return;

    const sitemapUrl = `${baseUrl}/sitemap-${locale}.xml`;
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sitemapUrl)}</loc>\n`;
    xml += `    <lastmod>${formatDate(new Date().toISOString())}</lastmod>\n`;
    xml += '  </sitemap>\n';
  });

  xml += '</sitemapindex>';
  return xml;
}

/**
 * Main function
 */
async function main() {
  // Read environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Error: Missing required environment variables');
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Fetch all drum sheets
  console.log('Fetching drum sheets...');
  const { data: sheets, error: sheetsError } = await supabase
    .from('drum_sheets')
    .select('id, updated_at, is_active')
    .order('updated_at', { ascending: false });

  if (sheetsError) {
    console.error('Error fetching drum sheets:', sheetsError);
    process.exit(1);
  }

  console.log(`Found ${sheets?.length || 0} drum sheets`);

  // Fetch all categories
  console.log('Fetching categories...');
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError);
    process.exit(1);
  }

  console.log(`Found ${categories?.length || 0} categories`);

  // Generate sitemaps for each locale
  const publicDir = join(__dirname, '..', 'public');
  const locales = Object.keys(languageDomainMap);

  console.log('\nGenerating locale sitemaps...');
  for (const locale of locales) {
    const baseUrl = languageDomainMap[locale];
    if (!baseUrl) continue;

    console.log(`  Generating sitemap for ${locale} (${baseUrl})...`);
    const sitemapXml = generateLocaleSitemap(locale, baseUrl, sheets || [], categories || []);
    const filename = join(publicDir, `sitemap-${locale}.xml`);
    writeFileSync(filename, sitemapXml, 'utf-8');
    console.log(`    ✓ Wrote ${filename}`);
  }

  // Generate sitemap index
  console.log('\nGenerating sitemap index...');
  const indexXml = generateSitemapIndex(locales);
  const indexFilename = join(publicDir, 'sitemap.xml');
  writeFileSync(indexFilename, indexXml, 'utf-8');
  console.log(`  ✓ Wrote ${indexFilename}`);

  console.log('\n✅ Sitemap generation complete!');
  console.log(`\nGenerated files:`);
  console.log(`  - ${indexFilename} (index)`);
  locales.forEach((locale) => {
    console.log(`  - ${join(publicDir, `sitemap-${locale}.xml`)}`);
  });
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

