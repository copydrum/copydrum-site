import { useState, type KeyboardEvent, type ChangeEvent } from 'react';
import { createSearchParams, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

interface MainHeaderProps {
  user?: User | null;
}

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: '악보카테고리', href: '/categories' },
  { label: '무료악보', href: '/free-sheets' },
  { label: '악보모음집', href: '/collections' },
  { label: '이벤트 할인악보', href: '/event-sale' },
  { label: '주문제작', href: '/custom-order' },
];

export default function MainHeader({ user }: MainHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }
    const searchParams = createSearchParams({ search: trimmed });
    navigate({ pathname: '/categories', search: `?${searchParams.toString()}` });
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  return (
    <div className={`bg-blue-700 ${user ? 'mr-64' : ''}`} style={{ height: '156px' }}>
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto h-full flex flex-col justify-between">
        {/* Logo, Search & Cart Row */}
        <div className="flex items-center relative py-4">
          {/* Logo */}
          <div className="flex items-center -ml-4 absolute left-0">
            <img
              src="/logo.png"
              alt="카피드럼"
              className="h-12 w-auto mr-3 cursor-pointer"
              onClick={() => navigate('/')}
            />
            <h1
              className="text-2xl font-bold text-white cursor-pointer"
              style={{ fontFamily: '"Noto Sans KR", "Malgun Gothic", sans-serif' }}
              onClick={() => navigate('/')}
            >
              카피드럼
            </h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="곡명, 아티스트, 장르로 검색..."
                value={searchQuery}
                onChange={handleChange}
                onKeyDown={handleKeyPress}
                className="w-full px-6 py-3 text-base border-0 rounded-full focus:outline-none pr-12 bg-blue-50 placeholder-gray-400 text-gray-900"
              />
              <button
                onClick={handleSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-blue-700 cursor-pointer transition-colors duration-200"
              >
                <i className="ri-search-line text-xl"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex items-center justify-center space-x-8 pb-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.href);
              }}
              className="text-white hover:text-purple-300 hover:underline font-semibold text-lg whitespace-nowrap cursor-pointer transition-all duration-200"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

