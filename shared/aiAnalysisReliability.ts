export const AI_ANALYSIS_TIMEOUT_MS = 75_000;

export function getFriendlyAIAnalysisError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/逾時|timeout|abort/i.test(message)) {
    return "AI 模型回應逾時，系統已停止本次分析。請稍後重新分析；若持續發生，請確認雲端模型服務可用。";
  }
  if (/Ollama API 錯誤 \(401|Ollama API 錯誤 \(403/i.test(message)) {
    return "AI 服務驗證失敗，請確認雲端模型的 API 金鑰與服務設定。";
  }
  if (/Ollama API 錯誤 \(429|Ollama API 錯誤 \(5/i.test(message)) {
    return "AI 服務暫時忙碌或不可用，系統已自動重試；請稍後再試。";
  }
  if (/回傳格式|有效內容|JSON/i.test(message)) {
    return "AI 服務回傳格式暫時無法驗證，請重新分析。";
  }
  return message || "AI 分析暫時無法完成，請稍後再試。";
}

export async function retryAIRequest<T>(operation: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI 服務暫時無法完成請求");
}
