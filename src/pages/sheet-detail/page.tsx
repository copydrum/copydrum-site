
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';
import { ArrowLeft, Download, Star, ShoppingCart, Music, Clock, DollarSign, ZoomIn, Eye, X } from 'lucide-react';

interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  category_id: string;
  difficulty: string;
  price: number;
  pdf_url: string;
  preview_image_url: string;
  thumbnail_url: string;
  youtube_url: string; // 유튜브 URL 추가
  album_name?: string; // 앨범명 추가
  is_featured: boolean;
  created_at: string;
  categories?: { name: string };
}

export default function SheetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [sheet, setSheet] = useState<DrumSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    checkAuth();
    if (id) {
      loadSheetDetail(id);
    }
  }, [id]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (err) {
      console.error('Auth check failed:', err);
    }
  };

  const loadSheetDetail = async (sheetId: string) => {
    try {
      const { data, error } = await supabase
        .from('drum_sheets')
        .select('*, categories (name)')
        .eq('id', sheetId)
        .single();

      if (error) throw error;
      setSheet(data);
    } catch (error) {
      console.error('악보 상세 정보 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const getDifficultyBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case '초급':
        return 'bg-green-100 text-green-800';
      case '중급':
        return 'bg-yellow-100 text-yellow-800';
      case '고급':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    setPurchasing(true);
    try {
      // 여기에 결제 로직 구현
      alert('결제 기능은 추후 구현 예정입니다.');
    } catch (error) {
      console.error('구매 오류:', error);
      alert('구매 중 오류가 발생했습니다.');
    } finally {
      setPurchasing(false);
    }
  };

  const downloadPdf = async () => {
    if (!sheet?.pdf_url) return;

    try {
      const response = await fetch(sheet.pdf_url);
      const blob = await response.blob();
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${sheet.title} - ${sheet.artist}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('다운로드 오류:', error);
      alert('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  // 썸네일 이미지 URL 가져오기 (유튜브 우선)
  const getThumbnailUrl = async () => {
    if (!sheet) return '';

    // 1. 유튜브 URL이 있는 경우 유튜브 썸네일 우선 사용
    if (sheet.youtube_url) {
      const videoId = extractVideoId(sheet.youtube_url);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    // 2. 데이터베이스에 저장된 썸네일 URL 확인
    if (sheet.thumbnail_url) {
      return sheet.thumbnail_url;
    }
    
    // 3. 썸네일이 없으면 빈 문자열 반환 (텍스트 표시용)
    return '';
  };

  // 썸네일 URL 상태 관리
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    if (sheet) {
      getThumbnailUrl().then(setThumbnailUrl);
    }
  }, [sheet]);

  // 미리보기 이미지 생성 함수
  const getPreviewImageUrl = (sheet: DrumSheet) => {
    if (sheet.preview_image_url) {
      return sheet.preview_image_url;
    }
    
    // 더 안정적인 이미지 생성 프롬프트
    const prompt = `Professional drum sheet music notation page with clear black musical notes on white paper background, drum symbols and rhythmic patterns, clean layout, high quality music manuscript paper, readable notation symbols, minimalist design, no text overlays, studio lighting`;
    
    return `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28prompt%29%7D&width=600&height=800&seq=preview-${sheet.id}&orientation=portrait`;
  };

  // 이미지 로드 실패 시 대체 이미지
  const handlePreviewImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    // 더 간단한 대체 이미지
    const fallbackPrompt = `Clean white paper with black musical notes, drum notation symbols, simple music sheet design, high contrast, professional quality`;
    img.src = `https://readdy.ai/api/search-image?query=$%7BencodeURIComponent%28fallbackPrompt%29%7D&width=600&height=800&seq=fallback-${Date.now()}&orientation=portrait`;
  };

  // 유튜브 URL에서 비디오 ID 추출 함수
  const extractVideoId = (url: string): string => {
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">악보를 찾을 수 없습니다</h1>
          <button
            onClick={() => navigate('/categories')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer"
          >
            카테고리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer"
                style={{ fontFamily: '"Pacifico", serif' }}
                onClick={() => navigate('/')}
              >
                카피드럼
              </h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="/" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                홈
              </a>
              <a href="/categories" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                악보 카테고리
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                신규 악보
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                인기 악보
              </a>
              <a href="#" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                고객지원
              </a>
              {user && (
                <a href="/admin" className="text-gray-700 hover:text-gray-900 font-medium whitespace-nowrap cursor-pointer">
                  관리자
                </a>
              )}
            </nav>
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900 cursor-pointer">
                <ShoppingCart className="w-5 h-5" />
              </button>
              {user ? (
                <div className="flex items-center space-x-4">
                  <span className="text-gray-700">{user.email?.split('@')[0]}님</span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <a
                  href="/auth/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  로그인
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <button
          onClick={() => navigate('/categories')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>카테고리로 돌아가기</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Thumbnail Image */}
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={`${sheet.title} ${sheet.youtube_url ? '유튜브 썸네일' : '앨범 커버'}`}
                  className="w-full h-auto object-cover object-top"
                />
              ) : (
                <div className="w-full h-96 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white font-bold text-2xl leading-tight">
                      COPYDRUM
                    </div>
                    <div className="text-white font-bold text-2xl leading-tight">
                      SHEET MUSIC
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center">
                    <Music className="w-4 h-4 text-blue-800" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-800 mb-1">
                    {sheet.youtube_url ? '유튜브 썸네일' : '앨범 커버'}
                  </h4>
                  <p className="text-sm text-blue-700">
                    {thumbnailUrl ? 
                      (sheet.youtube_url ? 
                        '위 이미지는 해당 곡의 유튜브 썸네일입니다.' :
                        '위 이미지는 해당 곡의 앨범 커버입니다.'
                      ) :
                      '썸네일 정보가 없습니다.'
                    } 
                    실제 악보 미리보기는 아래에서 확인하실 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
            
            {/* 유튜브 링크 버튼 */}
            {sheet.youtube_url && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-red-800">유튜브에서 보기</h4>
                      <p className="text-sm text-red-700">이 악보의 연주 영상을 확인해보세요</p>
                    </div>
                  </div>
                  <a
                    href={sheet.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span>유튜브 보기</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sheet Info */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{sheet.title}</h1>
                {sheet.is_featured && (
                  <Star className="w-6 h-6 text-yellow-500 fill-current" />
                )}
              </div>
              <p className="text-xl text-gray-600 mb-2">{sheet.artist}</p>
              {sheet.album_name && (
                <p className="text-lg text-gray-500 mb-2">앨범: {sheet.album_name}</p>
              )}
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span className="flex items-center space-x-1">
                  <Music className="w-4 h-4" />
                  <span>{sheet.categories?.name}</span>
                </span>
              </div>
            </div>

            {/* Difficulty Badge */}
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getDifficultyBadgeColor(sheet.difficulty)}`}>
                {sheet.difficulty}
              </span>
            </div>

            {/* Price */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <DollarSign className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-600">가격</span>
                  </div>
                  <span className="text-3xl font-bold text-blue-600">
                    ₩{sheet.price.toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 mb-2">즉시 다운로드</p>
                  <p className="text-sm text-gray-500">PDF 형식</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {purchasing ? '처리 중...' : '구매하기'}
              </button>
              
              <button
                onClick={() => setShowPreviewModal(true)}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center space-x-2 whitespace-nowrap cursor-pointer"
              >
                <Eye className="w-5 h-5" />
                <span>악보 미리보기</span>
              </button>
            </div>

            {/* Features */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">포함 내용</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>고품질 PDF 악보</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>인쇄 가능한 형식</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>즉시 다운로드</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>평생 이용 가능</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <span>가사없음</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

        {/* 유튜브 영상 섹션 (유튜브 URL이 있는 경우) */}
        {sheet.youtube_url && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8 mt-12">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center space-x-2">
              <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <span>연주 영상</span>
            </h3>
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${extractVideoId(sheet.youtube_url)}`}
                title={`${sheet.title} - ${sheet.artist} 연주 영상`}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-gray-600">이 악보의 연주 영상을 확인해보세요</p>
              <a
                href={sheet.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 whitespace-nowrap cursor-pointer flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>유튜브에서 보기</span>
              </a>
            </div>
          </div>
        )}

        {/* 악보 미리보기 섹션 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">악보 미리보기</h3>
          <div className="relative">
            <div className="aspect-[3/4] bg-gray-50 rounded-lg overflow-hidden relative">
              <img
                src={getPreviewImageUrl(sheet)}
                alt={`${sheet.title} 악보 미리보기`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setShowPreviewModal(true)}
                onError={handlePreviewImageError}
              />
              
              {/* 하단 흐림 효과 */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-white/90 via-white/60 to-transparent"></div>
              
              {/* 미리보기 안내 */}
              <div className="absolute bottom-4 left-4 right-4 text-center">
                <p className="text-sm text-gray-700 font-medium bg-white/80 rounded px-3 py-2">
                  전체 악보는 구매 후 확인 가능합니다
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowPreviewModal(true)}
              className="mt-4 w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              미리보기 확대
            </button>
          </div>
        </div>
      </div>

      {/* 미리보기 확대 모달 */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">악보 미리보기</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <img
                  src={getPreviewImageUrl(sheet)}
                  alt={`${sheet.title} 악보 미리보기`}
                  className="w-full h-auto rounded"
                  onError={handlePreviewImageError}
                />
                <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-white/95 via-white/70 to-transparent"></div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-gray-600 mb-4">전체 악보를 보려면 구매해주세요</p>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  구매하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-xl font-bold mb-4" style={{ fontFamily: '"Pacifico", serif' }}>
                카피드럼
              </h4>
              <p className="text-gray-400 mb-4">
                전문 드러머를 위한 최고 품질의 드럼 악보를 제공합니다.
              </p>
            </div>

            <div>
              <h5 className="font-semibold mb-4">악보 카테고리</h5>
              <ul className="space-y-2">
                <li>
                  <a href="/categories" className="text-gray-400 hover:text-white cursor-pointer">
                    전체 카테고리
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold mb-4">고객 지원</h5>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    자주 묻는 질문
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    다운로드 가이드
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    환불 정책
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    문의하기
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold mb-4">회사 정보</h5>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    회사 소개
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    이용약관
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    개인정보처리방침
                  </a>
                </li>
                <li>
                  <a href="#" className="text-gray-400 hover:text-white cursor-pointer">
                    파트너십
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 카피드럼. All rights reserved. |
              <a
                href="https://readdy.ai/?origin=logo"
                className="text-gray-400 hover:text-white ml-1 cursor-pointer"
              >
                Website Builder
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}