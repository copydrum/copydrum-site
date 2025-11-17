<%@ Page Language="C#" AutoEventWireup="true" CodeFile="INIStdPayRequest.aspx.cs" Inherits="INIStdPayRequest" %>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">

<html xmlns="http://www.w3.org/1999/xhtml" >
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
        <title>INIStd 웹표준결제</title>

        <style type="text/css">
            body { background-color: #efefef;}
            body, tr, td {font-size:9pt; font-family:굴림,verdana; color:#433F37; line-height:19px;}
            table, img {border:none}
        </style>

        <!-- 이니시스 표준결제 js -->
        <!-- 테스트 JS(샘플에 제공된 테스트 MID 전용) -->
      	<script language="javascript" type="text/javascript" src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js" charset="UTF-8"></script>
		<!-- 상용 JS(가맹점 MID 변경 시 주석 해제, 테스트용 JS 주석 처리 필수!) -->
      	<!--script language="javascript" type="text/javascript" src="https://stdpay.inicis.com/stdjs/INIStdPay.js" charset="UTF-8"></script-->
		<!-- =================================================================================================================================================
		
				테스트 JS 는 이니시스 테스트 MID (INIpayTest, INIBillTst)로만 요청할 수 있습니다.
				부여받은 가맹점 MID 세팅 시, '반드시' 운영 JS로 변경한 후 결제 진행 부탁드립니다. (위 운영 JS 주석 해제 필요)
				
		================================================================================================================================================= -->
        <script type="text/javascript">
        function send()
        {
            INIStdPay.pay('SendPayForm_id');
        }
        </script>

    </head>
    <body >
        <div style="padding:10px;background-color:#f3f3f3;width:100%;font-size:13px;color: #ffffff;background-color: #000000;text-align: center">
            이니시스 표준결제 결제요청 샘플
        </div>
        <table width="650" cellspacing="0" cellpadding="0"   border="0" align="center">
            <tr>
                <td style="padding:10px; background-color: #6095BC; text-align: center;" align="center">
                    <table style="background-color: White">

                        <tr>
                            <td>
                                이 페이지는 INIpay Standard 결제요청을 위한 예시입니다.<br/>
                                <br/>
                                결제처리를 위한 action등의 모든 동작은 Import 된 스크립트에 의해 자동처리됩니다.<br/>

                                <br/>
                                Form에 설정된 모든 필드의 name은 대소문자 구분하며,<br/>
                                이 Sample은 결제를 위해서 설정된 Form은 테스트 / 이해돕기를 위해서 모두 type="text"로 설정되어 있습니다.<br/>
                                운영에 적용시에는 일부 가맹점에서 필요에 의해 사용자가 변경하는 경우를 제외하고<br/>
                                모두 type="hidden"으로 변경하여 사용하시기 바랍니다.<br/>

                                <br/>
                                <strong style="color: #336699;">함께 제공되는 메뉴얼을 참조하여 작성 개발하시기 바랍니다.</strong>
                                <br/><br/>
                            </td>
                        </tr>
                        <tr>
                            
                        </tr>
                        <tr>
                            <td>
                                <table>
                                    <tr>
                                        <td >
                                            <form id="SendPayForm_id" method="post"    runat="server">   
                                                           
                                                <asp:Button id="Button1"  runat="server" Text="결제요청" OnClientClick="send();return false;" Height="100px" Width="200px" ></asp:Button>

                                                <!-- 필수 -->
                                                <br/><b>***** 필 수 *****</b>
                                                <div style="border:2px #dddddd double;padding:10px;background-color:#f3f3f3;text-align:left">

                                                    <br/><b>version</b> :
                                                    <br/><asp:textbox    id="version" Text="" runat="server" />


                                                    <br/><b>mid</b> :
                                                    <br/><asp:textbox    id="mid" Text="" runat="server" />

                                                    <br/><b>goodname</b> :
                                                    <br/><asp:textbox   id="goodname" Text="" runat="server" />

                                                    <br/><b>oid</b> :
                                                    <br/><asp:textbox   id="oid" Text="" runat="server"/>

                                                    <br/><b>price</b> :
                                                    <br/><asp:textbox   id="price" Text="" runat="server"/>

                                                    <br/><b>currency</b> :
                                                    <br/>[WON|USD]
                                                    <br/><asp:textbox   id="currency" Text="" runat="server" />

                                                    <br/><b>buyername</b> :
                                                    <br/><asp:textbox   id="buyername" Text="" runat="server"/>

                                                    <br/><b>buyertel</b> :
                                                    <br/><asp:textbox   id="buyertel" Text="" runat="server" />

                                                    <br/><b>buyeremail</b> :
                                                    <br/><asp:textbox   id="buyeremail" Text="" runat="server"/>

                                                    <br/><b>timestamp</b> :
                                                    <br/><asp:textbox    id="timestamp" Text=""  runat="server" Width="400px" />   


                                                    <br/><b>signature</b> :
                                                    <br/><asp:textbox   id="signature" runat="server" Width="400px" />
													
													<br/><b>use_chkfake</b> :
                                                    <br/><asp:textbox   id="use_chkfake" Text="" runat="server"/>
													
													<br/><b>verification</b> :
                                                    <br/><asp:textbox   id="verification" runat="server" Width="400px" />
													

                                                    <br/><b>returnUrl</b> :
                                                    <br/><asp:textbox   id="returnUrl" Text="" runat="server" Width="400px"/>
                                                    <br/><b>MKEY(가맹점키)</b> :
                                                    <br/><asp:textbox  id="mKey" runat="server" />
                                                </div>

                                                <br/><br/>
                                                <b>***** 기본 옵션 *****</b>
                                                <div style="border:2px #dddddd double;padding:10px;background-color:#f3f3f3;text-align:left">
                                                    <b>gopaymethod</b> : 결제 수단 선택
                                                    <br/>ex) Card (계약 결제 수단이 존재하지 않을 경우 에러로 리턴)
                                                    <br/>사용 가능한 입력 값
                                                    <br/>Card,DirectBank,HPP,Vbank,kpay,Swallet,Paypin,EasyPay,PhoneBill,GiftCard,EWallet
                                                    <br/>onlypoint,onlyocb,onyocbplus,onlygspt,onlygsptplus,onlyupnt,onlyupntplus
                                                    <br/><asp:textbox   id="gopaymethod" Text="" runat="server" />
                                                    <br/><br/>

                                                    <br/>
                                                    <b>offerPeriod</b> : 제공기간
                                                    <br/>ex)20150101-20150331, [Y2:년단위결제, M2:월단위결제, yyyyMMdd-yyyyMMdd : 시작일-종료일]
                                                    <br/><asp:textbox   id="offerPeriod" Text="2015010120150331"  runat="server" />
                                                    <br/><br/>

                                                    <br/><b>acceptmethod</b> : acceptmethod
                                                    <br/>acceptmethod  ex) CARDPOINT:SLIMQUOTA(코드-개월:개월):no_receipt:va_receipt:vbank(20150425):va_ckprice: 
                                                    <br/>KWPY_TYPE(0):KWPY_VAT(10|0) 기타 옵션 정보 및 설명은 연동정의보 참조 구분자 ":"
                                                    <br/><asp:textbox  id="acceptmethod" Text="HPP(1):no_receipt:va_receipt:below1000:centerCd(Y)" runat="server" Width="500px" />
                                                </div>

                                                <br/><br/>
                                                <b>***** 표시 옵션 *****</b>
                                                <div style="border:2px #dddddd double;padding:10px;background-color:#f3f3f3;text-align:left">
                                                    <br/><b>languageView</b> : 초기 표시 언어
                                                    <br/>[ko|en] (default:ko)
                                                    <br/><asp:textbox  id="languageView" Text="" runat="server" />

                                                    <br/><b>charset</b> : 리턴 인코딩
                                                    <br/>[UTF-8|EUC-KR] (default:UTF-8)
                                                    <br/><asp:textbox  id="charset" Text="" runat="server" />

                                                    <br/><b>payViewType</b> : 결제창 표시방법
                                                    <br/>[overlay] (default:overlay)
                                                    <br/><asp:textbox  id="payViewType" Text="" runat="server" Width="210px"/>

                                                    <br/><b>closeUrl</b> : payViewType='overlay','popup'시 취소버튼 클릭시 창닫기 처리 URL(가맹점에 맞게 설정)
                                                    <br/>close.jsp 샘플사용(생략가능, 미설정시 사용자에 의해 취소 버튼 클릭시 인증결과 페이지로 취소 결과를 보냅니다.)
                                                    <br/><asp:textbox  id="closeUrl" Text="" runat="server" Width="400px" />

                                          
                                                </div>

                                                <b>***** 결제 수단별 옵션 *****</b>
                                                <br/>
                                                <b>-- 카드(간편결제도 사용) --</b>
                                                <div style="border:2px #cccccc solid;padding:10px;background-color:#f3f3f3;text-align:left">
                                                    <br/><b>nointerest</b> : 무이자 할부 개월
                                                    <br/>ex) 11-2:3:4,04-2:3:4
                                                    <br/><asp:textbox   id="nointerest" Text="11-2:3:,34-5:12,14-6:12:24,12-12:36,06-9:12,01-3:4" runat="server" Width="400px" />

                                                    <br/><b>quotabase</b> : 할부 개월
                                                    <br/>ex) 2:3:4
                                                    <br/><asp:textbox   id="quotabase" Text="2:3:4:5:6:11:12:24:36" runat="server" Width="400px"  />	

                                                </div>

                                                <b>-- 가상계좌 --</b>
                                                <div style="border:2px #cccccc solid;padding:10px;background-color:#f3f3f3;text-align:left">
                                                    <br/><b>INIregno</b> : 주민번호 설정 기능
                                                    <br/>13자리(주민번호),10자리(사업자번호),미입력시(화면에서입력가능)
                                                    <br/><asp:textbox   id="INIregno" Text="" runat="server" Width="400px" />
                                                </div>

                                                <br/><br/>
                                                <b>***** 추가 옵션 *****</b>
                                                <div style="border:2px #dddddd double;padding:10px;background-color:#f3f3f3;text-align:left">
                                                    <br/><b>merchantData</b> : 가맹점 관리데이터(1000byte)
                                                    <br/>**인증결과 리턴시 함께 전달됨(한글 지원 안됨, 개인정보 암호화(권장))
                                                    <br/><asp:textbox   id="merchantData" Text=""  runat="server" Width="400px" />
                                                </div>
                                            </form>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>