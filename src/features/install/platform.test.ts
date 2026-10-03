import { expect, test } from 'vitest'
import { installPath, iosBrowser, shouldOffer } from './platform'

const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'
const INSTA = IPHONE_SAFARI + ' Instagram 300.0'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'

const base = { standalone: false, maxTouchPoints: 5, hasPrompt: false }

test('platform paths', () => {
  expect(installPath({ ...base, ua: IPHONE_SAFARI })).toBe('ios')
  expect(installPath({ ...base, ua: IPHONE_CHROME })).toBe('ios')
  expect(installPath({ ...base, ua: IPAD })).toBe('ios')
  expect(installPath({ ...base, ua: ANDROID, hasPrompt: true })).toBe('android-prompt')
  expect(installPath({ ...base, ua: ANDROID })).toBe('android-manual')
  expect(installPath({ ...base, ua: INSTA })).toBe('in-app')
  expect(installPath({ ...base, ua: MAC, maxTouchPoints: 0 })).toBe('desktop')
  expect(installPath({ ...base, ua: IPHONE_SAFARI, standalone: true })).toBe('standalone')
})

test('ios browser naming', () => {
  expect(iosBrowser(IPHONE_SAFARI)).toBe('safari')
  expect(iosBrowser(IPHONE_CHROME)).toBe('chrome')
})

test('offer rules', () => {
  expect(shouldOffer('ios', null)).toBe(true)
  expect(shouldOffer('desktop', null)).toBe(false)
  expect(shouldOffer('standalone', null)).toBe(false)
  expect(shouldOffer('ios', 1000, 1000 + 86_400_000)).toBe(false)
  expect(shouldOffer('ios', 1000, 1000 + 15 * 86_400_000)).toBe(true)
})
