<%
			Dim idc_name
			
			idc_name	= request("idc_name")

            Select Case (idc_name)
            
                Case "fc"
                   authreqUrl = "https://fcstdpay.inicis.com/api/payAuth"
                
                Case "ks"
                   authreqUrl = "https://ksstdpay.inicis.com/api/payAuth"
                
                Case Else :
                   authreqUrl = "https://stgstdpay.inicis.com/api/payAuth"
				   
            End Select
%>