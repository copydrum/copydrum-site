import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

type StatusOptionValue = 'pending' | 'quoted' | 'payment_confirmed' | 'in_progress' | 'completed' | 'cancelled';

interface StatusOption {
  value: StatusOptionValue;
  label: string;
  description: string;
}

interface OrderProfile {
  id: string;
  email: string | null;
  name: string | null;
}

interface OrderDetail {
  id: string;
  user_id: string;
  song_title: string;
  artist: string;
  song_url: string | null;
  requirements: string | null;
  status: StatusOptionValue;
  estimated_price: number | null;
  completed_pdf_url: string | null;
  completed_pdf_filename: string | null;
  download_count: number | null;
  max_download_count: number | null;
  download_expires_at: string | null;
  created_at: string;
  updated_at: string;
  profiles: OrderProfile | null;
}

interface Message {
  id: string;
  custom_order_id: string;
  sender_id: string | null;
  sender_type: 'admin' | 'customer';
  message: string;
  created_at: string;
}

interface CustomOrderDetailProps {
  orderId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', label: '견적중', description: '견적 검토 중입니다' },
  { value: 'quoted', label: '결제대기', description: '입금 대기 중입니다' },
  { value: 'payment_confirmed', label: '입금확인', description: '입금이 확인되었습니다' },
  { value: 'in_progress', label: '작업중', description: '악보 제작 중입니다' },
  { value: 'completed', label: '작업완료', description: '제작이 완료되었습니다' },
  { value: 'cancelled', label: '취소됨', description: '주문이 취소되었습니다' },
];

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
};

const getStatusMeta = (status: StatusOptionValue) => {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
};

export default function CustomOrderDetail({ orderId, onClose, onUpdated }: CustomOrderDetailProps) {
  const { user } = useAuthStore();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState<StatusOptionValue>('pending');
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const [estimatedPrice, setEstimatedPrice] = useState<string>('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const loadOrderDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: orderError } = await supabase
        .from('custom_orders')
        .select(
          `
            id,
            user_id,
            song_title,
            artist,
            song_url,
            requirements,
            status,
            estimated_price,
            completed_pdf_url,
            completed_pdf_filename,
            download_count,
            max_download_count,
            download_expires_at,
            created_at,
            updated_at,
            profiles (
              id,
              email,
              name
            )
          `
        )
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) {
        throw orderError;
      }

      if (!data) {
        throw new Error('주문 정보를 찾을 수 없습니다.');
      }

      setOrder(data as OrderDetail);
      setSelectedStatus((data.status as StatusOptionValue) ?? 'pending');
      setEstimatedPrice(
        typeof data.estimated_price === 'number' ? data.estimated_price.toString() : ''
      );

      const { data: messagesData, error: messageError } = await supabase
        .from('custom_order_messages')
        .select('id, custom_order_id, sender_id, sender_type, message, created_at')
        .eq('custom_order_id', orderId)
        .order('created_at', { ascending: true });

      if (messageError) {
        throw messageError;
      }

      setMessages((messagesData ?? []) as Message[]);
    } catch (fetchError: any) {
      console.error('주문제작 상세 정보 로드 실패:', fetchError);
      setError(fetchError?.message ?? '주문 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrderDetail();
  }, [loadOrderDetail]);

  const refreshMessages = useCallback(async () => {
    const { data, error: messageError } = await supabase
      .from('custom_order_messages')
      .select('id, custom_order_id, sender_id, sender_type, message, created_at')
      .eq('custom_order_id', orderId)
      .order('created_at', { ascending: true });

    if (messageError) {
      console.error('메시지 새로고침 실패:', messageError);
      return;
    }

    setMessages((data ?? []) as Message[]);
  }, [orderId]);

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || !order) return;

    setIsSendingMessage(true);
    try {
      const { error: invokeError } = await supabase.functions.invoke('admin-send-custom-order-message', {
        body: {
          customOrderId: order.id,
          message: trimmedMessage,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      setMessageInput('');
      await refreshMessages();
      onUpdated?.();
    } catch (sendError: any) {
      console.error('메시지 전송 실패:', sendError);
      alert(sendError?.message ?? '메시지를 전송하지 못했습니다.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleStatusSave = async () => {
    if (!order || !selectedStatus) return;

    setIsSavingStatus(true);
    try {
      const { error: statusError } = await supabase
        .from('custom_orders')
        .update({
          status: selectedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (statusError) {
        throw statusError;
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: selectedStatus,
              updated_at: new Date().toISOString(),
            }
          : prev
      );
      onUpdated?.();
      alert('주문 상태가 업데이트되었습니다.');
    } catch (statusError: any) {
      console.error('상태 업데이트 실패:', statusError);
      alert(statusError?.message ?? '상태를 업데이트하지 못했습니다.');
    } finally {
      setIsSavingStatus(false);
    }
  };

  const parsedEstimatedPrice = useMemo(() => {
    const value = Number(estimatedPrice.replace(/[^0-9]/g, ''));
    return Number.isFinite(value) ? value : 0;
  }, [estimatedPrice]);

  const handlePriceSave = async () => {
    if (!order) return;

    setIsSavingPrice(true);
    try {
      const { error: priceError } = await supabase
        .from('custom_orders')
        .update({
          estimated_price: parsedEstimatedPrice || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (priceError) {
        throw priceError;
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              estimated_price: parsedEstimatedPrice || null,
              updated_at: new Date().toISOString(),
            }
          : prev
      );
      onUpdated?.();
      alert('견적 금액이 저장되었습니다.');
    } catch (priceError: any) {
      console.error('견적 금액 저장 실패:', priceError);
      alert(priceError?.message ?? '견적 금액을 저장하지 못했습니다.');
    } finally {
      setIsSavingPrice(false);
    }
  };

  const handlePdfUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!order || !pdfFile) return;

    setIsUploadingPdf(true);
    try {
      const fileExt = pdfFile.name.split('.').pop() ?? 'pdf';
      const filePath = `${order.user_id}/${order.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('custom-orders')
        .upload(filePath, pdfFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: pdfFile.type || 'application/pdf',
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from('custom-orders').getPublicUrl(filePath);
      const publicUrl = publicData?.publicUrl ?? null;

      if (!publicUrl) {
        throw new Error('업로드된 파일 URL을 가져오지 못했습니다.');
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: updateError } = await supabase
        .from('custom_orders')
        .update({
          completed_pdf_url: publicUrl,
          completed_pdf_filename: pdfFile.name,
          download_count: 0,
          max_download_count: order.max_download_count ?? null,
          download_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) {
        throw updateError;
      }

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              completed_pdf_url: publicUrl,
              completed_pdf_filename: pdfFile.name,
              download_count: 0,
              max_download_count: prev.max_download_count ?? null,
              download_expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            }
          : prev
      );
      setPdfFile(null);
      onUpdated?.();
      alert('완료된 악보 파일이 업로드되었습니다.');
    } catch (uploadError: any) {
      console.error('PDF 업로드 실패:', uploadError);
      alert(uploadError?.message ?? 'PDF 파일을 업로드하지 못했습니다.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-b-2 border-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">주문 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-500">{error ?? '주문 정보를 찾을 수 없습니다.'}</p>
        <button
          type="button"
          className="mt-4 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    );
  }

  const statusMeta = getStatusMeta(order.status);
  const downloadUsageText = (() => {
    const usedCount = order.download_count ?? 0;
    const limit = order.max_download_count;
    if (typeof limit === 'number' && limit > 0) {
      return `다운로드 ${usedCount}/${limit}회 사용`;
    }
    return `다운로드 ${usedCount}회 사용 (무제한)`;
  })();

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <p className="text-xs text-gray-400">주문번호</p>
          <h2 className="text-xl font-bold text-gray-900">{order.song_title}</h2>
          <p className="text-sm text-gray-600">{order.artist}</p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            {statusMeta.label}
            <span className="text-blue-400">·</span>
            <span>{statusMeta.description}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">신청일</p>
          <p className="text-sm text-gray-700">{formatDateTime(order.created_at)}</p>
          <p className="mt-1 text-xs text-gray-400">최근 업데이트</p>
          <p className="text-sm text-gray-700">{formatDateTime(order.updated_at)}</p>
          <button
            type="button"
            className="mt-4 inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 gap-6">
        <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">신청자</p>
              <p className="text-sm text-gray-900">
                {order.profiles?.name ?? order.profiles?.email ?? '이름 미확인'}
              </p>
              <p className="text-xs text-gray-500">{order.profiles?.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">요청사항</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                {order.requirements?.trim() || '요청사항이 없습니다.'}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">참고 링크</p>
              {order.song_url ? (
                <a
                  href={order.song_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  {order.song_url}
                  <i className="ri-external-link-line" />
                </a>
              ) : (
                <p className="mt-1 text-sm text-gray-500">등록된 링크가 없습니다.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">견적 금액</p>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={estimatedPrice}
                  onChange={(event) => setEstimatedPrice(event.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="예: 50000"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                  onClick={handlePriceSave}
                  disabled={isSavingPrice}
                >
                  {isSavingPrice ? '저장 중...' : '견적 저장'}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                고객에게 안내할 견적 금액을 숫자만 입력하세요. (단위: 원)
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">주문 상태 관리</h3>
              <p className="text-xs text-gray-500">
                진행 상황에 맞게 상태를 변경하면 고객에게 안내됩니다.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as StatusOptionValue)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                onClick={handleStatusSave}
                disabled={isSavingStatus}
              >
                {isSavingStatus ? '저장 중...' : '상태 저장'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">완료된 악보 파일</h3>
                <p className="text-xs text-gray-500">
                  작업이 완료되면 PDF 파일을 업로드하고 고객에게 다운로드 권한을 부여하세요.
                </p>
              </div>
            </div>

            {order.completed_pdf_url && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex flex-col gap-1 text-sm text-green-800 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <i className="ri-file-pdf-line text-lg" />
                    <div>
                      <p className="font-semibold">{order.completed_pdf_filename}</p>
                      <p className="text-xs text-green-700">
                        {downloadUsageText} · 만료 {formatDateTime(order.download_expires_at)}
                      </p>
                    </div>
                  </div>
                  <a
                    href={order.completed_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 md:mt-0"
                  >
                    <i className="ri-external-link-line" />
                    파일 열기
                  </a>
                </div>
              </div>
            )}

            {(order.status === 'in_progress' || order.status === 'completed') && (
              <form className="rounded-lg border border-gray-200 bg-gray-50 p-4" onSubmit={handlePdfUpload}>
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-gray-700">
                    PDF 파일 업로드 (최대 20MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setPdfFile(file);
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:hover:bg-blue-700"
                  />
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <i className="ri-information-line" />
                    업로드 후 자동으로 다운로드 횟수가 초기화되고, 만료일은 30일 뒤로 설정됩니다.
                  </div>
                  <button
                    type="submit"
                    disabled={!pdfFile || isUploadingPdf}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isUploadingPdf ? '업로드 중...' : 'PDF 업로드'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white">
          <header className="border-b border-gray-200 px-4 py-3">
            <h3 className="text-base font-semibold text-gray-900">대화 내역</h3>
            <p className="text-xs text-gray-500">관리자와 고객이 주고받은 메시지를 확인하세요.</p>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                아직 대화가 없습니다. 첫 메시지를 남겨보세요.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isAdmin = message.sender_type === 'admin';
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isAdmin
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>{isAdmin ? '관리자' : '고객'}</span>
                          <span>{formatDateTime(message.created_at)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{message.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="border-t border-gray-200 bg-gray-50 px-4 py-3">
            <form className="flex flex-col gap-2 md:flex-row" onSubmit={handleSendMessage}>
              <textarea
                className="min-h-[80px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="관리자 답변을 입력하세요. 고객에게 바로 전달됩니다."
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || isSendingMessage}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isSendingMessage ? '전송 중...' : '답변 전송'}
              </button>
            </form>
          </footer>
        </section>
      </div>
    </div>
  );
}