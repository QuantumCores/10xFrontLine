  $body = @{ email = "manual-test@example.com" } | ConvertTo-Json
  $result = Invoke-RestMethod -Uri "http://localhost:5178/api/auth/request-code" -Method Post -ContentType "application/json" -Body $body
  Write-Host $result
 
  $body = @{ email = "another-test@example.com" } | ConvertTo-Json
  $result = Invoke-RestMethod -Uri "http://localhost:5178/api/auth/request-code" -Method Post -ContentType "application/json" -Body $body
  Write-Host $result
	
 Read-Host -Prompt '.'