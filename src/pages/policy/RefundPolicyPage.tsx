// src/pages/policy/RefundPolicyPage.tsx

import React from "react";

const RefundPolicyPage: React.FC = () => {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isEnglish = hostname.includes("en.copydrum.com");

  if (isEnglish) {
    return (
      <main className="refund-policy-page">
        <h1>Refund & Delivery (Digital Product Policy)</h1>

        <section>
          <h2>1. Product Type</h2>
          <p>
            All products sold on CopyDrum are digital contents (PDF drum sheet music).
            These are non-physical electronic products available for immediate download
            after payment.
          </p>
        </section>

        <section>
          <h2>2. Delivery Method</h2>
          <p>
            After successful payment, files are available for instant download under
            <strong> My Page &gt; Order History</strong>.
          </p>
          <p>
            If the download does not work, we provide reissued download links or resend
            the files manually upon request.
          </p>
        </section>

        <section>
          <h2>3. Refund Policy</h2>
          <p>
            Due to the nature of digital products, refunds are not available once the
            file has been downloaded or accessed.
          </p>
          <p>However, we offer refunds or exchanges in the following exceptional cases:</p>
          <ul>
            <li>Within 7 days of purchase if the file has not been downloaded</li>
            <li>Incorrect file provided or technical errors that make the file unusable</li>
            <li>Duplicate payments for the same product</li>
          </ul>
        </section>

        <section>
          <h2>4. Customer Protection</h2>
          <p>We strive to resolve issues immediately:</p>
          <ul>
            <li>Free replacement for file errors</li>
            <li>Reissue of download links if access issues occur</li>
            <li>Immediate refund for duplicate transactions</li>
          </ul>
          <p>
            Customer Support: <a href="mailto:support@copydrum.com">support@copydrum.com</a>
          </p>
        </section>
      </main>
    );
  }

  // 한국어 버전
  return (
    <main className="refund-policy-page">
      <h1>환불 및 제공(배송) 정책</h1>

      <section>
        <h2>1. 상품 유형</h2>
        <p>
          카피드럼(COPYDRUM)에서 판매하는 모든 상품은 디지털 콘텐츠(PDF 드럼 악보)로,
          결제 후 즉시 다운로드할 수 있는 비실물 전자상품입니다.
        </p>
      </section>

      <section>
        <h2>2. 제공(배송) 방식</h2>
        <p>
          결제 완료 후, <strong>마이페이지 &gt; 구매내역</strong>에서 즉시 다운로드가 가능합니다.
        </p>
        <p>
          다운로드가 정상적으로 이루어지지 않을 경우, 고객센터를 통해 재전송 또는
          다운로드 링크 재발급을 지원합니다.
        </p>
      </section>

      <section>
        <h2>3. 환불 정책</h2>
        <p>
          디지털 콘텐츠 특성상 <strong>파일 다운로드 및 열람이 이루어진 경우 환불이 불가</strong>합니다.
        </p>
        <p>아래의 경우에는 예외적으로 환불 또는 교환이 가능합니다.</p>
        <ul>
          <li>결제 후 7일 이내이며, 다운로드 이력이 없는 경우</li>
          <li>잘못된 파일이 제공되었거나 파일 오류로 사용이 불가능한 경우</li>
          <li>동일한 상품을 중복 결제한 경우</li>
        </ul>
      </section>

      <section>
        <h2>4. 고객 보호 정책</h2>
        <p>문제가 있는 경우 고객센터를 통해 빠르게 해결해 드립니다.</p>
        <ul>
          <li>파일 오류 발생 시 무료 교환</li>
          <li>다운로드 불가 시 재발급</li>
          <li>중복 결제 환불 즉시 처리</li>
        </ul>
        <p>
          고객센터 이메일:{" "}
          <a href="mailto:support@copydrum.com">support@copydrum.com</a>
        </p>
      </section>
    </main>
  );
};

export default RefundPolicyPage;




