// 中身を作り変えられる選択欄（appearance: base-select）で、選んだ項目の中身を写す要素。Reactの型にまだないので足す
import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      selectedcontent: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}
