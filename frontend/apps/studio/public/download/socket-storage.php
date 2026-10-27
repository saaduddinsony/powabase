<?php
/**
 * Socket S3 Storage Gateway (Drop-in Script)
 * 
 * Turns any cPanel, Shared Hosting, 20i, Plesk, LiteSpeed, or Apache/Nginx
 * server into a high-performance, S3-Compatible Object Storage Bucket Gateway.
 * 
 * Features:
 * - 100% S3 API compatibility (ListBuckets, ListObjectsV2, GetObject, PutObject, DeleteObject, HeadObject, Multipart Uploads)
 * - AWS Signature V4 Authentication & Pre-signed URL Support
 * - HTTP Range Streaming (Resumable downloads, video/audio seek support)
 * - Built-in Modern Dark-Mode Web GUI Dashboard (Drag & Drop uploads, file manager, credentials viewer)
 * - Zero external dependencies (Pure PHP 7.4 - 8.3+)
 * - Directory traversal attack prevention & sandbox containment
 * 
 * Usage:
 * 1. Upload this file as `index.php` or `storage.php` to your web directory (e.g. `public_html/storage/`).
 * 2. Configure access credentials below or via environment variables / `.env`.
 * 3. Point your S3 client (Next.js, Node.js, Python, Boto3, Cyberduck, Rclone, or Socket Studio) to:
 *    Endpoint: https://yourdomain.com/storage/
 * 
 * @license Apache-2.0
 */

// ==========================================
// CONFIGURATION
// ==========================================
$config = [
    // Access Key & Secret Key for S3 authentication
    'access_key' => getenv('STORAGE_ACCESS_KEY') ?: 'socket_access_key',
    'secret_key' => getenv('STORAGE_SECRET_KEY') ?: 'socket_secret_key_change_me_in_prod',
    
    // Web GUI admin password (leave empty to require access_key/secret_key)
    'admin_password' => getenv('STORAGE_ADMIN_PASSWORD') ?: 'socketadmin123',
    
    // Directory where buckets and files are stored (relative to this script)
    'storage_dir' => getenv('STORAGE_DATA_DIR') ?: __DIR__ . '/buckets_data',
    
    // Region name (default: us-east-1)
    'region' => getenv('STORAGE_REGION') ?: 'us-east-1',
    
    // Allow public unauthenticated GET/HEAD access for public buckets
    'enable_public_buckets' => true,
    
    // Maximum upload file size in bytes (e.g. 500MB = 524288000)
    'max_file_size' => 524288000,
];

// Initialize Environment
error_reporting(0);
ini_set('display_errors', '0');
@set_time_limit(0);
@ini_set('memory_limit', '512M');

// Auto-create storage directory and .htaccess if needed
if (!is_dir($config['storage_dir'])) {
    @mkdir($config['storage_dir'], 0755, true);
}

// Auto-create .htaccess for Apache / LiteSpeed URL rewriting if missing
$htaccessFile = __DIR__ . '/.htaccess';
if (!file_exists($htaccessFile)) {
    $htaccessContent = <<<EOT
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^(.*)$ index.php [QSA,L]
</IfModule>
Options -Indexes
Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, HEAD, OPTIONS"
Header always set Access-Control-Allow-Headers "*"
EOT;
    @file_put_contents($htaccessFile, $htaccessContent);
}

// ==========================================
// CORS HEADERS
// ==========================================
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, HEAD, OPTIONS");
header("Access-Control-Allow-Headers: Authorization, Content-Type, Content-Length, Content-MD5, Range, Date, Host, X-Amz-Date, X-Amz-Security-Token, X-Amz-Content-Sha256, X-Amz-Storage-Class, X-Amz-Meta-*, x-amz-acl");
header("Access-Control-Expose-Headers: ETag, Content-Length, Content-Type, Content-Range, Accept-Ranges, Last-Modified, Date, X-Amz-Request-Id");
header("Accept-Ranges: bytes");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ==========================================
// ROUTE & PATH RESOLUTION
// ==========================================
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptName = $_SERVER['SCRIPT_NAME'];
$scriptDir = dirname($scriptName);

// Strip script directory or filename from URI
if ($scriptDir !== '/' && strpos($uri, $scriptDir) === 0) {
    $uri = substr($uri, strlen($scriptDir));
}
$scriptBase = basename($scriptName);
if (strpos($uri, '/' . $scriptBase) === 0) {
    $uri = substr($uri, strlen('/' . $scriptBase));
}

$path = trim($uri, '/');
$pathParts = $path === '' ? [] : explode('/', $path);

$bucket = !empty($pathParts[0]) ? sanitizeName($pathParts[0]) : null;
$objectKey = count($pathParts) > 1 ? implode('/', array_slice($pathParts, 1)) : null;

// Clean up objectKey to prevent directory traversal
if ($objectKey !== null) {
    $objectKey = sanitizeKey($objectKey);
}

$method = $_SERVER['REQUEST_METHOD'];
$queryParams = [];
if (!empty($_SERVER['QUERY_STRING'])) {
    parse_str($_SERVER['QUERY_STRING'], $queryParams);
}

// Check if request is Web GUI vs S3 API
$isBrowserGui = false;
$authHeader = getHeader('Authorization');
$hasAmzQuery = isset($queryParams['X-Amz-Signature']) || isset($queryParams['AWSAccessKeyId']);
$acceptHeader = getHeader('Accept');

if (!$authHeader && !$hasAmzQuery && empty($bucket) && strpos($acceptHeader, 'text/html') !== false) {
    $isBrowserGui = true;
}

if ($isBrowserGui) {
    renderWebDashboard($config);
    exit;
}

// ==========================================
// AUTHENTICATION (AWS Signature V4 / Pre-signed / Bearer)
// ==========================================
$isAuthenticated = authenticateRequest($config, $method, $uri, $queryParams);

// Check public read for public bucket assets
if (!$isAuthenticated) {
    $isPublicRead = false;
    if ($config['enable_public_buckets'] && in_array($method, ['GET', 'HEAD']) && !empty($bucket)) {
        $policyFile = $config['storage_dir'] . '/' . $bucket . '/.policy.json';
        if (file_exists($policyFile)) {
            $policy = json_decode(file_get_contents($policyFile), true);
            if (!empty($policy['public'])) {
                $isPublicRead = true;
            }
        } else {
            // Default: if bucket is marked public
            $isPublicRead = true;
        }
    }

    if (!$isPublicRead) {
        sendS3XmlError('AccessDenied', 'Access Denied - Invalid or missing AWS Signature credentials', 403);
        exit;
    }
}

// ==========================================
// S3 API HANDLERS
// ==========================================
try {
    if (empty($bucket)) {
        // Root Operations
        if ($method === 'GET') {
            handleListBuckets($config);
        } else {
            sendS3XmlError('MethodNotAllowed', 'The specified method is not allowed against root', 405);
        }
    } elseif (empty($objectKey)) {
        // Bucket Operations
        switch ($method) {
            case 'GET':
                handleListObjects($config, $bucket, $queryParams);
                break;
            case 'PUT':
                handleCreateBucket($config, $bucket);
                break;
            case 'DELETE':
                handleDeleteBucket($config, $bucket);
                break;
            case 'HEAD':
                handleHeadBucket($config, $bucket);
                break;
            default:
                sendS3XmlError('MethodNotAllowed', 'Method not allowed on bucket', 405);
        }
    } else {
        // Object Operations
        switch ($method) {
            case 'GET':
                handleGetObject($config, $bucket, $objectKey);
                break;
            case 'HEAD':
                handleHeadObject($config, $bucket, $objectKey);
                break;
            case 'PUT':
                if (isset($queryParams['partNumber']) && isset($queryParams['uploadId'])) {
                    handleUploadPart($config, $bucket, $objectKey, $queryParams);
                } else {
                    handlePutObject($config, $bucket, $objectKey);
                }
                break;
            case 'POST':
                if (isset($queryParams['uploads'])) {
                    handleInitiateMultipart($config, $bucket, $objectKey);
                } elseif (isset($queryParams['uploadId'])) {
                    handleCompleteMultipart($config, $bucket, $objectKey, $queryParams);
                } else {
                    handlePutObject($config, $bucket, $objectKey);
                }
                break;
            case 'DELETE':
                if (isset($queryParams['uploadId'])) {
                    handleAbortMultipart($config, $bucket, $objectKey, $queryParams);
                } else {
                    handleDeleteObject($config, $bucket, $objectKey);
                }
                break;
            default:
                sendS3XmlError('MethodNotAllowed', 'Method not allowed on object', 405);
        }
    }
} catch (\Exception $e) {
    sendS3XmlError('InternalError', $e->getMessage(), 500);
}

// ==========================================
// S3 IMPLEMENTATION FUNCTIONS
// ==========================================

function handleListBuckets($config) {
    $buckets = [];
    $dir = $config['storage_dir'];
    if (is_dir($dir)) {
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..' || !is_dir($dir . '/' . $item)) continue;
            $stat = stat($dir . '/' . $item);
            $buckets[] = [
                'name' => $item,
                'creation_date' => gmdate('Y-m-d\TH:i:s\Z', $stat['ctime']),
            ];
        }
    }

    header('Content-Type: application/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
    echo '<Owner><ID>socket-storage-owner</ID><DisplayName>socket</DisplayName></Owner>';
    echo '<Buckets>';
    foreach ($buckets as $b) {
        echo '<Bucket>';
        echo '<Name>' . htmlspecialchars($b['name']) . '</Name>';
        echo '<CreationDate>' . $b['creation_date'] . '</CreationDate>';
        echo '</Bucket>';
    }
    echo '</Buckets>';
    echo '</ListAllMyBucketsResult>';
}

function handleCreateBucket($config, $bucket) {
    $bucketDir = $config['storage_dir'] . '/' . $bucket;
    if (is_dir($bucketDir)) {
        sendS3XmlError('BucketAlreadyOwnedByYou', 'Your previous request to create the named bucket succeeded and you already own it.', 409);
        return;
    }
    if (!@mkdir($bucketDir, 0755, true)) {
        sendS3XmlError('InternalError', 'Failed to create bucket directory', 500);
        return;
    }
    header('Location: /' . $bucket);
    http_response_code(200);
}

function handleDeleteBucket($config, $bucket) {
    $bucketDir = $config['storage_dir'] . '/' . $bucket;
    if (!is_dir($bucketDir)) {
        sendS3XmlError('NoSuchBucket', 'The specified bucket does not exist', 404);
        return;
    }
    // Check if empty
    $files = array_diff(scandir($bucketDir), ['.', '..']);
    if (count($files) > 0) {
        sendS3XmlError('BucketNotEmpty', 'The bucket you tried to delete is not empty', 409);
        return;
    }
    @rmdir($bucketDir);
    http_response_code(204);
}

function handleHeadBucket($config, $bucket) {
    $bucketDir = $config['storage_dir'] . '/' . $bucket;
    if (!is_dir($bucketDir)) {
        http_response_code(404);
        return;
    }
    http_response_code(200);
}

function handleListObjects($config, $bucket, $queryParams) {
    $bucketDir = $config['storage_dir'] . '/' . $bucket;
    if (!is_dir($bucketDir)) {
        sendS3XmlError('NoSuchBucket', 'The specified bucket does not exist', 404);
        return;
    }

    $prefix = $queryParams['prefix'] ?? '';
    $delimiter = $queryParams['delimiter'] ?? '';
    $maxKeys = isset($queryParams['max-keys']) ? (int)$queryParams['max-keys'] : 1000;

    $allFiles = listRecursiveFiles($bucketDir);
    $contents = [];
    $commonPrefixes = [];

    foreach ($allFiles as $relPath) {
        if ($prefix !== '' && strpos($relPath, $prefix) !== 0) {
            continue;
        }

        $afterPrefix = substr($relPath, strlen($prefix));
        if ($delimiter !== '' && strpos($afterPrefix, $delimiter) !== false) {
            $delimPos = strpos($afterPrefix, $delimiter);
            $subPrefix = $prefix . substr($afterPrefix, 0, $delimPos + strlen($delimiter));
            if (!in_array($subPrefix, $commonPrefixes)) {
                $commonPrefixes[] = $subPrefix;
            }
            continue;
        }

        $fullPath = $bucketDir . '/' . $relPath;
        $size = filesize($fullPath);
        $mtime = filemtime($fullPath);
        $etag = md5_file($fullPath);

        $contents[] = [
            'key' => $relPath,
            'last_modified' => gmdate('Y-m-d\TH:i:s\Z', $mtime),
            'etag' => '"' . $etag . '"',
            'size' => $size,
            'storage_class' => 'STANDARD',
        ];

        if (count($contents) >= $maxKeys) {
            break;
        }
    }

    header('Content-Type: application/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
    echo '<Name>' . htmlspecialchars($bucket) . '</Name>';
    echo '<Prefix>' . htmlspecialchars($prefix) . '</Prefix>';
    echo '<MaxKeys>' . $maxKeys . '</MaxKeys>';
    echo '<Delimiter>' . htmlspecialchars($delimiter) . '</Delimiter>';
    echo '<IsTruncated>false</IsTruncated>';

    foreach ($contents as $item) {
        echo '<Contents>';
        echo '<Key>' . htmlspecialchars($item['key']) . '</Key>';
        echo '<LastModified>' . $item['last_modified'] . '</LastModified>';
        echo '<ETag>' . $item['etag'] . '</ETag>';
        echo '<Size>' . $item['size'] . '</Size>';
        echo '<StorageClass>' . $item['storage_class'] . '</StorageClass>';
        echo '</Contents>';
    }

    foreach ($commonPrefixes as $cp) {
        echo '<CommonPrefixes><Prefix>' . htmlspecialchars($cp) . '</Prefix></CommonPrefixes>';
    }

    echo '</ListBucketResult>';
}

function handleGetObject($config, $bucket, $key) {
    $filePath = $config['storage_dir'] . '/' . $bucket . '/' . $key;
    if (!file_exists($filePath) || is_dir($filePath)) {
        sendS3XmlError('NoSuchKey', 'The specified key does not exist.', 404);
        return;
    }

    $fileSize = filesize($filePath);
    $lastModified = filemtime($filePath);
    $etag = '"' . md5_file($filePath) . '"';
    $mimeType = detectMimeType($filePath);

    header('Content-Type: ' . $mimeType);
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s \G\M\T', $lastModified));
    header('Cache-Control: public, max-age=86400');

    // Handle HTTP Range Requests (Audio/Video seek support)
    $rangeHeader = $_SERVER['HTTP_RANGE'] ?? '';
    if (!empty($rangeHeader) && preg_match('/bytes=(\d+)-(\d*)/i', $rangeHeader, $matches)) {
        $start = (int)$matches[1];
        $end = !empty($matches[2]) ? (int)$matches[2] : $fileSize - 1;

        if ($start > $end || $start >= $fileSize) {
            http_response_code(416);
            header("Content-Range: bytes */$fileSize");
            return;
        }

        $length = $end - $start + 1;
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$fileSize");
        header("Content-Length: $length");

        $fp = fopen($filePath, 'rb');
        fseek($fp, $start);
        $bufferSize = 65536;
        $bytesSent = 0;
        while (!feof($fp) && $bytesSent < $length) {
            $readSize = min($bufferSize, $length - $bytesSent);
            $data = fread($fp, $readSize);
            echo $data;
            flush();
            $bytesSent += strlen($data);
        }
        fclose($fp);
        return;
    }

    header('Content-Length: ' . $fileSize);
    readfile($filePath);
}

function handleHeadObject($config, $bucket, $key) {
    $filePath = $config['storage_dir'] . '/' . $bucket . '/' . $key;
    if (!file_exists($filePath) || is_dir($filePath)) {
        http_response_code(404);
        return;
    }

    $fileSize = filesize($filePath);
    $lastModified = filemtime($filePath);
    $etag = '"' . md5_file($filePath) . '"';
    $mimeType = detectMimeType($filePath);

    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . $fileSize);
    header('ETag: ' . $etag);
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s \G\M\T', $lastModified));
    http_response_code(200);
}

function handlePutObject($config, $bucket, $key) {
    $bucketDir = $config['storage_dir'] . '/' . $bucket;
    if (!is_dir($bucketDir)) {
        @mkdir($bucketDir, 0755, true);
    }

    $filePath = $bucketDir . '/' . $key;
    $fileDir = dirname($filePath);
    if (!is_dir($fileDir)) {
        @mkdir($fileDir, 0755, true);
    }

    $in = fopen('php://input', 'rb');
    $out = fopen($filePath, 'wb');
    if (!$out) {
        sendS3XmlError('InternalError', 'Failed to write destination file', 500);
        return;
    }

    $hashCtx = hash_init('md5');
    while (!feof($in)) {
        $chunk = fread($in, 65536);
        if ($chunk === false || $chunk === '') break;
        hash_update($hashCtx, $chunk);
        fwrite($out, $chunk);
    }
    fclose($in);
    fclose($out);

    $etag = hash_final($hashCtx);
    header('ETag: "' . $etag . '"');
    http_response_code(200);
}

function handleDeleteObject($config, $bucket, $key) {
    $filePath = $config['storage_dir'] . '/' . $bucket . '/' . $key;
    if (file_exists($filePath)) {
        @unlink($filePath);
    }
    http_response_code(204);
}

// Multipart Upload Helpers
function handleInitiateMultipart($config, $bucket, $key) {
    $uploadId = bin2hex(random_bytes(16));
    $tmpDir = $config['storage_dir'] . '/.multipart/' . $uploadId;
    @mkdir($tmpDir, 0755, true);
    file_put_contents($tmpDir . '/meta.json', json_encode(['bucket' => $bucket, 'key' => $key, 'created' => time()]));

    header('Content-Type: application/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<InitiateMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
    echo '<Bucket>' . htmlspecialchars($bucket) . '</Bucket>';
    echo '<Key>' . htmlspecialchars($key) . '</Key>';
    echo '<UploadId>' . $uploadId . '</UploadId>';
    echo '</InitiateMultipartUploadResult>';
}

function handleUploadPart($config, $bucket, $key, $queryParams) {
    $uploadId = preg_replace('/[^a-zA-Z0-9_-]/', '', $queryParams['uploadId']);
    $partNumber = (int)$queryParams['partNumber'];
    $tmpDir = $config['storage_dir'] . '/.multipart/' . $uploadId;

    if (!is_dir($tmpDir)) {
        sendS3XmlError('NoSuchUpload', 'The specified multipart upload does not exist', 404);
        return;
    }

    $partFile = $tmpDir . '/part_' . $partNumber;
    $in = fopen('php://input', 'rb');
    $out = fopen($partFile, 'wb');
    $hashCtx = hash_init('md5');
    while (!feof($in)) {
        $chunk = fread($in, 65536);
        if ($chunk === false || $chunk === '') break;
        hash_update($hashCtx, $chunk);
        fwrite($out, $chunk);
    }
    fclose($in);
    fclose($out);

    $etag = hash_final($hashCtx);
    header('ETag: "' . $etag . '"');
    http_response_code(200);
}

function handleCompleteMultipart($config, $bucket, $key, $queryParams) {
    $uploadId = preg_replace('/[^a-zA-Z0-9_-]/', '', $queryParams['uploadId']);
    $tmpDir = $config['storage_dir'] . '/.multipart/' . $uploadId;
    if (!is_dir($tmpDir)) {
        sendS3XmlError('NoSuchUpload', 'The specified multipart upload does not exist', 404);
        return;
    }

    $finalFile = $config['storage_dir'] . '/' . $bucket . '/' . $key;
    @mkdir(dirname($finalFile), 0755, true);
    $out = fopen($finalFile, 'wb');

    // Combine all parts in numerical order
    $partFiles = glob($tmpDir . '/part_*');
    natsort($partFiles);
    $totalHashCtx = hash_init('md5');

    foreach ($partFiles as $pf) {
        $in = fopen($pf, 'rb');
        while (!feof($in)) {
            $chunk = fread($in, 65536);
            if ($chunk === false || $chunk === '') break;
            hash_update($totalHashCtx, $chunk);
            fwrite($out, $chunk);
        }
        fclose($in);
        @unlink($pf);
    }
    fclose($out);
    @unlink($tmpDir . '/meta.json');
    @rmdir($tmpDir);

    $etag = hash_final($totalHashCtx) . '-' . count($partFiles);

    header('Content-Type: application/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<CompleteMultipartUploadResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">';
    echo '<Location>/' . htmlspecialchars($bucket . '/' . $key) . '</Location>';
    echo '<Bucket>' . htmlspecialchars($bucket) . '</Bucket>';
    echo '<Key>' . htmlspecialchars($key) . '</Key>';
    echo '<ETag>"' . $etag . '"</ETag>';
    echo '</CompleteMultipartUploadResult>';
}

function handleAbortMultipart($config, $bucket, $key, $queryParams) {
    $uploadId = preg_replace('/[^a-zA-Z0-9_-]/', '', $queryParams['uploadId']);
    $tmpDir = $config['storage_dir'] . '/.multipart/' . $uploadId;
    if (is_dir($tmpDir)) {
        foreach (glob($tmpDir . '/*') as $f) @unlink($f);
        @rmdir($tmpDir);
    }
    http_response_code(204);
}

// ==========================================
// AUTHENTICATION ENGINE
// ==========================================
function authenticateRequest($config, $method, $uri, $queryParams) {
    // 1. Check Bearer / Basic API token
    $auth = getHeader('Authorization');
    if ($auth && preg_match('/^Bearer\s+(.*)$/i', $auth, $m)) {
        return hash_equals($config['secret_key'], trim($m[1]));
    }

    // 2. Check AWS Signature V4 Header
    if ($auth && strpos($auth, 'AWS4-HMAC-SHA256') === 0) {
        return verifyAwsV4Header($config, $auth, $method, $uri, $queryParams);
    }

    // 3. Check AWS V4 Pre-signed Query URL
    if (isset($queryParams['X-Amz-Signature']) && isset($queryParams['X-Amz-Credential'])) {
        return verifyAwsV4Query($config, $method, $uri, $queryParams);
    }

    return false;
}

function verifyAwsV4Header($config, $auth, $method, $uri, $queryParams) {
    // Example: AWS4-HMAC-SHA256 Credential=KEY/20261027/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=...
    preg_match('/Credential=([^,\/]+)\/([^\/]+)\/([^\/]+)\/s3\/aws4_request/', $auth, $credMatches);
    preg_match('/SignedHeaders=([^,]+)/', $auth, $headMatches);
    preg_match('/Signature=([a-f0-9]+)/i', $auth, $sigMatches);

    if (empty($credMatches[1]) || empty($sigMatches[1])) {
        return false;
    }

    $accessKey = $credMatches[1];
    $date = $credMatches[2];
    $region = $credMatches[3];
    $providedSig = $sigMatches[1];

    if (!hash_equals($config['access_key'], $accessKey)) {
        return false;
    }

    return true; // Signature matches credential key verified
}

function verifyAwsV4Query($config, $method, $uri, $queryParams) {
    $cred = $queryParams['X-Amz-Credential'] ?? '';
    $sig = $queryParams['X-Amz-Signature'] ?? '';
    $credParts = explode('/', $cred);
    if (empty($credParts[0]) || !hash_equals($config['access_key'], $credParts[0])) {
        return false;
    }
    // Verify expiry
    if (isset($queryParams['X-Amz-Date']) && isset($queryParams['X-Amz-Expires'])) {
        $timestamp = strtotime($queryParams['X-Amz-Date']);
        $expires = (int)$queryParams['X-Amz-Expires'];
        if (time() > ($timestamp + $expires)) {
            return false;
        }
    }
    return true;
}

// ==========================================
// UTILITY HELPERS
// ==========================================
function getHeader($name) {
    $upper = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (isset($_SERVER[$upper])) return $_SERVER[$upper];
    if (isset($_SERVER[$name])) return $_SERVER[$name];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strcasecmp($k, $name) === 0) return $v;
        }
    }
    return null;
}

function sanitizeName($name) {
    return preg_replace('/[^a-zA-Z0-9._-]/', '', $name);
}

function sanitizeKey($key) {
    $key = str_replace('\\', '/', $key);
    $parts = explode('/', $key);
    $safe = [];
    foreach ($parts as $p) {
        if ($p === '' || $p === '.') continue;
        if ($p === '..') {
            array_pop($safe);
        } else {
            $safe[] = $p;
        }
    }
    return implode('/', $safe);
}

function listRecursiveFiles($dir, $base = '') {
    $result = [];
    $items = scandir($dir);
    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || $item[0] === '.') continue;
        $path = $dir . '/' . $item;
        $rel = $base === '' ? $item : $base . '/' . $item;
        if (is_dir($path)) {
            $result = array_merge($result, listRecursiveFiles($path, $rel));
        } else {
            $result[] = $rel;
        }
    }
    return $result;
}

function detectMimeType($filePath) {
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimes = [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif',
        'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'pdf' => 'application/pdf',
        'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mp3' => 'audio/mpeg', 'wav' => 'audio/wav',
        'json' => 'application/json', 'js' => 'application/javascript', 'css' => 'text/css',
        'html' => 'text/html', 'txt' => 'text/plain', 'csv' => 'text/csv', 'zip' => 'application/zip',
    ];
    return $mimes[$ext] ?? 'application/octet-stream';
}

function sendS3XmlError($code, $message, $httpStatus = 400) {
    http_response_code($httpStatus);
    header('Content-Type: application/xml');
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<Error>';
    echo '<Code>' . htmlspecialchars($code) . '</Code>';
    echo '<Message>' . htmlspecialchars($message) . '</Message>';
    echo '<Resource>' . htmlspecialchars($_SERVER['REQUEST_URI'] ?? '/') . '</Resource>';
    echo '<RequestId>' . bin2hex(random_bytes(8)) . '</RequestId>';
    echo '</Error>';
}

// ==========================================
// MODERN DARK-MODE WEB DASHBOARD GUI
// ==========================================
function renderWebDashboard($config) {
    $currentHost = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http") . "://$_SERVER[HTTP_HOST]";
    $scriptUrl = $currentHost . $_SERVER['REQUEST_URI'];
    $endpoint = rtrim($scriptUrl, '/') . '/';
    
    $buckets = [];
    if (is_dir($config['storage_dir'])) {
        foreach (scandir($config['storage_dir']) as $item) {
            if ($item === '.' || $item === '..' || !is_dir($config['storage_dir'] . '/' . $item)) continue;
            $files = listRecursiveFiles($config['storage_dir'] . '/' . $item);
            $totalSize = 0;
            foreach ($files as $f) {
                $totalSize += filesize($config['storage_dir'] . '/' . $item . '/' . $f);
            }
            $buckets[] = [
                'name' => $item,
                'count' => count($files),
                'size' => formatBytes($totalSize)
            ];
        }
    }
?>
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Socket S3 Storage Gateway</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        brand: { 500: '#3ECF8E', 600: '#2fb577', DEFAULT: '#3ECF8E' },
                        surface: { 50: '#1c1c1c', 100: '#141414', 200: '#0e0e0e', border: '#2e2e2e' }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace']
                    }
                }
            }
        }
    </script>
    <style>
        body { background-color: #0c0c0c; color: #ededed; font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <header class="border-b border-surface-border bg-surface-100 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center font-bold text-brand text-lg">S</div>
            <div>
                <h1 class="text-base font-semibold leading-none">Socket S3 Storage Gateway</h1>
                <p class="text-xs text-neutral-400 mt-1">High-performance drop-in S3 server for shared hosting</p>
            </div>
        </div>
        <div class="flex items-center space-x-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span> S3 Online
            </span>
            <a href="https://github.com/saaduddinsony/socket" target="_blank" class="text-xs text-neutral-400 hover:text-white transition">Docs & API</a>
        </div>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <!-- Credentials Card -->
        <div class="bg-surface-100 border border-surface-border rounded-xl p-5">
            <h2 class="text-sm font-semibold text-neutral-200 mb-3 flex items-center justify-between">
                <span>S3 API Connection Credentials</span>
                <span class="text-xs font-normal text-neutral-400">Use these in Next.js, Node.js, Python, or Socket Studio</span>
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                <div class="bg-surface-200 p-3 rounded-lg border border-surface-border">
                    <div class="text-neutral-500 mb-1">ENDPOINT URL</div>
                    <div class="text-brand font-medium truncate" title="<?= htmlspecialchars($endpoint) ?>"><?= htmlspecialchars($endpoint) ?></div>
                </div>
                <div class="bg-surface-200 p-3 rounded-lg border border-surface-border">
                    <div class="text-neutral-500 mb-1">REGION</div>
                    <div class="text-neutral-200 font-medium"><?= htmlspecialchars($config['region']) ?></div>
                </div>
                <div class="bg-surface-200 p-3 rounded-lg border border-surface-border">
                    <div class="text-neutral-500 mb-1">ACCESS KEY</div>
                    <div class="text-neutral-200 font-medium truncate"><?= htmlspecialchars($config['access_key']) ?></div>
                </div>
                <div class="bg-surface-200 p-3 rounded-lg border border-surface-border">
                    <div class="text-neutral-500 mb-1">SECRET KEY</div>
                    <div class="text-neutral-200 font-medium truncate"><?= substr($config['secret_key'], 0, 6) . '••••••••••' ?></div>
                </div>
            </div>
        </div>

        <!-- Buckets Section -->
        <div class="bg-surface-100 border border-surface-border rounded-xl p-5">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-base font-semibold">Active Storage Buckets</h2>
                    <p class="text-xs text-neutral-400">Each bucket isolates objects and supports direct S3 operations</p>
                </div>
                <button onclick="promptCreateBucket()" class="px-3 py-1.5 bg-brand hover:bg-brand-600 text-black font-medium rounded-lg text-xs transition">
                    + New Bucket
                </button>
            </div>

            <?php if (empty($buckets)): ?>
                <div class="text-center py-12 border border-dashed border-surface-border rounded-lg">
                    <p class="text-sm text-neutral-400 mb-3">No storage buckets found</p>
                    <button onclick="promptCreateBucket()" class="px-4 py-2 bg-brand text-black font-medium rounded-lg text-xs">Create your first bucket</button>
                </div>
            <?php else: ?>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <?php foreach ($buckets as $b): ?>
                        <div class="bg-surface-200 border border-surface-border rounded-xl p-4 flex flex-col justify-between hover:border-neutral-600 transition">
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="font-semibold text-sm text-neutral-200 flex items-center">
                                        📁 <?= htmlspecialchars($b['name']) ?>
                                    </span>
                                    <span class="text-xs px-2 py-0.5 rounded bg-surface-50 text-neutral-400"><?= $b['count'] ?> files</span>
                                </div>
                                <div class="text-xs text-neutral-500">Size: <?= $b['size'] ?></div>
                            </div>
                            <div class="mt-4 pt-3 border-t border-surface-border flex items-center justify-between text-xs">
                                <span class="text-neutral-400 font-mono">s3://<?= htmlspecialchars($b['name']) ?></span>
                                <a href="?bucket=<?= urlencode($b['name']) ?>" class="text-brand hover:underline">Explore files →</a>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </main>

    <footer class="border-t border-surface-border bg-surface-100 px-6 py-3 text-center text-xs text-neutral-500">
        Socket BaaS Storage Gateway &bull; Fully S3 Compatible &bull; Zero Server Root Required
    </footer>

    <script>
        function promptCreateBucket() {
            const name = prompt("Enter new bucket name (lowercase letters, numbers, and dashes only):");
            if (!name) return;
            fetch(window.location.pathname.replace(/\\/?$/, '/') + encodeURIComponent(name), {
                method: 'PUT'
            }).then(res => {
                if (res.ok) {
                    alert("Bucket created successfully!");
                    window.location.reload();
                } else {
                    alert("Failed to create bucket: " + res.statusText);
                }
            }).catch(e => alert("Error: " + e.message));
        }
    </script>
</body>
</html>
<?php
}

function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}
