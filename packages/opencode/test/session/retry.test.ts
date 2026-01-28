import { describe, expect, test } from "bun:test"
import { SessionRetry } from "../../src/session/retry"
import { MessageV2 } from "../../src/session/message-v2"

function apiError(headers?: Record<string, string>): MessageV2.APIError {
  return new MessageV2.APIError({
    message: "boom",
    isRetryable: true,
    responseHeaders: headers,
  }).toObject() as MessageV2.APIError
}

describe("session.retry.delay", () => {
  // The backoff schedule is: [10000, 10000, 10000, 15000, 15000]
  // After 5 attempts, delay returns undefined (stop retrying)

  test("follows fixed backoff schedule when no headers", () => {
    const error = apiError()
    const delays = Array.from({ length: 7 }, (_, index) => SessionRetry.delay(index + 1, error))
    expect(delays).toStrictEqual([10000, 10000, 10000, 15000, 15000, undefined, undefined])
  })

  test("uses retry-after-ms when shorter than base delay", () => {
    const error = apiError({ "retry-after-ms": "1500" })
    expect(SessionRetry.delay(1, error)).toBe(1500)
  })

  test("caps retry-after-ms at base delay", () => {
    // retry-after-ms: 20000, but base delay at attempt 1 is 10000
    const error = apiError({ "retry-after-ms": "20000" })
    expect(SessionRetry.delay(1, error)).toBe(10000)
  })

  test("uses retry-after seconds when shorter than base delay", () => {
    // retry-after: 5 = 5000ms, base delay at attempt 1 is 10000
    const error = apiError({ "retry-after": "5" })
    expect(SessionRetry.delay(1, error)).toBe(5000)
  })

  test("caps retry-after seconds at base delay", () => {
    // retry-after: 30 = 30000ms, but base delay at attempt 3 is 10000
    const error = apiError({ "retry-after": "30" })
    expect(SessionRetry.delay(3, error)).toBe(10000)
  })

  test("accepts http-date retry-after values when shorter than base delay", () => {
    // Date 5 seconds in future, base delay at attempt 1 is 10000
    const date = new Date(Date.now() + 5000).toUTCString()
    const error = apiError({ "retry-after": date })
    const d = SessionRetry.delay(1, error)
    expect(d).toBeGreaterThanOrEqual(4000)
    expect(d).toBeLessThanOrEqual(5000)
  })

  test("caps http-date retry-after at base delay", () => {
    // Date 20 seconds in future, base delay at attempt 1 is 10000
    const date = new Date(Date.now() + 20000).toUTCString()
    const error = apiError({ "retry-after": date })
    expect(SessionRetry.delay(1, error)).toBe(10000)
  })

  test("falls back to base delay for invalid retry hints", () => {
    const error = apiError({ "retry-after": "not-a-number" })
    expect(SessionRetry.delay(1, error)).toBe(10000)
  })

  test("falls back to base delay for malformed date retry hints", () => {
    const error = apiError({ "retry-after": "Invalid Date String" })
    expect(SessionRetry.delay(1, error)).toBe(10000)
  })

  test("falls back to base delay for past date retry hints", () => {
    const pastDate = new Date(Date.now() - 5000).toUTCString()
    const error = apiError({ "retry-after": pastDate })
    expect(SessionRetry.delay(1, error)).toBe(10000)
  })

  test("returns undefined after max retries", () => {
    const error = apiError()
    expect(SessionRetry.delay(6, error)).toBeUndefined()
    expect(SessionRetry.delay(10, error)).toBeUndefined()
  })

  test("respects RETRY_MAX_DELAY cap", () => {
    expect(SessionRetry.RETRY_MAX_DELAY).toBe(60000)
  })
})
