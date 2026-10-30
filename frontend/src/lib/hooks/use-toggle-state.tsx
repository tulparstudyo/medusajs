import { useCallback, useState } from "react"

export type StateType = [boolean, () => void, () => void, () => void] & {
  state: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

/**
 *
 * @param initialState - boolean
 * @returns An array like object with `state`, `open`, `close`, and `toggle` properties
 *  to allow both object and array destructuring
 *
 * ```
 *  const [showModal, openModal, closeModal, toggleModal] = useToggleState()
 *  // or
 *  const { state, open, close, toggle } = useToggleState()
 * ```
 */

const useToggleState = (initialState = false) => {
  const [state, setState] = useState<boolean>(initialState)

  const close = useCallback(() => {
    setState(false)
  }, [])

  const open = useCallback(() => {
    setState(true)
  }, [])

  const toggle = useCallback(() => {
    setState((state) => !state)
  }, [])

  const hookData = [state, open, close, toggle] as StateType
  hookData.state = state
  hookData.open = open
  hookData.close = close
  hookData.toggle = toggle
  return hookData
}

export default useToggleState
