import insularObserverFactory from 'insular-observer'
import managedMapFactory from 'key-master'

export interface IOptions {
  rootMargin?: number | string
  threshold?: number | number[]
  once?: boolean
}

interface IObservedElementOptions extends IOptions {
  unobserve: () => void
}

type Listener = (entry: IntersectionObserverEntry) => void
type ObserveCallback = (target: Element, listener: Listener) => UnobserveCallback
type UnobserveCallback = () => void

const observedElements = managedMapFactory(
  () => new Map<Listener, IObservedElementOptions>(),
  new WeakMap<Element, Map<Listener, IObservedElementOptions>>(),
)
const observers = new Map<string, ObserveCallback>()

export function observe<E extends Element>(
  target: E,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
  options: IOptions = {},
): void {
  const elementCallbacks = observedElements.get(target)
  const existingConfiguration = elementCallbacks.get(callback)
  if (existingConfiguration) {
    if (areOptionsEqual(options, existingConfiguration)) {
      return
    }

    unobserve(target, callback)
  }

  const observeElement = getObserver(options)
  const unobserveCallback = observeElement(target, options.once ? onceObserver.bind(null, callback) : callback)
  elementCallbacks.set(callback, {
    ...options,
    unobserve: unobserveCallback,
  })
}

export function unobserve(
  target: Element,
  callback: (visibilityEntry: IntersectionObserverEntry) => void,
): void {
  const elementCallbacks = observedElements.getUnderlyingDataStructure().get(target)
  if (elementCallbacks) {
    const options = elementCallbacks.get(callback)
    if (options) {
      options.unobserve()
      elementCallbacks.delete(callback)
      if (!elementCallbacks.size) {
        observedElements.delete(target)
      }
    }
  }
}

function areOptionsEqual(options1: IOptions, options2: IOptions): boolean {
  return (
    options1.rootMargin === options2.rootMargin &&
    options1.threshold === options2.threshold &&
    options1.once === options2.once
  )
}

function onceObserver(callback: Listener, entry: IntersectionObserverEntry): void {
  unobserve(entry.target, callback)
  callback(entry)
}

function getObserver(options: IOptions): ObserveCallback {
  const rootMargin = typeof options.rootMargin !== 'undefined' ? options.rootMargin : '0px 0px 0px 0px'
  const normalizedRootMargin = typeof rootMargin === 'number' ? `${rootMargin}px` : rootMargin
  const threshold = typeof options.threshold !== 'undefined' ? options.threshold.toString() : 0
  const serializedOptions = `${normalizedRootMargin};${threshold};${!!options.once}`
  const observer = observers.get(serializedOptions)
  if (observer) {
    return observer
  }

  const normalizedOptions: IOptions & {rootMargin: string} = {
    ...options,
    rootMargin: normalizedRootMargin,
  }
  const newObserver = insularObserverFactory(IntersectionObserver, normalizedOptions)
  observers.set(serializedOptions, newObserver)
  return newObserver
}
