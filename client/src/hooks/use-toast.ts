/**
 * @file use-toast.ts — Toast notification system using a custom pub/sub state manager.
 *
 * This module implements a lightweight, framework-agnostic toast notification system
 * that works outside of the React component tree. Key design decisions:
 *
 * - **External state store**: Toast state lives in a module-level variable (`memoryState`)
 *   rather than React context. This allows the `toast()` function to be called from
 *   anywhere (event handlers, async callbacks, non-React code) without needing a provider.
 * - **Pub/sub pattern**: React components subscribe to state changes via `useToast()`,
 *   which registers a setState listener. When `dispatch()` is called, all subscribed
 *   components re-render with the new state.
 * - **Two-phase removal**: Dismissing a toast sets `open: false` (triggers exit animation),
 *   then after TOAST_REMOVE_DELAY the toast is fully removed from state.
 * - **TOAST_LIMIT**: Only one toast is visible at a time; new toasts push older ones out.
 *
 * Exports:
 * - `toast(props)` — Imperative function to show a toast from anywhere in the app
 * - `useToast()` — React hook that returns current toasts and control methods
 */
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// Maximum number of toasts visible simultaneously
const TOAST_LIMIT = 1
// Delay (ms) between dismissing a toast (close animation) and removing it from DOM
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

// Module-level counter for generating unique toast IDs; wraps at MAX_SAFE_INTEGER
let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

// Tracks pending removal timeouts by toast ID to prevent duplicate timers
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Schedules a toast for removal after TOAST_REMOVE_DELAY.
 * Skips if a removal timer is already pending for this toast (idempotent).
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Pure reducer function that processes toast actions and returns new state.
 * Exported for testability.
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Prepend new toast and enforce TOAST_LIMIT by slicing excess
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      // Merge partial updates into the matching toast by ID
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // Side effect: schedule removal after dismiss animation completes.
      // If no toastId is specified, dismiss ALL toasts.
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      // Set open=false to trigger the close/exit animation
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      // If no toastId, clear all toasts; otherwise filter out the specified one
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

// Subscriber list: each entry is a React setState function from a useToast() consumer
const listeners: Array<(state: State) => void> = []

// Module-level state store — lives outside React, enabling imperative toast() calls
let memoryState: State = { toasts: [] }

/**
 * dispatch — Processes an action through the reducer and notifies all subscribed
 * React components so they re-render with the updated toast state.
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

/**
 * toast — Imperative function to create and display a toast notification.
 * Can be called from anywhere (inside or outside React components).
 * Returns an object with `id`, `dismiss`, and `update` methods for controlling the toast.
 */
function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      // Auto-dismiss when the toast's open state changes (e.g., user closes it)
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * useToast — React hook that subscribes to the toast state store.
 * Registers a setState listener on mount and unregisters on unmount.
 * Returns the current list of toasts plus `toast` and `dismiss` functions.
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    // Subscribe this component's setState to the pub/sub listener list
    listeners.push(setState)
    return () => {
      // Cleanup: remove this component's listener on unmount
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
