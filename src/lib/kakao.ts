
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
      const KakaoObj = window.Kakao;
      if (!KakaoObj) {
        reject(new Error('카카오 SDK가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.'));
        return;
      }

      // 카카오 SDK v2에서 제공하는 다양한 로그인 방식 시도
      let loginMethod = null;
      
      // 1. Kakao.Auth.authorize (최신 방식)
      if (KakaoObj.Auth && typeof KakaoObj.Auth.authorize === 'function') {
        loginMethod = () => {
          KakaoObj.Auth.authorize({
            redirectUri: window.location.origin + '/auth/kakao/callback',
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
        };
      }
      // 2. Kakao.Auth.login (기존 방식)
      else if (KakaoObj.Auth && typeof KakaoObj.Auth.login === 'function') {
        loginMethod = () => {
          KakaoObj.Auth.login({
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
        };
      }
      // 3. Kakao.Login.login (일부 버전)
      else if (KakaoObj.Login && typeof KakaoObj.Login.login === 'function') {
        loginMethod = () => {
          KakaoObj.Login.login({
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
        };
      }
      // 4. 팝업 방식 로그인 시도
      else if (KakaoObj.Auth) {
        loginMethod = () => {
          // 팝업 방식으로 카카오 로그인 시도
          const loginUrl = `https://kauth.kakao.com/oauth/authorize?client_id=379ca4f197e4bbe01ffbd571fe20d1de&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code`;
          
          const popup = window.open(
            loginUrl,
            'kakao-login',
            'width=500,height=600,scrollbars=yes,resizable=yes'
          );

          const checkClosed = setInterval(() => {
            if (popup?.closed) {
              clearInterval(checkClosed);
              // 팝업이 닫히면 토큰 확인
              if (KakaoObj.Auth.getAccessToken && KakaoObj.Auth.getAccessToken()) {
                this.getUserInfo()
                  .then(userInfo => resolve({ authObj: { access_token: KakaoObj.Auth.getAccessToken() }, userInfo }))
                  .catch(reject);
              } else {
                reject(new Error('카카오 로그인이 취소되었습니다.'));
              }
            }
          }, 1000);
        };
      }

      if (loginMethod) {
        try {
          loginMethod();
        } catch (error) {
          console.error('카카오 로그인 실행 오류:', error);
          reject(error);
        }
      } else {
        // 모든 방식이 실패할 경우 SDK 재초기화 시도
        console.warn('카카오 로그인 메소드를 찾을 수 없습니다. SDK를 재초기화합니다.');
        this.isInitialized = false;
        this.initialize()
          .then(() => {
            // 재초기화 후 다시 시도
            if (window.Kakao?.Auth?.login) {
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
            } else {
              reject(new Error('카카오 SDK 로딩에 문제가 있습니다. 페이지를 새로고침해주세요.'));
            }
          })
          .catch(reject);
      }
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
    const KakaoObj = window.Kakao;
    if (!KakaoObj) return;

    // v2 SDK는 Kakao.Auth.logout 대신 Kakao.Login.logout 사용
    if (KakaoObj.Login && typeof KakaoObj.Login.logout === 'function') {
      KakaoObj.Login.logout(() => {
        console.log('카카오 로그아웃 완료');
      });
    } else if (KakaoObj.Auth && typeof KakaoObj.Auth.logout === 'function') {
      KakaoObj.Auth.logout(() => {
        console.log('카카오 로그아웃 완료');
      });
    }
  }

  isLoggedIn(): boolean {
    const KakaoObj = window.Kakao;
    if (!KakaoObj) return false;

    // v2 SDK는 getAccessToken이 Auth 또는 Login 어느 쪽에도 없을 수 있어 토큰 존재 판단을 유연하게 처리
    try {
      if (KakaoObj.Auth && typeof KakaoObj.Auth.getAccessToken === 'function') {
        return !!KakaoObj.Auth.getAccessToken();
      }
      if (KakaoObj.Login && typeof KakaoObj.Login.getAccessToken === 'function') {
        return !!KakaoObj.Login.getAccessToken();
      }
      // 일부 환경에서는 SDK 내부에 토큰 저장이 비공개일 수 있으므로 사용자 정보 요청 가능 여부로 추정하지 않음
      return false;
    } catch {
      return false;
    }
  }
}

export const kakaoAuth = KakaoAuth.getInstance();
