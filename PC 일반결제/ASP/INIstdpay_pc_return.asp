<% @Language="VBScript" CODEPAGE="949" %>
<%
Response.CharSet="euc-kr"
Session.codepage="949"
Response.codepage="949"
Response.ContentType="text/html;charset=euc-kr"
%>
<!--#include virtual="/include/function.asp"-->
<!--#include virtual="/include/signature.asp"-->
<!--#include virtual="/include/aspJSON1.17.asp"-->
<!--#include virtual="/include/properties.asp"-->

<!DOCTYPE html>
<html lang="ko">

    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport"
            content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>KG이니시스 결제샘플</title>
        <link rel="stylesheet" href="css/style.css">
		<link rel="stylesheet" href="css/bootstrap.min.css">
    </head>

    <body class="wrap">

        <!-- 본문 -->
        <main class="col-8 cont" id="bill-01">
            <!-- 페이지타이틀 -->
            <section class="mb-5">
                <div class="tit">
                    <h2>일반결제</h2>
                    <p>KG이니시스 결제창을 호출하여 다양한 지불수단으로 안전한 결제를 제공하는 서비스</p>
                </div>
            </section>
            <!-- //페이지타이틀 -->


            <!-- 카드CONTENTS -->
            <section class="menu_cont mb-5">
                <div class="card">
                    <div class="card_tit">
                        <h3>PC 일반결제</h3>
                    </div>

                    <!-- 유의사항 -->
                    <div class="card_desc">
                        <h4>※ 유의사항</h4>
                        <ul>
                            <li>테스트MID 결제시 실 승인되며, 당일 자정(24:00) 이전에 자동으로 취소처리 됩니다.</li>
							<li>가상계좌 채번 후 입금할 경우 자동환불되지 않사오니, 가맹점관리자 내 "입금통보테스트" 메뉴를 이용부탁드립니다.<br>(실 입금하신 경우 별도로 환불요청해주셔야 합니다.)</li>
							<li>국민카드 정책상 테스트 결제가 불가하여 오류가 발생될 수 있습니다. 국민, 카카오뱅크 외 다른 카드로 테스트결제 부탁드립니다.</li>
                        </ul>
                    </div>
                    <!-- //유의사항 -->


<% 
		'#############################
		' 인증결과 파라미터 일괄 수신
		'#############################

		Set oJSON = New aspJSON

		if ("0000"=request("resultCode")) then

			'############################################
			' 1.전문 필드 값 설정(***가맹점 개발수정***)
			'############################################
			
			maid 		= request("mid")							' 가맹점 ID 수신 받은 데이터로 설정
			signKey 	= "SU5JTElURV9UUklQTEVERVNfS0VZU1RS"		' 가맹점 ID 와 매칭되는 signkey
			correct 	= "09"										' 표준시와의 차이를 2자리 숫자로 입력 (예: 대한민국은 표준시와 9시간 차이이므로 09)
			timestamp	= time_stamp(correct)
			charset 	= "EUC-KR"									' 리턴형식[UTF-8,EUC-KR](가맹점 수정후 고정)
			format 		= "JSON"									' 리턴형식[XML,JSON,NVP](가맹점 수정후 고정)	
			authUrl	    = request("authUrl")                        ' 승인요청 API url(수신 받은 값으로 설정, 임의 세팅 금지)
			authToken	= request("authToken")						' 취소 요청 tid에 따라서 유동적(가맹점 수정후 고정)
			netCancel	= request("netCancelUrl")					' 망취소 API url(수신 받은 값으로 설정, 임의 세팅 금지)
			merchantData= request("merchantData")					' 가맹점 관리데이터 수신

			
			'############################################
			' 2.signature 및 verification 생성
			'############################################
			signParam = "authToken=" & replace(authToken," ", "+")	
			signParam = signParam & "&timestamp=" & timestamp
			signature = MakeSignature(signParam)
			
			verifyParam = "authToken=" & replace(authToken," ", "+")	
			verifyParam = verifyParam & "&signKey=" & signKey
			verifyParam = verifyParam & "&timestamp=" & timestamp
			verification = MakeSignature(verifyParam)
			

			'#####################
			' 3.API 요청 전문 생성
			'#####################

			dim xmlHttp,  postdat
			Set xmlHttp = CreateObject("Msxml2.XMLHTTP")

			send_text = "mid="&maid
			send_text = send_text & "&timestamp="&timestamp
			send_text = send_text & "&signature="&signature
			send_text = send_text & "&verification="&verification
			send_text = send_text & "&authToken="&Server.URLEncode(authToken)
			send_text = send_text & "&charset="&charset
			send_text = send_text & "&format="&format
			

			'#####################
			' 4.API 통신 시작
			
			' 승인요청 API url (autnUrl) 리스트 는 properties 에 세팅하여 사용합니다.
            ' idc_name 으로 수신 받은 센터 네임을 properties 에서 include 하여 승인요청하시면 됩니다.
			'#####################
			
			if authUrl = authreqUrl then
			    
 			    xmlHttp.Open "POST", authreqUrl, False
 			    xmlHttp.setRequestHeader "Content-Type", "application/x-www-form-urlencoded; text/html; charset=euc-kr"
			    xmlHttp.Send send_text
			    result=Cstr( xmlHttp.responseText )
			    
			    Set oJSON = New aspJSON
			    oJSON.loadJSON(result)
				
			   else response.write ("authUrl Check Fail")
			
			End if
				
			'############################################################
			'5.API 통신결과 처리(***가맹점 개발수정***)
			'############################################################


			if "0000"=oJSON.data("resultCode")  then
			
			
			            response.write("<form name='' id='result' method='post' class='mt-5'>")
						response.write("<div class='row g-3 justify-content-between' style='--bs-gutter-x:0rem;'>")
                        response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>resultCode</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("resultCode")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>resultMsg</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("resultMsg")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>tid</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("tid")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>MOID</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("MOID")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>TotPrice</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("TotPrice")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>goodName</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("goodName")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>applDate</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("applDate")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>applTime</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("applTime")&"</label>")

                        response.write("</div></form>")						

			    '/*****************************************************************************
			    ' * 여기에 가맹점 내부 DB에 결제 결과를 반영하는 관련 프로그램 코드를 구현한다.  
			    '
			    '   [중요!] 승인내용에 이상이 없음을 확인한 뒤 가맹점 DB에 해당건이 정상처리 되었음을 반영함
			    '            처리중 에러 발생시 망취소를 한다.
			    '******************************************************************************/

						On Error Resume Next			' 에러가 날 경우 실행

					' 이부분에 DB 기록등 내부 서비스 구현 
					' 에러 발생시 망취소
							If Err.Number > 0 Then 
							'### 망취소 통신 시작
								response.write("##망취소 요청##</br>")
								send_text = "timestamp="&timestamp
								send_text = send_text & "&mid="&maid
								send_text = send_text & "&tid="&oJSON.data("tid")
								send_text = send_text & "&authToken="&Server.URLEncode(authToken)
								send_text = send_text & "&signature="&signature
								send_text = send_text & "&verification="&verification
								send_text = send_text & "&format="&format
								send_text = send_text & "&charset="&charset
								
					 			xmlHttp.Open "POST", netCancel, False
					 			xmlHttp.setRequestHeader "Content-Type", "application/x-www-form-urlencoded; text/html; charset=euc-kr"
								xmlHttp.Send send_text
								ask_result=Cstr( xmlHttp.responseText )
								Set xmlHttp = nothing
									response.write "<br>" &  ask_result &"<br>"
									'################# ask_result로 반환된 전문 중  "resultCode": "0000"  이면 정상 망취소 처리.
								response.end
			  			End If   
						Err.Clear      ' Clear the error.
						On Error GoTo 0
					' 망취소여기까지
				Set xmlHttp = nothing
				
			' 수신결과를 파싱후 resultCode가 "0000"이면 승인성공 이외 실패
			' 가맹점에서 스스로 파싱후 내부 DB 처리 후 화면에 결과 표시
			
			else 
			            response.write("<form name='' id='result' method='post' class='mt-5'>")
						response.write("<div class='row g-3 justify-content-between' style='--bs-gutter-x:0rem;'>")
                        response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>resultCode</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("resultCode")&"</label>")
						
						response.write("<label class='col-10 col-sm-2 gap-2 input param' style='border:none;'>resultMsg</label>")
                        response.write("<label class='col-10 col-sm-9 reinput'>"& oJSON.data("resultMsg")&"</label>")
						
						response.write("</div></form>")		


			' payViewType을 popup으로 해서 결제를 하셨을 경우
			' 내부처리후 스크립트를 이용해 opener의 화면 전환처리를 하세요
			end if

		else 
				'#############
				' 인증 실패시
				'#############
				response.write("<br/><br/><br/>")
				response.write("####인증실패####")

				For each item in Request.Form
				    for i = 1 to Request.Form(item).Count
				    	if not(item="authToken") then
								response.write("<pre>" & item & " = " & Request.Form(item)(i) & "</pre>")
							end if
				 Next
				Next



		end if
	Set oJSON = Nothing
		
%>

				<button onclick="location.href='INIstdpay_pc_req.asp'" class="btn_solid_pri col-6 mx-auto btn_lg" style="margin-top:50px">돌아가기</button>
					
                </div>
            </section>
			
        </main>
		
    </body>
</html>