/**
 * Multi-Language Sitemap Generation Script
 * 
 * Generates sitemap-index.xml and 17 language-specific sitemap files.
 * 
 * Output structure:
 *   /out/sitemap-index.xml
 *   /out/sitemap/ko.xml
 *   /out/sitemap/en.xml
 *   ... (17 languages)
 * 
 * Each sitemap includes:
 *   - Homepage (/)
 *   - Categories page (/categories)
 *   - Category pages with ID (/categories?category={id})
 *   - Product detail pages (/sheet-detail/{id})
 *   - Policy page (/policy/refund)
 *   - About page (/company/about)
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run generate:sitemaps
 * 
 * This script runs automatically after build via postbuild hook.
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 17 languages with their domains
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

const LOCALES = Object.keys(languageDomainMap);

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
  locale: string,
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

/**
 * Generate sitemap index
 */
function generateSitemapIndex(): string {
  // XML must start with <?xml declaration, no leading whitespace or comments
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  const today = formatDate(new Date().toISOString());

  LOCALES.forEach((locale) => {
    const baseUrl = languageDomainMap[locale];
    if (!baseUrl) return;

    // Use /sitemap/{locale}.xml format
    const sitemapUrl = `${baseUrl}/sitemap/${locale}.xml`;
    xml += '  <sitemap>\n';
    xml += `    <loc>${escapeXml(sitemapUrl)}</loc>\n`;
    xml += `    <lastmod>${escapeXml(today)}</lastmod>\n`;
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

  // Output directory (Vite builds to 'out' directory)
  const outDir = join(__dirname, '..', 'out');
  const sitemapDir = join(outDir, 'sitemap');

  // Create sitemap directory if it doesn't exist
  try {
    mkdirSync(sitemapDir, { recursive: true });
    console.log(`Created directory: ${sitemapDir}`);
  } catch (error) {
    // Directory might already exist, that's okay
    console.log(`Directory exists: ${sitemapDir}`);
  }

  // Generate sitemaps for each locale
  console.log('\nGenerating locale sitemaps...');
  for (const locale of LOCALES) {
    const baseUrl = languageDomainMap[locale];
    if (!baseUrl) {
      console.warn(`  ⚠ Skipping ${locale}: no domain mapping`);
      continue;
    }

    console.log(`  Generating sitemap for ${locale} (${baseUrl})...`);
    const sitemapXml = generateLocaleSitemap(locale, baseUrl, sheets || [], categories || []);
    const filename = join(sitemapDir, `${locale}.xml`);
    writeFileSync(filename, sitemapXml, 'utf-8');
    console.log(`    ✓ Wrote ${filename}`);
  }

  // Generate sitemap index
  console.log('\nGenerating sitemap index...');
  const indexXml = generateSitemapIndex();
  const indexFilename = join(outDir, 'sitemap-index.xml');
  writeFileSync(indexFilename, indexXml, 'utf-8');
  console.log(`  ✓ Wrote ${indexFilename}`);

  console.log('\n✅ Sitemap generation complete!');
  console.log(`\nGenerated files:`);
  console.log(`  - ${indexFilename} (index)`);
  LOCALES.forEach((locale) => {
    console.log(`  - ${join(sitemapDir, `${locale}.xml`)}`);
  });
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
