import React from 'react'
interface Props {
  text: string
  onActivate: () => void
}
export const FlatButton: React.FC<Props> = (props) => {
  const { text, onActivate } = props
  return (
    <span className="flat-cta" role="button" tabIndex={0} onClick={onActivate}>
      {text}
    </span>
  )
}
