using System;
using System.Data;
using System.Configuration;
using System.Collections;
using System.Web;
using System.Web.Security;
using System.Web.UI;
using System.Web.UI.WebControls;
using System.Web.UI.WebControls.WebParts;
using System.Web.UI.HtmlControls;
using System.Security.Cryptography;
using System.Text;

public partial class INIStdPayRequest : System.Web.UI.Page
{

    
    protected void Page_Load(object sender, EventArgs e)
    {
        // 여기에 사용자 코드를 배치하여 페이지를 초기화합니다.
        if (!Page.IsPostBack)
            StartINIStd();	

    }
   
    private void StartINIStd()
    {
        //각 필드 설정
        
        string strMid = "INIpayTest";
        mid.Text = strMid;

        string strVersion = "1.0";
        version.Text = strVersion;

        string strGoodName = "테스트";
        goodname.Text = strGoodName;

        string strPrice = "1000";
        price.Text = strPrice;

        string strCurrency = "WON";
        currency.Text = strCurrency;

        string strBuyerName = "홍길동";
        buyername.Text = strBuyerName;

        string strBuyerTel = "010-1234-1234";
        buyertel.Text = strBuyerTel;

        string strBuyerEmail = "test@inicis.com";
        buyeremail.Text = strBuyerEmail;
        
        

        // TimeStamp 생성
        string timeTemp = "" + DateTime.UtcNow.Subtract(DateTime.MinValue.AddYears(1969)).TotalMilliseconds;
        string[] artime = timeTemp.Split('.');
        timestamp.Text = artime[0];

        oid.Text = mid.Text + "_" + timestamp.Text;

        //Signature 생성 - 알파벳 순으로 정렬후 hash
        string param = "oid=" + oid.Text + "&price=" + price.Text + "&timestamp=" + timestamp.Text;
        signature.Text = ComputeHash(param);
		
		
		// 가맹점확인을 위한 signKey 를 해쉬값으로 변경(SHA-256)
        string signKey = "SU5JTElURV9UUklQTEVERVNfS0VZU1RS";   // 가맹점에 제공된 가맹점 키 (외부유출금지)
		mKey.Text = ComputeHash(signKey);
		
        
		//PC보안강화 사용 선언 및 verification 정렬후 hash
        string strUse_chkfake = "Y";
        use_chkfake.Text = strUse_chkfake;
		
        string param2 = "oid=" + oid.Text + "&price=" + price.Text + "&signKey=" + signKey + "&timestamp=" + timestamp.Text;
        verification.Text = ComputeHash(param2);
		

        //closeURL
        string close = "https://[가맹점도메인]/close.aspx";
        closeUrl.Text = close;

                
        //가맹점 전환 페이지 설정
        string strReturnUrl = "https://[가맹점도메인]/INIStdPayReturn.aspx";
        returnUrl.Text = strReturnUrl;




    }
    
    // SHA256  256bit 암호화
    private string ComputeHash(string input)
    {
        System.Security.Cryptography.SHA256 algorithm = System.Security.Cryptography.SHA256Managed.Create();
        Byte[] inputBytes = Encoding.UTF8.GetBytes(input);
        Byte[] hashedBytes = algorithm.ComputeHash(inputBytes);

        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < hashedBytes.Length; i++)
        {
            sb.Append(String.Format("{0:x2}", hashedBytes[i]));
        }

        
        return sb.ToString();
    }
    


    
   
}
