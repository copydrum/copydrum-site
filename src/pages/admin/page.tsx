
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useAuthStore } from '../../stores/authStore';

// 공통 로그인 경로 상수
const LOGIN_PATH = '/login';

interface Profile {
  id: string;
  email: string;
  name: string;
  kakao_id?: string;
  google_id?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// 기존 코드
interface DrumSheet {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  price: number;
  category_id: string;
  created_at: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  created_at: string;
  profiles?: Profile;
}

interface CustomOrder {
  id: string;
  user_id: string;
  song_title: string;
  artist: string;
  reference_url?: string;
  difficulty_preference: string;
  additional_notes?: string;
  status: string;
  estimated_price?: number;
  created_at: string;
  profiles?: Profile;
}

const AdminPage: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // 기존 상태 선언
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalSheets: 0,
    totalOrders: 0,
    totalRevenue: 0,
    monthlyGrowth: 0
  });

  const [members, setMembers] = useState<Profile[]>([]);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMember, setNewMember] = useState({
    email: '',
    name: '',
    kakao_id: '',
    google_id: '',
    is_admin: false
  });

  const [showMemberBulkModal, setShowMemberBulkModal] = useState(false);
  const [memberCsvFile, setMemberCsvFile] = useState<File | null>(null);
  const [memberCsvData, setMemberCsvData] = useState<any[]>([]);
  const [isMemberCsvProcessing, setIsMemberCsvProcessing] = useState(false);

  const [sheets, setSheets] = useState<DrumSheet[]>([]);
  const [sheetSearchTerm, setSheetSearchTerm] = useState('');
  const [isAddingSheet, setIsAddingSheet] = useState(false);
  const [newSheet, setNewSheet] = useState({
    title: '',
    artist: '',
    difficulty: 'beginner',
    price: 0,
    category_id: ''
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: ''
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');

  const [customOrders, setCustomOrders] = useState<CustomOrder[]>([]);
  const [customOrderSearchTerm, setCustomOrderSearchTerm] = useState('');

  // 관리자 권한 확인 함수 추가
  const checkAdminStatus = async (currentUser: User) => {
    try {
      // 프로필 조회
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 프로필이 없으면 생성
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([{
              id: currentUser.id,
              email: currentUser.email || '',
              name: currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || '',
              is_admin: false
            }]);

          if (insertError) {
            console.error('프로필 생성 오류:', insertError);
            window.location.href = LOGIN_PATH;
            return;
          }

          // 일반 사용자로 설정
          setIsAdmin(false);
          setAuthChecked(true);
          window.location.href = '/';
          return;
        }
        throw error;
      }

      if (profile?.is_admin) {
        setIsAdmin(true);
        setAuthChecked(true);
        // 관리자인 경우 대시보드 데이터 로드
        await loadDashboardData();
      } else {
        setIsAdmin(false);
        setAuthChecked(true);
        window.location.href = '/';
      }
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error);
      window.location.href = LOGIN_PATH;
    }
  };

  // 개선된 인증 확인 함수
  const checkAuth = async () => {
    try {
      // 1. 먼저 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('세션 확인 오류:', sessionError);
        window.location.href = LOGIN_PATH;
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await checkAdminStatus(session.user);
        return;
      }

      // 2. 세션이 없으면 상태 변화 대기 (탭 복귀·리다이렉트 지연 대응)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
        if (s?.user) {
          setUser(s.user);
          await checkAdminStatus(s.user);
            subscription.unsubscribe();
        } else if (event === 'SIGNED_OUT' || !s) {
          window.location.href = LOGIN_PATH;
        }
      });

      // 3. 1.5초 정도 대기 후에도 세션 없으면 로그인으로
      setTimeout(() => {
        if (!authChecked) {
          window.location.href = LOGIN_PATH;
        }
      }, 1500);

    } catch (error) {
      console.error('Auth check failed:', error);
      window.location.href = LOGIN_PATH;
    }
  };

  // 초기 인증 확인
  useEffect(() => {
    checkAuth();
  }, []);

  // 기존 코드: loadDashboardData, loadMembers, loadSheets, loadCategories, loadOrders, loadCustomOrders
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: sheetCount } = await supabase
        .from('drum_sheets')
        .select('*', { count: 'exact', head: true });

      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'completed');

      const totalRevenue = revenueData?.reduce((sum, order) => sum + order.total_amount, 0) || 0;

      setDashboardStats({
        totalUsers: userCount || 0,
        totalSheets: sheetCount || 0,
        totalOrders: orderCount || 0,
        totalRevenue,
        monthlyGrowth: 12.5 // 임시 값
      });

    } catch (error) {
      console.error('대시보드 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('회원 목록 로드 오류:', error);
    }
  };

  const loadSheets = async () => {
    try {
      const { data, error } = await supabase
        .from('drum_sheets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSheets(data || []);
    } catch (error) {
      console.error('악보 목록 로드 오류:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('카테고리 목록 로드 오류:', error);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles (
            id,
            email,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('주문 목록 로드 오류:', error);
    }
  };

  const loadCustomOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('custom_orders')
        .select(`
          *,
          profiles (
            id,
            email,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomOrders(data || []);
    } catch (error) {
      console.error('맞춤 제작 주문 목록 로드 오류:', error);
    }
  };

  // 기존 코드: 회원, CSV, 악보, 카테고리, 로그아웃 등 함수들
  const handleAddMember = async () => {
    if (!newMember.email || !newMember.name) {
      alert('이메일과 이름은 필수입니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .insert([{
          email: newMember.email,
          name: newMember.name,
          kakao_id: newMember.kakao_id || null,
          google_id: newMember.google_id || null,
          is_admin: newMember.is_admin
        }]);

      if (error) throw error;

      alert('회원이 추가되었습니다.');
      setIsAddingMember(false);
      setNewMember({
        email: '',
        name: '',
        kakao_id: '',
        google_id: '',
        is_admin: false
      });
      loadMembers();
    } catch (error) {
      console.error('회원 추가 오류:', error);
      alert('회원 추가 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('회원이 삭제되었습니다.');
      loadMembers();
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      alert('회원 삭제 중 오류가 발생했습니다.');
    }
  };

  const startBulkAddMembers = () => {
    setShowMemberBulkModal(true);
  };

  const downloadMemberCsvSample = () => {
    const csvContent = 'email,name,kakao_id,google_id\nexample@email.com,홍길동,kakao123,google456\ntest@test.com,김철수,,google789';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'member_sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processMemberCsvData = async () => {
    if (memberCsvData.length === 0) {
      alert('처리할 데이터가 없습니다.');
      return;
    }

    setIsMemberCsvProcessing(true);

    try {
      const raw = memberCsvData || [];
      const norm = (s: any) => (s ?? '').trim();
      const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
      const seen = new Set();
      const parsed = [];

      for (const r of raw) {
        const email = norm(r.email || r.Email || r.E_MAIL || '');
        const name = norm(r.name || r.Name || '');
        const kakao = norm(r.kakao_id || r.kakao || r.kakaoID || '');
        const google = norm(r.google_id || r.google || r.googleID || '');

        if (!email || email.toLowerCase() === 'email' || !emailOk(email)) continue;
        const em = email.toLowerCase();
        if (seen.has(em)) continue;
        seen.add(em);

        const row: any = { email: em };
        if (name) row.name = name;
        if (kakao) row.kakao_id = kakao;
        if (google) row.google_id = google;

        parsed.push(row);
      }

      console.log('최종 파싱된 데이터 length:', parsed.length);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        alert('로그인이 만료되었습니다. 다시 로그인해주세요.');
        window.location.href = LOGIN_PATH;
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_PUBLIC_SUPABASE_URL}/functions/v1/bulk-import-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ users: parsed })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        alert(`CSV 처리가 완료되었습니다.\n성공: ${result.successCount}개\n실패: ${result.errorCount}개`);

        setShowMemberBulkModal(false);
        setMemberCsvFile(null);
        setMemberCsvData([]);

        await loadMembers();
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }

    } catch (error) {
      console.error('CSV 처리 오류:', error);
      alert(`CSV 처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsMemberCsvProcessing(false);
    }
  };

  const handleMemberCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMemberCsvFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      console.log('CSV 파일 내용:', text);

      const lines = text.split('\n').filter(line => line.trim());
      console.log('파싱된 라인 수:', lines.length);

      if (lines.length < 2) {
        alert('CSV 파일에 데이터가 없습니다.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log('헤더:', headers);

      const expectedHeaders = ['email', 'name', 'kakao_id', 'google_id'];

      const isValidFormat = expectedHeaders.every(header =>
        headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
      );

      if (!isValidFormat) {
        alert('CSV 파일 형식이 올바르지 않습니다.\n필요한 컬럼: email, name, kakao_id, google_id');
        return;
      }

      const data = lines.slice(1).map((line, index) => {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));

        console.log(`행 ${index + 1} 파싱 결과:`, values);

        return {
          id: index + 1,
          email: values[0] || '',
          name: values[1] || '',
          kakao_id: values[2]?.trim() || null,
          google_id: values[3]?.trim() || null,
          valid: values[0] && values[1]
        };
      }).filter(item => item.email && item.name);

      console.log('최종 파싱된 데이터:', data);
      setMemberCsvData(data);
    };

    reader.onerror = (error) => {
      console.error('파일 읽기 오류:', error);
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleAddSheet = async () => {
    if (!newSheet.title || !newSheet.artist || !newSheet.category_id) {
      alert('제목, 아티스트, 카테고리는 필수입니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('drum_sheets')
        .insert([{
          title: newSheet.title,
          artist: newSheet.artist,
          difficulty: newSheet.difficulty,
          price: newSheet.price,
          category_id: newSheet.category_id,
          is_active: true
        }]);

      if (error) throw error;

      alert('악보가 추가되었습니다.');
      setIsAddingSheet(false);
      setNewSheet({
        title: '',
        artist: '',
        difficulty: 'beginner',
        price: 0,
        category_id: ''
      });
      loadSheets();
    } catch (error) {
      console.error('악보 추가 오류:', error);
      alert('악보 추가 중 오류가 발생했습니다.');
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) {
      alert('카테고리 이름은 필수입니다.');
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{
          name: newCategory.name,
          description: newCategory.description
        }]);

      if (error) throw error;

      alert('카테고리가 추가되었습니다.');
      setIsAddingCategory(false);
      setNewCategory({
        name: '',
        description: ''
      });
      loadCategories();
    } catch (error) {
      console.error('카테고리 추가 오류:', error);
      alert('카테고리 추가 중 오류가 발생했습니다.');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // 메뉴별 데이터 로드
  useEffect(() => {
    if (!isAdmin) return;
    
    switch (activeMenu) {
      case 'member-list':
        loadMembers();
        break;
      case 'sheets':
        loadSheets();
        loadCategories();
        break;
      case 'categories':
        loadCategories();
        break;
      case 'orders':
        loadOrders();
        break;
      case 'custom-orders':
        loadCustomOrders();
        break;
    }
  }, [activeMenu, isAdmin]);

  // 필터링된 데이터
  const filteredMembers = members.filter(member =>
    member.email.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
    member.name.toLowerCase().includes(memberSearchTerm.toLowerCase())
  );

  const filteredSheets = sheets.filter(sheet =>
    sheet.title.toLowerCase().includes(sheetSearchTerm.toLowerCase()) ||
    sheet.artist.toLowerCase().includes(sheetSearchTerm.toLowerCase())
  );

  const filteredOrders = orders.filter(order =>
    order.profiles?.email.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
    order.profiles?.name.toLowerCase().includes(orderSearchTerm.toLowerCase())
  );

  const filteredCustomOrders = customOrders.filter(order =>
    order.song_title.toLowerCase().includes(customOrderSearchTerm.toLowerCase()) ||
    order.artist.toLowerCase().includes(customOrderSearchTerm.toLowerCase()) ||
    order.profiles?.email.toLowerCase().includes(customOrderSearchTerm.toLowerCase())
  );

  // 렌더링 함수들
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">총 회원 수</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalUsers.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="ri-user-line w-6 h-6 text-blue-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">총 악보 수</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalSheets.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="ri-file-text-line w-6 h-6 text-green-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">총 주문 수</p>
              <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalOrders.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="ri-shopping-cart-line w-6 h-6 text-purple-600"></i>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">총 매출</p>
              <p className="text-2xl font-bold text-gray-900">₩{dashboardStats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <i className="ri-money-dollar-circle-line w-6 h-6 text-yellow-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">최근 주문</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{order.profiles?.name}</p>
                    <p className="text-sm text-gray-500">{order.profiles?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">₩{order.total_amount.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">최근 맞춤 제작 요청</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {customOrders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{order.song_title}</p>
                    <p className="text-sm text-gray-500">{order.artist}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status === 'pending' ? '대기중' :
                       order.status === 'in_progress' ? '진행중' :
                       order.status === 'completed' ? '완료' : '취소'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMemberManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">회원 관리</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setIsAddingMember(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <i className="ri-user-add-line w-4 h-4"></i>
            <span>새 회원 추가</span>
          </button>
          <button
            onClick={startBulkAddMembers}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <i className="ri-upload-line w-4 h-4"></i>
            <span>CSV 대량 등록</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"></i>
                <input
                  type="text"
                  placeholder="회원 검색..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={loadMembers}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
              >
                <i className="ri-refresh-line w-4 h-4"></i>
                <span>새로고침</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">회원 정보</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <i className="ri-user-line text-blue-600 w-5 h-5"></i>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{member.name || '이름 없음'}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      member.is_admin 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {member.is_admin ? '관리자' : '일반회원'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <i className="ri-delete-bin-line w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV 업로드 모달 */}
      {showMemberBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">CSV 대량 회원 등록</h3>
              <button
                onClick={() => setShowMemberBulkModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line w-5 h-5"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CSV 파일 선택
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleMemberCsvUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="text-sm text-gray-600">
                <p className="mb-2">CSV 파일 형식:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>email (필수)</li>
                  <li>name (선택)</li>
                  <li>kakao_id (선택)</li>
                  <li>google_id (선택)</li>
                </ul>
              </div>
              
              <button
                onClick={downloadMemberCsvSample}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
              >
                <i className="ri-download-line w-4 h-4"></i>
                <span>샘플 CSV 다운로드</span>
              </button>

              {memberCsvData.length > 0 && (
                <button
                  onClick={processMemberCsvData}
                  disabled={isMemberCsvProcessing}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isMemberCsvProcessing ? '처리 중...' : `${memberCsvData.length}개 회원 등록`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 회원 추가 모달 */}
      {isAddingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">새 회원 추가</h3>
              <button
                onClick={() => setIsAddingMember(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="ri-close-line w-5 h-5"></i>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름
                </label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({...newMember, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newMember.is_admin}
                  onChange={(e) => setNewMember({...newMember, is_admin: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-900">
                  관리자 권한 부여
                </label>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleAddMember}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSheetManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">악보 관리</h2>
        <button
          onClick={() => setIsAddingSheet(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <i className="ri-add-line w-4 h-4"></i>
          <span>새 악보 추가</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"></i>
            <input
              type="text"
              placeholder="악보 검색..."
              value={sheetSearchTerm}
              onChange={(e) => setSheetSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">악보 정보</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">난이도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">등록일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSheets.map((sheet) => (
                <tr key={sheet.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{sheet.title}</div>
                      <div className="text-sm text-gray-500">{sheet.artist}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      sheet.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      sheet.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {sheet.difficulty === 'beginner' ? '초급' :
                       sheet.difficulty === 'intermediate' ? '중급' : '고급'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₩{sheet.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      sheet.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {sheet.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(sheet.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors">
                        <i className="ri-edit-line w-4 h-4"></i>
                      </button>
                      <button className="text-red-600 hover:text-red-900 transition-colors">
                        <i className="ri-delete-bin-line w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 악보 추가 모달 */}
      {isAddingSheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">새 악보 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                <input
                  type="text"
                  value={newSheet.title}
                  onChange={(e) => setNewSheet({ ...newSheet, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아티스트</label>
                <input
                  type="text"
                  value={newSheet.artist}
                  onChange={(e) => setNewSheet({ ...newSheet, artist: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-707 mb-1">난이도</label>
                <select
                  value={newSheet.difficulty}
                  onChange={(e) => setNewSheet({ ...newSheet, difficulty: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                >
                  <option value="beginner">초급</option>
                  <option value="intermediate">중급</option>
                  <option value="advanced">고급</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-707 mb-1">가격</label>
                <input
                  type="number"
                  value={newSheet.price}
                  onChange={(e) => setNewSheet({ ...newSheet, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-707 mb-1">카테고리</label>
                <select
                  value={newSheet.category_id}
                  onChange={(e) => setNewSheet({ ...newSheet, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
                >
                  <option value="">카테고리 선택</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsAddingSheet(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddSheet}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCategoryManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">카테고리 관리</h2>
        <button
          onClick={() => setIsAddingCategory(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <i className="ri-add-line w-4 h-4"></i>
          <span>새 카테고리 추가</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">설명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">생성일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {category.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {category.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(category.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button className="text-blue-600 hover:text-blue-900 transition-colors">
                        <i className="ri-edit-line w-4 h-4"></i>
                      </button>
                      <button className="text-red-600 hover:text-red-900 transition-colors">
                        <i className="ri-delete-bin-line w-4 h-4"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 카테고리 추가 모달 */}
      {isAddingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">새 카테고리 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsAddingCategory(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderOrderManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">주문 관리</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"></i>
            <input
              type="text"
              placeholder="주문 검색..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문 ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.profiles?.name}</div>
                      <div className="text-sm text-gray-500">{order.profiles?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₩{order.total_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status === 'pending' ? '대기중' :
                       order.status === 'completed' ? '완료' :
                       order.status === 'cancelled' ? '취소' : order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 transition-colors">
                      <i className="ri-eye-line w-4 h-4"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderCustomOrderManagement = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">맞춤 제작 주문 관리</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"></i>
            <input
              type="text"
              placeholder="맞춤 제작 주문 검색..."
              value={customOrderSearchTerm}
              onChange={(e) => setCustomOrderSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">곡 정보</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">고객</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">난이도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">예상 가격</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">요청일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.song_title}</div>
                      <div className="text-sm text-gray-500">{order.artist}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{order.profiles?.name}</div>
                      <div className="text-sm text-gray-500">{order.profiles?.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.difficulty_preference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {order.estimated_price ? `₩${order.estimated_price.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status === 'pending' ? '대기중' :
                       order.status === 'in_progress' ? '진행중' :
                       order.status === 'completed' ? '완료' : '취소'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 transition-colors">
                      <i className="ri-eye-line w-4 h-4"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return renderDashboard();
      case 'sheets':
        return renderSheetManagement();
      case 'categories':
        return renderCategoryManagement();
      case 'member-list':
        return renderMemberManagement();
      case 'orders':
        return renderOrderManagement();
      case 'custom-orders':
        return renderCustomOrderManagement();
      case 'points':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">적립금 관리</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">적립금 관리 기능이 곧 추가될 예정입니다.</p>
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">분석</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">분석 기능이 곧 추가될 예정입니다.</p>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">설정</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">설정 기능이 곧 추가될 예정입니다.</p>
            </div>
          </div>
        );
      default:
        return renderDashboard();
    }
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line w-8 h-8 animate-spin text-blue-600 mx-auto mb-4"></i>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">접근 권한이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">관리자 패널</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveMenu('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <i className="ri-home-line w-5 h-5"></i>
            <span>대시보드</span>
          </button>

          <button
            onClick={() => setActiveMenu('member-list')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'member-list' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <i className="ri-user-line w-5 h-5"></i>
            <span>회원 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('sheets')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'sheets' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <i className="ri-music-line w-5 h-5"></i>
            <span>악보 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('categories')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'categories' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <i className="ri-folder-open-line w-5 h-5"></i>
            <span>카테고리 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('orders')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hoverbg-gray-100'
            }`}
          >
            <i className="ri-shopping-cart-line w-5 h-5"></i>
            <span>주문 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('custom-orders')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'custom-orders' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hoverbg-gray-100'
            }`}
          >
            <i className="ri-clipboard-line w-5 h-5"></i>
            <span>맞춤 제작 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('points')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'points' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hoverbg-gray-100'
            }`}
          >
            <i className="ri-star-line w-5 h-5"></i>
            <span>적립금 관리</span>
          </button>

          <button
            onClick={() => setActiveMenu('analytics')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'analytics' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hoverbg-gray-100'
            }`}
          >
            <i className="ri-bar-chart-line w-5 h-5"></i>
            <span>분석</span>
          </button>

          <button
            onClick={() => setActiveMenu('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeMenu === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hoverbg-gray-100'
            }`}
          >
            <i className="ri-settings-line w-5 h-5"></i>
            <span>설정</span>
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-red-600 hoverbg-red-50 transition-colors"
          >
            <i className="ri-logout-box-line w-5 h-5"></i>
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 헤더 */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeMenu === 'dashboard' ? '대시보드' :
                   activeMenu === 'member-list' ? '회원 관리' :
                   activeMenu === 'sheets' ? '악보 관리' :
                   activeMenu === 'categories' ? '카테고리 관리' :
                   activeMenu === 'orders' ? '주문 관리' :
                   activeMenu === 'custom-orders' ? '맞춤 제작 관리' :
                   activeMenu === 'points' ? '적립금 관리' :
                   activeMenu === 'analytics' ? '분석' :
                   activeMenu === 'settings' ? '설정' : '대시보드'}
                </h2>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">{user?.email?.split('@')[0]}님</span>
              </div>
            </div>
          </div>
        </header>

        {/* 메인 컨텐츠 영역 */}
        <main className="flex-1 p-6 overflow-auto">
          {renderMainContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
