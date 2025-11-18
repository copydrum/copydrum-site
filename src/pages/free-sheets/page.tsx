import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Heart, Loader2, Play, Search } from 'lucide-react';

import MainHeader from '../../components/common/MainHeader';
import { supabase } from '../../lib/supabase';
import { fetchUserFavorites, toggleFavorite } from '../../lib/favorites';
import { generateDefaultThumbnail } from '../../lib/defaultThumbnail';
import { useTranslation } from 'react-i18next';
import { isEnglishHost } from '../../i18n/languages';

interface SupabaseDrumSheetRow {
  id: string;
  title: string;
  artist: string;
  difficulty: string | null;
  created_at: string;
  thumbnail_url: string | null;
  youtube_url: string | null;
  pdf_url: string;
  page_count: number | null;
  categories?: {
    name: string;
  } | null;
}

interface DrumSheetCategoryRow {
  sheet_id: string;
  category?: {
    name: string;
  } | null;
}

interface DrumLessonRelationRow {
  sheet_id: string;
}

interface FreeSheet {
  id: string;
  title: string;
  artist: string;
  difficulty: string | null;
  createdAt: string;
  thumbnailUrl: string;
  youtubeUrl: string | null;
  pdfUrl: string;
  pageCount: number | null;
  categories: string[];
}

const getSubCategoryOptions = (isEnglishSite: boolean) => [
  { key: 'all', label: isEnglishSite ? 'All' : '전체' },
  { key: '드럼테크닉', label: isEnglishSite ? 'Drum Technique' : '드럼테크닉' },
  { key: '루디먼트', label: isEnglishSite ? 'Rudiment' : '루디먼트' },
  { key: '드럼솔로', label: isEnglishSite ? 'Drum Solo' : '드럼솔로' },
  { key: '기초/입문', label: isEnglishSite ? 'Beginner/Basics' : '기초/입문' },
  { key: '리듬패턴', label: isEnglishSite ? 'Rhythm Pattern' : '리듬패턴' },
  { key: '필인', label: isEnglishSite ? 'Fill-in' : '필인' },
] as const;

const SHEET_SELECT_FIELDS = `
  id,
  title,
  artist,
  difficulty,
  created_at,
  thumbnail_url,
  youtube_url,
  pdf_url,
  page_count,
  categories (
    name
  )
`;

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  '초급': 1,
  '중급': 2,
  '고급': 3,
  unknown: 4,
};

const normalizeDifficultyKey = (value: string | null | undefined): string => {
  if (!value) {
    return 'unknown';
  }

  const normalized = value.toLowerCase();

  if (normalized.includes('beginner') || normalized.includes('초급')) {
    return 'beginner';
  }
  if (normalized.includes('intermediate') || normalized.includes('중급')) {
    return 'intermediate';
  }
  if (normalized.includes('advanced') || normalized.includes('고급')) {
    return 'advanced';
  }

  return value;
};

const getDifficultyLabel = (value: string | null | undefined, isEnglishSite: boolean = false): string => {
  if (!value) {
    return isEnglishSite ? 'Difficulty not available' : '난이도 정보 없음';
  }

  const key = normalizeDifficultyKey(value);

  switch (key) {
    case 'beginner':
    case '초급':
      return isEnglishSite ? 'Beginner' : '초급';
    case 'intermediate':
    case '중급':
      return isEnglishSite ? 'Intermediate' : '중급';
    case 'advanced':
    case '고급':
      return isEnglishSite ? 'Advanced' : '고급';
    default:
      return value;
  }
};

const extractYouTubeVideoId = (url: string | null): string | null => {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '');
    }

    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }

    const pathMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
  } catch (error) {
    console.warn('유튜브 URL 파싱 실패:', error);
  }

  return null;
};

const buildThumbnailUrl = (sheet: SupabaseDrumSheetRow): string => {
  if (sheet.thumbnail_url) {
    return sheet.thumbnail_url;
  }

  const youtubeId = extractYouTubeVideoId(sheet.youtube_url);
  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/hq720.jpg`;
  }

  return generateDefaultThumbnail(1280, 720);
};

const formatRelativeDate = (isoString: string): string => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const FreeSheetsPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sheets, setSheets] = useState<FreeSheet[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | '드럼테크닉' | '루디먼트' | '드럼솔로' | '기초/입문' | '리듬패턴' | '필인'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState<'latest' | 'title' | 'difficulty'>('latest');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  const [selectedSheet, setSelectedSheet] = useState<FreeSheet | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isEnglishSite = typeof window !== 'undefined' && isEnglishHost(window.location.host);

  // 카테고리 이름을 번역하는 함수
  const getCategoryName = (categoryKo: string): string => {
    if (!isEnglishSite) return categoryKo;
    
    const categoryMap: Record<string, string> = {
      '드럼테크닉': 'Drum Technique',
      '루디먼트': 'Rudiment',
      '드럼솔로': 'Drum Solo',
      '기초/입문': 'Beginner/Basics',
      '리듬패턴': 'Rhythm Pattern',
      '필인': 'Fill-in',
      '드럼레슨': 'Drum Lesson',
      '카테고리 준비 중': 'Category pending',
    };
    
    return categoryMap[categoryKo] || categoryKo;
  };

  const loadSheets = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const {
        data: lessonCategory,
        error: lessonCategoryError,
      } = await supabase
        .from('categories')
        .select('id')
        .eq('name', '드럼레슨')
        .maybeSingle();

      if (lessonCategoryError) {
        console.error('드럼레슨 카테고리 조회 오류:', lessonCategoryError);
        setErrorMessage('드럼레슨 카테고리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setSheets([]);
        return;
      }

      if (!lessonCategory) {
        setErrorMessage('드럼레슨 카테고리가 존재하지 않습니다. 관리자에게 문의해 주세요.');
        setSheets([]);
        return;
      }

      const lessonCategoryId = lessonCategory.id;

      const {
        data: primarySheets,
        error: primaryError,
      } = await supabase
        .from('drum_sheets')
        .select(SHEET_SELECT_FIELDS)
        .eq('category_id', lessonCategoryId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (primaryError) {
        console.error('드럼레슨 기본 카테고리 악보 로드 오류:', primaryError);
        setErrorMessage('무료 드럼레슨 악보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        setSheets([]);
        return;
      }

      const primaryList = primarySheets ?? [];
      const primaryIdSet = new Set(primaryList.map((sheet) => sheet.id));

      const {
        data: lessonRelations,
        error: relationsError,
      } = await supabase
        .from('drum_sheet_categories')
        .select('sheet_id')
        .eq('category_id', lessonCategoryId);

      if (relationsError) {
        console.error('드럼레슨 카테고리 관계 로드 오류:', relationsError);
      }

      const relationIdSet = new Set<string>();
      (lessonRelations ?? []).forEach((relation) => {
        const sheetId = (relation as DrumLessonRelationRow | null)?.sheet_id;
        if (sheetId) {
          relationIdSet.add(sheetId);
        }
      });

      const additionalIds = Array.from(relationIdSet).filter((id) => !primaryIdSet.has(id));

      let additionalList: SupabaseDrumSheetRow[] = [];

      if (additionalIds.length > 0) {
        const {
          data: additionalSheets,
          error: additionalError,
        } = await supabase
          .from('drum_sheets')
          .select(SHEET_SELECT_FIELDS)
          .in('id', additionalIds)
          .eq('is_active', true);

        if (additionalError) {
          console.error('추가 드럼레슨 악보 로드 오류:', additionalError);
        } else {
          additionalList = additionalSheets ?? [];
        }
      }

      const sheetList = [...primaryList];
      additionalList.forEach((sheet) => {
        if (!primaryIdSet.has(sheet.id)) {
          sheetList.push(sheet);
        }
      });

      sheetList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const sheetIds = sheetList.map((sheet) => sheet.id);
      const extraCategoryMap = new Map<string, string[]>();

      if (sheetIds.length > 0) {
        const {
          data: extraCategories,
          error: extraError,
        } = await supabase
          .from('drum_sheet_categories')
          .select(`
            sheet_id,
            category:categories (
              name
            )
          `)
          .in('sheet_id', sheetIds);

        if (extraError) {
          console.error('추가 카테고리 로드 오류:', extraError);
        } else {
          const typedExtraCategories = (extraCategories ?? []) as DrumSheetCategoryRow[];
          typedExtraCategories.forEach((relation) => {
            if (!relation?.sheet_id) {
              return;
            }

            const categoryName = relation.category?.name;
            if (!categoryName) {
              return;
            }

            const list = extraCategoryMap.get(relation.sheet_id) ?? [];
            list.push(categoryName);
            extraCategoryMap.set(relation.sheet_id, list);
          });
        }
      }

      const mappedSheets: FreeSheet[] = sheetList.map((sheet: SupabaseDrumSheetRow) => {
        const categorySet = new Set<string>();
        categorySet.add('드럼레슨');

        if (sheet.categories?.name) {
          categorySet.add(sheet.categories.name);
        }

        const extraCategories = extraCategoryMap.get(sheet.id) ?? [];
        extraCategories.forEach((name) => categorySet.add(name));

        const categories = Array.from(categorySet).sort((a, b) => {
          if (a === '드럼레슨') return -1;
          if (b === '드럼레슨') return 1;
          return a.localeCompare(b, 'ko');
        });

        return {
          id: sheet.id,
          title: sheet.title,
          artist: sheet.artist,
          difficulty: sheet.difficulty,
          createdAt: sheet.created_at,
          thumbnailUrl: buildThumbnailUrl(sheet),
          youtubeUrl: sheet.youtube_url,
          pdfUrl: sheet.pdf_url,
          pageCount: sheet.page_count,
          categories,
        };
      });

      setSheets(mappedSheets);
    } catch (error) {
      console.error('무료 악보 페이지 처리 오류:', error);
      setErrorMessage('무료 드럼레슨 악보를 불러오는 중 오류가 발생했습니다.');
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }

    try {
      const favorites = await fetchUserFavorites(user.id);
      setFavoriteIds(new Set(favorites.map((favorite) => favorite.sheet_id)));
    } catch (error) {
      console.error('찜 목록 로드 오류:', error);
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user ?? null);
      } catch (error) {
        console.error('사용자 정보를 불러오지 못했습니다:', error);
        setUser(null);
      }
    };

    init();
    loadSheets();
  }, [loadSheets]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleToggleFavorite = async (sheetId: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    setFavoriteLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(sheetId);
      return next;
    });

    try {
      const isFavoriteNow = await toggleFavorite(sheetId, user.id);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavoriteNow) {
          next.add(sheetId);
        } else {
          next.delete(sheetId);
        }
        return next;
      });
    } catch (error) {
      console.error('찜하기 처리 오류:', error);
      alert('찜하기 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setFavoriteLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(sheetId);
        return next;
      });
    }
  };

  const handleMobileSheetSelect = useCallback((sheet: FreeSheet) => {
    setSelectedSheet(sheet);
    setIsMobileDetailOpen(true);
  }, []);

  const closeMobileDetail = useCallback(() => {
    setIsMobileDetailOpen(false);
    setSelectedSheet(null);
  }, []);

  const handleSheetLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, sheet: FreeSheet) => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        event.preventDefault();
        handleMobileSheetSelect(sheet);
      }
    },
    [handleMobileSheetSelect],
  );

  const handleOpenPdf = useCallback((sheet: FreeSheet) => {
    if (!sheet.pdfUrl) {
      alert('PDF 링크가 준비되지 않았습니다.');
      return;
    }
    window.open(sheet.pdfUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleOpenYoutube = useCallback((sheet: FreeSheet) => {
    if (!sheet.youtubeUrl) {
      alert('등록된 유튜브 영상이 없습니다.');
      return;
    }
    window.open(sheet.youtubeUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleNavigateToDetail = useCallback(
    (sheet: FreeSheet) => {
      closeMobileDetail();
      navigate(`/sheet-detail/${sheet.id}`);
    },
    [closeMobileDetail, navigate],
  );

  const filteredSheets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let result = sheets.filter((sheet) => {
      if (!term) {
        return true;
      }

      const haystack = `${sheet.title} ${sheet.artist} ${sheet.categories.join(' ')}`.toLowerCase();
      return haystack.includes(term);
    });

    if (selectedCategory !== 'all') {
      result = result.filter((sheet) => sheet.categories.includes(selectedCategory));
    }

    switch (sortOption) {
      case 'title':
        result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'ko'));
        break;
      case 'difficulty':
        result = [...result].sort((a, b) => {
          const aOrder = DIFFICULTY_ORDER[normalizeDifficultyKey(a.difficulty)] ?? DIFFICULTY_ORDER.unknown;
          const bOrder = DIFFICULTY_ORDER[normalizeDifficultyKey(b.difficulty)] ?? DIFFICULTY_ORDER.unknown;
          return aOrder - bOrder;
        });
        break;
      case 'latest':
      default: {
        result = [...result].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      }
    }

    return result;
  }, [searchTerm, selectedCategory, sortOption, sheets]);

  return (
    <div className="min-h-screen bg-gray-50">
      <MainHeader />

      <section className="bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-sm font-semibold tracking-wide text-white">
            FREE DRUM LESSONS
          </span>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            무료 드럼레슨 악보
          </h1>
          <p className="max-w-3xl text-sm text-blue-100 sm:text-base md:text-lg">
            드럼 레슨 카테고리의 모든 악보를 무료로 만나보세요!
            유튜브 레슨과 함께 연습하면 더욱 빠르게 실력이 향상됩니다.
            드럼 테크닉, 루디먼트, 드럼 솔로 등 다양한 학습 주제를 자유롭게 선택해보세요.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-blue-100">
            <span className="rounded-full border border-white/40 px-3 py-1">전곡 무료 다운로드</span>
            <span className="rounded-full border border-white/40 px-3 py-1">카테고리별 학습</span>
            <span className="rounded-full border border-white/40 px-3 py-1">유튜브 레슨 참고 링크</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-3">
              {getSubCategoryOptions(isEnglishSite).map((option) => {
                const isActive = selectedCategory === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedCategory(option.key)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'border-transparent bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="제목, 아티스트 또는 태그 검색"
                className="w-full rounded-full border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600" htmlFor="free-sheet-sort">
                정렬
              </label>
              <select
                id="free-sheet-sort"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as typeof sortOption)}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="latest">최신순</option>
                <option value="title">제목순</option>
                <option value="difficulty">난이도순</option>
              </select>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">무료 드럼레슨 악보를 불러오는 중입니다...</span>
              </div>
            </div>
          ) : filteredSheets.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-gray-500">
              <span className="text-lg font-semibold text-gray-600">조건에 맞는 무료 악보가 없습니다.</span>
              <p className="text-sm text-gray-500">
                다른 카테고리를 선택하거나 검색어를 변경해 보세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredSheets.map((sheet) => {
                const isFavorite = favoriteIds.has(sheet.id);
                const isFavoriteLoading = favoriteLoadingIds.has(sheet.id);
                const displayCategories = sheet.categories.filter((name) => name !== '드럼레슨');

                return (
                  <div
                    key={sheet.id}
                    className="group relative flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <Link
                      to={`/sheet-detail/${sheet.id}`}
                      className="relative block"
                      onClick={(event) => handleSheetLinkClick(event, sheet)}
                    >
                      <div
                        className="aspect-video w-full bg-gray-200 transition duration-300 group-hover:brightness-110"
                        style={{
                          backgroundImage: `url(${sheet.thumbnailUrl})`,
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                        }}
                      />

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent opacity-0 transition group-hover:opacity-100" />

                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-blue-600 shadow-lg">
                          <Play className="ml-1 h-7 w-7" />
                        </div>
                      </div>
                    </Link>

                    <span className="absolute left-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      FREE
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(sheet.id)}
                      className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-blue-600 shadow transition hover:bg-white"
                      disabled={isFavoriteLoading}
                    >
                      {isFavoriteLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Heart
                          className="h-5 w-5"
                          fill={isFavorite ? 'currentColor' : 'none'}
                          strokeWidth={isFavorite ? 0 : 2}
                        />
                      )}
                    </button>

                    <div className="flex flex-1 flex-col gap-4 p-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs font-medium text-gray-400">
                          <span>{formatRelativeDate(sheet.createdAt)}</span>
                          {sheet.pageCount ? <span>{sheet.pageCount}p</span> : null}
                        </div>
                        <Link
                          to={`/sheet-detail/${sheet.id}`}
                          className="text-lg font-semibold leading-tight text-gray-900 transition hover:text-blue-600"
                        >
                          {sheet.title}
                        </Link>
                        <span className="text-sm font-medium text-blue-600">{sheet.artist}</span>
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                          {getDifficultyLabel(sheet.difficulty, isEnglishSite)}
                        </span>

                        {displayCategories.length > 0 ? (
                          displayCategories.map((category) => (
                            <span
                              key={category}
                              className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                            >
                              {getCategoryName(category)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                            {getCategoryName('카테고리 준비 중')}
                          </span>
                        )}
                      </div>

                      <Link
                        to={`/sheet-detail/${sheet.id}`}
                        className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                        onClick={(event) => handleSheetLinkClick(event, sheet)}
                      >
                        무료 악보 보기
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedSheet && isMobileDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm md:hidden">
          <div className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-600">무료 악보</p>
                <h2 className="text-lg font-bold text-gray-900">{selectedSheet.title}</h2>
                <p className="text-sm text-gray-500">{selectedSheet.artist}</p>
              </div>
              <button
                type="button"
                onClick={closeMobileDetail}
                aria-label="무료 악보 상세 닫기"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <i className="ri-close-line text-2xl" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="overflow-hidden rounded-2xl border border-gray-100">
                <img
                  src={selectedSheet.thumbnailUrl}
                  alt={selectedSheet.title}
                  className="w-full object-cover"
                  onError={(event) => {
                    const img = event.target as HTMLImageElement;
                    img.src = generateDefaultThumbnail(640, 480);
                  }}
                />
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {getDifficultyLabel(selectedSheet.difficulty, isEnglishSite)}
                  </span>
                  {selectedSheet.categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600"
                    >
                      {category}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>업로드 {formatRelativeDate(selectedSheet.createdAt)}</span>
                  {selectedSheet.pageCount ? <span>{selectedSheet.pageCount} 페이지</span> : null}
                  {selectedSheet.youtubeUrl ? <span>유튜브 레슨 포함</span> : null}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3">
                <div className="text-sm text-gray-500">
                  <p className="font-semibold text-gray-900">무료 다운로드</p>
                  <p>PDF 악보와 함께 연습해보세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(selectedSheet.id)}
                  disabled={favoriteLoadingIds.has(selectedSheet.id)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                    favoriteIds.has(selectedSheet.id)
                      ? 'border-red-200 bg-red-50 text-red-500'
                      : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500'
                  } ${favoriteLoadingIds.has(selectedSheet.id) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-label={favoriteIds.has(selectedSheet.id) ? '찜 해제' : '찜하기'}
                >
                  <i className={`ri-heart-${favoriteIds.has(selectedSheet.id) ? 'fill' : 'line'} text-xl`} />
                </button>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleOpenPdf(selectedSheet)}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-blue-700"
                >
                  무료 악보 보기
                </button>
                {selectedSheet.youtubeUrl ? (
                  <button
                    type="button"
                    onClick={() => handleOpenYoutube(selectedSheet)}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-100"
                  >
                    유튜브 레슨 보기
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleNavigateToDetail(selectedSheet)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  상세 페이지로 이동
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeSheetsPage;
 