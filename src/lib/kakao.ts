
declare global {
  interface Window {
    Kakao: any;
  }
}

export class KakaoAuth {
  private static instance: KakaoAuth;
  private isInitialized = false;

  static getInstance(): KakaoAuth {
    if (!KakaoAuth.instance) {
      KakaoAuth.instance = new KakaoAuth();
    }
    return KakaoAuth.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      // 카카오 SDK 스크립트 로드
      const script = document.createElement('script');
      script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
      script.integrity = 'sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4';
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        try {
          // 카카오 SDK 초기화
          window.Kakao.init('379ca4f197e4bbe01ffbd571fe20d1de');
          this.isInitialized = true;
          console.log('카카오 SDK 초기화 완료');
          resolve();
        } catch (error) {
          console.error('카카오 SDK 초기화 실패:', error);
          reject(error);
        }
      };

      script.onerror = () => {
        reject(new Error('카카오 SDK 로드 실패'));
      };

      document.head.appendChild(script);
    });
  }

  async login(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      window.Kakao.Auth.login({
        success: (authObj: any) => {
          console.log('카카오 로그인 성공:', authObj);
          this.getUserInfo()
            .then(userInfo => resolve({ authObj, userInfo }))
            .catch(reject);
        },
        fail: (err: any) => {
          console.error('카카오 로그인 실패:', err);
          reject(err);
        }
      });
    });
  }

  async getUserInfo(): Promise<any> {
    return new Promise((resolve, reject) => {
      window.Kakao.API.request({
        url: '/v2/user/me',
        success: (res: any) => {
          console.log('카카오 사용자 정보:', res);
          resolve(res);
        },
        fail: (err: any) => {
          console.error('사용자 정보 가져오기 실패:', err);
          reject(err);
        }
      });
    });
  }

  logout(): void {
    if (window.Kakao?.Auth) {
      window.Kakao.Auth.logout(() => {
        console.log('카카오 로그아웃 완료');
      });
    }
  }

  isLoggedIn(): boolean {
    return window.Kakao?.Auth?.getAccessToken() ? true : false;
  }
}

export const kakaoAuth = KakaoAuth.getInstance();
