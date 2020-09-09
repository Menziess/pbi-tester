$user = Connect-PowerBIServiceAccount
$user

$token_regex = '(?<=PBIToken\":\s*\").*?(?=\")'
$accessToken = Get-PowerBIAccessToken -AsString | % {$_.replace('Bearer ', '').Trim()}
$tokenJSONFile = Get-Content 'example.json' -raw;
$new_TokenJSONFile = ($tokenJSONFile -replace $token_regex, $accessToken)
$new_TokenJSONFile | set-content 'token.json'
