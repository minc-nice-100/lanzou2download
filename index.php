<?php

/**
 * @package Lanzou_API
 * @author iami233
 * @version 2.0.0
 * @link http://github.com/5ime/Lanzou_api
 */

class LanzouParser {
    private $url;
    private $pwd;
    private $type;

    public function __construct($url, $pwd = '', $type = '') {
        $this->url = $url;
        $this->pwd = $pwd;
        $this->type = $type;
    }

    public function parse() {
        $url = $this->formatUrl();
        $headers = $this->getHeaders();
        $content = $this->getPageContent($url, $headers);
        
        if ($this->isFileDeleted($content)) {
            response(false, '文件取消分享了');
        }

        $fileInfo = $this->extractFileInfo($content);
        if (!$fileInfo) {
            response(false, '解析失败');
        }

        if (strpos($content, 'function down_p(){') !== false) {
            if (empty($this->pwd)) {
                response(false, '请输入分享密码');
            }
            
            preg_match("~v3c = '(.*?)';~", $content, $sign);
            $sign = $sign[1] ?? '';
            if (strlen($sign) < 82) {
                preg_match_all("~sign\'\:\'(.*?)\'~", $content, $sign);
                $sign = $sign[1][1] ?? '';
            }
            
            preg_match("~ajaxm.php\?file=(\d+)~", $content, $ajaxm);
            $postData = [
                'action' => 'downprocess',
                'sign' => $sign,
                'p' => $this->pwd,
                'kd' => 1
            ];

            $headers[] = 'Referer: ' . $url;
            $apiUrl = "https://www.lanzoux.com/" . ($ajaxm[0] ?? '');
            $fileInfo['content'] = curlRequest($apiUrl, $postData, $headers);
        } else {
            preg_match("~<iframe.*?src=\"/(.*?)\"~", $content, $iframe);
            $iframeUrl = 'https://www.lanzoup.com/' . ($iframe[1] ?? '');
            $iframeContent = curlRequest($iframeUrl);

            preg_match("~wp_sign = '(.*?)'~", $iframeContent, $sign);
            preg_match_all("/ajaxm\.php\?file=(\d+)/", $iframeContent, $ajaxm);

            $postData = [
                'action' => 'downprocess',
                'signs' => '?ctdf',
                'sign' => $sign[1] ?? '',
                'kd' => 1
            ];

            $headers[] = 'Referer: ' . $url;
            $apiUrl = "https://www.lanzoux.com/" . ($ajaxm[0][1] ?? $ajaxm[0][0] ?? '');
            $fileInfo['content'] = curlRequest($apiUrl, $postData, $headers);
        }

        $downloadUrl = $this->getDownloadUrl($fileInfo);
        if (!$downloadUrl) {
            response(false, '获取下载链接失败');
        }

        response(true, '', [
            'name' => $fileInfo['name'],
            'size' => $fileInfo['size'],
            'time' => $fileInfo['time'],
            'url' => $downloadUrl
        ]);
    }

    private function formatUrl() {
        $parts = explode('.com/', $this->url);
        return 'https://www.lanzoup.com/' . ($parts[1] ?? '');
    }

    private function getHeaders() {
        return [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
        ];
    }

    private function getPageContent($url, $headers) {
        return curlRequest($url, [], $headers);
    }

    private function isFileDeleted($content) {
        return strpos($content, '文件取消分享了') !== false;
    }

    private function extractFileInfo($content) {
        preg_match("~文件大小：(.*?)\"~", $content, $size);
        preg_match("~n_file_infos\"\>(.*?)\<~", $content, $time);
        
        if (empty($time[1])) {
            preg_match("~上传时间：</span>(.*?)\<~", $content, $time);
        }

        $name = $this->extractFileName($content);
        
        return [
            'name' => $name,
            'size' => $size[1] ?? '',
            'time' => $time[1] ?? ''
        ];
    }

    private function extractFileName($content) {
        preg_match("~<div class=\"n_box_3fn\".*?>(.*?)</div>~", $content, $name);
        if (empty($name[1])) {
            preg_match("~<title>(.*?) \-~", $content, $name);
        }
        return $name[1] ?? '';
    }

    private function getDownloadUrl($fileInfo) {
        $response = json_decode($fileInfo['content'], true);

        if ($response['url'] == '0') {
            response(false, $response['inf'] ?? '未知错误');
        }

        if (($response['zt'] ?? 0) != 1) {
            return false;
        }


        $downloadLink = $response['dom'] . '/file/' . $response['url'];
        $finalLink = getRedirectUrl($downloadLink, "https://developer.lanzoug.com", "down_ip=1; expires=Sat, 16-Nov-2019 11:42:54 GMT; path=/; domain=.baidupan.com");

        if (strpos($finalLink, 'http') === false) {
            return $downloadLink;
        }

        if (!empty($_GET['n'])) {
            preg_match("~(.*?)\?fn=(.*?)\.~", $finalLink, $rename);
            return ($rename[1] ?? $finalLink) . $_GET['n'];
        }

        return preg_replace('/pid=.*?&/', '', $finalLink);
    }
};

function curlRequest($url, $postData = [], $headers = [])
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
    ]);

    if (!empty($postData)) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    }

    $result = curl_exec($ch);
    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return 'Curl Error: ' . $error;
    }
    curl_close($ch);
    return $result;
}

function getRedirectUrl($url, $referer, $cookie)
{
    $headers = [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding: gzip, deflate',
        'Accept-Language: zh-CN,zh;q=0.9',
        'Cache-Control: no-cache',
        'Connection: keep-alive',
        'Pragma: no-cache',
        'Upgrade-Insecure-Requests: 1',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36',
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_REFERER => $referer,
        CURLOPT_COOKIE => $cookie,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT => 10,
    ]);

    curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    return $info['redirect_url'] ?? '';
}

function response($success, $msg = '', $data = [])
{
    $result = [
        'code' => $success ? 200 : 400,
        'msg' => $success ? ($msg ?: '解析成功') : ($msg ?: '解析失败'),
        'data' => $success ? $data : null
    ];

    die(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
};

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$url = trim($_REQUEST['url'] ?? '');
$pwd = trim($_REQUEST['pwd'] ?? '');
$type = trim($_REQUEST['type'] ?? '');

if (empty($url)) {
    response(false, '请输入需要解析的蓝奏链接');
}

if (!filter_var($url, FILTER_VALIDATE_URL)) {
    response(false, '请输入有效的蓝奏链接');
}

if (!in_array($type, ['', 'down'])) {
    response(false, '无效的请求类型');
}

try {
    $parser = new LanzouParser($url, $pwd, $type);
    $result = $parser->parse();

    if ($type === 'down') {
        if (empty($result['data']['url'])) {
            response(false, '获取下载链接失败');
        }
        header("Location: {$result['data']['url']}");
        exit;
    }

    if (!$result['success']) {
        response(false, $result['msg'] ?? '解析失败，请稍后再试');
    }

    response(true, '解析成功', $result['data']);
} catch (Exception $e) {
    response(false, '解析过程中发生错误：' . $e->getMessage());
} 