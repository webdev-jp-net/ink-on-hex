import styles from './Icon.module.scss'

// Material Symbols のパス（viewBox 0 -960 960 960）
const PATH_LIST = {
  back: 'm313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z',
  undo: 'M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z',
  retry:
    'M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440h80q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720h-6l62 62-56 58-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-440q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80Z',
  trophy:
    'M280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Zm0-408v-152h-80v40q0 38 22 68.5t58 43.5Zm400 0q36-13 58-43.5t22-68.5v-40h-80v152Z',
  expand: 'M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z',
  redo: 'M396-200q-97 0-166.5-63T160-420q0-94 69.5-157T396-640h252L544-744l56-56 200 200-200 200-56-56 104-104H396q-63 0-109.5 40T240-420q0 60 46.5 100T396-280h284v80H396Z',
} as const

export type IconName = keyof typeof PATH_LIST

export const ICON_NAME_LIST = Object.keys(PATH_LIST) as IconName[]

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 -960 960 960" aria-hidden="true">
      <path d={PATH_LIST[name]} />
    </svg>
  )
}

// 掛け算の×。文字ではなく図形で描く。8pxにする
export function TimesIcon() {
  return (
    <svg className={styles.times} viewBox="0 0 8 8" aria-hidden="true">
      <path d="M1 1L7 7M7 1L1 7" />
    </svg>
  )
}

export const DROPLET_PATH = 'M20 2C20 2 2 22 2 36A18 18 0 0 0 38 36C38 22 20 2 20 2Z'

export function DropletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 56" aria-hidden="true">
      <path d={DROPLET_PATH} />
    </svg>
  )
}
