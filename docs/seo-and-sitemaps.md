# SEO and Sitemaps Documentation

## Overview

This document describes the SEO infrastructure for COPYDRUM, including meta tag management, localized SEO templates, and sitemap generation for all 17 language locales.

## SEO Component

### Location
`src/components/Seo.tsx`

### Usage

The `<Seo>` component is a reusable component that sets `<title>`, meta tags, and Open Graph tags for each page.

```tsx
import Seo from '../../components/Seo';

<Seo
  title="Page Title"
  description="Page description"
  keywords="keyword1, keyword2"
  ogTitle="OG Title"
  ogDescription="OG Description"
  ogImageUrl="https://example.com/image.jpg"
  canonicalUrl="https://example.com/page"
  locale="en"
/>
```

### Props

- `title` (optional): Page title (defaults to "COPYDRUM | Drum Sheet Music Store")
- `description` (optional): Meta description (defaults to generic description)
- `keywords` (optional): Meta keywords
- `ogTitle` (optional): Open Graph title (defaults to `title`)
- `ogDescription` (optional): Open Graph description (defaults to `description`)
- `ogImageUrl` (optional): Open Graph image URL
- `canonicalUrl` (optional): Canonical URL (auto-detected from current URL if not provided)
- `locale` (optional): Locale code for `og:locale` (defaults to 'en')

### Important Notes

- The `<Seo>` component **only handles** title, meta tags, and Open Graph tags
- **Hreflang tags** are handled separately by the existing `<HreflangTags>` component in `src/components/common/HreflangTags.tsx`
- Do not duplicate hreflang functionality in the `<Seo>` component

## i18n SEO Templates

### Location
`src/i18n/locales/{locale}/seo.json`

### Structure

Each locale has a `seo.json` file with the following keys:

```json
{
  "detailTitle": "{{title}} – {{artist}} | Drum Sheet Music PDF | COPYDRUM",
  "detailDescription": "Download the drum sheet music for {{title}} by {{artist}}. High-quality PDF, instant download. {{genre}} drum score, {{pages}} pages, {{bpm}} BPM, {{difficulty}} level.",
  "detailKeywords": "{{title}}, {{artist}}, drum sheet music, drum score, drum transcription, COPYDRUM",
  "homeTitle": "COPYDRUM | Drum Sheet Music Store",
  "homeDescription": "High-quality drum sheet music and drum scores for pop, rock, K-POP, CCM and more.",
  "categoryTitle": "{{category}} Drum Sheet Music | COPYDRUM",
  "categoryDescription": "Download drum sheet music for {{category}} songs in PDF format."
}
```

### Placeholders

- `{{title}}`: Sheet title
- `{{artist}}`: Sheet artist
- `{{genre}}`: Sheet category/genre
- `{{pages}}`: Number of pages
- `{{bpm}}`: Tempo in BPM
- `{{difficulty}}`: Difficulty level (translated)
- `{{category}}`: Category name

### Supported Locales

All 17 locales have `seo.json` files:
- `ko` (Korean)
- `en` (English)
- `ja` (Japanese)
- `de` (German)
- `es` (Spanish)
- `fr` (French)
- `hi` (Hindi)
- `id` (Indonesian)
- `it` (Italian)
- `pt` (Portuguese)
- `ru` (Russian)
- `th` (Thai)
- `tr` (Turkish)
- `uk` (Ukrainian)
- `vi` (Vietnamese)
- `zh-CN` (Simplified Chinese)
- `zh-TW` (Traditional Chinese)

**Note:** Currently, all locales except `ko` and `en` contain English placeholders. These should be translated by native speakers for each language.

### Accessing SEO Strings

The i18n system automatically loads `seo.json` files, so you can access them via:

```tsx
const { t } = useTranslation();
const title = t('seo.detailTitle'); // Uses current locale
```

## SEO Helper Functions

### Location
`src/lib/seo.ts`

### Functions

#### `buildDetailSeoStrings(sheet, t)`

Builds SEO strings for a drum sheet detail page.

```tsx
import { buildDetailSeoStrings } from '../../lib/seo';

const seoStrings = buildDetailSeoStrings(sheet, t);
// Returns: { title, description, keywords }
```

This function:
- Loads templates from i18n (`seo.detailTitle`, `seo.detailDescription`, `seo.detailKeywords`)
- Replaces placeholders with actual sheet data
- Handles difficulty level translation

#### `buildCategorySeoStrings(categoryName, t)`

Builds SEO strings for a category page.

```tsx
import { buildCategorySeoStrings } from '../../lib/seo';

const seoStrings = buildCategorySeoStrings(categoryName, t);
// Returns: { title, description }
```

## Pages with SEO

### Product Detail Page
**File:** `src/pages/sheet-detail/page.tsx`

- Uses `buildDetailSeoStrings()` to generate localized SEO strings
- Includes sheet thumbnail as OG image
- Sets canonical URL based on current locale domain

### Home Page
**File:** `src/pages/home/page.tsx`

- Uses `seo.homeTitle` and `seo.homeDescription` from i18n
- Sets canonical URL to home page

### Categories Page
**File:** `src/pages/categories/page.tsx`

- Uses `buildCategorySeoStrings()` if a category is selected
- Falls back to generic category page title/description
- Includes category ID in canonical URL query parameter if applicable

## Sitemap Generation

### Script Location
`scripts/generate-sitemaps.ts`

### Usage

```bash
SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key npm run generate:sitemaps
```

Or set environment variables in `.env` file (ensure it's in `.gitignore`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### What It Generates

1. **Root sitemap index** (`public/sitemap.xml`)
   - Links to all 17 locale-specific sitemaps

2. **Locale sitemaps** (`public/sitemap-{locale}.xml`)
   - Home page (`/`)
   - Categories main page (`/categories`)
   - Category-specific pages (`/categories?category={id}`)
   - Product detail pages (`/sheet-detail/{id}`)

### Generated Files

- `public/sitemap.xml` (index)
- `public/sitemap-ko.xml`
- `public/sitemap-en.xml`
- `public/sitemap-ja.xml`
- ... (one for each of 17 locales)

### When to Run

- **Before deployment**: Generate sitemaps before deploying to production
- **After bulk updates**: Regenerate after adding/updating many sheets
- **Scheduled**: Consider running on a schedule (daily/weekly) to keep sitemaps fresh

### CI/CD Integration

Add to your deployment pipeline:

```yaml
# Example GitHub Actions step
- name: Generate Sitemaps
  run: npm run generate:sitemaps
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## robots.txt

### Location
`public/robots.txt`

### Contents

- Allows all crawlers (`User-agent: *`, `Allow: /`)
- Lists all 17 locale sitemaps

The robots.txt is automatically served from the `public` folder and should be accessible at:
- `https://copydrum.com/robots.txt`
- `https://en.copydrum.com/robots.txt`
- etc.

## Adding SEO to New Pages

1. Import the `<Seo>` component
2. Import helper functions if needed (`buildDetailSeoStrings`, `buildCategorySeoStrings`)
3. Build SEO strings using i18n templates or helpers
4. Determine canonical URL (use `languageDomainMap` for locale domains)
5. Render `<Seo>` component near the top of your component

Example:

```tsx
import Seo from '../../components/Seo';
import { languageDomainMap } from '../../config/languageDomainMap';

function MyPage() {
  const { i18n, t } = useTranslation();
  const baseUrl = languageDomainMap[i18n.language as keyof typeof languageDomainMap] || window.location.origin;
  
  return (
    <div>
      <Seo
        title={t('myPage.title')}
        description={t('myPage.description')}
        canonicalUrl={`${baseUrl}/my-page`}
        locale={i18n.language}
      />
      {/* Rest of page */}
    </div>
  );
}
```

## Adding New Languages

1. Add locale entry to `src/config/languageDomainMap.ts`
2. Create `src/i18n/locales/{locale}/seo.json` with SEO templates
3. Copy English templates as placeholders if needed
4. Translate templates with native speakers
5. Regenerate sitemaps to include new locale

## Troubleshooting

### SEO strings not updating

- Ensure `seo.json` file exists for the locale
- Check that i18n is loading the correct locale
- Verify template placeholders match exactly (case-sensitive)

### Sitemap generation fails

- Verify Supabase credentials are correct
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Ensure service role key has read access to `drum_sheets` and `categories` tables

### Canonical URLs incorrect

- Check `languageDomainMap.ts` for correct domain mapping
- Verify hostname detection in `src/i18n/getLocaleFromHost.ts`
- Ensure canonical URL uses full domain from `languageDomainMap`

## Best Practices

1. **Always set canonical URLs** - Prevents duplicate content issues across locales
2. **Use localized descriptions** - Translate SEO templates for each language
3. **Keep OG images relevant** - Use actual product images for OG tags
4. **Update sitemaps regularly** - Regenerate after significant content changes
5. **Test SEO tags** - Use browser dev tools or SEO testing tools to verify tags are correct

