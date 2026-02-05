# DIRECT MARKETSTACK API TEST
# Run this to test Marketstack without the gateway

# 1. Set your API key
$API_KEY = "YOUR_MARKETSTACK_API_KEY_HERE"

# 2. Test a simple commodity
$commodity = "coffee"
$url = "https://api.marketstack.com/v2/commodities?access_key=$API_KEY&commodity_name=$commodity"

Write-Host "Testing Marketstack API..."
Write-Host "Commodity: $commodity"
Write-Host "URL: $($url -replace 'access_key=[^&]+', 'access_key=***')"
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Message: $($_.Exception.Message)"
    
    # Try to get response body
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    Write-Host "Response Body: $responseBody"
}

# 3. If v2 doesn't work, try v1
Write-Host ""
Write-Host "Trying v1 endpoint..."
$url_v1 = "https://api.marketstack.com/v1/commodities?access_key=$API_KEY&commodity_name=$commodity"

try {
    $response = Invoke-RestMethod -Uri $url_v1 -Method Get
    Write-Host "✅ V1 WORKS!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "❌ V1 ALSO FAILS" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
}
