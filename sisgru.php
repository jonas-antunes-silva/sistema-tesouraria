<?php
/**
 * INTEGRAÇÃO SISGRU - CONSULTA MULTI-ENDPOINT (GRUs ou Pagamentos)
 */



// --- 1. CONFIGURAÇÕES DE ACESSO ---
$config = [
    "url_base" => "https://webservice.sisgru.tesouro.gov.br/sisgru/services/v1",
    "issuer"   => "tesouraria",
    "chave"    => "/home/jonas/Documentos/certificado-wildcard/private/wildcard.concordia.ifc.edu.br.key",
    "senha"    => "" 
];

// --- 2. ESCOLHA O QUE CONSULTAR ---
// Opções: 'grus' ou 'pagamentos'
$tipo_consulta = 'pagamentos'; 


if ($tipo_consulta == 'grus') {
    $endpoint = "/grus";
    $filtros  = "ugArrecadadora=158461&dtEmissao=01/03/2026-25/03/2026";
} else {
    $endpoint = "/pagamentos";
    // Tentativa com o nome de parâmetro padrão de sistema do Tesouro
    $filtros  = "ug=158461&dataAlteracaoSituacaoPagTesouro=25/03/2026-25/03/2026";
}

// --- 3. FUNÇÃO PARA GERAR O TOKEN JWT ---
function gerarJWT($iss, $privateKeyPath, $passphrase = '') {
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $payload = json_encode(['iss' => $iss, 'iat' => time(), 'exp' => time() + 600]);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $key_content = file_get_contents($privateKeyPath);
    $private_key_res = openssl_pkey_get_private($key_content, $passphrase);
    
    if (!$private_key_res) die("ERRO: Chave privada não encontrada.\n");

    $signature = '';
    openssl_sign($base64UrlHeader . "." . $base64UrlPayload, $signature, $private_key_res, OPENSSL_ALGO_SHA256);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

// --- 4. EXECUÇÃO DA CONSULTA ---
$jwt = gerarJWT($config['issuer'], $config['chave'], $config['senha']);
$url_final = $config['url_base'] . $endpoint . "?q=" . urlencode($filtros);

$ch = curl_init($url_final);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $jwt",
    "Content-Type: application/xml",
    "Accept: application/xml"
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// --- 5. EXIBIÇÃO ---
echo "Endpoint: $endpoint\n";
echo "Filtros: $filtros\n";
echo "Status HTTP: $http_code\n";

if ($http_code == 200) {
    // Formata o XML para leitura
    $dom = new DOMDocument();
    $dom->preserveWhiteSpace = false;
    $dom->formatOutput = true;
    @$dom->loadXML($response);
    echo $dom->saveXML();
} else {
    echo "Resposta do Servidor:\n" . $response;
}




