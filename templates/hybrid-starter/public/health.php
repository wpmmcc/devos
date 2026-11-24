<?php
header('Content-Type: application/json');
http_response_code(200);
echo json_encode([
    'status' => 'ok',
    'app' => 'hybrid-starter',
    'timestamp' => date('c'),
    'engines' => [
        'web' => 'ddev',
        'script' => 'devcontainer'
    ]
]);
