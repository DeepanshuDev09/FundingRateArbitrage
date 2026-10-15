import { ZodError, type ZodType } from "zod";

interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchJson<T>(
  url: string,
  schema: ZodType<T>,
  label: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 5000, retries = 1 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "FundingRateMonitor/0.1",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 200);
        const error = new Error(`${label} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
        if (attempt < retries && (response.status === 429 || response.status >= 500)) {
          lastError = error;
          continue;
        }
        throw error;
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw new Error(`${label} returned invalid JSON: ${errorMessage(error)}`);
      }

      try {
        return schema.parse(body);
      } catch (error) {
        if (error instanceof ZodError) {
          const issues = error.issues
            .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
            .join("; ");
          throw new Error(`${label} response validation failed: ${issues}`);
        }
        throw error;
      }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (normalized.name === "AbortError") {
        lastError = new Error(`${label} timed out after ${timeoutMs} ms.`);
      } else if (error instanceof TypeError && attempt < retries) {
        lastError = new Error(`${label} network request failed: ${normalized.message}`);
      } else if (lastError !== normalized) {
        throw normalized;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`${label} request failed without a response.`);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
