<%

'//// inval 로 들어온 문장의 왼쪽에 padnum 전체자리숫자가 찰때까지 padchar로 채워주기 )
function pad_left(inval, padnum, padchar)
	for pad_i = 0 to padnum - len(inval)-1
		inval = padchar & inval
	next
	pad_left = inval
end function


'//// inval 로 들어온 문장의 오른쪽에 padnum 전체자리숫자가 찰때까지 padchar로 채워주기 )
function pad_right(inval, padnum, padchar)
	for pad_i = 0 to padnum - len(inval)-1
		inval = inval & padchar
	next
	pad_right = inval
end function

function time_stamp(correct) 
	time_stamp			= DateDiff("s", "1970-01-01 "&correct&":00:00", now)*1000+clng(timer) 
end function 
'****************************************************************************************
'*
'*  형 식 : Function
'*  정 의 : Public Function URLEncode(URLStr)
'*  설 명 : URLStr 인자로 입력받은 문자열을 URLEncoding 한다.
'*  작 성 : 송원석
'*  날 짜 : 2001.12.03
'*
'****************************************************************************************
Public Function URLEncode(URLStr)

 Dim sURL                '** 입력받은 URL 문자열
 Dim sBuffer             '** Encoding 중의 URL 을 담을 Buffer 문자열
 Dim sTemp               '** 임시 문자열
 Dim cChar               '** URL 문자열 중의 현재 Index 의 문자

 Dim Index

 On Error Resume Next

 Err.Clear
    sURL = Trim(URLStr)     '** URL 문자열을 얻는다.
    sBuffer = ""            '** 임시 Buffer 용 문자열 변수 초기화.


    '******************************************************
    '* URL Encoding 작업
    '******************************************************

    For Index = 1 To Len(sURL)
        '** 현재 Index 의 문자를 얻는다.
        cChar = Mid(sURL, Index, 1)

        If cChar = "0" Or _
           (cChar >= "1" And cChar <= "9") Or _
           (cChar >= "a" And cChar <= "z") Or _
           (cChar >= "A" And cChar <= "Z") Or _
           cChar = "-" Or _
           cChar = "_" Or _
           cChar = "." Or _
           cChar = "*" Then

            '** URL 에 허용되는 문자들 :: Buffer 문자열에 추가한다.
            sBuffer = sBuffer & cChar

        ElseIf cChar = " " Then
            '** 공백 문자 :: + 로 대체하여 Buffer 문자열에 추가한다.
            sBuffer = sBuffer & "+"
        Else
            '** URL 에 허용되지 않는 문자들 :: % 로 Encoding 해서 Buffer 문자열에 추가
            sTemp = CStr(Hex(Asc(cChar)))

            If Len(sTemp) = 4 Then
                sBuffer = sBuffer & "%" & Left(sTemp, 2) & "%" & Mid(sTemp, 3, 2)
            ElseIf Len(sTemp) = 2 Then
                sBuffer = sBuffer & "%" & sTemp
            End If
        End If
    Next


    '** Error 처리
    If Err.Number > 0 Then
        URLEncode = ""
        Exit Function
    End If

    '** 결과를 리턴한다.
    URLEncode = sBuffer
    Exit Function

End Function


'****************************************************************************************
'*
'*  형 식 : Function
'*  정 의 : Public Function URLDecode(URLStr)
'*  설 명 : URLStr 인자로 입력받은 문자열을 URLDecoding 한다.
'*  작 성 : 송원석
'*  날 짜 : 2001.12.03
'*
'****************************************************************************************
Public Function URLDecode(URLStr)

    Dim sURL                '** 입력받은 URL 문자열
    Dim sBuffer             '** Decoding 중의 URL 을 담을 Buffer 문자열
    Dim cChar               '** URL 문자열 중의 현재 Index 의 문자

    Dim Index
    Dim s,bUnicode

 On Error Resume Next

    Err.Clear
    sURL = Trim(URLStr)     '** URL 문자열을 얻는다.
    sBuffer = ""            '** 임시 Buffer 용 문자열 변수 초기화.

    '******************************************************
    '* URL Decoding 작업
    '******************************************************
    '한글이 입력되는 경우가 2가지 있음
    ' "%C0%DA" ->일반 
    ' "%uC911" ->유니코드 chr 대신 chrW 사용

    Index = 1
 
 '?,%가 없다면 검색할 필요없음
 if instr(1,pURL,"?",1) > 0 OR instr(1,pURL,"%",1) > 0 then
     Do While Index <= Len(sURL)
         cChar = Mid(sURL, Index, 1)
         If cChar = "+" Then        
             '** '+' 문자 :: ' ' 로 대체하여 Buffer 문자열에 추가한다.
             sBuffer = sBuffer & " "
             Index = Index + 1            
         ElseIf cChar = "%" Then        
             '** '%' 문자 :: Decoding 하여 Buffer 문자열에 추가한다.
             
             '유니코드인지 판단한 후에 일반문자인지 한글인지 구분함
             bUnicode = false
             
             s = Mid(sURL, Index + 1, 5)
             bUnicode = boolUnicode(s)
             
             if bUnicode = true then
              cChar = Mid(sURL, Index + 2, 2)
             else
              cChar = Mid(sURL, Index + 1, 2)
             end if
 
             If CInt("&H" & cChar) < &H80 Then
                 '** 일반 ASCII 문자
                 sBuffer = sBuffer & Chr(CInt("&H" & cChar))
                 Index = Index + 3
             Else
                 '** 2 Byte 한글 문자
                 cChar = Replace(Mid(sURL, Index + 1, 5), "%", "")
                 
                 '유니코드인경우 맨앞의 u자를 제거해야 함
                 if bUnicode = true then  'C0DA
                  cChar = mid(cChar,2,4)
                  sBuffer = sBuffer & ChrW(CInt("&H" & cChar))
                 else      'uC911
                  sBuffer = sBuffer & Chr(CInt("&H" & cChar))
                 end if
                 Index = Index + 6
             End If
         Else
             '** 그 외의 일반 문자들 :: Buffer 문자열에 추가한다.
             sBuffer = sBuffer & cChar
             Index = Index + 1
         End If
     Loop
 else
  sBuffer = ""
 end if
 
    '** Error 처리
    If Err.Number > 0 Then
        URLDecode = ""
        Exit Function
    End If

    '** 결과를 리턴한다.
    URLDecode = sBuffer
    Exit Function

End Function

'****************************************************************************************
'*  형 식 : Function
'*  정 의 : Public Function boolUnicode(s)
'*  설 명 : s 인자로 입력받은 문자열을 기준으로 유니코드인지 판단한다.
'*  작 성 : kimyh
'*  날 짜 : 2007.01.25
'****************************************************************************************
Function boolUnicode(s)
 'true = 유니코드(%uC911)  false=일반(%C0%DA) 형식으로 문자열이 잘리므로
 '첫번째 %를 제거하여 %가 발견되지 않으면 유니코드로 판단
 
 tmp = false
 if instr(1,s,"%",1) <= 0 then tmp = true
 boolUnicode = tmp
 
End Function


'---------------------------------------------------------------------
' URLEncodeUTF8 (아스키 -> UTF8)
' Devpia.com 고일호(n4kjy)님 - 2002-07-24
'---------------------------------------------------------------------
Public Function URLEncodeUTF8(byVal szSource)

 Dim szChar, WideChar, nLength, i, result
 nLength = Len(szSource)

 szSource = Replace(szSource," ","+")

 For i = 1 To nLength
  szChar = Mid(szSource, i, 1)

  If Asc(szChar) < 0 Then             
   WideChar = CLng(AscB(MidB(szChar, 2, 1))) * 256 + AscB(MidB(szChar, 1, 1))

   If (WideChar And &HFF80) = 0 Then
    result = result & "%" & Hex(WideChar)
   ElseIf (WideChar And &HF000) = 0 Then
    result = result & _
    "%" & Hex(CInt((WideChar And &HFFC0) / 64) Or &HC0) & _
    "%" & Hex(WideChar And &H3F Or &H80)
   Else
    result = result & _
    "%" & Hex(CInt((WideChar And &HF000) / 4096) Or &HE0) & _
    "%" & Hex(CInt((WideChar And &HFFC0) / 64) And &H3F Or &H80) & _
    "%" & Hex(WideChar And &H3F Or &H80)
   End If
  Else
   result = result + szChar
  End If
 Next
 URLEncodeUTF8 = result
End Function


'---------------------------------------------------------------------
' URLDecodeUTF8 (UTF8 --> 아스키 )
' mongmong - 2003. 10 (URLEncodeUTF8 참조)
'---------------------------------------------------------------------
Public Function URLDecodeUTF8(byVal pURL)
 Dim i, s1, s2, s3, u1, u2, result
 pURL = Replace(pURL,"+"," ")
 
 '?,%가 없다면 검색할 필요없음
 if instr(1,pURL,"?",1) > 0 OR instr(1,pURL,"%",1) > 0 then
   For i = 1 to Len(pURL)
    if Mid(pURL, i, 1) = "%" then
     s1 = CLng("&H" & Mid(pURL, i + 1, 2))
  
     '2바이트일 경우
     if ((s1 AND &HC0) = &HC0) AND ((s1 AND &HE0) <> &HE0) then
      s2 = CLng("&H" & Mid(pURL, i + 4, 2))
  
      u1 = (s1 AND &H1C) / &H04
      u2 = ((s1 AND &H03) * &H04 + ((s2 AND &H30) / &H10)) * &H10
      u2 = u2 + (s2 AND &H0F)
      result = result & ChrW((u1 * &H100) + u2)
      i = i + 5
  
     '3바이트일 경우
     elseif (s1 AND &HE0 = &HE0) then
      s2 = CLng("&H" & Mid(pURL, i + 4, 2))
      s3 = CLng("&H" & Mid(pURL, i + 7, 2))
  
      u1 = ((s1 AND &H0F) * &H10)
      u1 = u1 + ((s2 AND &H3C) / &H04)
      u2 = ((s2 AND &H03) * &H04 +  (s3 AND &H30) / &H10) * &H10
      u2 = u2 + (s3 AND &H0F)
      result = result & ChrW((u1 * &H100) + u2)
      i = i + 8
     end if
    else
     result = result & Mid(pURL, i, 1)
    end if
   Next
 else
  result = ""
 end if
 URLDecodeUTF8 = result
End Function
%>
