$chat = @{
  model = "gpt-4o-mini"
  temperature = 0.2
  messages = @(@{ role="user"; content="Say hi in five words." })
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://localhost:4000/api/ai/openai/chat" -Method Post -ContentType "application/json" -Body $chat | % Content
