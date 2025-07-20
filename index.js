//
//@package Lanzou_API
//@author iami233
//@version 2.0.0
//@link http://github.com/5ime/Lanzou_api
//
//
class LanzouParser {
  constructor(url, pwd = "", type = "") {
    this.url = url;
    this.pwd = pwd;
    this.type = type;
  }
  parse() {
    var url = this.formatUrl();
    var headers = this.getHeaders();
    var content = this.getPageContent(url, headers);
    if (this.isFileDeleted(content)) {
      response(false, "\u6587\u4EF6\u53D6\u6D88\u5206\u4EAB\u4E86");
    }
    var fileInfo = this.extractFileInfo(content);
    if (!fileInfo) {
      response(false, "\u89E3\u6790\u5931\u8D25");
    }
    if (strpos(content, "function down_p(){") !== false) {
      if (!this.pwd) {
        response(false, "\u8BF7\u8F93\u5165\u5206\u4EAB\u5BC6\u7801");
      }
      preg_match("~v3c = '(.*?)';~", content, sign);
      var sign = sign[1] || "";
      if (sign.length < 82) {
        preg_match_all("~sign'\\:'(.*?)'~", content, sign);
        sign = sign[1][1] || "";
      }
      preg_match("~ajaxm.php\\?file=(\\d+)~", content, ajaxm);
      var postData = {
        action: "downprocess",
        sign: sign,
        p: this.pwd,
        kd: 1
      };
      headers.push("Referer: " + url);
      var apiUrl = "https://www.lanzoux.com/" + (ajaxm[0] || "");
      fileInfo.content = curlRequest(apiUrl, postData, headers);
    } else {
      preg_match("~<iframe.*?src=\"/(.*?)\"~", content, iframe);
      var iframeUrl = "https://www.lanzoup.com/" + (iframe[1] || "");
      var iframeContent = curlRequest(iframeUrl);
      preg_match("~wp_sign = '(.*?)'~", iframeContent, sign);
      preg_match_all("/ajaxm\\.php\\?file=(\\d+)/", iframeContent, ajaxm);
      postData = {
        action: "downprocess",
        signs: "?ctdf",
        sign: sign[1] || "",
        kd: 1
      };
      headers.push("Referer: " + url);
      apiUrl = "https://www.lanzoux.com/" + (ajaxm[0][1] || ajaxm[0][0] || "");
      fileInfo.content = curlRequest(apiUrl, postData, headers);
    }
    var downloadUrl = this.getDownloadUrl(fileInfo);
    if (!downloadUrl) {
      response(false, "\u83B7\u53D6\u4E0B\u8F7D\u94FE\u63A5\u5931\u8D25");
    }
    response(true, "", {
      name: fileInfo.name,
      size: fileInfo.size,
      time: fileInfo.time,
      url: downloadUrl
    });
  }
  formatUrl() {
    var parts = this.url.split(".com/");
    return "https://www.lanzoup.com/" + (parts[1] || "");
  }
  getHeaders() {
    return ["User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36"];
  }
  getPageContent(url, headers) {
    return curlRequest(url, Array(), headers);
  }
  isFileDeleted(content) {
    return strpos(content, "\u6587\u4EF6\u53D6\u6D88\u5206\u4EAB\u4E86") !== false;
  }
  extractFileInfo(content) {
    preg_match("~\u6587\u4EF6\u5927\u5C0F\uFF1A(.*?)\"~", content, size);
    preg_match("~n_file_infos\"\\>(.*?)\\<~", content, time);
    if (!time[1]) {
      preg_match("~\u4E0A\u4F20\u65F6\u95F4\uFF1A</span>(.*?)\\<~", content, time);
    }
    var name = this.extractFileName(content);
    return {
      name: name,
      size: size[1] || "",
      time: time[1] || ""
    };
  }
  extractFileName(content) {
    preg_match("~<div class=\"n_box_3fn\".*?>(.*?)</div>~", content, name);
    if (!name[1]) {
      preg_match("~<title>(.*?) \\-~", content, name);
    }
    return name[1] || "";
  }
  getDownloadUrl(fileInfo) {
    var response = json_decode(fileInfo.content, true);
    if (response.url == "0") {
      response(false, response.inf || "\u672A\u77E5\u9519\u8BEF");
    }
    if ((response.zt || 0) != 1) {
      return false;
    }
    var downloadLink = response.dom + "/file/" + response.url;
    var finalLink = getRedirectUrl(downloadLink, "https://developer.lanzoug.com", "down_ip=1; expires=Sat, 16-Nov-2019 11:42:54 GMT; path=/; domain=.baidupan.com");
    if (strpos(finalLink, "http") === false) {
      return downloadLink;
    }
    if (!!_GET.n) {
      preg_match("~(.*?)\\?fn=(.*?)\\.~", finalLink, rename);
      return (rename[1] || finalLink) + _GET.n;
    }
    return finalLink.replace(/pid=.*?&/g, "");
  }
};
function curlRequest(url, postData = Array(), headers = Array()) {
  var ch = curl_init(url);
  curl_setopt_array(ch, {
    [CURLOPT_RETURNTRANSFER]: true,
    [CURLOPT_FOLLOWLOCATION]: true,
    [CURLOPT_SSL_VERIFYPEER]: false,
    [CURLOPT_TIMEOUT]: 10,
    [CURLOPT_HTTPHEADER]: headers
  });
  if (!!postData) {
    curl_setopt(ch, CURLOPT_POST, true);
    curl_setopt(ch, CURLOPT_POSTFIELDS, postData);
  }
  var result = curl_exec(ch);
  if (result === false) {
    var error = curl_error(ch);
    curl_close(ch);
    return "Curl Error: " + error;
  }
  curl_close(ch);
  return result;
};
function getRedirectUrl(url, referer, cookie) {
  var headers = ["Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8", "Accept-Encoding: gzip, deflate", "Accept-Language: zh-CN,zh;q=0.9", "Cache-Control: no-cache", "Connection: keep-alive", "Pragma: no-cache", "Upgrade-Insecure-Requests: 1", "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36"];
  var ch = curl_init();
  curl_setopt_array(ch, {
    [CURLOPT_URL]: url,
    [CURLOPT_HTTPHEADER]: headers,
    [CURLOPT_REFERER]: referer,
    [CURLOPT_COOKIE]: cookie,
    [CURLOPT_RETURNTRANSFER]: true,
    [CURLOPT_SSL_VERIFYPEER]: false,
    [CURLOPT_TIMEOUT]: 10
  });
  curl_exec(ch);
  var info = curl_getinfo(ch);
  curl_close(ch);
  return info.redirect_url || "";
};
function response(success, msg = "", data = Array()) {
  var result = {
    code: success ? 200 : 400,
    msg: success ? msg ? msg : "\u89E3\u6790\u6210\u529F" : msg ? msg : "\u89E3\u6790\u5931\u8D25",
    data: success ? data : undefined
  };
  throw die(json_encode(result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
};
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
var url = (_REQUEST.url || "").trim();
var pwd = (_REQUEST.pwd || "").trim();
var type = (_REQUEST.type || "").trim();
if (!url) {
  response(false, "\u8BF7\u8F93\u5165\u9700\u8981\u89E3\u6790\u7684\u84DD\u594F\u94FE\u63A5");
}
if (!filter_var(url, FILTER_VALIDATE_URL)) {
  response(false, "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u84DD\u594F\u94FE\u63A5");
}
if (!(-1 !== ["", "down"].indexOf(type))) {
  response(false, "\u65E0\u6548\u7684\u8BF7\u6C42\u7C7B\u578B");
}
try {
  var parser = new LanzouParser(url, pwd, type);
  var result = parser.parse();
  if (type === "down") {
    if (!result.data.url) {
      response(false, "\u83B7\u53D6\u4E0B\u8F7D\u94FE\u63A5\u5931\u8D25");
    }
    header(`Location: ${result.data.url}`);
    throw die();
  }
  if (!result.success) {
    response(false, result.msg || "\u89E3\u6790\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
  }
  response(true, "\u89E3\u6790\u6210\u529F", result.data);
} catch (e) {
  response(false, "\u89E3\u6790\u8FC7\u7A0B\u4E2D\u53D1\u751F\u9519\u8BEF\uFF1A" + e.getMessage());
}
