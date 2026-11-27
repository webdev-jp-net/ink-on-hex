// 色はCSS変数（src/styles/index.scss）を正とし、JSはそれを読む
import { cssToken } from './cssToken'

const cache = new Map<string, [number, number, number]>()

// '#ebebeb' / '#fff' → [235, 235, 235]
export function rgbToken(name: string): [number, number, number] {
  let channelList = cache.get(name)
  if (!channelList) {
    const value = cssToken(name)
    const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
    if (!hex) throw new Error('色のCSS変数が読めません: ' + name + '=' + value)
    const full = hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex
    channelList = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number]
    cache.set(name, channelList)
  }
  return channelList
}

// まだ色のない点やしずくの色（背景色を白に寄せた色）
export function uncoloredRGB(): [number, number, number] {
  return rgbToken('--bg-basic').map(channel => Math.round(channel + (255 - channel) * 0.55)) as [
    number,
    number,
    number,
  ]
}
