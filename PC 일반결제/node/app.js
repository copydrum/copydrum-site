const express = require("express"); 
const app = express();
const crypto = require('crypto'); 
const bodyParser = require("body-parser");
const request = require('request');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));

app.set("views" , __dirname+"/views");
app.set("views engline" , "ejs");
app.engine("html", require("ejs").renderFile);

app.use(express.static("views"));  
const getUrl = require('./properties');



app.get("/" , (req,res) =>{
    const mid = "INIpayTest";                                               // 상점아이디
    const signKey = "SU5JTElURV9UUklQTEVERVNfS0VZU1RS";
    const mKey = crypto.createHash("sha256").update(signKey).digest('hex'); // SHA256 Hash값 [대상: mid와 매칭되는 signkey]
    const oid = "INIpayTest_01234";                                         // 주문번호
    const price = "1000";                                                   // 결제금액
    const timestamp = new Date().getTime();                                 // 타임스템프 [TimeInMillis(Long형)]
    const use_chkfake = "Y";                             
    const signature  = crypto.createHash("sha256").update("oid="+oid+"&price="+price+"&timestamp="+timestamp).digest('hex'); //SHA256 Hash값 [대상: oid, price, timestamp]
    const verification = crypto.createHash("sha256").update("oid="+oid+"&price="+price+"&signKey="+signKey+"&timestamp="+timestamp).digest('hex'); //SHA256 Hash값 [대상: oid, price, signkey, timestamp]

    res.render("INIstdpay_pc_req.html" , {
        mid : mid,
        oid : oid,
        price : price,
        timestamp : timestamp,
        mKey : mKey,
        use_chkfake : use_chkfake,
        signature : signature,
        verification : verification
    });
});

app.post("/INIstdpay_pc_return.ejs" , (req , res) => {
    
    if(req.body.resultCode === "0000"){

        //############################################
		//1.전문 필드 값 설정(***가맹점 개발수정***)
		//############################################

        const mid = req.body.mid;                       // 상점아이디
        const signKey = "SU5JTElURV9UUklQTEVERVNfS0VZU1RS";
        const authToken = req.body.authToken;           // 승인요청 검증 토큰
        const netCancelUrl = req.body.netCancelUrl;     // 망취소요청 Url 
        const merchantData = req.body.merchantData;
        const timestamp = new Date().getTime();         // 타임스템프 [TimeInMillis(Long형)]
        const charset = "UTF-8";                        // 리턴형식[UTF-8,EUC-KR](가맹점 수정후 고정)
        const format = "JSON";                          // 리턴형식[XML,JSON,NVP](가맹점 수정후 고정)

        //##########################################################################
        // 승인요청 API url (authUrl) 리스트 는 properties 에 세팅하여 사용합니다.
        // idc_name 으로 수신 받은 센터 네임을 properties 에서 include 하여 승인 요청하시면 됩니다.
        //##########################################################################   

        const idc_name = req.body.idc_name;             
        const authUrl = req.body.authUrl;               // 승인요청 Url
        const authUrl2 = getUrl.getAuthUrl(idc_name);

        // SHA256 Hash값 [대상: authToken, timestamp]
        const signature  = crypto.createHash("sha256").update("authToken="+authToken+"&timestamp="+timestamp).digest('hex');

        // SHA256 Hash값 [대상: authToken, signKey, timestamp]
        const verification  = crypto.createHash("sha256").update("authToken="+authToken+"&signKey="+signKey+"&timestamp="+timestamp).digest('hex');
    
    
        
        //결제 승인 요청 
        let options = { 
                mid : mid,
                authToken : authToken, 
                timestamp : timestamp,
                signature : signature,
                verification : verification,
                charset : charset,
                format : format
        };

        if(authUrl == authUrl2) {

            request.post({method: 'POST', uri: authUrl2, form: options, json: true}, (err,httpResponse,body) =>{ 
                
                try{
    
                    let jsoncode = (err) ? err : JSON.stringify(body);

                    let result = JSON.parse(jsoncode)
                    
                    res.render('INIstdpay_pc_return.ejs',{
                        resultCode : result.resultCode,
                        resultMsg : result.resultMsg,
                        tid : result.tid,
                        MOID : result.MOID,
                        TotPrice : result.TotPrice,
                        goodName : result.goodName,
                        applDate : result.applDate,
                        applTime : result.applTime

                    })
                }catch(e){
                    /*
                        가맹점에서 승인결과 전문 처리 중 예외발생 시 망취소 요청할 수 있습니다.
                        승인요청 전문과 동일한 스펙으로 진행되며, 인증결과 수신 시 전달받은 "netCancelUrl" 로 망취소요청합니다.

                        ** 망취소를 일반 결제취소 용도로 사용하지 마십시오.
                        일반 결제취소는 INIAPI 취소/환불 서비스를 통해 진행해주시기 바랍니다.
                    */
                    console.log(e);
                    const netCancelUrl2 = getUrl.getNetCancel(idc_name)
                    if(netCancelUrl == netCancelUrl2) {
                        request.post({method: 'POST', uri: netCancelUrl2, form: options, json: true}, (err,httpResponse,body) =>{
                            let result = (err) ? err : JSON.stringify(body);
                    
                            console.log("<p>"+result+"</p>");
                        });
                    }
                }
             });
        }
        
    }else{
        res.render('INIstdpay_pc_return.ejs',{
            resultCode : req.body.resultCode,
            resultMsg :req.body.resultMsg,
            tid : req.body.tid,
            MOID : req.body.MOID,
            TotPrice: req.body.TotPrice,
            goodName : req.body.goodName,
            applDate : req.body.applDate,
            applTime : req.body.applTime
           })
    }
});

app.get('/close', (req, res) => {
    res.send('<script language="javascript" type="text/javascript" src="https://stdpay.inicis.com/stdjs/INIStdPay_close.js" charset="UTF-8"></script>');
});


app.listen(3000 , (err) =>{
    if(err) return console.log(err);
    console.log("The server is listening on port 3000");
});